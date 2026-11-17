// 하루결 - 복약 탭
// 원칙: 약 이름/복용량은 코드에 쓰지 않고, 앱 안에서 입력해 휴대폰(localStorage)에만 저장
// 흐름: 데이터(medData) 변경 → saveMeds() → renderMeds()
// app.js에 있는 todayString(), showToast()를 같이 사용함 (index.html에서 app.js 다음에 불러옴)

const MEDS_KEY = 'meds';
const DAY_START_HOUR = 4;      // 04:00부터 '아침' (그 전 새벽은 전날 저녁으로 침)
const EVENING_START_HOUR = 16; // 16:00부터 '저녁'
const MAX_LOG = 730;           // 기록은 최근 730개(아침+저녁 1년치)까지 보관
const KEEP_SNAPSHOTS = 10;     // '취소'용 되돌릴 개수는 최근 10개 기록에만 남김 (용량 절약)
const SLOT_LABEL = { morning: '아침', evening: '저녁' };

const medsView = document.getElementById('view-meds');

// ===== 데이터 =====
// medData = {
//   meds: [{ id, name, dose, sheetSize, sheetLeft, stock }],
//     dose: 1회 복용 알 수 / sheetSize: 한 판 알 수 / sheetLeft: 지금 판에 남은 알 수 / stock: 전체 재고
//   log:  [{ key, date, slot, status: 'taken'|'skipped', time, late, snapshot }]
//     key: 'YYYY-MM-DD|morning' / snapshot: 복용 전 개수 (취소할 때 되돌리기용)
// }
let medData = loadMeds();
let medEditingId = null;    // 수정 중인 약 id ('new'면 새 약 추가 중)
let medRestockingId = null; // 재고 추가 입력 중인 약 id
let medSelectedKey = null;  // 복약 카드에서 직접 고른 시간대 창 (null이면 자동)
let medRange = '7d';        // 기록 보기 기간 (7d / 1m / 3m / 6m / 1y)

function loadMeds() {
  try {
    const saved = JSON.parse(localStorage.getItem(MEDS_KEY));
    if (saved && Array.isArray(saved.meds) && Array.isArray(saved.log)) return saved;
  } catch (error) {
    console.error('복약 데이터를 불러오지 못했어요:', error);
  }
  return { meds: [], log: [] };
}

function saveMeds() {
  localStorage.setItem(MEDS_KEY, JSON.stringify(medData));
}

// 사용자가 입력한 글자를 HTML에 넣을 때 안전하게 바꿈
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ===== 복약 시간대(슬롯) 계산 =====
// 어떤 시각이 '몇 월 며칠 아침/저녁 약'에 해당하는지
function slotOf(time = Date.now()) {
  const d = new Date(time);
  const h = d.getHours();
  const slot = h >= DAY_START_HOUR && h < EVENING_START_HOUR ? 'morning' : 'evening';
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (h < DAY_START_HOUR) day.setDate(day.getDate() - 1); // 새벽은 전날 저녁
  return { date: todayString(day), slot };
}

function slotKey(s) {
  return `${s.date}|${s.slot}`;
}

// 바로 앞 슬롯 (오늘 아침 → 어제 저녁, 오늘 저녁 → 오늘 아침)
function prevSlot(s) {
  if (s.slot === 'evening') return { date: s.date, slot: 'morning' };
  const [y, m, d] = s.date.split('-').map(Number);
  return { date: todayString(new Date(y, m - 1, d - 1)), slot: 'evening' };
}

// 날짜 하루 더하기/빼기 ('YYYY-MM-DD' → 'YYYY-MM-DD')
function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return todayString(new Date(y, m - 1, d + n));
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

