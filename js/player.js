// 아이(선수) 화면
import { rpc, select, auth } from './api.js';
import { state, loadMe, logout } from './app.js';
import { $, $$, esc, mount, toast, action, sheet, go, top, bindBack, tabs, countdown, fmtDate,
         BALL, BOLT, FIRE, BAND_LABEL, DAY } from './ui.js';

const UNIT_COLOR = { 1: '#58cc02', 2: '#2fb5a0', 3: '#1cb0f6', 4: '#ff9600', 5: '#e05a9b', 6: '#ff7a3c', 7: '#1cb0f6', 8: '#7a5af8' };
const ITEM_HINT = {   // 배치·승급 측정 방법 (기획서)
  1: '제자리에서 양발 안쪽으로 좌우 터치, 30초 동안 횟수',
  2: '벽에 차서 돌아온 공을 멈추기, 10번 중 성공 수',
  3: '표적에 20번 중 맞힌 수 (양발 각 10번)',
  4: '콘 5개(1.5m 간격) 왕복 시간, 콘을 건드리면 +1초',
  5: '3번 시도 중 가장 많이 한 연속 횟수',
  6: '멈춘 공 10번 중 골대에 들어간 수',
  7: '버틴 가장 긴 시간',
  8: '2m 간격 두 선을 30초 동안 번갈아 터치한 횟수',
};
const COND = {   // 연령별 측정 조건 (정확도 종목)
  2: { adult: '공이 발 1m 안에 멈추면 성공', elem_high: '발 1.5m 안', elem_low: '발 2m 안' },
  3: { adult: '거리 3m · 표적 폭 1m', elem_high: '2.5m · 1.2m', elem_low: '2m · 1.5m' },
  6: { adult: '거리 6m · 골대 폭 2m', elem_high: '5m · 2.5m', elem_low: '3m · 3m' },
};
const PART_NAME = { 5: '리프팅 연속(회)', 6: '슈팅 골 (10번 중)', 7: '플랭크(초)', 8: '사이드스텝 30초(회)', 1: '인사이드 터치 30초(회)', 2: '트래핑 (10번 중)', 3: '벽 패스 (20번 중)', 4: '콘 드리블 왕복(초)' };

let cache = {};
async function ref(key, table, query) {
  if (!cache[key]) cache[key] = await select(table, query);
  return cache[key];
}
const units = () => ref('units', 'units', 'select=*&order=id');
const skills = () => ref('skills', 'skills', 'select=*&order=sort');
const testItems = () => ref('items', 'test_items', 'select=*&order=id');

const me = () => state.me;
const band = () => me().age_band;
const isElem = () => me().age_band !== 'adult';
const todayDow = () => new Date().getDay();

// ------------------------------------------------------------------ 미션 기준
const tval = (t, b) => (t[b] ?? t.adult);
function targetText(t, b) {
  if (!t || !t.metric) return '';
  if (t.metric === 'multi') return t.parts.map(p => `${PART_NAME[p.test_item] || ''} ${partGoal(p, b)}`).join(' + ');
  return partGoal(t, b) + (t.sets ? ` × ${t.sets}세트` : '');
}
function partGoal(t, b) {
  const v = tval(t, b);
  if (t.metric === 'done') return '해내기';
  if (v == null) return '';
  if (t.metric === 'seconds') return t.lower_is_better ? `${v}초 이내` : `${v}초`;
  return t.out_of ? `${t.out_of}번 중 ${v}번` : `${v}번`;
}
function judge(t, b, vals) {
  if (t.metric === 'multi') return t.parts.every((p, i) => judgeOne(p, b, vals[i]));
  return judgeOne(t, b, vals[0]);
}
function judgeOne(t, b, v) {
  v = Number(v);
  if (!isFinite(v)) return false;
  if (t.metric === 'done') return v >= 1;
  const goal = tval(t, b);
  if (goal == null) return v > 0;
  if (t.lower_is_better) return v > 0 && v <= goal;
  return v >= goal;
}

// ------------------------------------------------------------------ 공통
function statsBar(energy, overall) {
  const m = me();
  return `<div class="stats">
    <span class="chip" style="background:var(--gl);color:var(--gd)">${overall == null ? '배치 전' : `Lv.${Math.min(5, Math.floor(overall / 20) + 1)} · ${Math.round(overall)}점`}</span>
    <span style="color:#e07800">${FIRE}${m.current_streak}일</span>
    <span>${BALL}${m.balls}</span>
    <span style="color:#a07000">${BOLT}${energy ? `${energy.energy}/${energy.daily}` : m.energy}</span>
    <span style="color:var(--bs)" title="휴식권">휴식권 ${m.rest_tickets}</span></div>`;
}

function energyScreen(msg) {
  const adult = !isElem();
  const app = mount(`${top('에너지', { back: '#/' })}
  <div class="page"><div class="center"><div style="width:110px;height:110px;border-radius:50%;background:var(--yl);display:flex;align-items:center;justify-content:center"><svg width="64" height="64" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="#ffc800" stroke="#e0a800" stroke-width="1.2" stroke-linejoin="round"/></svg></div>
  <div class="t" style="color:#c99600">에너지를 다 썼어요</div><div class="sub" style="margin:0">${esc(msg || '')}<br>하던 레슨은 저장됐어요. 충전되면 이어서 해요.</div></div>
  <div class="note y">매일 0시에 ⚡${isElem() ? 8 : 12}까지 충전 · 미션 모두 성공 +⚡2 · 7일 연속 +⚡4 · 보물상자 +⚡4</div></div>
  <div class="foot">${adult ? '<button class="btn y" id="buy">축구공 30개로 ⚡4 채우기</button>' : ''}<button class="ghost" id="home">내일 할게요</button></div>`);
  $('#home', app).addEventListener('click', () => go('#/'));
  action($('#buy', app), async () => { await rpc('buy_item', { p_code: 'energy_refill' }); await loadMe(); toast('⚡4 채웠어요'); history.back(); });
}

function handleErr(e) {
  if (/에너지가 부족/.test(e.message)) { energyScreen(e.message); return true; }
  return false;
}

