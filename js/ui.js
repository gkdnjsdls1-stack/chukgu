// 화면 그리기 도우미
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);

export function mount(html) {
  const app = $('#app');
  app.innerHTML = html;
  window.scrollTo(0, 0);
  return app;
}

export const spinner = () => mount('<div class="spin" role="status" aria-label="불러오는 중"><i></i></div>');

let toastTimer;
export function toast(msg, isError = false) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' err' : '');
  el.setAttribute('role', isError ? 'alert' : 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), isError ? 4500 : 2500);
}

// 버튼을 누르는 동안 잠그고, 오류는 토스트로
export function action(btn, fn) {
  if (!btn) return;
  btn.addEventListener('click', async e => {
    e.preventDefault();
    if (btn.disabled) return;
    btn.disabled = true;
    try { await fn(e); } catch (err) { console.error(err); toast(err.message || '문제가 생겼어요', true); }
    finally { if (btn.isConnected) btn.disabled = false; }
  });
}

export function sheet(html, cls = '') {
  const el = document.createElement('div');
  el.className = 'sheet ' + cls;
  el.innerHTML = `<div role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(el);
  return { el, close: () => el.remove() };
}

export const go = hash => { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; };

export const top = (title, { back = null, right = '' } = {}) =>
  `<header class="top">${back ? `<button class="back" aria-label="뒤로" data-back="${esc(back)}">‹</button>` : ''}<div class="grow">${title}</div>${right}</header>`;

export function bindBack(root) {
  $$('[data-back]', root).forEach(b => b.addEventListener('click', () => go(b.dataset.back)));
}

const ICONS = {
  train: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4l3.5 2.5-1.3 4h-4.4l-1.3-4z" fill="currentColor"/>',
  tactics: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 5v14M3 12h3M18 12h3" stroke="currentColor" stroke-width="2"/>',
  quest: '<path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  profile: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6" fill="none" stroke="currentColor" stroke-width="2"/>',
  shop: '<path d="M4 8h16l-1 12H5zM8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="2"/>',
  admin: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2"/>',
};
let adminMode = false;
export const setAdmin = v => { adminMode = !!v; };
export function tabs(active) {
  const items = [['train', '#/', '훈련'], ['tactics', '#/tactics', '전술'], ['quest', '#/quests', '퀘스트'], ['profile', '#/profile', '프로필'], ['shop', '#/shop', '상점']];
  if (adminMode) items.push(['admin', '#/admin', '관리']);
  return `<nav class="tabs" aria-label="메뉴">${items.map(([k, h, l]) =>
    `<a href="${h}" class="${k === active ? 'on' : ''}" ${k === active ? 'aria-current="page"' : ''} ${k === 'admin' ? 'style="color:' + (k === active ? 'var(--ps)' : '#9b87f5') + '"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>${l}</a>`).join('')}</nav>`;
}

export const BALL = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#3c3c3c" stroke-width="2"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z" fill="#3c3c3c"/></svg>';
export const BOLT = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="#ffc800" stroke="#e0a800" stroke-width="1.5" stroke-linejoin="round"/></svg>';
export const FIRE = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 1-3 0-5 0-8z" fill="#ff9600"/></svg>';

export const BAND_LABEL = { adult: '중학생 이상', elem_high: '초등 고학년 (4~6)', elem_low: '초등 저학년 (1~3)' };
export const DAY = ['일', '월', '화', '수', '목', '금', '토'];

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const same = d.toDateString() === now.toDateString();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (same) return `오늘 ${hm}`;
  if (d.toDateString() === y.toDateString()) return `어제 ${hm}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hm}`;
}

// 카운트다운 타이머 (워밍업·스트레칭). 남은 초를 el에 그리고 끝나면 onDone
export function countdown(el, seconds, onDone) {
  let left = seconds;
  const draw = () => { el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };
  draw();
  const id = setInterval(() => {
    if (!el.isConnected) return clearInterval(id);
    left -= 1; draw();
    if (left <= 0) { clearInterval(id); onDone(); }
  }, 1000);
  return () => clearInterval(id);
}
