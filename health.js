// 하루결 - 건강수첩 탭
// 구성: 💧 수분 섭취(병 버튼) / 혈압·맥박·몸무게·특이사항 기록 / 기록 보기(몸무게 그래프, 표) / 설정
// 흐름: 데이터(healthData) 변경 → saveHealth() → renderHealth()
// app.js의 todayString(), showToast(), celebrate()와 meds.js의 escapeHtml(), addDays(), shortDate(), RANGES를 같이 사용
// (index.html에서 app.js → meds.js → health.js 순서로 불러옴)

const HEALTH_KEY = 'health';
const HEALTH_DAY_START_HOUR = 2; // 새벽 2시에 날짜가 바뀜 (01:30에 마신 물은 전날로)
const DEFAULT_BOTTLES = [330, 550];
const LIST_LIMIT = 50;           // 표/목록에 한 번에 보여 줄 최대 줄 수

const healthView = document.getElementById('view-health');

// ===== 데이터 =====
// healthData = {
//   settings: { height: 키(cm)|null, goal: 하루 목표(ml)|null, bottles: [병 용량(ml)] },
//   water:  [{ id, date, ml, time }],
//   vitals: [{ id, date, time, sys, dia, pulse, weight, note }]  (비운 칸은 null / '')
// }
let healthData = loadHealth();
let healthRange = '7d';        // 기록 보기 기간 (meds.js의 RANGES와 같음)
let healthFormId = null;       // 열린 기록 입력칸: null(닫힘) / 'new' / 수정 중인 기록 id
let healthCustomOpen = false;  // 물 용량 직접 입력칸
let healthSettingsOpen = false;
let healthManageOpen = false;  // 기록 수정/삭제 목록

function loadHealth() {
  const empty = { settings: { height: null, goal: null, bottles: [...DEFAULT_BOTTLES] }, water: [], vitals: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(HEALTH_KEY));
    if (saved && typeof saved === 'object') {
      return {
        settings: { ...empty.settings, ...(saved.settings || {}) },
        water: Array.isArray(saved.water) ? saved.water : [],
        vitals: Array.isArray(saved.vitals) ? saved.vitals : [],
      };
    }
  } catch (error) {
    console.error('건강수첩 데이터를 불러오지 못했어요:', error);
  }
  return empty;
}

function saveHealth() {
  localStorage.setItem(HEALTH_KEY, JSON.stringify(healthData));
}

