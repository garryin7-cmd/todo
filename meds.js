// 하루일정 - 복약 탭
// 원칙: 약 이름/복용량은 코드에 쓰지 않고, 앱 안에서 입력해 휴대폰(localStorage)에만 저장
// 흐름: 데이터(medData) 변경 → saveMeds() → renderMeds()
// app.js에 있는 todayString(), showToast()를 같이 사용함 (index.html에서 app.js 다음에 불러옴)

const MEDS_KEY = 'meds';
const DAY_START_HOUR = 5;      // 05:00부터 '아침' (그 전 새벽은 전날 저녁으로 침) = 저녁 약 마감
const EVENING_START_HOUR = 17; // 17:00부터 '저녁' = 아침 약 마감
// 의료진 안내: 약을 잊었으면 최대한 빨리 먹되, 마감이 지나면 그 약은 건너뜀
//              아침 약을 두 번 먹었으면 그날 저녁 약은 건너뜀
const MAX_LOG = 730;           // 기록은 최근 730개(아침+저녁 1년치)까지 보관
const KEEP_SNAPSHOTS = 10;     // '취소'용 되돌릴 개수는 최근 10개 기록에만 남김 (용량 절약)
const SLOT_LABEL = { morning: '아침', evening: '저녁' };
const TARGET_HOUR = { morning: 10, evening: 22 }; // 복용 목표 시각 (고정)
const ON_TIME_MS = 2 * 60 * 1000;                 // 목표 시각 ~ +1분 59초까지 '제시간'
const CUTOFF_TEXT = { morning: `${EVENING_START_HOUR}:00`, evening: `다음 날 ${String(DAY_START_HOUR).padStart(2, '0')}:00` };

const medsView = document.getElementById('view-meds');

// ===== 데이터 =====
// medData = {
//   meds: [{ id, name, dose, sheetSize, sheetLeft, stock }],
//     dose: 1회 복용 알 수 / sheetSize: 한 판 알 수 / sheetLeft: 지금 판에 남은 알 수 / stock: 전체 재고
//   log:  [{ key, date, slot, status: 'taken'|'skipped', time, recordedAt, late, manual, snapshot }]
//     key: 'YYYY-MM-DD|morning' / time: 먹은 시각 / recordedAt: 체크 버튼을 누른 시각
//     late: 지난 시간대를 나중에 체크 / manual: 먹은 시각을 직접 입력
//     snapshot: 복용 전 개수 (취소할 때 되돌리기용)
// }
let medData = loadMeds();
let medEditingId = null;    // 수정 중인 약 id ('new'면 새 약 추가 중)
let medRestockingId = null; // 재고 추가 입력 중인 약 id
let medSelectedKey = null;  // 복약 카드에서 직접 고른 시간대 창 (null이면 자동)
let medRange = '7d';        // 기록 보기 기간 (7d / 1m / 3m / 6m / 1y)
let medTimeForm = null;     // 시각 입력 칸이 열린 시간대 { key, mode: 'new' | 'edit' }

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

// ===== 복용 시각 판정 =====
// 그 시간대의 목표 시각 (아침 10:00, 저녁 22:00)
function targetTime(s) {
  const [y, m, d] = s.date.split('-').map(Number);
  return new Date(y, m - 1, d, TARGET_HOUR[s.slot], 0, 0).getTime();
}

// 먹은 시각 → 제시간 / 늦음 / 이름 + 몇 분 차이
function doseTiming(s, time) {
  const diff = time - targetTime(s);
  if (diff >= 0 && diff < ON_TIME_MS) return { kind: 'ontime', minutes: 0 };
  if (diff < 0) return { kind: 'early', minutes: Math.ceil(-diff / 60000) };
  return { kind: 'late', minutes: Math.floor(diff / 60000) };
}

