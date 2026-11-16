// 앱 시작·라우터·로그인/가입 화면
import { getConfig, saveConfig, clearConfig, configEditable } from './config.js';
import { auth, rpc, select } from './api.js';
import { $, esc, mount, spinner, toast, action, go, top, bindBack, BAND_LABEL } from './ui.js';
import * as P from './player.js';
import * as A from './admin.js';

export const state = { me: null };

export async function loadMe() {
  if (!auth.userId) { state.me = null; return null; }
  const rows = await select('profiles', `id=eq.${auth.userId}&select=*`);
  state.me = rows[0] || null;
  return state.me;
}

// ---------------------------------------------------------------- 설정
function screenSetup() {
  const app = mount(`${top('처음 설정')}
  <div class="page">
    <h1>Supabase 연결 정보를 넣어요</h1>
    <p class="sub">Supabase 대시보드 → Project Settings → API에서 복사해요. 한 번만 넣으면 이 기기에 저장돼요.</p>
    <div class="field"><label for="u">Project URL</label><input id="u" placeholder="https://xxxx.supabase.co" autocomplete="off"></div>
    <div class="field"><label for="k">anon public key</label><input id="k" placeholder="eyJ..." autocomplete="off"></div>
    <div class="note y">service_role 키는 넣지 마세요. anon 키만 써요.</div>
  </div>
  <div class="foot"><button class="btn" id="save">저장</button></div>`);
  action($('#save', app), async () => {
    const u = $('#u').value.trim(), k = $('#k').value.trim();
    if (!/^https?:\/\//.test(u) || k.length < 20) throw new Error('URL과 키를 확인해 주세요');
    saveConfig(u, k);
    go('#/login');
  });
}

// ---------------------------------------------------------------- 로그인
function screenLogin(mode = 'in') {
  const isUp = mode === 'up';
  const app = mount(`${top(isUp ? '회원가입' : '로그인')}
  <div class="page">
    <div class="center" style="padding-top:28px"><img src="icon.svg" width="72" height="72" alt=""><div class="t" style="color:var(--g)">축구</div><div class="sub" style="margin:0">매일 조금씩, 공이랑 친해지기</div></div>
    <div class="field"><label for="em">이메일</label><input id="em" type="email" autocomplete="email" inputmode="email"></div>
    <div class="field"><label for="pw">비밀번호 (6자 이상)</label><input id="pw" type="password" autocomplete="${isUp ? 'new-password' : 'current-password'}"></div>
  </div>
  <div class="foot">
    <button class="btn" id="go">${isUp ? '가입하기' : '로그인'}</button>
    <button class="ghost" id="sw">${isUp ? '이미 계정이 있어요 · 로그인' : '처음이에요 · 회원가입'}</button>
    ${configEditable ? '<button class="ghost" id="cfg" style="color:#999;font-size:13px">연결 설정 바꾸기</button>' : ''}
  </div>`);
  $('#sw', app).addEventListener('click', () => screenLogin(isUp ? 'in' : 'up'));
  const cfg = $('#cfg', app);
  if (cfg) cfg.addEventListener('click', () => { clearConfig(); go('#/setup'); });
  action($('#go', app), async () => {
    const em = $('#em').value.trim(), pw = $('#pw').value;
    if (!em || pw.length < 6) throw new Error('이메일과 6자 이상 비밀번호를 넣어 주세요');
    if (isUp) {
      const r = await auth.signUp(em, pw);
      if (!r.signedIn) { toast('메일함의 확인 링크를 누른 뒤 로그인해 주세요'); screenLogin('in'); return; }
    } else {
      await auth.signIn(em, pw);
    }
    await route();
  });
}

// ---------------------------------------------------------------- 가입 (프로필)
function screenRegister() {
  const now = new Date();
  const years = []; for (let y = now.getFullYear() - 5; y >= now.getFullYear() - 70; y--) years.push(y);
  const app = mount(`${top('가입하기')}
  <div class="page">
    <h1>나를 소개해요</h1>
    <div class="field"><label for="nick">닉네임</label><input id="nick" maxlength="12" autocomplete="off"></div>
    <div class="hint" id="nickhint">한글·영문·숫자 2~12자 · 실명·전화번호·욕설은 쓸 수 없어요</div>
    <div style="display:flex;gap:10px;margin:0 20px 12px">
      <div class="field" style="margin:0;flex:1"><label for="yy">태어난 해</label><select id="yy">${years.map(y => `<option ${y === now.getFullYear() - 10 ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
      <div class="field" style="margin:0;flex:1"><label for="mm">월</label><select id="mm">${Array.from({ length: 12 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="code">관리자 초대 코드 (6자리)</label><input id="code" maxlength="6" autocomplete="off" style="text-transform:uppercase;letter-spacing:4px"></div>
    <div class="hint">관리자(코치)에게 받은 코드를 넣어요. 관리자 본인은 비워 두세요.</div>
    <div class="note s">받는 정보는 닉네임과 태어난 연월뿐이에요. 실명·사진·연락처는 받지 않아요.</div>
  </div>
  <div class="foot"><button class="btn" id="ok">가입 신청</button><button class="ghost" id="out" style="color:#999">로그아웃</button></div>`);
  const birth = () => `${$('#yy').value}-${String($('#mm').value).padStart(2, '0')}-01`;
  let t;
  const check = () => {
    clearTimeout(t);
    const v = $('#nick').value.trim(), h = $('#nickhint');
    if (v.length < 2) { h.className = 'hint'; h.textContent = '한글·영문·숫자 2~12자 · 실명·전화번호·욕설은 쓸 수 없어요'; return; }
    t = setTimeout(async () => {
      try {
        const r = await rpc('check_nickname', { p_nickname: v, p_birth_ym: birth() });
        if ($('#nick').value.trim() !== v) return;
        h.className = 'hint ' + (r.ok ? 'ok' : 'bad');
        h.textContent = r.ok ? '쓸 수 있는 닉네임이에요' : r.reason;
      } catch { /* 검사 실패는 가입 때 다시 걸러짐 */ }
    }, 350);
  };
  $('#nick').addEventListener('input', check);
  $('#yy').addEventListener('change', check); $('#mm').addEventListener('change', check);
  $('#out', app).addEventListener('click', async () => { await auth.signOut(); go('#/login'); });
  action($('#ok', app), async () => {
    const nick = $('#nick').value.trim(), code = $('#code').value.trim().toUpperCase();
    if (nick.length < 2) throw new Error('닉네임을 넣어 주세요');
    if (code && code.length !== 6) throw new Error('초대 코드는 6자리예요');
    await rpc('register_profile', { p_nickname: nick, p_birth_ym: birth(), p_coach_code: code || null });
    await loadMe();
    go('#/wait');
  });
}

// ---------------------------------------------------------------- 승인 대기
function screenWait() {
  const me = state.me;
  const noCoach = !me.coach_id;
  const app = mount(`${top('승인 기다리는 중')}
  <div class="page">
    <div class="center"><div style="width:110px;height:110px;border-radius:50%;background:var(--ol);display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:800;color:var(--od)">${esc(me.nickname[0])}</div>
    <div class="t">${esc(me.nickname)}</div>
    <div class="sub" style="margin:0">${esc(BAND_LABEL[me.age_band])}</div></div>
    ${noCoach
      ? `<div class="note p">관리자 계정이 되려면 Supabase SQL Editor에서 아래를 한 번 실행해 주세요.<br><code style="font-size:13px">select public.make_admin('${esc(me.nickname)}');</code></div>
         <div class="note s">아이라면 로그아웃 후 다른 계정으로, 또는 관리자에게 초대 코드를 받아 다시 가입해 주세요.</div>`
      : `<div class="note o">관리자가 승인하면 바로 훈련을 시작할 수 있어요.</div>`}
  </div>
  <div class="foot"><button class="btn" id="re">다시 확인</button><button class="ghost" id="out" style="color:#999">로그아웃</button></div>`);
  action($('#re', app), async () => { await loadMe(); if (state.me.status === 'pending_consent') toast('아직 승인 전이에요'); route(); });
  $('#out', app).addEventListener('click', async () => { await auth.signOut(); go('#/login'); });
}

// ---------------------------------------------------------------- 라우터
export async function route() {
  const hash = location.hash || '#/';
  if (!getConfig()) { if (hash !== '#/setup') return go('#/setup'); return screenSetup(); }
  if (hash === '#/setup') return screenSetup();
  if (!auth.session) return screenLogin();
  spinner();
  try {
    if (!state.me || hash === '#/' || hash === '#/admin') await loadMe();
  } catch (e) {
    if (e.status === 401) { await auth.signOut(); return screenLogin(); }
    return mount(`${top('연결 오류')}<div class="page"><div class="note r">${esc(e.message)}</div></div><div class="foot"><button class="btn" onclick="location.reload()">다시 시도</button></div>`);
  }
  const me = state.me;
  if (!me) return screenRegister();
  if (me.status === 'pending_consent') return screenWait();
  if (me.status === 'suspended') return mount(`${top('이용 정지')}<div class="page"><div class="note r">관리자에게 문의해 주세요.</div></div>`);

  const parts = hash.slice(2).split('/');   // '#/lesson/1' -> ['lesson','1']
  try {
    if (me.role === 'admin') {
      if (parts[0] === 'admin' && parts[1] === 'p' && parts[2]) return await A.player(parts[2], parts[3] || 'lessons');
      return await A.home();
    }
    switch (parts[0]) {
      case '': return await P.home();
      case 'placement': return await P.placement();
      case 'lesson': return await P.lesson(+parts[1]);
      case 'check': return await P.check(+parts[1]);
      case 'tactics': return await P.tactics();
      case 'quiz': return await P.quiz(parts[1] === 'check');
      case 'quests': return await P.quests();
      case 'profile': return await P.profile();
      case 'comments': return await P.comments();
      case 'shop': return await P.shop();
      default: return go('#/');
    }
  } catch (e) {
    console.error(e);
    mount(`${top('문제가 생겼어요', { back: '#/' })}<div class="page"><div class="note r" style="margin-top:20px">${esc(e.message)}</div></div><div class="foot"><button class="btn" id="home">처음으로</button></div>`);
    bindBack($('#app'));
    $('#home').addEventListener('click', () => go('#/'));
  }
}

export async function logout() { await auth.signOut(); state.me = null; go('#/login'); }

window.addEventListener('hashchange', route);
route();