// 어떤 시각이 건강수첩에서 '며칠'인지 (새벽 2시 전은 전날)
function healthDay(time = Date.now()) {
  const d = new Date(time);
  if (d.getHours() < HEALTH_DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return todayString(d);
}

function hmText(time) {
  const d = new Date(time);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// <input type="datetime-local">에 넣을 값 'YYYY-MM-DDTHH:MM'
function localInputValue(time) {
  return `${todayString(new Date(time))}T${hmText(time)}`;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function literText(ml) {
  return `${(ml / 1000).toFixed(2)}L`;
}

// ===== 💧 수분 섭취 =====
function waterTotal(date) {
  return healthData.water.filter((w) => w.date === date).reduce((sum, w) => sum + w.ml, 0);
}

function addWater(ml) {
  if (!(ml > 0 && ml <= 3000)) { showToast('1~3000ml 사이로 입력해 주세요'); return; }
  const today = healthDay();
  const before = waterTotal(today);
  healthData.water.push({ id: newId(), date: today, ml, time: Date.now() });
  // 1년 넘은 물 기록은 정리 (용량 절약)
  const oldest = addDays(today, -400);
  healthData.water = healthData.water.filter((w) => w.date >= oldest);
  saveHealth();
  healthCustomOpen = false;
  renderHealth();

  const after = before + ml;
  const goal = healthData.settings.goal;
  if (goal && before < goal && after >= goal) celebrate(`오늘 수분 목표 ${literText(goal)}를\n달성했어요 💧`, false);
  else showToast(`+${ml}ml · 오늘 ${literText(after)}`);
}

// 오늘 마지막으로 누른 물 기록 취소
function undoWater() {
  const today = healthDay();
  const todays = healthData.water.filter((w) => w.date === today);
  if (todays.length === 0) return;
  const last = todays[todays.length - 1]; // 누른 순서대로 쌓이므로 마지막이 가장 최근
  healthData.water = healthData.water.filter((w) => w.id !== last.id);
  saveHealth();
  renderHealth();
  showToast(`${last.ml}ml 취소 · 오늘 ${literText(waterTotal(today))}`);
}

function waterCardHtml() {
  const today = healthDay();
  const total = waterTotal(today);
  const count = healthData.water.filter((w) => w.date === today).length;
  const { goal, bottles } = healthData.settings;
  const pct = goal ? Math.min(100, Math.round((total / goal) * 100)) : 0;

  const goalHtml = goal ? `
    <div class="water-goal">
      <div class="bar"><div class="bar-fill${total >= goal ? ' is-done' : ''}" style="width: ${pct}%"></div></div>
      <span>${total >= goal ? '✅ 목표 달성' : `목표 ${literText(goal)} · ${pct}%`}</span>
    </div>` : '';

  const bottleButtons = bottles.map((ml) => `
    <button type="button" class="water-btn" data-action="water-add" data-ml="${ml}">+${ml}ml</button>`).join('');

  const customForm = healthCustomOpen ? `
    <form class="water-form">
      <input type="number" name="ml" min="1" max="3000" step="1" inputmode="numeric" placeholder="마신 양 (ml)" required>
      <button type="submit" class="btn-small btn-save">추가</button>
      <button type="button" class="btn-small" data-action="water-custom-cancel">취소</button>
    </form>` : '';

  return `
    <section class="med-card water-card">
      <h2 class="med-card-title">💧 수분 섭취</h2>
      <div class="water-total">${literText(total)}<small>오늘${count ? ` · ${count}번` : ''}</small></div>
      ${goalHtml}
      <div class="water-btns">${bottleButtons}</div>
      ${customForm}
      <div class="water-links">
        ${healthCustomOpen ? '' : '<button type="button" class="link-btn" data-action="water-custom">직접 입력</button>'}
        ${count ? '<button type="button" class="link-btn danger" data-action="water-undo">방금 것 취소</button>' : ''}
      </div>
    </section>`;
}

// ===== 혈압 · BMI 판정 =====
// 대한고혈압학회 기준. 수축기/이완기 중 더 높은 단계를 따름
const BP_LEVELS = [
  { label: '정상', cls: 'lv0' },
  { label: '주의혈압', cls: 'lv1' },
  { label: '고혈압 전단계', cls: 'lv2' },
  { label: '고혈압', cls: 'lv3' },
];

function bpLevel(sys, dia) {
  const s = sys < 120 ? 0 : sys < 130 ? 1 : sys < 140 ? 2 : 3;
  const d = dia < 80 ? 0 : dia < 90 ? 2 : 3;
  return BP_LEVELS[Math.max(s, d)];
}

// 대한비만학회 기준
function bmiOf(weight) {
  const h = healthData.settings.height;
  if (!h || !weight) return null;
  return Math.round((weight / (h / 100) ** 2) * 10) / 10;
}

function bmiLevel(bmi) {
  if (bmi < 18.5) return { label: '저체중', cls: 'lv1' };
  if (bmi < 23) return { label: '정상', cls: 'lv0' };
  if (bmi < 25) return { label: '비만 전단계', cls: 'lv2' };
  return { label: '비만', cls: 'lv3' };
}

function badge(level) {
  return `<span class="hl-badge ${level.cls}">${level.label}</span>`;
}

// ===== 혈압 · 몸무게 · 특이사항 기록 =====
function numOrNull(value) {
  const n = Number(value);
  return value === '' || Number.isNaN(n) ? null : n;
}

function readVitalForm(form) {
  const time = new Date(form.elements.time.value).getTime();
  return {
    time,
    sys: numOrNull(form.elements.sys.value),
    dia: numOrNull(form.elements.dia.value),
    pulse: numOrNull(form.elements.pulse.value),
    weight: numOrNull(form.elements.weight.value),
    note: form.elements.note.value.trim(),
  };
}

function validateVital(v) {
  if (Number.isNaN(v.time)) return '측정 시각을 넣어 주세요';
  if (v.time > Date.now() + 60000) return '앞으로의 시각은 기록할 수 없어요';
  if (v.sys === null && v.dia === null && v.pulse === null && v.weight === null && !v.note) return '적어도 한 칸은 채워 주세요';
  if ((v.sys === null) !== (v.dia === null)) return '혈압은 수축기·이완기를 둘 다 넣어 주세요';
  if (v.sys !== null && !(v.sys >= 60 && v.sys <= 260 && v.dia >= 30 && v.dia <= 160 && v.sys > v.dia)) return '혈압 숫자를 다시 확인해 주세요';
  if (v.pulse !== null && !(v.pulse >= 30 && v.pulse <= 220)) return '맥박 숫자를 다시 확인해 주세요';
  if (v.weight !== null && !(v.weight >= 20 && v.weight <= 300)) return '몸무게 숫자를 다시 확인해 주세요';
  return null;
}

function saveVitalForm(form) {
  const v = readVitalForm(form);
  const error = validateVital(v);
  if (error) { showToast(error); return; }
  const record = { ...v, date: healthDay(v.time) };
  if (healthFormId === 'new') healthData.vitals.push({ id: newId(), ...record });
  else healthData.vitals = healthData.vitals.map((r) => (r.id === healthFormId ? { ...r, ...record } : r));
  healthData.vitals.sort((a, b) => a.time - b.time);
  const wasNew = healthFormId === 'new';
  healthFormId = null;
  saveHealth();
  renderHealth();
  showToast(wasNew ? '기록했어요' : '수정했어요');
}

function deleteVital(id) {
  if (!confirm('이 기록을 삭제할까요?')) return;
  healthData.vitals = healthData.vitals.filter((r) => r.id !== id);
  saveHealth();
  renderHealth();
  showToast('삭제했어요');
}

function vitalFormHtml() {
  const r = healthData.vitals.find((x) => x.id === healthFormId)
    || { time: Date.now(), sys: '', dia: '', pulse: '', weight: '', note: '' };
  const val = (x) => (x === null || x === undefined ? '' : x);
  return `
    <form class="med-form vital-form">
      <label class="full">측정 시각<input type="datetime-local" name="time" value="${localInputValue(r.time)}" required></label>
      <label>수축기 (위)<input type="number" name="sys" min="60" max="260" step="1" inputmode="numeric" value="${val(r.sys)}" placeholder="mmHg"></label>
      <label>이완기 (아래)<input type="number" name="dia" min="30" max="160" step="1" inputmode="numeric" value="${val(r.dia)}" placeholder="mmHg"></label>
      <label>맥박 (선택)<input type="number" name="pulse" min="30" max="220" step="1" inputmode="numeric" value="${val(r.pulse)}" placeholder="회/분"></label>
      <label>몸무게<input type="number" name="weight" min="20" max="300" step="0.1" inputmode="decimal" value="${val(r.weight)}" placeholder="kg"></label>
      <label class="full">특이사항<textarea name="note" rows="3" placeholder="몸 상태, 증상 등 자유롭게">${escapeHtml(r.note || '')}</textarea></label>
      <p class="vital-help full">비워 둔 칸은 기록하지 않아요</p>
      <div class="row-actions">
        <button type="submit" class="btn-small btn-save">${healthFormId === 'new' ? '기록' : '저장'}</button>
        <button type="button" class="btn-small" data-action="vital-cancel">취소</button>
      </div>
    </form>`;
}

function vitalCardHtml() {
  return `
    <section class="med-section">
      <h3>📏 혈압 · 몸무게 · 특이사항</h3>
      ${healthFormId ? vitalFormHtml() : '<button type="button" class="btn-small btn-save wide" data-action="vital-new">+ 기록하기</button>'}
    </section>`;
}

// ===== 기록 보기 =====
// 몸무게: 날짜별 마지막 값 [{ date, weight }]
function weightPoints(startDate) {
  const byDate = {};
  healthData.vitals.forEach((r) => {
    if (r.weight !== null && r.weight !== undefined && r.date >= startDate) byDate[r.date] = r.weight; // 시간순이라 마지막 값이 남음
  });
  return Object.keys(byDate).sort().map((date) => ({ date, weight: byDate[date] }));
}

function dayIndex(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function mdText(date) {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

// 몸무게 선 그래프 (SVG). 첫 기록은 점 하나, 다음 날부터 선으로 이어짐
function weightChartHtml(startDate) {
  const points = weightPoints(startDate);
  if (points.length === 0) return '<p class="missed-none">몸무게를 기록하면 여기에 그래프가 그려져요</p>';

  const W = 320, H = 170, L = 34, R = 304, T = 26, B = 140;
  const today = healthDay();
  const x0 = dayIndex(points[0].date);
  const x1 = dayIndex(today);
  const xOf = (date) => (x1 === x0 ? (L + R) / 2 : L + ((dayIndex(date) - x0) / (x1 - x0)) * (R - L));

  const ws = points.map((p) => p.weight);
  let lo = Math.min(...ws), hi = Math.max(...ws);
  if (hi - lo < 2) { const mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; }
  lo = Math.floor(lo * 2) / 2 - 0.5; hi = Math.ceil(hi * 2) / 2 + 0.5;
  const yOf = (w) => B - ((w - lo) / (hi - lo)) * (B - T);

  const xy = points.map((p) => ({ ...p, x: xOf(p.date), y: yOf(p.weight) }));
  const line = xy.length > 1 ? `<polyline class="wc-line" points="${xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"/>` : '';
  const labelAll = xy.length <= 7;
  const dots = xy.map((p, i) => {
    const last = i === xy.length - 1;
    const label = labelAll || last ? `<text class="wc-val${last ? ' last' : ''}" x="${p.x.toFixed(1)}" y="${(p.y - 9).toFixed(1)}">${p.weight}</text>` : '';
    return `<circle class="wc-dot${last ? ' last' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${last ? 4.5 : 3.5}"/>${label}`;
  }).join('');
  const grid = [hi, (hi + lo) / 2, lo].map((v) => `
    <line class="wc-grid" x1="${L}" x2="${R}" y1="${yOf(v)}" y2="${yOf(v)}"/>
    <text class="wc-axis" x="${L - 4}" y="${yOf(v) + 4}" text-anchor="end">${Number(v.toFixed(1))}</text>`).join('');
  const xLabels = x1 === x0
    ? `<text class="wc-axis" x="${(L + R) / 2}" y="${H - 10}" text-anchor="middle">${mdText(points[0].date)}</text>`
    : `<text class="wc-axis" x="${L}" y="${H - 10}" text-anchor="start">${mdText(points[0].date)}</text>
       <text class="wc-axis" x="${R}" y="${H - 10}" text-anchor="end">${mdText(today)}</text>`;

  // 요약: 최근 몸무게, BMI, 기간 안 변화
  const last = points[points.length - 1];
  const bmi = bmiOf(last.weight);
  const diff = Math.round((last.weight - points[0].weight) * 10) / 10;
  const diffText = points.length > 1 ? ` · <span class="nowrap">기간 변화 ${diff > 0 ? '+' : ''}${diff}kg</span>` : '';
  const bmiText = bmi ? ` · BMI ${bmi} ${badge(bmiLevel(bmi))}` : ' · <small>키를 설정하면 BMI가 나와요</small>';

  return `
    <p class="wc-summary"><b>${last.weight}kg</b>${bmiText}${diffText}</p>
    <svg class="weight-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="몸무게 추이">${grid}${line}${dots}${xLabels}</svg>`;
}

function bpTableHtml(startDate) {
  const rows = healthData.vitals.filter((r) => r.date >= startDate && r.sys !== null && r.sys !== undefined).reverse();
  if (rows.length === 0) return '<p class="missed-none">혈압 기록이 없어요</p>';
  const body = rows.slice(0, LIST_LIMIT).map((r) => `
    <tr>
      <th>${shortDate(r.date)}<small>${hmText(r.time)}</small></th>
      <td><b>${r.sys}/${r.dia}</b></td>
      <td>${r.pulse ?? '-'}</td>
      <td>${badge(bpLevel(r.sys, r.dia))}</td>
    </tr>`).join('');
  const more = rows.length > LIST_LIMIT ? `<p class="more-note">이전 ${rows.length - LIST_LIMIT}개는 생략</p>` : '';
  return `
    <table class="history hl-table">
      <thead><tr><th>날짜</th><th>혈압</th><th>맥박</th><th>판정</th></tr></thead>
      <tbody>${body}</tbody>
    </table>${more}`;
}

// 수분: 30일 이하는 날짜별, 그 이상은 월별 평균
function waterTableHtml(startDate, days) {
  if (healthData.water.length === 0) return '<p class="missed-none">물 버튼을 누르면 여기에 쌓여요</p>';
  const first = healthData.water.reduce((a, w) => (w.date < a ? w.date : a), healthDay());
  const from = first > startDate ? first : startDate;
  const today = healthDay();
  const goal = healthData.settings.goal;
  const dates = [];
  for (let d = today; d >= from; d = addDays(d, -1)) dates.push(d);

  if (days <= 30) {
    const body = dates.map((d) => {
      const total = waterTotal(d);
      let mark = '';
      if (goal) mark = total >= goal ? '✅' : d === today ? '<small>진행 중</small>' : '❌';
      return `<tr><th>${shortDate(d)}</th><td><b>${literText(total)}</b></td>${goal ? `<td>${mark}</td>` : ''}</tr>`;
    }).join('');
    return `
      <table class="history hl-table">
        <thead><tr><th>날짜</th><th>총량</th>${goal ? `<th>목표 ${literText(goal)}</th>` : ''}</tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  // 월별: 오늘(진행 중)은 평균과 달성 일수에서 뺌
  const months = {};
  dates.filter((d) => d !== today).forEach((d) => {
    const key = d.slice(0, 7);
    if (!months[key]) months[key] = { sum: 0, n: 0, ok: 0 };
    const total = waterTotal(d);
    months[key].sum += total; months[key].n += 1;
    if (goal && total >= goal) months[key].ok += 1;
  });
  const keys = Object.keys(months).sort().reverse();
  if (keys.length === 0) return '<p class="missed-none">아직 지난 날 기록이 없어요</p>';
  const body = keys.map((k) => {
    const m = months[k];
    const [y, mo] = k.split('-').map(Number);
    return `<tr><th>${y}년 ${mo}월</th><td><b>${literText(Math.round(m.sum / m.n))}</b></td>${goal ? `<td>${m.ok}/${m.n}일</td>` : ''}</tr>`;
  }).join('');
  return `
    <table class="history hl-table">
      <thead><tr><th>월</th><th>하루 평균</th>${goal ? '<th>목표 달성</th>' : ''}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function notesHtml(startDate) {
  const notes = healthData.vitals.filter((r) => r.date >= startDate && r.note).reverse();
  if (notes.length === 0) return '<p class="missed-none">특이사항이 없어요</p>';
  const items = notes.slice(0, LIST_LIMIT).map((r) => `
    <li><span class="note-date">${shortDate(r.date)} ${hmText(r.time)}</span><p>${escapeHtml(r.note)}</p></li>`).join('');
  const more = notes.length > LIST_LIMIT ? `<p class="more-note">이전 ${notes.length - LIST_LIMIT}개는 생략</p>` : '';
  return `<ul class="note-list">${items}</ul>${more}`;
}

function healthHistoryHtml() {
  const range = RANGES.find((r) => r.id === healthRange) || RANGES[0];
  const startDate = addDays(healthDay(), -(range.days - 1));
  const buttons = RANGES.map((r) => `
    <button type="button" class="range-btn${r.id === range.id ? ' is-active' : ''}" data-action="health-range" data-range="${r.id}">${r.label}</button>`).join('');

  return `
    <section class="med-section">
      <h3>기록 보기</h3>
      <div class="range-btns">${buttons}</div>
      <h4 class="hl-sub">⚖️ 몸무게</h4>
      ${weightChartHtml(startDate)}
      <h4 class="hl-sub">🩺 혈압</h4>
      ${bpTableHtml(startDate)}
      <h4 class="hl-sub">💧 수분 섭취</h4>
      ${waterTableHtml(startDate, range.days)}
      <h4 class="hl-sub">📝 특이사항</h4>
      ${notesHtml(startDate)}
    </section>`;
}

// 기록 수정/삭제 목록 (최근 것부터)
function manageHtml() {
  if (healthData.vitals.length === 0) return '';
  if (!healthManageOpen) {
    return '<button type="button" class="link-btn manage-link" data-action="manage-open">기록 수정 / 삭제</button>';
  }
  const items = healthData.vitals.slice().reverse().slice(0, LIST_LIMIT).map((r) => {
    const parts = [];
    if (r.sys !== null && r.sys !== undefined) parts.push(`🩺 ${r.sys}/${r.dia}${r.pulse ? ` · 맥박 ${r.pulse}` : ''}`);
    else if (r.pulse) parts.push(`맥박 ${r.pulse}`);
    if (r.weight) parts.push(`⚖️ ${r.weight}kg`);
    if (r.note) parts.push(`📝 ${escapeHtml(r.note.length > 20 ? `${r.note.slice(0, 20)}…` : r.note)}`);
    return `
      <li class="med-item">
        <div class="med-info"><b>${shortDate(r.date)} ${hmText(r.time)}</b><span>${parts.join(' · ')}</span></div>
        <div class="med-actions">
          <button type="button" class="btn-icon" data-action="vital-edit" data-id="${r.id}" title="수정">✎</button>
          <button type="button" class="btn-icon btn-delete" data-action="vital-delete" data-id="${r.id}" title="삭제">✕</button>
        </div>
      </li>`;
  }).join('');
  return `
    <section class="med-section">
      <h3>기록 수정 / 삭제</h3>
      <ul class="med-list">${items}</ul>
      <button type="button" class="btn-small" data-action="manage-close">닫기</button>
    </section>`;
}

// ===== 설정 (키, 하루 목표, 병 용량) =====
function settingsHtml() {
  const s = healthData.settings;
  if (!healthSettingsOpen) {
    const summary = [
      s.height ? `키 ${s.height}cm` : '키 미설정',
      s.goal ? `목표 ${literText(s.goal)}` : '목표 없음',
      `병 ${s.bottles.map((b) => `${b}ml`).join(', ')}`,
    ].join(' · ');
    return `
      <section class="med-section">
        <h3>설정</h3>
        <p class="backup-help">${summary}</p>
        <button type="button" class="btn-small" data-action="settings-open">설정 바꾸기</button>
      </section>`;
  }
  return `
    <section class="med-section">
      <h3>설정</h3>
      <form class="med-form settings-form">
        <label>키 (cm)<input type="number" name="height" min="100" max="230" step="0.1" inputmode="decimal" value="${s.height ?? ''}" placeholder="BMI 계산용"></label>
        <label>하루 물 목표 (L)<input type="number" name="goal" min="0.1" max="10" step="0.01" inputmode="decimal" value="${s.goal ? s.goal / 1000 : ''}" placeholder="비우면 목표 없음"></label>
        <label class="full">물 버튼 용량 (ml, 쉼표로 구분)<input name="bottles" value="${s.bottles.join(', ')}" placeholder="330, 550" autocomplete="off"></label>
        <div class="row-actions">
          <button type="submit" class="btn-small btn-save">저장</button>
          <button type="button" class="btn-small" data-action="settings-cancel">취소</button>
        </div>
      </form>
    </section>`;
}

function saveSettings(form) {
  const height = numOrNull(form.elements.height.value);
  const goalL = numOrNull(form.elements.goal.value);
  const bottles = form.elements.bottles.value.split(/[,\s]+/).filter(Boolean).map(Number);
  if (height !== null && !(height >= 100 && height <= 230)) { showToast('키를 다시 확인해 주세요 (cm)'); return; }
  if (goalL !== null && !(goalL > 0 && goalL <= 10)) { showToast('목표는 L 단위로 넣어 주세요 (예: 2.5)'); return; }
  if (bottles.length === 0 || bottles.some((b) => !(Number.isInteger(b) && b > 0 && b <= 3000))) {
    showToast('병 용량은 ml 숫자로 넣어 주세요 (예: 330, 550)'); return;
  }
  healthData.settings = {
    height,
    goal: goalL ? Math.round(goalL * 1000) : null,
    bottles: [...new Set(bottles)].slice(0, 6),
  };
  healthSettingsOpen = false;
  saveHealth();
  renderHealth();
  showToast('설정을 저장했어요');
}

// ===== 화면 그리기 =====
function renderHealth() {
  healthView.innerHTML = waterCardHtml() + vitalCardHtml() + healthHistoryHtml() + manageHtml() + settingsHtml();
}

// ===== 이벤트 =====
healthView.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === 'water-add') addWater(Number(button.dataset.ml));
  else if (action === 'water-undo') undoWater();
  else if (action === 'water-custom') { healthCustomOpen = true; renderHealth(); healthView.querySelector('.water-form input')?.focus(); }
  else if (action === 'water-custom-cancel') { healthCustomOpen = false; renderHealth(); }
  else if (action === 'vital-new') { healthFormId = 'new'; renderHealth(); }
  else if (action === 'vital-edit') { healthFormId = id; renderHealth(); healthView.querySelector('.vital-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else if (action === 'vital-cancel') { healthFormId = null; renderHealth(); }
  else if (action === 'vital-delete') deleteVital(id);
  else if (action === 'health-range') { healthRange = button.dataset.range; renderHealth(); }
  else if (action === 'manage-open') { healthManageOpen = true; renderHealth(); }
  else if (action === 'manage-close') { healthManageOpen = false; renderHealth(); }
  else if (action === 'settings-open') { healthSettingsOpen = true; renderHealth(); }
  else if (action === 'settings-cancel') { healthSettingsOpen = false; renderHealth(); }
});

healthView.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.classList.contains('water-form')) addWater(Number(form.elements.ml.value));
  else if (form.classList.contains('vital-form')) saveVitalForm(form);
  else if (form.classList.contains('settings-form')) saveSettings(form);
});

// 앱으로 돌아올 때 날짜가 바뀌었을 수 있으니 다시 그림 (입력 중이면 건드리지 않음)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !healthFormId && !healthSettingsOpen) renderHealth();
});

// ===== 시작 =====
renderHealth();