// ------------------------------------------------------------------ 홈
export async function home() {
  const uid = auth.userId;
  const [energy, prog, us, scores, open, unread] = await Promise.all([
    rpc('my_energy'),
    select('unit_progress', `user_id=eq.${uid}&select=*`),
    units(),
    select('current_skill_scores', `user_id=eq.${uid}&select=*`),
    select('lessons', `user_id=eq.${uid}&completed_at=is.null&select=unit_id,stage`),
    select('lesson_comments', 'read_at=is.null&select=id'),
  ]);
  const sk = await skills();
  await loadMe();
  const inOverall = new Set(sk.filter(s => s.in_overall).map(s => s.code));
  const ov = scores.filter(s => inOverall.has(s.skill_code));
  const overall = ov.length === 6 ? ov.reduce((a, s) => a + Number(s.score), 0) / 6 : null;
  const P = Object.fromEntries(prog.map(p => [p.unit_id, p]));
  const body = us.filter(u => u.kind === 'body');
  const score = Object.fromEntries(scores.map(s => [s.skill_code, Number(s.score)]));

  if (overall == null) {
    const app = mount(`${statsBar(energy, null)}
    <div class="page"><div class="center"><img src="icon.svg" width="90" height="90" alt=""><div class="t">반가워요, ${esc(me().nickname)}!</div>
    <div class="sub" style="margin:0">먼저 배치 테스트 8종목(약 15분)으로<br>지금 실력을 재고 시작 위치를 정해요.</div></div>
    <div class="note s">준비물: 축구공, 벽, 콘 5개(페트병 OK), 2m를 잴 줄자나 걸음</div></div>
    <div class="foot"><button class="btn" id="pl">배치 테스트 시작</button></div>${tabs('train')}`);
    $('#pl', app).addEventListener('click', () => go('#/placement'));
    return;
  }

  // 오늘 고를 유닛: 진행 중 레슨 > 저장한 선택 > 요일 루틴 > 가장 낮은 스킬
  let sel = open[0] && open[0].unit_id;
  if (!sel) { try { sel = +localStorage.getItem('chukgu.unit') || 0; } catch { sel = 0; } }
  if (!sel || !body.find(u => u.id === sel) || (P[sel] && P[sel].current_stage > 4)) {
    const dow = todayDow();
    const live = body.filter(u => !P[u.id] || P[u.id].current_stage <= 4);
    if (dow === 2 && live.find(u => u.id === 6)) sel = 6;
    else if (dow === 4 && live.find(u => u.id === 8)) sel = 8;
    else sel = (live.filter(u => u.id <= 5).sort((a, b) => (score[a.skill_code] ?? 0) - (score[b.skill_code] ?? 0))[0] || live[0] || body[0]).id;
  }
  const su = body.find(u => u.id === sel);
  const sp = P[sel] || { current_stage: 1, lessons_in_stage: 0 };
  const isOpen = open.some(o => o.unit_id === sel);
  const graduated = sp.current_stage > 4;
  const sunday = todayDow() === 0;
  const partnerCheck = sel === 8 && sp.current_stage >= 3;
  const routine = ['오늘은 쉬는 날이에요. 전술 퀴즈는 할 수 있어요', '주력 유닛 레슨 날', '체력·민첩 + 전술 연습 세트 날', '주력 유닛 레슨 날', '수비(또는 복습) + 전술 연습 세트 날', '주력 레슨 + 승급 체크 날', '관리자와 함께 하는 날 (1대1·미니게임)'][todayDow()];
  const weakest = [...ov].sort((a, b) => a.score - b.score)[0];
  const weakName = weakest && (sk.find(s => s.code === weakest.skill_code) || {}).name;

  let main = '';
  if (graduated) main = '<div class="note g" style="margin:12px 0 0">이 유닛은 졸업했어요! 다른 유닛을 골라요</div>';
  else if (sunday) main = '<button class="btn" disabled>일요일은 몸 훈련 쉬는 날</button>';
  else if (isOpen) main = `<button class="btn" id="go">이어하기</button>`;
  else if (sp.lessons_in_stage >= 2 && !partnerCheck) main = `<button class="btn" id="chk">승급 체크 하기</button><button class="ghost" id="go" style="color:#fff">레슨 한 번 더 · ⚡${sel === 8 && sp.current_stage >= 3 ? (sp.current_stage === 3 ? 3 : 2) : 4}</button>`;
  else main = `<button class="btn" id="go">레슨 시작 · ⚡${sel === 8 && sp.current_stage >= 3 ? (sp.current_stage === 3 ? 3 : 2) : 4}</button>`;

  const app = mount(`${statsBar(energy, overall)}
  <div class="page">
    ${unread.length ? `<a href="#/comments" class="note p" style="display:block;margin-top:12px;text-decoration:none">관리자 코멘트 ${unread.length}개가 왔어요 · 보러 가기 ›</a>` : ''}
    <div class="hero" style="background:${UNIT_COLOR[sel]}">
      <div class="k">유닛 ${sel} · ${graduated ? '졸업' : `스테이지 ${sp.current_stage} · 레슨 ${Math.min(sp.lessons_in_stage, 2)}/2`}</div>
      <div class="n">${esc(su.title)}</div>
      <div class="d">${graduated ? 'Lv.5 달성' : `목표 Lv.${sp.current_stage} → Lv.${sp.current_stage + 1}`}</div>
      ${partnerCheck && sp.lessons_in_stage >= 2 ? '<div class="note p" style="margin:10px 0 0">이 스테이지 승급 체크는 관리자와 1대1로 하고 관리자가 기록해요</div>' : ''}
      <div style="margin-top:6px">${main}</div>
    </div>
    <div class="note o" style="margin-top:10px">오늘(${DAY[todayDow()]}): ${routine}${weakName ? ` · 약점: ${esc(weakName)}` : ''}</div>
    <h2>유닛 고르기</h2>
    ${body.map(u => {
      const p = P[u.id] || { current_stage: 1, lessons_in_stage: 0 };
      const lv = Math.min(p.current_stage, 5);
      return `<button class="unit ${u.id === sel ? 'sel' : ''}" data-unit="${u.id}"><div class="ic" style="background:${p.current_stage > 4 ? '#c9c9c9' : UNIT_COLOR[u.id]}">${u.id}</div>
        <div class="grow"><div class="nm">${esc(u.title)}</div><div class="ds">${p.current_stage > 4 ? '졸업 · Lv.5' : `스테이지 ${p.current_stage} · Lv.${lv}${score[u.skill_code] != null && u.id <= 6 ? ` · ${Math.round(score[u.skill_code])}점` : ''}`}</div></div>
        ${open.some(o => o.unit_id === u.id) ? '<span class="chip" style="background:var(--gl);color:var(--gd)">진행 중</span>' : ''}</button>`;
    }).join('')}
  </div>${tabs('train')}`);
  $$('[data-unit]', app).forEach(b => b.addEventListener('click', () => {
    if (open.length && +b.dataset.unit !== open[0].unit_id) toast(`진행 중인 유닛 ${open[0].unit_id} 레슨을 먼저 끝내요`);
    try { localStorage.setItem('chukgu.unit', b.dataset.unit); } catch { /* 무시 */ }
    home();
  }));
  const g = $('#go', app); if (g) g.addEventListener('click', () => go(`#/lesson/${sel}`));
  const c = $('#chk', app); if (c) c.addEventListener('click', () => go(`#/check/${sel}`));
}