// 'M/D (요일)'
function shortDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}/${d} (${WEEKDAY[new Date(y, m - 1, d).getDay()]})`;
}

// 'YYYY-MM-DD'를 실제 달력 오늘 기준으로 부르는 이름 (오늘/어제/11/15)
// (새벽 1시에 보는 '전날 저녁 약'은 '어제 저녁'으로 보임)
function dayName(date) {
  const today = todayString();
  if (date === today) return '오늘';
  if (date === addDays(today, -1)) return '어제';
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

function slotName(s) {
  return `${dayName(s.date)} ${SLOT_LABEL[s.slot]}`;
}

function findRecord(s) {
  return medData.log.find((r) => r.key === slotKey(s));
}

// 시간대 앞뒤 비교 (a가 앞이면 음수)
function compareSlots(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.slot === b.slot) return 0;
  return a.slot === 'morning' ? -1 : 1;
}

// 추적 시작 = 첫 기록을 남긴 시간대. 그 전은 '기록 없음(안 먹음)'으로 치지 않음
function trackingStart() {
  return medData.log.reduce((first, r) => (!first || compareSlots(r, first) < 0 ? r : first), null);
}

function isTracked(s) {
  const start = trackingStart();
  return Boolean(start) && compareSlots(s, start) >= 0;
}

function timeText(time) {
  return new Date(time).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}

// ===== 개수 계산 =====
// 판에서 dose알을 뺐을 때 남는 알 수 (판이 비면 새 판으로 넘어감)
function sheetAfterDose(med) {
  let left = med.sheetLeft - med.dose;
  while (left < 0) left += med.sheetSize;
  return left;
}

// 전체 재고로 며칠 버틸 수 있는지 (하루 = 아침 + 저녁)
function daysOfStock(med) {
  return Math.floor(med.stock / (med.dose * 2));
}

// ===== 기록하기 =====
// 복용함: 판/재고에서 빼고 기록 (late: 나중에 '먹었어요'로 기록한 것)
function takeDose(s, late = false) {
  if (findRecord(s) || medData.meds.length === 0) return;
  const snapshot = {};
  medData.meds.forEach((med) => {
    snapshot[med.id] = { sheetLeft: med.sheetLeft, stock: med.stock };
    med.sheetLeft = sheetAfterDose(med);
    med.stock = Math.max(0, med.stock - med.dose);
  });
  addRecord({ ...s, key: slotKey(s), status: 'taken', time: Date.now(), late, snapshot });
  showToast(`${slotName(s)} 약 복용 기록했어요`);
}

// 안 먹음: 개수는 그대로 두고 기록만
function skipDose(s) {
  if (findRecord(s)) return;
  addRecord({ ...s, key: slotKey(s), status: 'skipped', time: Date.now() });
  showToast(`${slotName(s)} 약은 안 먹은 것으로 기록했어요`);
}

function addRecord(record) {
  medSelectedKey = null;
  medData.log.push(record);
  medData.log.sort((a, b) => a.time - b.time);
  if (medData.log.length > MAX_LOG) medData.log = medData.log.slice(-MAX_LOG);
  // 오래된 기록의 되돌리기용 개수는 지워서 용량 절약 (최근 몇 개만 취소에 쓰임)
  medData.log.slice(0, -KEEP_SNAPSHOTS).forEach((r) => { delete r.snapshot; });
  saveMeds();
  renderMeds();
}

// 가장 최근 기록만 취소 가능 (복용이었으면 개수도 기록 전으로 되돌림)
function latestRecord() {
  return medData.log.reduce((a, b) => (!a || b.time > a.time ? b : a), null);
}

function undoLatest() {
  const record = latestRecord();
  if (!record) return;
  if (record.status === 'taken' && record.snapshot) {
    medData.meds.forEach((med) => {
      const before = record.snapshot[med.id];
      if (before) {
        med.sheetLeft = before.sheetLeft;
        med.stock = before.stock;
      }
    });
  }
  medData.log = medData.log.filter((r) => r !== record);
  medSelectedKey = null;
  saveMeds();
  renderMeds();
  showToast(`${slotName(record)} 기록을 취소했어요`);
}

// ===== 약 관리 =====
function readMedForm(form) {
  const num = (name) => Number(form.elements[name].value);
  return {
    name: form.elements.name.value.trim(),
    dose: num('dose'),
    sheetSize: num('sheetSize'),
    sheetLeft: num('sheetLeft'),
    stock: num('stock'),
  };
}

// 입력값 검사 (문제가 있으면 안내 문구, 없으면 null)
function validateMed(m) {
  const isWhole = (n) => Number.isInteger(n) && n >= 0;
  if (!m.name) return '약 이름을 입력해 주세요';
  if (!isWhole(m.dose) || m.dose < 1) return '1회 복용 알 수는 1 이상이어야 해요';
  if (!isWhole(m.sheetSize) || m.sheetSize < 1) return '한 판 알 수는 1 이상이어야 해요';
  if (!isWhole(m.sheetLeft) || m.sheetLeft > m.sheetSize) return '지금 판에 남은 알 수는 0 ~ 한 판 알 수 사이여야 해요';
  if (!isWhole(m.stock)) return '전체 재고는 0 이상이어야 해요';
  return null;
}

function saveMedForm(form) {
  const values = readMedForm(form);
  const problem = validateMed(values);
  if (problem) {
    showToast(problem);
    return;
  }
  if (medEditingId === 'new') {
    medData.meds.push({ id: Date.now().toString(), ...values });
    showToast(`${values.name} 등록했어요`);
  } else {
    Object.assign(medData.meds.find((m) => m.id === medEditingId), values);
    showToast(`${values.name} 수정했어요`);
  }
  medEditingId = null;
  saveMeds();
  renderMeds();
}

function deleteMed(id) {
  const med = medData.meds.find((m) => m.id === id);
  if (!med || !confirm(`"${med.name}"을(를) 목록에서 삭제할까요?`)) return;
  medData.meds = medData.meds.filter((m) => m.id !== id);
  saveMeds();
  renderMeds();
}

function restock(id, amount) {
  const med = medData.meds.find((m) => m.id === id);
  if (!med) return;
  if (!Number.isInteger(amount) || amount < 1) {
    showToast('받은 알 수를 1 이상으로 입력해 주세요');
    return;
  }
  med.stock += amount;
  medRestockingId = null;
  saveMeds();
  renderMeds();
  showToast(`${med.name} 재고 ${amount}알 추가했어요`);
}

// ===== 화면 그리기 =====
// 먹었다면/안 먹었다면 판에 있어야 할 개수 비교 (기록 없는 시간대용)
function compareHtml() {
  const ifTaken = medData.meds.map((m) => `${escapeHtml(m.name)} <b>${sheetAfterDose(m)}</b>`).join(' · ');
  const ifNot = medData.meds.map((m) => `${escapeHtml(m.name)} <b>${m.sheetLeft}</b>`).join(' · ');
  return `
      <div class="compare">
        <div>먹었다면 → ${ifTaken}</div>
        <div>안 먹었다면 → ${ifNot}</div>
      </div>`;
}

// 시간대 상태 아이콘 (✅ 복용 / ❌ 안 먹음 / ⏳ 기록 없음)
function slotIcon(s, isCurrent) {
  const record = findRecord(s);
  if (!record) return isCurrent || isTracked(s) ? '⏳' : '·'; // 추적 시작 전은 점
  return record.status === 'taken' ? '✅' : '❌';
}

// 선택한 시간대 창 내용
// isCurrent: 지금 시간대인지 / previous: 바로 앞 시간대
function slotPanelHtml(s, isCurrent, previous) {
  const record = findRecord(s);
  const undo = record && record === latestRecord()
    ? '<button type="button" class="btn-small" data-action="undo">취소</button>' : '';

  if (record && record.status === 'taken') {
    const note = record.late ? ' (나중에 기록)' : '';
    return `<div class="slot-panel ok"><span>✅ ${timeText(record.time)} 복용${note}</span>${undo}</div>`;
  }
  if (record && record.status === 'skipped') {
    return `<div class="slot-panel skip"><span>❌ 안 먹음으로 기록</span>${undo}</div>`;
  }

  // 지금 시간대인데 앞 시간대도 기록이 없으면, 앞 시간대부터 정리하도록 안내
  if (isCurrent && !findRecord(previous) && isTracked(previous)) {
    return `
      <div class="slot-panel wait">
        <div>아직 기록 없음</div>
        <button type="button" class="link-btn" data-action="select-slot" data-key="${slotKey(previous)}">
          ${slotName(previous)} 기록부터 정리해 주세요 →
        </button>
      </div>`;
  }

  // 지난 시간대라도 추적 시작 전이면 경고 없이 (기록이 없다고 안 먹은 건 아니므로)
  const warn = !isCurrent && isTracked(s);
  const cls = warn ? 'missing' : 'wait';
  const icon = warn ? '⚠️ ' : '';
  return `
    <div class="slot-panel ${cls}">
      <div>${icon}아직 기록 없음 — 약판을 세어 보세요</div>
      ${compareHtml()}
      <div class="row-actions">
        <button type="button" class="btn-small btn-save" data-action="record-take" data-key="${slotKey(s)}">먹었어요</button>
        <button type="button" class="btn-small" data-action="record-skip" data-key="${slotKey(s)}">안 먹었어요</button>
      </div>
    </div>`;
}

// 핵심 카드: 지금 판에 있어야 할 알 수 + [직전 | 지금] 시간대 전환 + 선택한 창
function checkCardHtml() {
  const current = slotOf();
  const previous = prevSlot(current);
  const counts = medData.meds.map((m) => `
    <div class="pill-count">
      <span class="pill-name">${escapeHtml(m.name)}</span>
      <span class="pill-num">${m.sheetLeft}<small>알</small></span>
      <span class="pill-sub">${m.sheetLeft === 0 ? '이 판 다 먹음 · 다음엔 새 판' : `한 판 ${m.sheetSize}알 중`}</span>
    </div>`).join('');

  // 어느 창을 보여줄지: 직접 고른 창 → 없으면 (앞 시간대 기록 없음 ? 앞 : 지금)
  const keys = [slotKey(previous), slotKey(current)];
  if (!keys.includes(medSelectedKey)) medSelectedKey = null;
  const selected = medSelectedKey === slotKey(previous)
    || (!medSelectedKey && !findRecord(previous) && isTracked(previous))
    ? previous : current;

  const tabs = [previous, current].map((s) => {
    const active = slotKey(s) === slotKey(selected) ? ' is-active' : '';
    return `<button type="button" class="slot-tab${active}" data-action="select-slot" data-key="${slotKey(s)}">
      ${slotIcon(s, slotKey(s) === slotKey(current))} ${slotName(s)}</button>`;
  }).join('');

  const isCurrent = slotKey(selected) === slotKey(current);
  return `
    <section class="med-card">
      <h2 class="med-card-title">지금 판에 있어야 할 알 수</h2>
      <div class="pill-counts">${counts}</div>
      <div class="slot-tabs">${tabs}</div>
      ${slotPanelHtml(selected, isCurrent, previous)}
    </section>`;
}

// ===== 기록 보기 (기간 버튼 + 복용률 + 빠진 복용 + 표/월별) =====
const RANGES = [
  { id: '7d', label: '7일', days: 7 },
  { id: '1m', label: '1개월', days: 30 },
  { id: '3m', label: '3개월', days: 90 },
  { id: '6m', label: '6개월', days: 180 },
  { id: '1y', label: '1년', days: 365 },
];

// 한 시간대의 상태: taken / skipped / missing(기록 없음) / waiting(지금 시간대, 아직) / none(추적 전·미래)
function slotState(s, current) {
  const record = findRecord(s);
  if (record) return record.status;
  const cmp = compareSlots(s, current);
  if (cmp > 0 || !isTracked(s)) return 'none';
  if (cmp === 0) return 'waiting';
  return 'missing';
}

// 기간 안의 시간대 목록 (오늘부터 과거로, 최신순)
function slotsInRange(days, current) {
  const today = todayString();
  const list = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, -i);
    list.push({ date, slot: 'evening' }, { date, slot: 'morning' });
  }
  return list.map((slot) => ({ ...slot, state: slotState(slot, current) }));
}

// 복용률 + 빠진 복용 (아직 시간이 남은 지금 시간대, 추적 전은 빼고 셈)
function rangeStats(slots) {
  const counted = slots.filter((x) => ['taken', 'skipped', 'missing'].includes(x.state));
  const taken = counted.filter((x) => x.state === 'taken').length;
  const missed = counted.filter((x) => x.state !== 'taken');
  return { taken, total: counted.length, missed };
}

function rateText(taken, total) {
  return total === 0 ? '—' : `${Math.round((taken / total) * 100)}%`;
}

// 표 칸 하나
function cellHtml(x) {
  if (x.state === 'taken') {
    const record = findRecord(x);
    return `<span class="mark ok">✅<small>${timeText(record.time)}</small></span>`;
  }
  if (x.state === 'skipped') return '<span class="mark skip">❌</span>';
  if (x.state === 'missing') return '<span class="mark none" title="기록 없음">—</span>';
  if (x.state === 'waiting') return '<span class="mark wait">⏳</span>';
  return '';
}

// 날짜별 표 (7일, 1개월): 오늘이 맨 위, 추적 시작 전 날짜는 생략
function dailyTableHtml(slots) {
  const start = trackingStart();
  const rows = [];
  for (let i = 0; i < slots.length; i += 2) {
    const evening = slots[i];
    const morning = slots[i + 1];
    if (start && evening.date < start.date && i > 0) break;
    const name = dayName(evening.date);
    const label = name === '오늘' || name === '어제' ? `${name} · ${shortDate(evening.date)}` : shortDate(evening.date);
    rows.push(`<tr><th>${label}</th><td>${cellHtml(morning)}</td><td>${cellHtml(evening)}</td></tr>`);
  }
  return `<table class="history"><thead><tr><th></th><th>아침</th><th>저녁</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table>`;
}

// 월별 묶음 (3개월 이상): 최신 달이 맨 위
function monthlyHtml(slots) {
  const months = new Map();
  slots.forEach((x) => {
    const month = x.date.slice(0, 7);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(x);
  });
  const rows = [...months.entries()].map(([month, list]) => {
    const st = rangeStats(list);
    if (st.total === 0) return '';
    const [y, m] = month.split('-').map(Number);
    const pct = Math.round((st.taken / st.total) * 100);
    return `
      <li class="month-row">
        <span class="month-name">${y}년 ${m}월</span>
        <span class="month-bar"><span style="width:${pct}%"></span></span>
        <span class="month-rate">${pct}% <small>(${st.taken}/${st.total})</small></span>
      </li>`;
  }).join('');
  return rows ? `<ul class="month-list">${rows}</ul>` : '';
}

// 빠진 복용 목록 (최신순, 너무 많으면 일부만)
function missedHtml(missed) {
  if (missed.length === 0) return '<p class="missed-none">빠진 복용이 없어요 👏</p>';
  const LIMIT = 15;
  const items = missed.slice(0, LIMIT).map((x) => {
    const what = x.state === 'skipped' ? '❌' : '—';
    const why = x.state === 'skipped' ? '안 먹음' : '기록 없음';
    return `<li><span class="${x.state === 'skipped' ? 'skip' : 'none'}">${what}</span> ${shortDate(x.date)} ${SLOT_LABEL[x.slot]} · ${why}</li>`;
  }).join('');
  const more = missed.length > LIMIT ? `<li class="more">외 ${missed.length - LIMIT}회</li>` : '';
  return `
    <p class="missed-title">빠진 복용 ${missed.length}회</p>
    <ul class="missed-list">${items}${more}</ul>`;
}

function historyHtml() {
  const current = slotOf();
  const range = RANGES.find((r) => r.id === medRange) || RANGES[0];
  const slots = slotsInRange(range.days, current);
  const st = rangeStats(slots);
  const start = trackingStart();

  const buttons = RANGES.map((r) => `
    <button type="button" class="range-btn${r.id === range.id ? ' is-active' : ''}" data-action="range" data-range="${r.id}">${r.label}</button>`).join('');

  const body = !start
    ? '<p class="missed-none">첫 복용 기록부터 여기에 쌓여요</p>'
    : `
      <div class="rate-box">
        <span class="rate-num">${rateText(st.taken, st.total)}</span>
        <span class="rate-sub">복용률 · ${st.taken}/${st.total}회<br><small>${shortDate(start.date)}부터 기록 중</small></span>
      </div>
      ${missedHtml(st.missed)}
      ${range.days <= 30 ? dailyTableHtml(slots) : monthlyHtml(slots)}`;

  return `
    <section class="med-section">
      <h3>복약 기록</h3>
      <div class="range-btns">${buttons}</div>
      ${body}
    </section>`;
}

// ===== 백업 (할 일 · 복약 · 건강수첩 전체) =====
const BACKUP_KEYS = ['todos', 'meds', 'health'];
const LAST_BACKUP_KEY = 'lastBackupAt';
const BACKUP_REMIND_DAYS = 14;

function backupHtml() {
  let last = null;
  try { last = Number(localStorage.getItem(LAST_BACKUP_KEY)) || null; } catch (error) { /* 무시 */ }
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  let status;
  if (days === null) status = '<span class="backup-warn">아직 백업한 적이 없어요</span>';
  else if (days >= BACKUP_REMIND_DAYS) status = `<span class="backup-warn">백업한 지 ${days}일 됐어요</span>`;
  else status = `마지막 백업: ${days === 0 ? '오늘' : `${days}일 전`}`;

  return `
    <section class="med-section">
      <h3>데이터 백업</h3>
      <p class="backup-help">할 일 · 복약 · 건강수첩 전체를 파일 하나로 저장해요. 카톡 나에게 보내기나 Google Drive에 보관해 두세요.</p>
      <p class="backup-status">${status}</p>
      <div class="row-actions">
        <button type="button" class="btn-small btn-save" data-action="backup-save">백업 파일 저장</button>
        <button type="button" class="btn-small" data-action="backup-load">백업 불러오기</button>
      </div>
      <input type="file" id="backup-file" accept=".json,.txt,application/json,text/plain" hidden>
    </section>`;
}

// 백업 파일 만들기 → 공유 창(카톡/드라이브) → 안 되면 다운로드
async function saveBackup() {
  const data = {};
  BACKUP_KEYS.forEach((key) => { data[key] = localStorage.getItem(key); });
  const text = JSON.stringify({ app: 'harugyeol', version: 1, exportedAt: Date.now(), data });
  const base = `harugyeol-backup-${todayString()}`;

  // 휴대폰 공유 창은 파일 종류를 가려서, json이 안 되면 txt로 시도
  const candidates = [
    new File([text], `${base}.json`, { type: 'application/json' }),
    new File([text], `${base}.txt`, { type: 'text/plain' }),
  ];
  const shareable = navigator.canShare && candidates.find((file) => navigator.canShare({ files: [file] }));

  try {
    if (shareable) {
      await navigator.share({ files: [shareable], title: '하루결 백업' });
    } else {
      const url = URL.createObjectURL(candidates[0]);
      const a = document.createElement('a');
      a.href = url;
      a.download = candidates[0].name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
    showToast('백업 파일을 저장했어요');
    renderMeds();
  } catch (error) {
    if (error.name !== 'AbortError') { // 공유 창에서 그냥 닫은 경우는 조용히
      console.error(error);
      showToast('백업 저장에 실패했어요');
    }
  }
}

// 백업 파일 읽어서 덮어쓰기 (확인 후) → 새로고침해서 전체 반영
function loadBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let backup;
    try {
      backup = JSON.parse(reader.result);
    } catch (error) {
      showToast('백업 파일을 읽을 수 없어요');
      return;
    }
    if (!backup || backup.app !== 'harugyeol' || !backup.data) {
      showToast('하루결 백업 파일이 아니에요');
      return;
    }
    const when = new Date(backup.exportedAt).toLocaleString('ko-KR');
    if (!confirm(`${when}에 만든 백업으로 지금 데이터를 모두 바꿀까요?\n(지금 데이터는 사라져요)`)) return;
    BACKUP_KEYS.forEach((key) => {
      const value = backup.data[key];
      if (typeof value === 'string') localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    });
    localStorage.setItem(LAST_BACKUP_KEY, String(backup.exportedAt || Date.now()));
    location.reload();
  };
  reader.readAsText(file);
}

// 약 목록 (재고, 수정, 삭제)
function medListHtml() {
  const items = medData.meds.map((m) => {
    if (medEditingId === m.id) return `<li class="med-item">${medFormHtml(m)}</li>`;
    const days = daysOfStock(m);
    const low = days <= 7 ? ' low' : '';
    const restockForm = medRestockingId === m.id ? `
      <form class="restock-form" data-id="${m.id}">
        <input type="number" name="amount" min="1" step="1" inputmode="numeric" placeholder="받은 알 수" required>
        <button type="submit" class="btn-small btn-save">추가</button>
        <button type="button" class="btn-small" data-action="restock-cancel">취소</button>
      </form>` : '';
    return `
      <li class="med-item">
        <div class="med-info">
          <b>${escapeHtml(m.name)}</b>
          <span>1회 ${m.dose}알 · 판 ${m.sheetLeft}/${m.sheetSize}알</span>
          <span class="stock${low}">전체 재고 ${m.stock}알 · 약 ${days}일분${low ? ' · 곧 떨어져요' : ''}</span>
        </div>
        <div class="med-actions">
          <button type="button" class="btn-small" data-action="restock" data-id="${m.id}">재고 추가</button>
          <button type="button" class="btn-icon" data-action="edit" data-id="${m.id}" title="수정 / 판 다시 세기">✎</button>
          <button type="button" class="btn-icon btn-delete" data-action="delete" data-id="${m.id}" title="삭제">✕</button>
        </div>
        ${restockForm}
      </li>`;
  }).join('');

  const addForm = medEditingId === 'new' ? medFormHtml(null) : '';
  const addButton = medEditingId === null
    ? '<button type="button" class="btn-small" data-action="add">+ 약 추가</button>' : '';

  return `
    <section class="med-section">
      <h3>내 약</h3>
      <ul class="med-list">${items}</ul>
      ${addForm}
      ${addButton}
    </section>`;
}

// 약 등록/수정 입력칸 (이름 예시에 실제 약 이름을 쓰지 않음: 코드가 공개되어 있으므로)
function medFormHtml(med) {
  const v = med || { name: '', dose: 1, sheetSize: 10, sheetLeft: 10, stock: '' };
  return `
    <form class="med-form">
      <label>약 이름<input name="name" value="${escapeHtml(v.name)}" placeholder="약 이름" autocomplete="off"></label>
      <label>1회 복용 (알)<input type="number" name="dose" min="1" step="1" inputmode="numeric" value="${v.dose}"></label>
      <label>한 판 (알)<input type="number" name="sheetSize" min="1" step="1" inputmode="numeric" value="${v.sheetSize}"></label>
      <label>지금 판에 남은 알<input type="number" name="sheetLeft" min="0" step="1" inputmode="numeric" value="${v.sheetLeft}"></label>
      <label>전체 재고 (알)<input type="number" name="stock" min="0" step="1" inputmode="numeric" value="${v.stock}" placeholder="판에 남은 것 포함"></label>
      <div class="row-actions">
        <button type="submit" class="btn-small btn-save">${med ? '저장' : '등록'}</button>
        ${medData.meds.length > 0 ? '<button type="button" class="btn-small" data-action="form-cancel">취소</button>' : ''}
      </div>
    </form>`;
}

function renderMeds() {
  // 약이 하나도 없으면 등록 화면부터
  if (medData.meds.length === 0) {
    medEditingId = 'new';
    medsView.innerHTML = `
      <section class="med-card">
        <h2 class="med-card-title">먼저 먹는 약을 등록해 주세요</h2>
        <p class="med-help">약 이름과 개수는 이 휴대폰에만 저장돼요.<br>지금 약판에 남은 알 수를 세어서 넣어 주세요.</p>
        ${medFormHtml(null)}
      </section>${backupHtml()}`;
    return;
  }
  medsView.innerHTML = checkCardHtml() + historyHtml() + medListHtml() + backupHtml();
}

// ===== 이벤트 (한 곳에서 처리) =====
function slotFromKey(key) {
  const [date, slot] = key.split('|');
  return { date, slot };
}

medsView.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id, key } = button.dataset;

  if (action === 'select-slot') { medSelectedKey = key; renderMeds(); }
  else if (action === 'range') { medRange = button.dataset.range; renderMeds(); }
  else if (action === 'backup-save') saveBackup();
  else if (action === 'backup-load') document.getElementById('backup-file').click();
  else if (action === 'record-take') {
    // 지금 시간대가 아닌 창에서 누르면 '나중에 기록'으로 표시
    takeDose(slotFromKey(key), key !== slotKey(slotOf()));
  }
  else if (action === 'record-skip') skipDose(slotFromKey(key));
  else if (action === 'undo') undoLatest();
  else if (action === 'add') { medEditingId = 'new'; renderMeds(); }
  else if (action === 'edit') { medEditingId = id; medRestockingId = null; renderMeds(); }
  else if (action === 'form-cancel') { medEditingId = null; renderMeds(); }
  else if (action === 'delete') deleteMed(id);
  else if (action === 'restock') { medRestockingId = id; renderMeds(); medsView.querySelector('.restock-form input')?.focus(); }
  else if (action === 'restock-cancel') { medRestockingId = null; renderMeds(); }
});

// 백업 파일을 고르면 불러오기
medsView.addEventListener('change', (event) => {
  if (event.target.id !== 'backup-file' || !event.target.files[0]) return;
  loadBackup(event.target.files[0]);
  event.target.value = '';
});

medsView.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.classList.contains('med-form')) saveMedForm(form);
  else if (form.classList.contains('restock-form')) restock(form.dataset.id, Number(form.elements.amount.value));
});

// 앱으로 돌아올 때 시간대가 바뀌었을 수 있으니 다시 그림
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    medSelectedKey = null;
    renderMeds();
  }
});

// ===== 시작 =====
renderMeds();
