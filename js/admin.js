// 관리자 화면: 아이 목록·가입 승인·레슨 기록과 코멘트·점수·함께 한 체크 기록
import { rpc, select } from './api.js';
import { state, loadMe, logout } from './app.js';
import { $, $$, esc, mount, toast, action, go, top, bindBack, fmtDate, BAND_LABEL } from './ui.js';

const ADMIN = '<span class="chip admin">관리자</span>';

export async function home() {
  const [players] = await Promise.all([rpc('my_players'), loadMe()]);
  const me = state.me;
  const pending = players.filter(p => p.status === 'pending_consent');
  const active = players.filter(p => p.status === 'active');
  const trainedToday = active.filter(p => p.lessons_today > 0).length;
  const todo = active.reduce((a, p) => a + p.uncommented, 0);
  const card = p => `<button class="unit" data-p="${p.id}"><div class="ic" style="background:${p.lessons_today ? 'var(--g)' : p.status === 'pending_consent' ? 'var(--o)' : '#c9c9c9'};border-radius:50%">${esc(p.nickname[0])}</div>
    <div class="grow"><div class="nm">${esc(p.nickname)}</div><div class="ds">${p.status === 'pending_consent' ? `${esc(BAND_LABEL[p.age_band])} · 가입 승인 대기` : `오늘 레슨 ${p.lessons_today}회 · 스트릭 ${p.streak}일 · 이번 주 ${p.week_xp} XP`}</div></div>
    ${p.status === 'pending_consent' ? '<span class="chip" style="background:var(--ol);color:var(--od)">승인하기</span>' : p.uncommented ? `<span class="chip admin">코멘트 ${p.uncommented}</span>` : ''}</button>`;
  const app = mount(`${top('우리 아이들', { right: ADMIN })}<div class="page">
    <div class="boxes" style="margin-top:14px"><div><b style="color:var(--gd)">${trainedToday}/${active.length}명</b><small>오늘 훈련</small></div><div><b style="color:var(--ps)">${todo}개</b><small>코멘트 할 레슨</small></div><div><b style="color:#c86a00">${pending.length}명</b><small>승인 대기</small></div></div>
    ${pending.length ? `<h2>승인 대기</h2>${pending.map(card).join('')}` : ''}
    <h2>훈련 중</h2>${active.length ? active.map(card).join('') : '<div class="empty">아직 아이가 없어요. 아래 초대 코드를 알려 주세요</div>'}
    <div class="card" style="margin-top:16px"><div style="font-size:13px;font-weight:800;color:var(--t3)">초대 코드</div><div style="font-size:32px;font-weight:800;letter-spacing:6px;margin-top:4px">${esc(me.coach_code || '------')}</div>
      <div style="font-size:13px;color:var(--t2);margin-top:6px;line-height:1.5">아이가 가입할 때 이 코드를 넣으면 나에게 묶여요. 승인해야 훈련을 시작해요.<br>14세 미만은 보호자 동의를 앱 밖에서 받아 주세요.</div>
      <button class="btn p" id="share" style="margin-top:12px">코드 공유하기</button></div>
    <button class="ghost" id="out" style="color:var(--r);margin:10px 0">로그아웃</button>
  </div>`);
  $$('[data-p]', app).forEach(b => b.addEventListener('click', () => go(`#/admin/p/${b.dataset.p}`)));
  $('#out', app).addEventListener('click', logout);
  action($('#share', app), async () => {
    const text = `축구 훈련 앱 초대 코드: ${me.coach_code}\n${location.origin}${location.pathname}`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* 취소 */ } }
    try { await navigator.clipboard.writeText(text); toast('복사했어요'); } catch { toast(text); }
  });
}

export async function player(id, tab) {
  const [profiles] = await Promise.all([select('profiles', `id=eq.${id}&select=*`)]);
  const p = profiles[0];
  if (!p) { toast('아이를 찾을 수 없어요', true); return go('#/admin'); }
  if (p.status === 'pending_consent') return approve(p);
  const head = `${top(esc(p.nickname), { back: '#/admin', right: ADMIN })}
    <div class="seg" role="tablist">${[['lessons', '레슨 기록'], ['scores', '점수'], ['check', '함께 한 체크']].map(([k, l]) => `<button role="tab" class="${k === tab ? 'on' : ''}" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>`;
  if (tab === 'scores') return scores(p, head);
  if (tab === 'check') return partnerCheck(p, head);
  return lessons(p, head);
}

function bindHead(app, p) {
  bindBack(app);
  $$('[data-tab]', app).forEach(b => b.addEventListener('click', () => go(`#/admin/p/${p.id}/${b.dataset.tab}`)));
}