// ------------------------------------------------------------------ 배치 테스트
export async function placement() {
  const items = await testItems();
  const done = (await select('current_skill_scores', `user_id=eq.${auth.userId}&select=skill_code`)).length > 0;
  const b = band();
  const app = mount(`${top(done ? '재측정' : '배치 테스트', { back: '#/' })}
  <div class="page">
    <h1>8종목을 재고 기록해요</h1>
    <p class="sub">${esc(BAND_LABEL[b])} 기준으로 점수를 매겨요. 정확도 종목은 아래 조건으로 재요.</p>
    ${items.map(it => `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><b>${it.id}. ${esc(it.name)}</b><span class="chip" style="background:var(--soft);color:#555">${esc(it.unit_label)}${it.higher_is_better ? '' : ' · 적을수록 좋음'}</span></div>
      <div style="font-size:13px;color:var(--t2);margin-top:4px;line-height:1.5">${ITEM_HINT[it.id] || ''}${COND[it.id] ? `<br><b style="color:var(--bd)">조건: ${COND[it.id][b]}</b>` : ''}</div>
      <label class="sr" for="it${it.id}" style="position:absolute;left:-9999px">${esc(it.name)} 기록</label>
      <input id="it${it.id}" data-item="${it.id}" inputmode="decimal" placeholder="기록 (${esc(it.unit_label)})" style="margin-top:10px;width:100%;height:48px;border:2px solid var(--line);border-radius:12px;padding:0 12px;font-size:18px;font-weight:800"></div>`).join('')}
  </div>
  <div class="foot"><button class="btn" id="ok">점수 계산하기</button></div>`);
  bindBack(app);
  action($('#ok', app), async () => {
    const res = $$('[data-item]', app).map(i => ({ item: +i.dataset.item, value: Number(i.value.replace(',', '.')) }));
    const miss = res.find(r => i_bad(r.value));
    if (miss) throw new Error(`${items.find(i => i.id === miss.item).name} 기록을 넣어 주세요`);
    const out = await rpc('submit_placement', { p_results: res, p_kind: done ? 'retest' : 'placement' });
    const sk = await skills();
    const name = c => (sk.find(s => s.code === c) || {}).name || c;
    const avg = out.reduce((a, r) => a + Number(r.score), 0) / out.length;
    const a2 = mount(`${top('결과')}
    <div class="page"><div class="center"><div class="t" style="color:var(--g)">종합 ${Math.round(avg)}점 · Lv.${Math.min(5, Math.floor(avg / 20) + 1)}</div><div class="sub" style="margin:0">${done ? '재측정 점수가 기록됐어요' : '스킬마다 시작 스테이지가 정해졌어요'}</div></div>
    ${out.map(r => `<div class="row"><span>${esc(name(r.skill_code))}</span><span><b>${Math.round(r.score)}점</b> <span class="v">Lv.${r.level}${done ? '' : ` → 스테이지 ${Math.min(r.level, 4)}${r.level >= 5 ? ' (졸업)' : ''}`}</span></span></div>`).join('')}
    </div><div class="foot"><button class="btn" id="h">훈련 시작</button></div>`);
    $('#h', a2).addEventListener('click', () => go('#/'));
  });
}
const i_bad = v => !isFinite(v) || v < 0 || v === '';

// ------------------------------------------------------------------ 레슨
export async function lesson(unitId) {
  if (todayDow() === 0) { toast('일요일은 몸 훈련을 쉬는 날이에요'); return go('#/'); }
  const en = await rpc('my_energy');
  if (en.energy < 1) return energyScreen(`남은 에너지 ⚡0`);
  let r;
  try { r = await rpc('start_lesson', { p_unit: unitId }); }
  catch (e) { if (handleErr(e)) return; throw e; }
  const [us, ms] = await Promise.all([units(), select('missions', `unit_id=eq.${unitId}&stage=eq.${r.stage}&meetup_only=is.false&order=slot&select=*`)]);
  const u = us.find(x => x.id === unitId);
  const done = new Set(r.done || []);
  const left = ms.filter(m => !done.has(m.id));
  const ctx = { lessonId: r.lesson_id, unit: u, stage: r.stage, missions: ms, idx: ms.length - left.length };
  let warmed = false;
  try { warmed = sessionStorage.getItem('warm.' + r.lesson_id) === '1'; } catch { /* 무시 */ }
  if (!warmed && done.size === 0) return warmup(ctx);
  missionScreen(ctx);
}

function warmup(ctx) {
  const app = mount(`${top(`${esc(ctx.unit.title)} · 스테이지 ${ctx.stage}`, { back: '#/' })}
  <div class="page"><div class="center"><div style="font-size:15px;font-weight:800;color:var(--gd)">워밍업 3분</div>
    <div class="big" id="cd">3:00</div>
    <div class="sub" style="margin:0;line-height:1.8">제자리 뛰기 1분<br>무릎 높이 들기 1분<br>가볍게 공 터치 1분</div></div>
    <div class="note s">다치지 않으려고 꼭 해요. 시간이 끝나면 미션이 열려요.</div></div>
  <div class="foot"><button class="btn" id="next" disabled>워밍업 중…</button></div>`);
  bindBack(app);
  const next = $('#next', app);
  countdown($('#cd', app), 180, () => { next.disabled = false; next.textContent = '미션 시작'; });
  next.addEventListener('click', () => {
    try { sessionStorage.setItem('warm.' + ctx.lessonId, '1'); } catch { /* 무시 */ }
    missionScreen(ctx);
  });
}

