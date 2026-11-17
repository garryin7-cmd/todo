// 하루결 - 복약 탭
// 원칙: 약 이름/복용량은 코드에 쓰지 않고, 앱 안에서 입력해 휴대폰(localStorage)에만 저장
// 흐름: 데이터(medData) 변경 → saveMeds() → renderMeds()
// app.js에 있는 todayString(), showToast()를 같이 사용함 (index.html에서 app.js 다음에 불러옴)

const MEDS_KEY = 'meds';
const DAY_START_HOUR = 4;      // 04:00부터 '아침' (그 전 새벽은 전날 저녁으로 침)
const EVENING_START_HOUR = 16; // 16:00부터 '저녁'
const MAX_LOG = 120;           // 기록은 최근 120개(약 두 달)만 보관
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

// 'YYYY-MM-DD'를 오늘 기준으로 부르는 이름 (오늘/어제/11월 15일)
function dayName(date) {
  const today = slotOf().date;
  if (date === today) return '오늘';
  if (date === prevSlot({ date: today, slot: 'morning' }).date) return '어제';
  const [, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일`;
}

function slotName(s) {
  return `${dayName(s.date)} ${SLOT_LABEL[s.slot]}`;
}

function findRecord(s) {
  return medData.log.find((r) => r.key === slotKey(s));
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
  if (medData.log.length > MAX_LOG) medData.log = medData.log.slice(-MAX_LOG);
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

// 시간대 상태 아이콘 (✅ 복용 / ⏭ 안 먹음 / ⏳ 기록 없음)
function slotIcon(s) {
  const record = findRecord(s);
  if (!record) return '⏳';
  return record.status === 'taken' ? '✅' : '⏭';
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
    return `<div class="slot-panel skip"><span>⏭ 안 먹음으로 기록</span>${undo}</div>`;
  }

  // 지금 시간대인데 앞 시간대도 기록이 없으면, 앞 시간대부터 정리하도록 안내
  if (isCurrent && !findRecord(previous)) {
    return `
      <div class="slot-panel wait">
        <div>아직 기록 없음</div>
        <button type="button" class="link-btn" data-action="select-slot" data-key="${slotKey(previous)}">
          ${slotName(previous)} 기록부터 정리해 주세요 →
        </button>
      </div>`;
  }

  const cls = isCurrent ? 'wait' : 'missing';
  const icon = isCurrent ? '' : '⚠️ ';
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
  const selected = medSelectedKey === slotKey(previous) || (!medSelectedKey && !findRecord(previous))
    ? previous : current;

  const tabs = [previous, current].map((s) => {
    const active = slotKey(s) === slotKey(selected) ? ' is-active' : '';
    return `<button type="button" class="slot-tab${active}" data-action="select-slot" data-key="${slotKey(s)}">
      ${slotIcon(s)} ${slotName(s)}</button>`;
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

// 최근 7일 기록 표
function historyHtml() {
  const current = slotOf();
  const rows = [];
  let s = current.slot === 'evening' ? current : { date: current.date, slot: 'evening' };
  for (let i = 0; i < 7; i++) {
    const morning = { date: s.date, slot: 'morning' };
    const evening = { date: s.date, slot: 'evening' };
    rows.push(`<tr><th>${dayName(s.date)}</th><td>${markHtml(morning, current)}</td><td>${markHtml(evening, current)}</td></tr>`);
    s = prevSlot(morning); // 전날 저녁
  }
  return `
    <section class="med-section">
      <h3>최근 7일</h3>
      <table class="history"><thead><tr><th></th><th>아침</th><th>저녁</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table>
    </section>`;
}

function markHtml(s, current) {
  const record = findRecord(s);
  if (record && record.status === 'taken') return `<span class="mark ok" title="${timeText(record.time)}">✅<small>${timeText(record.time)}</small></span>`;
  if (record && record.status === 'skipped') return '<span class="mark skip">⏭</span>';
  const isFuture = s.date === current.date && s.slot === 'evening' && current.slot === 'morning';
  if (isFuture) return '';
  if (slotKey(s) === slotKey(current)) return '<span class="mark wait">⏳</span>';
  return '<span class="mark none">—</span>';
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
      </section>`;
    return;
  }
  medsView.innerHTML = checkCardHtml() + historyHtml() + medListHtml();
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