function approve(p) {
  const app = mount(`${top('가입 승인', { back: '#/admin', right: ADMIN })}<div class="page">
    <div class="center"><div style="width:96px;height:96px;border-radius:50%;background:var(--ol);display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;color:var(--od)">${esc(p.nickname[0])}</div><div class="t">${esc(p.nickname)}</div><div class="sub" style="margin:0">가입 ${fmtDate(p.created_at)}</div></div>
    <div class="row"><span>태어난 연월</span><span class="v">${esc(p.birth_ym.slice(0, 7).replace('-', '년 '))}월</span></div>
    <div class="row"><span>연령 구간</span><span class="v">${esc(BAND_LABEL[p.age_band])}</span></div>
    ${p.age_band !== 'adult' ? '<div class="note y" style="margin-top:14px">14세 미만이면 보호자 동의를 앱 밖에서 받아 주세요 (문자·종이 동의서)</div>' : ''}
  </div><div class="foot"><button class="btn p" id="ok">승인</button><button class="ghost" id="no" style="color:var(--r)">모르는 사람이에요 · 거절</button></div>`);
  bindBack(app);
  action($('#ok', app), async () => { await rpc('approve_player', { p_player: p.id, p_approve: true }); toast(`${p.nickname} 승인!`); go('#/admin'); });
  action($('#no', app), async () => { await rpc('approve_player', { p_player: p.id, p_approve: false }); toast('거절했어요'); go('#/admin'); });
}

async function lessons(p, head) {
  const feed = await rpc('lesson_feed', { p_player: p.id, p_limit: 30 });
  const app = mount(`${head}<div class="page" style="padding-top:8px">
    ${feed.length ? feed.map(l => {
      const okAll = (l.missions || []).every(m => m.success);
      return `<div class="lesson-card"><div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:800;color:var(--t3)"><span>${fmtDate(l.completed_at)} · ${esc(l.unit)} 스테이지 ${l.stage} · 레슨 ${l.lesson_no}</span>${okAll ? '<span style="color:var(--gd);white-space:nowrap">모두 성공</span>' : ''}</div>
      <div style="margin-top:6px">${(l.missions || []).map(m => `<div class="mrow"><span>${esc(m.title)}</span><span class="${m.success ? 'ok' : 'no'}">${m.value ?? ''} ${m.success ? '✓' : '·'}</span></div>`).join('')}</div>
      ${l.comments.map(c => `<div class="cmt">${esc(c.body)}<small>내 코멘트 · ${fmtDate(c.at)} · ${c.read ? '아이가 읽음' : '아직 안 읽음'}</small></div>`).join('')}
      <div class="cmtbox"><label for="c-${l.lesson_id}" style="position:absolute;left:-9999px">코멘트</label><input id="c-${l.lesson_id}" maxlength="300" placeholder="${l.comments.length ? '코멘트 더 남기기' : '코멘트 남기기'}"><button data-c="${l.lesson_id}">보내기</button></div></div>`;
    }).join('') : '<div class="empty">아직 끝낸 레슨이 없어요</div>'}
  </div>`);
  bindHead(app, p);
  $$('[data-c]', app).forEach(b => action(b, async () => {
    const inp = $(`#c-${b.dataset.c}`, app);
    const body = inp.value.trim();
    if (!body) throw new Error('코멘트를 써 주세요');
    await rpc('comment_lesson', { p_lesson: b.dataset.c, p_body: body });
    toast('코멘트를 보냈어요');
    player(p.id, 'lessons');
  }));
}

async function scores(p, head) {
  const [sc, sk, ex, prog, units] = await Promise.all([
    select('current_skill_scores', `user_id=eq.${p.id}&select=*`),
    select('skills', 'select=*&order=sort'),
    select('extra_unit_levels', `user_id=eq.${p.id}&select=*`),
    select('unit_progress', `user_id=eq.${p.id}&select=*&order=unit_id`),
    select('units', 'select=*&order=id'),
  ]);
  const S = Object.fromEntries(sc.map(s => [s.skill_code, Number(s.score)]));
  const six = sk.filter(s => s.in_overall);
  const has = six.every(s => S[s.code] != null);
  const overall = has ? six.reduce((a, s) => a + S[s.code], 0) / 6 : null;
  const weak = has ? six.reduce((a, s) => (S[s.code] < S[a.code] ? s : a)) : null;
  const app = mount(`${head}<div class="page" style="padding-top:6px">
    <div class="card"><div style="font-size:13px;font-weight:800;color:var(--t3)">종합 점수 · ${esc(BAND_LABEL[p.age_band])}</div>
      <div style="font-size:30px;font-weight:800;color:var(--gd)">${overall == null ? '배치 테스트 전' : `${Math.round(overall)}점 <span style="font-size:15px;color:var(--t)">Lv.${Math.min(5, Math.floor(overall / 20) + 1)}</span>`}</div>
      ${six.map(s => { const v = S[s.code] ?? 0; return `<div style="display:flex;align-items:center;gap:10px;margin:6px 0"><div style="width:84px;font-size:13px;font-weight:800">${esc(s.name)}</div><div class="bar" style="flex:1"><i style="width:${v}%;background:${v < 20 ? 'var(--o)' : 'var(--g)'}"></i></div><div style="width:30px;text-align:right;font-weight:800;font-size:13px">${Math.round(v)}</div></div>`; }).join('')}</div>
    <div class="boxes">${ex.map(e => `<div><b>Lv.${e.level}</b><small>${esc(e.title)}</small></div>`).join('')}<div><b>${p.current_streak}일</b><small>스트릭</small></div></div>
    ${weak ? `<div class="note o">약점: ${esc(weak.name)} ${Math.round(S[weak.code])}점 · 레슨 코멘트로 응원해 주세요</div>` : ''}
    <h2>유닛 진행</h2>
    ${prog.map(g => { const u = units.find(x => x.id === g.unit_id) || {}; return `<div class="row"><span>${g.unit_id}. ${esc(u.title)}</span><span class="v">${g.current_stage > 4 ? '졸업' : `스테이지 ${g.current_stage} · 레슨 ${g.lessons_in_stage}회`}</span></div>`; }).join('')}
    <div class="row"><span>축구공 · 휴식권 · 에너지</span><span class="v">${p.balls} · ${p.rest_tickets}장 · ⚡${p.energy}</span></div>
  </div>`);
  bindHead(app, p);
}