function inputUI(t, b) {
  if (t.metric === 'multi') {
    return t.parts.map((p, i) => `<label style="display:block;margin:14px 20px 0;font-size:13px;font-weight:800;color:var(--t3)" for="v${i}">${esc(PART_NAME[p.test_item] || '기록')} · 목표 ${esc(partGoal(p, b))}</label>
      <div class="stepper"><button data-step="${i}" data-d="-1" aria-label="1 줄이기">−</button><input id="v${i}" data-v="${i}" inputmode="decimal" value="0"><button data-step="${i}" data-d="1" aria-label="1 늘리기">+</button></div>`).join('');
  }
  if (t.metric === 'done') {
    return `<div style="display:flex;gap:10px;margin:16px 20px 0"><button class="opt" style="margin:0;width:auto;flex:1;text-align:center" data-done="1">했어요</button><button class="opt" style="margin:0;width:auto;flex:1;text-align:center" data-done="0">못 했어요</button></div><input type="hidden" id="v0" data-v="0" value="">`;
  }
  const sec = t.metric === 'seconds';
  return `<label style="display:block;margin:16px 20px 0;font-size:13px;font-weight:800;color:var(--t3)" for="v0">${sec ? (t.lower_is_better ? '걸린 시간(초)' : '버틴·한 시간(초)') : '몇 번 했나요?'} · 목표 ${esc(targetText(t, b))}</label>
    <div class="stepper"><button data-step="0" data-d="-1" aria-label="1 줄이기">−</button><input id="v0" data-v="0" inputmode="decimal" value="0"><button data-step="0" data-d="1" aria-label="1 늘리기">+</button></div>
    ${sec ? '<div style="display:flex;gap:10px;margin:10px 20px 0"><button class="opt" style="margin:0;flex:1;width:auto;text-align:center" id="sw">⏱ 스톱워치 시작</button></div>' : ''}`;
}

function missionScreen(ctx) {
  const m = ctx.missions[ctx.idx];
  const b = band();
  const t = m.target || {};
  const total = ctx.missions.length;
  const app = mount(`<header class="top"><button class="back" aria-label="레슨 멈추기" id="x">×</button><div class="grow"><div class="bar"><i style="width:${(ctx.idx / total) * 100}%"></i></div></div><span style="font-size:14px;color:var(--t3)">${ctx.idx + 1}/${total}</span></header>
  <div class="page">
    <div style="margin:18px 20px 0;font-size:13px;font-weight:800;color:${m.is_challenge ? 'var(--o)' : 'var(--g)'}">${m.is_challenge ? '도전 ④' : `쉬움 ${'①②③'[m.slot - 1] || ''}`} · 유닛 ${ctx.unit.id} ${esc(ctx.unit.title)}</div>
    <div style="margin:4px 20px 0;font-size:23px;font-weight:800;line-height:1.35">${esc(m.title)}</div>
    ${m.needs_partner ? '<div class="note p" style="margin-top:10px">관리자(또는 가족)와 같이 해요</div>' : ''}
    ${isElem() && m.is_challenge && t.conditions ? `<div class="note b" style="margin-top:10px">조건: ${esc(t.conditions[b] || '')}</div>` : ''}
    ${inputUI(t, b)}
    <div style="font-size:12px;color:var(--t3);margin:10px 20px 0">못 채워도 벌칙 없어요. 솔직하게 적어요</div>
  </div>
  <div class="foot"><button class="btn" id="save">기록 저장 · ⚡1</button></div>`);
  $('#x', app).addEventListener('click', () => {
    const s = sheet(`<div class="res">레슨을 잠깐 멈출까요?</div><div style="font-size:14px;color:#666;line-height:1.5;margin-bottom:14px">끝낸 미션은 저장돼요. 다음에 열면 이어서 해요.</div><button class="btn" id="cont">계속 훈련하기</button><button class="ghost" id="quit" style="color:var(--r)">나가기</button>`);
    $('#cont', s.el).addEventListener('click', s.close);
    $('#quit', s.el).addEventListener('click', () => { s.close(); go('#/'); });
  });
  $$('[data-step]', app).forEach(bt => bt.addEventListener('click', () => {
    const inp = $(`#v${bt.dataset.step}`, app);
    inp.value = Math.max(0, (Number(inp.value) || 0) + Number(bt.dataset.d));
  }));
  $$('[data-done]', app).forEach(bt => bt.addEventListener('click', () => {
    $$('[data-done]', app).forEach(x => x.classList.remove('sel'));
    bt.classList.add('sel'); $('#v0', app).value = bt.dataset.done;
  }));
  const sw = $('#sw', app);
  if (sw) {
    let start = 0, id = 0;
    sw.addEventListener('click', () => {
      if (!start) {
        start = Date.now(); sw.textContent = '⏹ 멈추기';
        id = setInterval(() => { if (!sw.isConnected) return clearInterval(id); $('#v0', app).value = ((Date.now() - start) / 1000).toFixed(1); }, 100);
      } else { clearInterval(id); start = 0; sw.textContent = '⏱ 다시 재기'; }
    });
  }
  action($('#save', app), async () => {
    const vals = $$('[data-v]', app).map(i => i.value === '' ? NaN : Number(String(i.value).replace(',', '.')));
    if (vals.some(v => !isFinite(v))) throw new Error(t.metric === 'done' ? '했는지 골라 주세요' : '기록을 넣어 주세요');
    const ok = judge(t, b, vals);
    let r;
    try { r = await rpc('submit_mission', { p_lesson: ctx.lessonId, p_mission: m.id, p_value: vals[0], p_success: ok }); }
    catch (e) { if (handleErr(e)) return; throw e; }
    const last = r.lesson_done;
    const s = sheet(`<div class="res">${ok ? '미션 성공!' : '조금만 더!'} ${t.metric === 'done' ? '' : esc(vals.join(' / '))}</div>
      <div style="font-size:15px;font-weight:700;line-height:1.5;margin-bottom:14px">${ok ? '잘했어요' : '기록은 저장됐어요. 벌칙 없이 다음에 다시 해요'} · 남은 ⚡${r.energy}</div>
      <button class="btn ${ok ? '' : 'o'}" id="nx">${last ? '레슨 결과 보기' : '다음 미션'}</button>`, ok ? 'ok' : 'no');
    $('#nx', s.el).addEventListener('click', () => {
      s.close();
      if (last) return complete(ctx, r);
      ctx.idx += 1; missionScreen(ctx);
    });
  });
}

