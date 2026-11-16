// Supabase 연결 정보
// 1) 아래 두 값을 채우면 그대로 쓴다 (Vercel에 올릴 때 권장)
// 2) 비어 있으면 첫 화면에서 입력받아 이 기기에 저장한다
//    anon key는 공개돼도 되는 키다. service_role 키는 절대 넣지 말 것
export const SUPABASE_URL = 'https://lxhnsovfxgabyvylljqb.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Fm-kiXfb_1xlF538qx5C5Q_Qb0Cb3_7';

const CKEY = 'chukgu.config';

export function getConfig() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return { url: SUPABASE_URL.replace(/\/$/, ''), key: SUPABASE_ANON_KEY };
  try {
    const c = JSON.parse(localStorage.getItem(CKEY) || 'null');
    if (c && c.url && c.key) return c;
  } catch { /* 저장소를 못 쓰면 설정 화면으로 */ }
  return null;
}

export function saveConfig(url, key) {
  const c = { url: url.trim().replace(/\/$/, ''), key: key.trim() };
  try { localStorage.setItem(CKEY, JSON.stringify(c)); } catch { /* 무시 */ }
  return c;
}

export function clearConfig() {
  try { localStorage.removeItem(CKEY); } catch { /* 무시 */ }
}

export const configEditable = !(SUPABASE_URL && SUPABASE_ANON_KEY);
