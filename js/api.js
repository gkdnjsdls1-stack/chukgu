// Supabase REST/Auth 를 라이브러리 없이 직접 부르는 작은 클라이언트
// - 인증: /auth/v1 (이메일+비밀번호)
// - 데이터: /rest/v1 (PostgREST). 쓰기는 전부 RPC(서버 함수)로만 한다
import { getConfig } from './config.js';

const SKEY = 'chukgu.session';
let session = null;
try { session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch { session = null; }

function saveSession(s) {
  session = s;
  try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch { /* 저장 못 해도 이번 접속은 동작 */ }
}

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

function decodeJwt(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(part).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  } catch { return {}; }
}

function base() {
  const c = getConfig();
  if (!c) throw new ApiError('Supabase 설정이 없습니다', 0);
  return c;
}

async function parse(res) {
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = (body && (body.message || body.msg || body.error_description || body.error)) || `요청 실패 (${res.status})`;
    throw new ApiError(translate(msg), res.status, body && body.code);
  }
  return body;
}

// 자주 나오는 영어 오류를 한국어로
function translate(msg) {
  const m = String(msg);
  if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요';
  if (/User already registered/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요';
  if (/Password should be at least/i.test(m)) return '비밀번호는 6자 이상이어야 해요';
  if (/Email not confirmed/i.test(m)) return '이메일 확인이 아직 안 됐어요. 메일함의 확인 링크를 눌러 주세요';
  if (/duplicate key.*nickname/i.test(m)) return '이미 누가 쓰고 있는 닉네임이에요';
  if (/duplicate key.*profiles_pkey/i.test(m)) return '이미 가입을 마친 계정이에요';
  if (/JWT expired/i.test(m)) return '로그인이 만료됐어요. 다시 로그인해 주세요';
  if (/Failed to fetch|NetworkError/i.test(m)) return '인터넷 연결을 확인해 주세요';
  return m;
}

async function authPost(path, body) {
  const { url, key } = base();
  const res = await fetch(`${url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(e => { throw new ApiError(translate(e.message), 0); });
  return parse(res);
}

function storeAuth(r) {
  if (!r || !r.access_token) return false;
  saveSession({
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600),
    user_id: (r.user && r.user.id) || decodeJwt(r.access_token).sub,
    email: (r.user && r.user.email) || decodeJwt(r.access_token).email,
  });
  return true;
}

export const auth = {
  get session() { return session; },
  get userId() { return session && session.user_id; },
  async signUp(email, password) {
    const r = await authPost('signup', { email, password });
    if (storeAuth(r)) return { signedIn: true };
    if (r && r.session && storeAuth(r.session)) return { signedIn: true };
    return { signedIn: false };   // 이메일 확인이 켜져 있으면 세션 없이 돌아옴
  },
  async signIn(email, password) {
    const r = await authPost('token?grant_type=password', { email, password });
    storeAuth(r);
  },
  async refresh() {
    if (!session || !session.refresh_token) throw new ApiError('로그인이 필요해요', 401);
    try {
      const r = await authPost('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      storeAuth(r);
    } catch (e) { saveSession(null); throw e; }
  },
  async signOut() {
    try {
      const { url, key } = base();
      if (session) await fetch(`${url}/auth/v1/logout`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${session.access_token}` } });
    } catch { /* 로그아웃은 실패해도 로컬 세션만 지우면 됨 */ }
    saveSession(null);
  },
};

async function token() {
  if (!session) return null;
  if (session.expires_at - 60 < Date.now() / 1000) await auth.refresh();
  return session.access_token;
}

async function rest(method, path, body, retry = true) {
  const { url, key } = base();
  const t = await token();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    // 새 publishable 키(sb_publishable_...)는 JWT가 아니라서 Authorization에 넣지 않는다.
    // 로그인 전에는 apikey만, 로그인 뒤에는 사용자 토큰을 Bearer로 보낸다
    headers: Object.assign({ apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
      t ? { Authorization: `Bearer ${t}` } : (key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {})),
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(e => { throw new ApiError(translate(e.message), 0); });
  if (res.status === 401 && retry && session) {
    await auth.refresh();
    return rest(method, path, body, false);
  }
  return parse(res);
}

// 서버 함수 호출: rpc('start_lesson', { p_unit: 1 })
export const rpc = (fn, args = {}) => rest('POST', `rpc/${fn}`, args);
// 읽기: select('profiles', 'id=eq.xxx&select=*')
export const select = (table, query = 'select=*') => rest('GET', `${table}?${query}`);