async function complete(ctx, r) {
  await loadMe();
  const app = mount(`<div class="page"><div class="center"><img src="icon.svg" width="96" height="96" alt=""><div class="t" style="color:var(--g)">레슨 완료!</div></div>
    <div class="boxes"><div><b style="color:#a07800">+${r.xp}</b><small>XP</small></div><div><b>+${r.balls}</b><small>축구공</small></div><div><b style="color:#c86a00">${me().current_streak}일</b><small>스트릭</small></div></div>
    <div class="note y">남은 에너지 ⚡${r.energy}</div>
    ${r.promotion_check_ready ? (ctx.unit.id === 8 && ctx.stage >= 3 ? '<div class="note p">레슨 2회 완료! 승급 체크는 관리자와 1대1로 해요</div>' : '<div class="note g">레슨 2회 완료! 이제 승급 체크를 할 수 있어요</div>') : ''}
    <div class="card" style="text-align:center"><div style="font-weight:800">마무리 스트레칭 2분</div><div class="big" id="cd" style="font-size:36px">2:00</div><div style="font-size:13px;color:var(--t2)">종아리·허벅지·엉덩이를 천천히 늘려요</div></div></div>
  <div class="foot">${r.promotion_check_ready && !(ctx.unit.id === 8 && ctx.stage >= 3) ? '<button class="btn" id="chk">승급 체크 하기</button>' : ''}<button class="${r.promotion_check_ready && !(ctx.unit.id === 8 && ctx.stage >= 3) ? 'ghost' : 'btn'}" id="h">스트레칭 하고 끝내기</button></div>`);
  countdown($('#cd', app), 120, () => toast('스트레칭 끝! 수고했어요'));
  $('#h', app).addEventListener('click', () => go('#/'));
  const c = $('#chk', app); if (c) c.addEventListener('click', () => go(`#/check/${ctx.unit.id}`));
}

// ------------------------------------------------------------------ 승급 체크
export async function check(unitId) {
  if (unitId === 7) return go('#/tactics');
  const uid = auth.userId;
  const [us, prog, items] = await Promise.all([units(), select('unit_progress', `user_id=eq.${uid}&unit_id=eq.${unitId}&select=*`), testItems()]);
  const u = us.find(x => x.id === unitId);
  const p = prog[0] || { current_stage: 1, lessons_in_stage: 0 };
  const b = band();
  if (p.current_stage > 4) { toast('이미 졸업한 유닛이에요'); return go('#/'); }

  let fields = '', submit;
  if (unitId === 8) {
    if (p.current_stage >= 3) {
      const app = mount(`${top('수비 승급 체크', { back: '#/' })}<div class="page"><div class="note p" style="margin-top:20px">스테이지 ${p.current_stage}의 1대1 체크는 관리자와 함께 하고 관리자가 기록해요. 관리자에게 말해 주세요!</div></div>`);
      bindBack(app); return;
    }
    const [ch] = await select('missions', `unit_id=eq.8&stage=eq.${p.current_stage}&slot=eq.4&select=*`);
    fields = `<h1>${esc(ch.title)}</h1><p class="sub">목표 ${esc(targetText(ch.target, b))}</p>${inputUI(ch.target, b)}`;
    submit = async app => {
      const v = Number($('#v0', app).value);
      return rpc('submit_defense_check', { p_results: [{ mission: ch.id, value: v }] });
    };
  } else {
    const its = items.filter(i => i.skill_code === u.skill_code);
    const th = await select('level_thresholds', `age_band=eq.${b}&level=eq.${p.current_stage + 1}&test_item_id=in.(${its.map(i => i.id).join(',')})&select=*`);
    fields = `<h1>${esc(u.title)} 스테이지 ${p.current_stage} → Lv.${p.current_stage + 1}</h1><p class="sub">${its.length > 1 ? '두 종목 모두 기준을 넘으면 통과해요.' : '기준을 넘으면 통과해요.'} 3분 안에 재요.</p>
      ${its.map(it => {
        const goal = (th.find(x => x.test_item_id === it.id) || {}).value;
        return `<div class="card"><b>${esc(it.name)}</b> <span style="color:var(--gd);font-weight:800">· 기준 ${goal}${esc(it.unit_label)} ${it.higher_is_better ? '이상' : '이하'}</span>
        <div style="font-size:13px;color:var(--t2);margin-top:4px">${ITEM_HINT[it.id]}${COND[it.id] ? `<br><b style="color:var(--bd)">조건: ${COND[it.id][b]}</b>` : ''}</div>
        <label for="c${it.id}" style="position:absolute;left:-9999px">${esc(it.name)}</label><input id="c${it.id}" data-item="${it.id}" inputmode="decimal" placeholder="기록" style="margin-top:10px;width:100%;height:48px;border:2px solid var(--line);border-radius:12px;padding:0 12px;font-size:18px;font-weight:800"></div>`;
      }).join('')}`;
    submit = async app => {
      const res = $$('[data-item]', app).map(i => ({ item: +i.dataset.item, value: Number(i.value.replace(',', '.')) }));
      if (res.some(r => !isFinite(r.value) || $(`#c${r.item}`, app).value === '')) throw new Error('기록을 모두 넣어 주세요');
      return rpc('submit_promotion_check', { p_unit: unitId, p_results: res });
    };
  }
  const app = mount(`${top('승급 체크', { back: '#/' })}<div class="page">${fields}</div><div class="foot"><button class="btn" id="ok">결과 저장</button></div>`);
  bindBack(app);
  $$('[data-step]', app).forEach(bt => bt.addEventListener('click', () => { const i = $(`#v${bt.dataset.step}`, app); i.value = Math.max(0, (Number(i.value) || 0) + Number(bt.dataset.d)); }));
  const sw = $('#sw', app);
  if (sw) { let st = 0, id = 0; sw.addEventListener('click', () => { if (!st) { st = Date.now(); sw.textContent = '⏹ 멈추기'; id = setInterval(() => { if (!sw.isConnected) return clearInterval(id); $('#v0', app).value = ((Date.now() - st) / 1000).toFixed(1); }, 100); } else { clearInterval(id); st = 0; sw.textContent = '⏱ 다시 재기'; } }); }
  action($('#ok', app), async () => {
    const r = await submit(app);
    await loadMe();
    if (r.passed) {
      mount(`<div class="page"><div class="center"><svg width="150" height="130" viewBox="0 0 120 110" aria-hidden="true"><circle cx="48" cy="54" r="10" fill="#fff" stroke="#3c3c3c" stroke-width="2.5"/><circle cx="72" cy="52" r="10" fill="#fff" stroke="#3c3c3c" stroke-width="2.5"/><rect x="18" y="50" width="84" height="48" rx="8" fill="#e0a24e" stroke="#7a4f1c" stroke-width="3"/><rect x="52" y="48" width="16" height="18" rx="3" fill="#ffc800" stroke="#7a4f1c" stroke-width="2.5"/></svg>
        <div class="t" style="color:var(--g)">승급 통과!</div><div class="sub" style="margin:0">${esc(u.title)} Lv.${p.current_stage + 1} · 보물상자를 열었어요</div></div>
        <div class="boxes"><div><b>+${r.chest_balls}</b><small>축구공</small></div><div><b style="color:#a07000">+4</b><small>⚡ 에너지</small></div><div><b style="color:#a07800">+20</b><small>XP</small></div></div></div>
        <div class="foot"><button class="btn" onclick="location.hash='#/'">계속</button></div>`);
    } else {
      mount(`<div class="page"><div class="center"><div class="t" style="color:var(--o)">다음 기회에!</div><div class="sub" style="margin:0">벌칙은 없어요. 레슨 1번 더 하고 다시 체크해요.</div></div></div>
        <div class="foot"><button class="btn o" onclick="location.hash='#/'">홈으로</button></div>`);
    }
  });
}