// 분 → 'N시간 N분' / 'N분'
function durationText(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

function timingLabel(s, time) {
  const t = doseTiming(s, time);
  if (t.kind === 'ontime') return '제시간';
  return t.kind === 'late' ? `${durationText(t.minutes)} 늦음` : `${durationText(t.minutes)} 일찍`;
}

// 판정 결과 카드 띄우기 (아침·저녁 둘 다 제시간인 날은 폭죽)
function showDoseResult(s, time) {
  const t = doseTiming(s, time);
  const name = `${dayName(s.date)} ${SLOT_LABEL[s.slot]}`;

  if (t.kind === 'ontime') {
    const other = { date: s.date, slot: s.slot === 'morning' ? 'evening' : 'morning' };
    const otherRecord = findRecord(other);
    const bothOnTime = otherRecord && otherRecord.status === 'taken'
      && doseTiming(other, otherRecord.time).kind === 'ontime';
    if (bothOnTime) {
      celebrate(`축하드려요,\n${dayName(s.date)} 약을 모두 제시간에 드셨어요`, false);
      return;
    }
    showDoseCard('ok', '🎉', `축하드려요, ${name} 약을 제시간에 드셨어요`, '');
    return;
  }
  const next = SLOT_LABEL[s.slot];
  if (t.kind === 'late') {
    showDoseCard('late', '🕐', `${name} 약을 ${durationText(t.minutes)} 늦게 드셨어요`, `내일 ${next}에는 제때 드시길 바라요`);
  } else {
    showDoseCard('early', '⏰', `${name} 약을 ${durationText(t.minutes)} 일찍 드셨어요`, `${next} 약은 ${TARGET_HOUR[s.slot]}시에 드셔야 해요`);
  }
}

function showDoseCard(kind, emoji, title, sub) {
  toast.classList.remove('is-visible');
  document.getElementById('dose-card').className = `dose-card dose-${kind}`;
  document.getElementById('dose-emoji').textContent = emoji;
  document.getElementById('dose-title').textContent = title;
  const subEl = document.getElementById('dose-sub');
  subEl.textContent = sub;
  subEl.hidden = !sub;
  document.getElementById('dose-alert').classList.add('is-visible');
}

// 입력한 'HH:MM'을 그 시간대의 실제 시각으로 (저녁 약의 새벽 시각은 다음 날)
// 시간대 밖이거나 미래면 { error }
function timeFromInput(s, value) {
  const [hh, mm] = value.split(':').map(Number);
  const [y, m, d] = s.date.split('-').map(Number);
  if (s.slot === 'morning' && (hh < DAY_START_HOUR || hh >= EVENING_START_HOUR)) {
    return { error: `아침 약은 ${DAY_START_HOUR}:00 ~ ${EVENING_START_HOUR - 1}:59 사이 시각만 넣을 수 있어요` };
  }
  if (s.slot === 'evening' && hh >= DAY_START_HOUR && hh < EVENING_START_HOUR) {
    return { error: `저녁 약은 ${EVENING_START_HOUR}:00 ~ 다음 날 ${DAY_START_HOUR - 1}:59 사이 시각만 넣을 수 있어요` };
  }
  const nextDay = s.slot === 'evening' && hh < DAY_START_HOUR ? 1 : 0;
  const time = new Date(y, m - 1, d + nextDay, hh, mm, 0).getTime();
  if (time > Date.now()) return { error: '아직 오지 않은 시각이에요' };
  return { time };
}

function hhmm(time) {
  const d = new Date(time);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ===== 기록하기 =====
// 복용함: 판/재고에서 빼고 기록 (late: 나중에 '먹었어요'로 기록한 것)
// time: 먹은 시각 (기본: 지금) / manual: 시각을 직접 입력했는지
function takeDose(s, time = Date.now(), manual = false) {
  if (findRecord(s) || medData.meds.length === 0) return;
  // 지난 시간대를 지금 시각으로 체크하면 실제 먹은 시각을 모르니 판정하지 않음
  const late = !manual && slotKey(s) !== slotKey(slotOf());
  const snapshot = {};
  medData.meds.forEach((med) => {
    snapshot[med.id] = { sheetLeft: med.sheetLeft, stock: med.stock };
    med.sheetLeft = sheetAfterDose(med);
    med.stock = Math.max(0, med.stock - med.dose);
  });
  addRecord({ ...s, key: slotKey(s), status: 'taken', time, recordedAt: Date.now(), late, manual, snapshot });
  if (late) showToast(`${slotName(s)} 약 복용 기록했어요 · 먹은 시각은 [시각 수정]으로 넣을 수 있어요`);
  else showDoseResult(s, time);
}

// 이미 남긴 복용 기록의 시각 고치기
function editDoseTime(s, time) {
  const record = findRecord(s);
  if (!record || record.status !== 'taken') return;
  record.time = time;
  record.manual = true;
  record.late = false;
  medData.log.sort((a, b) => a.time - b.time);
  saveMeds();
  renderMeds();
  showDoseResult(s, time);
}

// 안 먹음: 개수는 그대로 두고 기록만
// reason: 'cutoff'(마감 지나 건너뜀) / 'double'(아침 두 번 복용으로 저녁 건너뜀) / 없음(그냥 안 먹음)
function skipDose(s, reason) {
  if (findRecord(s)) return;
  const record = { ...s, key: slotKey(s), status: 'skipped', time: Date.now(), recordedAt: Date.now() };
  if (reason) record.reason = reason;
  addRecord(record);
  showToast(reason ? `${slotName(s)} 약은 건너뜀으로 기록했어요` : `${slotName(s)} 약은 안 먹은 것으로 기록했어요`);
}

// 아침 약을 한 번 더 먹음: 판/재고에서 한 번 더 빼고, 그날 저녁은 건너뛰도록 안내
function markDouble(s) {
  const record = findRecord(s);
  if (!record || record.status !== 'taken' || record.doubled || s.slot !== 'morning') return;
  if (!confirm(`${slotName(s)} 약을 정말 한 번 더 드셨나요?\n(판 개수가 한 번 더 줄어요)`)) return;
  const snapshot = {};
  medData.meds.forEach((med) => {
    snapshot[med.id] = { sheetLeft: med.sheetLeft, stock: med.stock };
    med.sheetLeft = sheetAfterDose(med);
    med.stock = Math.max(0, med.stock - med.dose);
  });
  record.doubled = { time: Date.now(), snapshot };
  saveMeds();
  renderMeds();
  showDoseCard('stop', '⚠️', `${slotName(s)} 약을 두 번 드셨어요`, `${dayName(s.date)} 저녁 약은 드시면 안 돼요 (의료진 안내)`);
}

// 두 번 복용 기록 취소 (잘못 누른 경우): 개수 되돌림
function undoDouble(s) {
  const record = findRecord(s);
  if (!record || !record.doubled) return;
  medData.meds.forEach((med) => {
    const before = record.doubled.snapshot && record.doubled.snapshot[med.id];
    if (before) {
      med.sheetLeft = before.sheetLeft;
      med.stock = before.stock;
    }
  });
  delete record.doubled;
  // 두 번 복용 때문에 남긴 '저녁 건너뜀' 기록도 함께 지움 (저녁을 다시 기록할 수 있게)
  const eveningKey = slotKey({ date: s.date, slot: 'evening' });
  medData.log = medData.log.filter((r) => !(r.key === eveningKey && r.reason === 'double'));
  saveMeds();
  renderMeds();
  showToast('두 번 복용 기록을 취소했어요');
}

function addRecord(record) {
  medSelectedKey = null;
  medTimeForm = null;
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
  const at = (r) => r.recordedAt || r.time;
  return medData.log.reduce((a, b) => (!a || at(b) > at(a) ? b : a), null);
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
  if (record.status === 'taken') return record.doubled ? '⚠️' : '✅';
  return { cutoff: '⛔', double: '⏸' }[record.reason] || '❌';
}

// 선택한 시간대 창 내용
// isCurrent: 지금 시간대인지 / previous: 바로 앞 시간대
function slotPanelHtml(s, isCurrent, previous) {
  const record = findRecord(s);
  const undo = record && record === latestRecord()
    ? '<button type="button" class="btn-small" data-action="undo">취소</button>' : '';
  const formOpen = medTimeForm && medTimeForm.key === slotKey(s);
  const morningOfDay = findRecord({ date: s.date, slot: 'morning' });
  const morningDoubled = s.slot === 'evening' && morningOfDay && morningOfDay.doubled;

  if (record && record.status === 'taken') {
    // 나중에 체크한 기록은 실제 먹은 시각을 모르니 판정 대신 안내
    const judge = record.late
      ? '<span class="timing unknown">먹은 시각 모름</span>'
      : `<span class="timing ${doseTiming(s, record.time).kind}">${timingLabel(s, record.time)}</span>`;
    const note = record.manual ? ' <small>(직접 입력)</small>' : '';
    // 아침 약 두 번 복용: 표시 + 취소 / 아직이면 [한 번 더 먹었어요]
    let doubleLine = '';
    let doubleBtn = '';
    if (s.slot === 'morning' && record.doubled) {
      doubleLine = `<div class="double-line">⚠️ ${timeText(record.doubled.time)}에 한 번 더 복용 → ${dayName(s.date)} 저녁 약은 드시면 안 돼요 (의료진 안내)</div>`;
      doubleBtn = `<button type="button" class="link-btn" data-action="double-undo" data-key="${slotKey(s)}">두 번 복용 기록 취소</button>`;
    } else if (s.slot === 'morning') {
      doubleBtn = `<button type="button" class="link-btn danger" data-action="double" data-key="${slotKey(s)}">한 번 더 먹었어요</button>`;
    }
    const edit = formOpen
      ? timeFormHtml(s, 'edit', hhmm(record.time))
      : `<div class="row-actions">
          <button type="button" class="btn-small" data-action="time-form" data-mode="edit" data-key="${slotKey(s)}">시각 수정</button>
          ${undo}
        </div>
        ${doubleBtn}`;
    return `
      <div class="slot-panel ${record.doubled ? 'double' : 'ok'}">
        <div class="taken-line">✅ ${timeText(record.time)} 복용${note} ${judge}</div>
        ${doubleLine}
        ${edit}
      </div>`;
  }
  if (record && record.status === 'skipped') {
    const label = {
      cutoff: `⛔ 마감(${CUTOFF_TEXT[s.slot]})이 지나 건너뜀`,
      double: '⏸ 아침 약 두 번 복용으로 건너뜀 (의료진 안내)',
    }[record.reason] || '❌ 안 먹음으로 기록';
    return `<div class="slot-panel skip"><span>${label}</span>${undo}</div>`;
  }

  // 아침 약을 두 번 먹은 날의 저녁: 먹으면 안 됨 → [먹었어요] 숨기고 건너뜀 기록만
  if (morningDoubled) {
    return `
      <div class="slot-panel stop">
        <div class="stop-title">⛔ ${dayName(s.date)} 아침 약을 두 번 드셨어요</div>
        <div>${dayName(s.date)} 저녁 약은 드시면 안 돼요 (의료진 안내)</div>
        <div class="row-actions">
          <button type="button" class="btn-small btn-stop" data-action="record-skip" data-key="${slotKey(s)}" data-reason="double">저녁 건너뜀으로 기록</button>
        </div>
      </div>`;
  }

  // 지금 시간대인데 앞 시간대도 기록이 없으면, 앞 시간대부터 정리하도록 안내
  if (isCurrent && !findRecord(previous) && isTracked(previous)) {
    return `
      <div class="slot-panel wait">
        <div>아직 기록 없음</div>
        <button type="button" class="event-add slot-dashed-btn" data-action="select-slot" data-key="${slotKey(previous)}">
          ${slotName(previous)} 기록부터 정리해 주세요 →
        </button>
      </div>`;
  }

  // 지난 시간대 = 마감이 지난 시간대 (추적 시작 전이면 경고 없이)
  const pastCutoff = !isCurrent;
  const warn = pastCutoff && isTracked(s);
  const cls = warn ? 'missing' : 'wait';
  const icon = warn ? '⚠️ ' : '';

  // 안내: 마감 지남 → 건너뛰기 / 목표 시각 지났는데 아직 → 지금 바로
  let guide = '';
  if (pastCutoff) {
    guide = `<div class="guide stop">⛔ 아직 안 드셨다면, 마감(${CUTOFF_TEXT[s.slot]})이 지났으니 이 약은 건너뛰세요 (의료진 안내)</div>`;
  } else if (Date.now() >= targetTime(s) + ON_TIME_MS) {
    guide = `<div class="guide hurry">🕐 아직 안 드셨다면 지금 바로 드세요 (마감 ${CUTOFF_TEXT[s.slot]})</div>`;
  }

  // 마감이 지난 시간대: 먹었으면 실제 시각을 넣게 하고, 아니면 건너뜀 기록
  const buttons = pastCutoff
    ? `<div class="row-actions">
        <button type="button" class="btn-small btn-save" data-action="time-form" data-mode="new" data-key="${slotKey(s)}">먹었어요 (시각 입력)</button>
        <button type="button" class="btn-small" data-action="record-skip" data-key="${slotKey(s)}" data-reason="cutoff">건너뜀으로 기록</button>
      </div>`
    : `<div class="row-actions">
        <button type="button" class="btn-small btn-save" data-action="record-take" data-key="${slotKey(s)}">먹었어요</button>
        <button type="button" class="btn-small" data-action="record-skip" data-key="${slotKey(s)}">안 먹었어요</button>
      </div>
      <button type="button" class="event-add slot-dashed-btn" data-action="time-form" data-mode="new" data-key="${slotKey(s)}">🕐 다른 시간에 먹었어요</button>`;

  return `
    <div class="slot-panel ${cls}">
      <div>${icon}아직 기록 없음 — 약판을 세어 보세요</div>
      ${compareHtml()}
      ${guide}
      ${formOpen ? timeFormHtml(s, 'new', `${String(TARGET_HOUR[s.slot]).padStart(2, '0')}:00`) : buttons}
    </div>`;
}

// 먹은 시각 입력 칸 (새 기록 / 시각 수정)
function timeFormHtml(s, mode, value) {
  return `
    <form class="time-form" data-key="${slotKey(s)}" data-mode="${mode}">
      <label>${mode === 'new' ? '실제로 먹은 시각' : '먹은 시각 수정'}
        <input type="time" name="time" value="${value}" required>
      </label>
      <div class="row-actions">
        <button type="submit" class="btn-small btn-save">저장</button>
        <button type="button" class="btn-small" data-action="time-cancel">취소</button>
      </div>
    </form>`;
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

// 한 시간대의 상태: taken / double(두 번 복용) / skipped(안 먹음) / cutoff(마감 지나 건너뜀)
//   / excused(지시대로 건너뜀) / missing(기록 없음) / waiting(지금 시간대, 아직) / none(추적 전·미래)
function slotState(s, current) {
  const record = findRecord(s);
  if (record && record.status === 'taken') return record.doubled ? 'double' : 'taken';
  if (record && record.status === 'skipped') {
    if (record.reason === 'cutoff') return 'cutoff'; // 잊어서 마감 지남 → 빠진 복용으로 셈
    if (record.reason === 'double') return 'excused'; // 지시대로 건너뜀 → 복용률 계산에서 뺌
    return 'skipped';
  }
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
  const counted = slots.filter((x) => ['taken', 'double', 'skipped', 'cutoff', 'missing'].includes(x.state));
  const taken = counted.filter((x) => x.state === 'taken' || x.state === 'double').length;
  const missed = counted.filter((x) => ['skipped', 'cutoff', 'missing'].includes(x.state));
  const doubles = slots.filter((x) => x.state === 'double');
  return { taken, total: counted.length, missed, doubles };
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
  if (x.state === 'double') {
    const record = findRecord(x);
    return `<span class="mark double" title="두 번 복용">⚠️<small>2회 · ${timeText(record.time)}</small></span>`;
  }
  if (x.state === 'skipped') return '<span class="mark skip">❌</span>';
  if (x.state === 'cutoff') return '<span class="mark cutoff" title="마감 지나 건너뜀">⛔</span>';
  if (x.state === 'excused') return '<span class="mark excused" title="지시대로 건너뜀">⏸</span>';
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
function missedHtml(missed, doubles) {
  const LABEL = {
    skipped: ['❌', '안 먹음', 'skip'],
    cutoff: ['⛔', '마감 지나 건너뜀', 'none'],
    missing: ['—', '기록 없음', 'none'],
    double: ['⚠️', '두 번 복용', 'double'],
  };
  // 빠진 복용 + 두 번 복용을 날짜 최신순으로 함께
  const all = [...missed, ...doubles].sort((a, b) => -compareSlots(a, b));
  if (all.length === 0) return '<p class="missed-none">빠진 복용이 없어요 👏</p>';
  const LIMIT = 15;
  const items = all.slice(0, LIMIT).map((x) => {
    const [what, why, cls] = LABEL[x.state];
    return `<li><span class="${cls}">${what}</span> ${shortDate(x.date)} ${SLOT_LABEL[x.slot]} · ${why}</li>`;
  }).join('');
  const more = all.length > LIMIT ? `<li class="more">외 ${all.length - LIMIT}건</li>` : '';
  const title = [`빠진 복용 ${missed.length}회`, doubles.length ? `두 번 복용 ${doubles.length}회` : ''].filter(Boolean).join(' · ');
  return `
    <p class="missed-title">${title}</p>
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
      ${missedHtml(st.missed, st.doubles)}
      ${range.days <= 30 ? dailyTableHtml(slots) : monthlyHtml(slots)}`;

  return `
    <section class="med-section">
      <h3>복약 기록</h3>
      <div class="range-btns">${buttons}</div>
      ${body}
    </section>`;
}

// ===== 백업 (할 일 · 복약 · 건강수첩 전체) =====
const BACKUP_KEYS = ['todos', 'meds', 'health', 'dday'];
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
    </section>`;
}

// 백업 파일 만들기 → 공유 창(카톡/드라이브) → 공유가 안 되거나 실패하면 다운로드
async function saveBackup() {
  const data = {};
  BACKUP_KEYS.forEach((key) => { data[key] = localStorage.getItem(key); });
  // app: 'harugyeol'은 옛 이름이지만, 예전 백업 파일과 호환되게 그대로 둠
  const text = JSON.stringify({ app: 'harugyeol', version: 1, exportedAt: Date.now(), data });
  // 파일 이름: back_up_날짜_시각 (예: back_up_20261118_2130) → 이름순 정렬이 곧 시간순
  const now = new Date();
  const stamp = `${todayString(now).replace(/-/g, '')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const base = `back_up_${stamp}`;

  // 휴대폰 공유 창은 파일 종류를 가려서, json이 안 되면 txt로 시도
  const candidates = [
    new File([text], `${base}.json`, { type: 'application/json' }),
    new File([text], `${base}.txt`, { type: 'text/plain' }),
  ];
  const shareable = navigator.canShare && candidates.find((file) => navigator.canShare({ files: [file] }));

  if (shareable) {
    try {
      await navigator.share({ files: [shareable], title: '하루일정 백업' });
      markBackedUp('백업 파일을 보냈어요');
      return;
    } catch (error) {
      if (error.name === 'AbortError') return; // 공유 창을 그냥 닫음
      console.warn('공유 실패, 다운로드로 저장합니다:', error); // 예: 컴퓨터 크롬이 파일 공유를 거부
    }
  }

  try {
    const url = URL.createObjectURL(candidates[0]);
    const a = document.createElement('a');
    a.href = url;
    a.download = candidates[0].name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    markBackedUp('다운로드 폴더에 백업 파일을 저장했어요');
  } catch (error) {
    console.error(error);
    showToast(`백업 저장에 실패했어요 (${error.name})`);
  }
}

function markBackedUp(message) {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  showToast(message);
  renderMeds();
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
      showToast('하루일정 백업 파일이 아니에요');
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
      <label>전체 재고 (알)<input type="number" name="stock" min="0" step="1" inputmode="numeric" value="${v.stock}" placeholder="판 포함"></label>
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
  } else {
    medsView.innerHTML = checkCardHtml() + historyHtml() + medListHtml() + backupHtml();
  }
  // 재고가 바뀌었을 수 있으니 맨 위 재고 경고도 다시 그림 (dday.js가 불러와진 뒤부터)
  if (typeof renderTopBar === 'function') renderTopBar();
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
    takeDose(slotFromKey(key));
  }
  else if (action === 'time-form') { medTimeForm = { key, mode: button.dataset.mode }; renderMeds(); medsView.querySelector('.time-form input')?.focus(); }
  else if (action === 'time-cancel') { medTimeForm = null; renderMeds(); }
  else if (action === 'record-skip') skipDose(slotFromKey(key), button.dataset.reason);
  else if (action === 'double') markDouble(slotFromKey(key));
  else if (action === 'double-undo') undoDouble(slotFromKey(key));
  else if (action === 'undo') undoLatest();
  else if (action === 'add') { medEditingId = 'new'; renderMeds(); }
  else if (action === 'edit') { medEditingId = id; medRestockingId = null; renderMeds(); }
  else if (action === 'form-cancel') { medEditingId = null; renderMeds(); }
  else if (action === 'delete') deleteMed(id);
  else if (action === 'restock') { medRestockingId = id; renderMeds(); medsView.querySelector('.restock-form input')?.focus(); }
  else if (action === 'restock-cancel') { medRestockingId = null; renderMeds(); }
});

// 판정 카드 바깥 클릭 → 닫기
document.getElementById('dose-alert').addEventListener('click', (event) => {
  if (event.target.id === 'dose-alert') event.currentTarget.classList.remove('is-visible');
});

// 백업 파일을 고르면 불러오기
// (파일 선택칸은 index.html에 고정 → 폰에서 선택 창 다녀온 뒤 renderMeds()가 다시 그려도 사라지지 않음)
document.getElementById('backup-file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  loadBackup(file);
  event.target.value = '';
});

medsView.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.classList.contains('med-form')) saveMedForm(form);
  else if (form.classList.contains('time-form')) {
    const s = slotFromKey(form.dataset.key);
    const result = timeFromInput(s, form.elements.time.value);
    if (result.error) { showToast(result.error); return; }
    medTimeForm = null;
    if (form.dataset.mode === 'new') takeDose(s, result.time, true);
    else editDoseTime(s, result.time);
  }
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