async function partnerCheck(p, head) {
  const prog = await select('unit_progress', `user_id=eq.${p.id}&unit_id=eq.8&select=*`);
  const g = prog[0] || { current_stage: 1, lessons_in_stage: 0 };
  if (g.current_stage < 3 || g.current_stage > 4) {
    const app = mount(`${head}<div class="page"><div class="note s" style="margin-top:14px">${g.current_stage > 4 ? '수비 유닛을 졸업했어요.' : `지금 수비 스테이지 ${g.current_stage}이에요. 스테이지 1·2 승급 체크는 아이가 혼자 하고 기록해요. 스테이지 3부터 관리자가 상대해 주고 여기서 기록해요.`}</div></div>`);
    return bindHead(app, p);
  }
  const ms = await select('missions', `unit_id=eq.8&stage=eq.${g.current_stage}&meetup_only=is.true&order=slot&select=*`);
  const app = mount(`${head}<div class="page">
    <div style="margin:14px 20px 0;font-size:13px;font-weight:800;color:var(--ps)">유닛 8 수비 · 스테이지 ${g.current_stage} → Lv.${g.current_stage + 1}</div>
    <p class="sub" style="margin-top:6px">관리자가 천천히 드리블하고 아이가 발로만 막아요. 몸싸움·슬라이딩은 하지 않아요. 레슨 횟수와 상관없이 기록할 수 있어요.</p>
    ${ms.map(m => {
      const t = m.target || {};
      const goal = t[p.age_band] ?? t.adult;
      if (t.metric === 'done') return `<div class="card"><b>${esc(m.title.replace('(모임 날) ', ''))}</b><div style="display:flex;gap:10px;margin-top:10px"><button class="opt" data-m="${m.id}" data-val="1" style="margin:0;flex:1;width:auto;text-align:center">했어요</button><button class="opt" data-m="${m.id}" data-val="0" style="margin:0;flex:1;width:auto;text-align:center">못 했어요</button></div></div>`;
      return `<div class="card"><b>${esc(m.title.replace('(모임 날) ', ''))}</b><div style="font-size:13px;color:var(--t3);margin-top:2px">통과 기준 ${t.out_of}번 중 ${goal}번</div>
        <div class="nums" style="margin:10px 0 0">${Array.from({ length: (t.out_of || 5) + 1 }, (_, k) => `<button data-m="${m.id}" data-val="${k}" aria-label="${k}번">${k}</button>`).join('')}</div></div>`;
    }).join('')}
  </div><div class="foot"><button class="btn p" id="ok">기록 저장 · 통과하면 바로 승급</button></div>`);
  bindHead(app, p);
  const vals = {};
  $$('[data-m]', app).forEach(b => b.addEventListener('click', () => {
    $$(`[data-m="${b.dataset.m}"]`, app).forEach(x => x.classList.remove('on', 'sel'));
    b.classList.add(b.classList.contains('opt') ? 'sel' : 'on');
    vals[b.dataset.m] = +b.dataset.val;
  }));
  action($('#ok', app), async () => {
    if (ms.some(m => vals[m.id] == null)) throw new Error('모든 항목을 골라 주세요');
    const r = await rpc('record_partner_check', { p_player: p.id, p_results: ms.map(m => ({ mission: m.id, value: vals[m.id] })) });
    toast(r.passed ? `통과! 수비 Lv.${g.current_stage + 1}` : '이번엔 통과 못 했어요. 다음에 다시 해요');
    player(p.id, 'check');
  });
}