// ------------------------------------------------------------------ 전술
export async function tactics() {
  const uid = auth.userId;
  const [prog, rules, energy, openQ] = await Promise.all([
    select('unit_progress', `user_id=eq.${uid}&unit_id=eq.7&select=*`),
    select('quiz_stage_rules', 'select=*&order=stage'),
    rpc('my_energy'),
    select('quiz_attempts', `user_id=eq.${uid}&submitted_at=is.null&select=id,is_check`),
  ]);
  const p = prog[0] || { current_stage: 1, lessons_in_stage: 0 };
  const names = ['규칙과 포지션', '공간과 위치', '공격 상황', '수비 상황'];
  const grad = p.current_stage > 4;
  const ready = !grad && p.lessons_in_stage >= 2;
  const app = mount(`${top('전술', { right: `<span class="chip" style="background:var(--bl);color:var(--bd)">전술 Lv.${Math.min(p.current_stage, 5)}</span>` })}
  <div class="page">
    <div class="hero" style="background:var(--b)"><div class="k">${grad ? '전술 졸업' : `스테이지 ${p.current_stage} · ${names[p.current_stage - 1]}`}</div>
      <div class="n">연습 세트 ${grad ? '' : `${Math.min(p.lessons_in_stage, 2)}/2`}</div><div class="d">문제당 ⚡1 · 세트당 +5 XP · 남은 ⚡${energy.energy}</div>
      ${openQ.length ? `<button class="btn" id="res" style="color:var(--bs)">풀던 ${openQ[0].is_check ? '시험' : '세트'} 이어하기</button>` : `<button class="btn" id="pr" style="color:var(--bs)">연습 세트 (5문제)</button>
      ${ready ? '<button class="btn" id="ck" style="margin-top:10px;color:var(--ps)">승급 시험 (10문제 · 에너지 안 씀)</button>' : ''}`}</div>
    <h2>스테이지</h2>
    ${rules.map(r => `<div class="unit"><div class="ic" style="background:${r.stage < p.current_stage ? 'var(--g)' : r.stage === p.current_stage ? 'var(--b)' : '#c9c9c9'}">${r.stage}</div><div class="grow"><div class="nm">${names[r.stage - 1]}</div><div class="ds">${r.out_of}문제 중 ${r.need_correct}개 정답으로 통과${r.stage >= 3 ? ' · 관리자와 미니게임 권장' : ''}</div></div>${r.stage < p.current_stage ? '<b style="color:var(--gd)">완료</b>' : ''}</div>`).join('')}
  </div>${tabs('tactics')}`);
  const pr = $('#pr', app); if (pr) pr.addEventListener('click', () => go('#/quiz/practice'));
  const ck = $('#ck', app); if (ck) ck.addEventListener('click', () => go('#/quiz/check'));
  const rs = $('#res', app); if (rs) rs.addEventListener('click', () => go(openQ[0].is_check ? '#/quiz/check' : '#/quiz/practice'));
}

export async function quiz(isCheck) {
  if (!isCheck) { const en = await rpc('my_energy'); if (en.energy < 1) return energyScreen('전술 문제도 하나에 ⚡1을 써요'); }
  let q;
  try { q = isCheck ? await rpc('get_tactics_check') : await rpc('get_quiz', { p_count: 5 }); }
  catch (e) { if (handleErr(e)) return; throw e; }
  const qs = q.questions || [];
  const answers = {};
  let i = 0;
  const color = isCheck ? 'var(--p)' : 'var(--b)';
  const draw = () => {
    const x = qs[i];
    const app = mount(`<header class="top"><button class="back" aria-label="나가기" id="x">×</button><div class="grow"><div class="bar"><i style="width:${(i / qs.length) * 100}%;background:${color}"></i></div></div><span style="font-size:14px;color:var(--t3)">${i + 1}/${qs.length}</span></header>
    <div class="page"><div style="margin:16px 20px 0;font-size:13px;font-weight:800;color:${color}">${isCheck ? `승급 시험 · ${q.need_correct}개 맞히면 통과` : '연습 세트'}</div>
      <div style="margin:6px 20px 16px;font-size:20px;font-weight:800;line-height:1.45">${esc(x.prompt)}</div>
      ${x.choices.map((c, k) => `<button class="opt ${answers[x.id] === k ? 'sel' : ''}" data-k="${k}">${esc(c)}</button>`).join('')}</div>
    <div class="foot"><button class="btn ${isCheck ? 'p' : 'b'}" id="ok" ${answers[x.id] == null ? 'disabled' : ''}>${i === qs.length - 1 ? '제출' : '다음'}</button></div>`);
    $('#x', app).addEventListener('click', () => go('#/tactics'));
    $$('[data-k]', app).forEach(b => b.addEventListener('click', () => { answers[x.id] = +b.dataset.k; draw(); }));
    action($('#ok', app), async () => {
      if (i < qs.length - 1) { i += 1; return draw(); }
      let r;
      try { r = await rpc('submit_quiz', { p_attempt: q.attempt_id, p_answers: answers }); }
      catch (e) { if (handleErr(e)) return; throw e; }
      result(r);
    });
  };
  const result = r => {
    const byId = Object.fromEntries(qs.map(x => [x.id, x]));
    if (r.is_check) {
      mount(`<div class="page"><div class="center"><div class="t" style="color:${r.passed ? 'var(--g)' : 'var(--o)'}">${r.passed ? '승급 시험 통과!' : '다음 기회에!'}</div>
        <div class="sub" style="margin:0">${r.total}문제 중 <b>${r.correct}개</b> 정답 (기준 ${r.need_correct}개)</div>
        <div class="dots">${(r.review || []).map(v => `<i style="background:${v.right ? 'var(--g)' : 'var(--r)'}">${v.right ? '○' : '×'}</i>`).join('')}</div>
        <div style="font-size:12px;color:var(--t3)">시험은 맞고 틀린 것만 알려 줘요</div></div>
        ${r.passed ? `<div class="boxes"><div><b>Lv.${r.tactics_level}</b><small>전술</small></div><div><b>+${r.chest_balls}</b><small>축구공</small></div><div><b>+20</b><small>XP</small></div></div>` : '<div class="note o">연습 세트 1번 더 하고 다시 도전해요</div>'}</div>
        <div class="foot"><button class="btn" onclick="location.hash='#/tactics'">계속</button></div>`);
    } else {
      mount(`${top('연습 세트 풀이')}<div class="page"><div class="note b" style="margin-top:14px">${r.total}문제 중 ${r.correct}개 정답 · +${r.xp} XP · 남은 ⚡${r.energy}</div>
        ${(r.review || []).map(v => { const x = byId[v.id] || { prompt: '', choices: [] }; const ok = v.answer === v.yours;
          return `<div class="card"><div style="font-weight:800;line-height:1.45">${ok ? '⭕' : '❌'} ${esc(x.prompt)}</div><div style="font-size:14px;color:var(--gd);font-weight:800;margin-top:6px">정답: ${esc(x.choices[v.answer])}</div>${ok ? '' : `<div style="font-size:14px;color:#d33;font-weight:700">내 답: ${esc(x.choices[v.yours])}</div>`}</div>`; }).join('')}
        ${r.check_ready ? '<div class="note g">연습 2번 완료! 승급 시험을 볼 수 있어요</div>' : ''}</div>
        <div class="foot"><button class="btn b" onclick="location.hash='#/tactics'">전술로</button></div>`);
    }
  };
  if (!qs.length) { toast('문제가 없어요'); return go('#/tactics'); }
  draw();
}

// ------------------------------------------------------------------ 퀘스트
export async function quests() {
  const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const lastMon = new Date(monday); lastMon.setDate(monday.getDate() - 7);
  const [dq, xp] = await Promise.all([
    rpc('my_daily_quests'),
    select('xp_events', `user_id=eq.${auth.userId}&local_date=gte.${ymd(lastMon)}&select=amount,local_date`),
  ]);
  const thisW = xp.filter(x => x.local_date >= ymd(monday)).reduce((a, x) => a + x.amount, 0);
  const lastW = xp.filter(x => x.local_date < ymd(monday)).reduce((a, x) => a + x.amount, 0);
  const app = mount(`${top('퀘스트')}<div class="page">
    <h2>일일 퀘스트 · 3개 모두 끝내면 축구공 +10</h2>
    ${dq.rest_day ? '<div class="note s">일요일은 쉬는 날이라 퀘스트가 없어요</div>' :
      dq.quests.map(x => `<div class="card"><div style="display:flex;justify-content:space-between;font-weight:800"><span>${esc(x.title)}</span>${x.done ? '<span style="color:var(--gd)">완료</span>' : ''}</div>
      <div class="bar" style="margin-top:8px"><i style="width:${Math.round(x.progress / x.target * 100)}%;background:var(--y)"></i></div><div style="font-size:12px;color:var(--t2);font-weight:700;margin-top:6px">${x.progress} / ${x.target}</div></div>`).join('') +
      `<div class="pad"><button class="btn y" id="claim" ${dq.all_done && !dq.rewarded ? '' : 'disabled'}>${dq.rewarded ? '오늘 보상 받았어요' : dq.all_done ? '축구공 +10 받기' : `보상 받기 · ${dq.quests.filter(x => !x.done).length}개 남음`}</button></div>`}
    <h2>이번 주 기록</h2>
    <div class="boxes"><div><b>${thisW}</b><small>이번 주 XP</small></div><div><b>${lastW}</b><small>지난주 XP</small></div><div><b>${me().longest_streak}일</b><small>최장 스트릭</small></div></div>
  </div>${tabs('quest')}`);
  action($('#claim', app), async () => { const r = await rpc('claim_daily_quests'); await loadMe(); toast(`축구공 +${r.balls}!`); quests(); });
}

// ------------------------------------------------------------------ 프로필
export async function profile() {
  const uid = auth.userId;
  const [sc, sk, ex, unread] = await Promise.all([
    select('current_skill_scores', `user_id=eq.${uid}&select=*`), skills(),
    select('extra_unit_levels', `user_id=eq.${uid}&select=*`),
    select('lesson_comments', 'read_at=is.null&select=id'),
  ]);
  await loadMe();
  const m = me();
  const S = Object.fromEntries(sc.map(s => [s.skill_code, s]));
  const six = sk.filter(s => s.in_overall);
  const overall = six.every(s => S[s.code]) ? six.reduce((a, s) => a + Number(S[s.code].score), 0) / 6 : null;
  const app = mount(`${top('프로필')}<div class="page">
    <div style="display:flex;align-items:center;gap:14px;padding:18px 20px 8px"><div style="width:64px;height:64px;border-radius:50%;background:var(--gl);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:var(--gd)">${esc(m.nickname[0])}</div>
      <div><div style="font-size:21px;font-weight:800">${esc(m.nickname)}</div><div style="font-size:13px;color:var(--t3)">${esc(BAND_LABEL[m.age_band])}</div></div></div>
    <div class="card"><div style="display:flex;justify-content:space-between"><b>축구 점수</b><span style="font-size:12px;color:var(--t3);font-weight:700">나와 관리자만 봐요</span></div>
      <div style="font-size:30px;font-weight:800;color:var(--gd);margin:4px 0 8px">${overall == null ? '배치 전' : `${Math.round(overall)}점 <span style="font-size:15px;color:var(--t)">Lv.${Math.min(5, Math.floor(overall / 20) + 1)}</span>`}</div>
      ${six.map(s => { const v = S[s.code] ? Number(S[s.code].score) : 0; return `<div style="display:flex;align-items:center;gap:10px;margin:6px 0"><div style="width:84px;font-size:13px;font-weight:800">${esc(s.name)}</div><div class="bar" style="flex:1"><i style="width:${v}%;background:${v < 20 ? 'var(--o)' : 'var(--g)'}"></i></div><div style="width:30px;text-align:right;font-weight:800;font-size:13px">${Math.round(v)}</div></div>`; }).join('')}
      <div style="font-size:12px;color:var(--t3);margin-top:6px">장기 목표: 종합 Lv.3 (40점)</div></div>
    <div class="boxes">${ex.map(e => `<div><b>Lv.${e.level}</b><small>${esc(e.title)}</small></div>`).join('')}<div><b>${m.current_streak}일</b><small>스트릭</small></div></div>
    <a href="#/comments" class="row" style="text-decoration:none;color:inherit"><span>관리자 코멘트</span><span class="v">${unread.length ? `<b style="color:var(--ps)">새 코멘트 ${unread.length}</b>` : '보기'} ›</span></a>
    <a href="#/placement" class="row" style="text-decoration:none;color:inherit"><span>재측정 (배치 테스트 다시)</span><span class="v">›</span></a>
    <div class="row"><span>휴식권</span><span class="v">${m.rest_tickets}장 · 일요일마다 1장</span></div>
    <button class="row" id="out" style="width:100%;border:0;border-bottom:2px solid var(--soft);background:#fff;color:var(--r);font-size:16px;text-align:left">로그아웃</button>
  </div>${tabs('profile')}`);
  $('#out', app).addEventListener('click', logout);
}

export async function comments() {
  const feed = await rpc('lesson_feed', { p_player: null, p_limit: 30 });
  const app = mount(`${top('관리자 코멘트', { back: '#/profile' })}<div class="page" style="padding-top:12px">
    ${feed.length ? feed.map(l => `<div class="lesson-card"><div style="font-size:12px;font-weight:800;color:var(--t3)">${fmtDate(l.completed_at)} · ${esc(l.unit)} 스테이지 ${l.stage} · 레슨 ${l.lesson_no}</div>
      ${(l.missions || []).map(mm => `<div class="mrow"><span>${esc(mm.title)}</span><span class="${mm.success ? 'ok' : 'no'}">${mm.value ?? ''} ${mm.success ? '✓' : '·'}</span></div>`).join('')}
      ${l.comments.map(c => `<div class="cmt">${esc(c.body)}<small>${fmtDate(c.at)}${c.read ? '' : ' · 새 코멘트'}</small></div>`).join('')}</div>`).join('')
      : '<div class="empty">아직 끝낸 레슨이 없어요</div>'}
  </div>`);
  bindBack(app);
  rpc('mark_comments_read').catch(() => {});
}

// ------------------------------------------------------------------ 상점
export async function shop() {
  await loadMe();
  const items = await select('shop_items', 'select=*&order=price');
  const m = me();
  const visible = items.filter(i => !(i.kind === 'energy' && isElem()));
  const app = mount(`${top('상점', { right: `<span style="display:flex;align-items:center;gap:4px;font-size:16px">${BALL}${m.balls}</span>` })}<div class="page" style="padding-top:12px">
    ${visible.map(i => `<div class="unit"><div class="ic" style="background:${{ rest_ticket: 'var(--b)', energy: 'var(--y)', background: 'var(--g)', cosmetic: 'var(--o)' }[i.kind]}"></div><div class="grow"><div class="nm">${esc(i.name)}</div><div class="ds">${{ rest_ticket: `빠진 평일을 메워 스트릭 유지 · 보유 ${m.rest_tickets}/3`, energy: '하루에 더 훈련하고 싶을 때', background: '홈 화면 배경', cosmetic: '캐릭터 꾸미기' }[i.kind]}</div></div>
      <button data-buy="${esc(i.code)}" style="height:40px;padding:0 12px;border:0;border-radius:12px;background:#3c3c3c;color:#fff;font-weight:800;display:flex;align-items:center;gap:4px">${i.price}</button></div>`).join('')}
    <div class="note s">축구공 모으기: 레슨 +5 · 일일 퀘스트 3개 +10 · 보물상자 +20~40. 현금 결제는 없어요</div>
  </div>${tabs('shop')}`);
  $$('[data-buy]', app).forEach(b => action(b, async () => { await rpc('buy_item', { p_code: b.dataset.buy }); toast('샀어요!'); shop(); }));
}
