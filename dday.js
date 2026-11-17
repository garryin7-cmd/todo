// 하루결 - D-day (외래 · 중요 일정) 와 약 재고 경고
// - 🏥 외래 D-day, ⚠️ 재고 3일분 이하 경고: 세 탭 모두 맨 위(#top-bar)에 표시
// - 📌 중요 일정(시험 등) D-day: 할 일 탭 맨 위(#dday-events)에만 표시
// app.js의 todayString(), daysUntil(), showToast(), showTab()과
// meds.js의 medData, daysOfStock(), escapeHtml(), shortDate()를 같이 사용 (index.html에서 마지막에 불러옴)

const DDAY_KEY = 'dday';
const STOCK_WARN_DAYS = 3; // 재고가 이 일수 이하로 남으면 경고

const topBar = document.getElementById('top-bar');
const eventsBox = document.getElementById('dday-events');

// ddayData = { clinic: 'YYYY-MM-DD' | null, events: [{ id, name, date }] }
let ddayData = loadDday();
let clinicFormOpen = false;
let eventFormOpen = false;

function loadDday() {
  try {
    const saved = JSON.parse(localStorage.getItem(DDAY_KEY));
    if (saved && typeof saved === 'object') {
      return { clinic: saved.clinic || null, events: Array.isArray(saved.events) ? saved.events : [] };
    }
  } catch (error) {
    console.error('D-day 데이터를 불러오지 못했어요:', error);
  }
  return { clinic: null, events: [] };
}

function saveDday() {
  localStorage.setItem(DDAY_KEY, JSON.stringify(ddayData));
}

function ddayText(days) {
  return days === 0 ? 'D-Day' : `D-${days}`;
}

// ===== 맨 위 띠: 외래 + 재고 경고 (세 탭 공통) =====
function clinicHtml() {
  if (clinicFormOpen) {
    return `
      <form class="dday-form clinic-form">
        <span class="dday-form-label">🏥 다음 외래</span>
        <input type="date" name="date" value="${ddayData.clinic || ''}" min="${todayString()}" required>
        <button type="submit" class="btn-small btn-save">저장</button>
        <button type="button" class="btn-small" data-action="clinic-cancel">취소</button>
        ${ddayData.clinic ? '<button type="button" class="link-btn danger" data-action="clinic-clear">날짜 지우기</button>' : ''}
      </form>`;
  }
  if (!ddayData.clinic) {
    return '<button type="button" class="clinic-bar empty" data-action="clinic-open">🏥 외래 날짜 넣기</button>';
  }
  const days = daysUntil(ddayData.clinic);
  if (days < 0) {
    return `<button type="button" class="clinic-bar past" data-action="clinic-open">🏥 지난 외래 ${shortDate(ddayData.clinic)} · 다음 외래 날짜를 넣어 주세요</button>`;
  }
  const level = days === 0 ? ' is-today' : days <= 3 ? ' is-soon' : '';
  return `
    <button type="button" class="clinic-bar${level}" data-action="clinic-open">
      <span>🏥 ${days === 0 ? '오늘 외래' : '다음 외래'}</span>
      <b>${ddayText(days)}</b>
      <span class="clinic-date">${shortDate(ddayData.clinic)}</span>
    </button>`;
}

function stockWarnHtml() {
  if (typeof medData === 'undefined') return '';
  return medData.meds
    .map((m) => ({ m, days: daysOfStock(m) }))
    .filter((x) => x.days <= STOCK_WARN_DAYS)
    .map((x) => `
      <button type="button" class="stock-warn" data-action="go-meds">
        ⚠️ ${escapeHtml(x.m.name)} ${x.days === 0 ? '재고가 거의 없어요' : `재고 ${x.days}일분 남음`}
      </button>`).join('');
}

function renderTopBar() {
  if (!topBar) return;
  topBar.innerHTML = clinicHtml() + stockWarnHtml();
}

// ===== 📌 중요 일정 (할 일 탭) =====
function upcomingEvents() {
  const today = todayString();
  return ddayData.events.filter((e) => e.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
}

function renderEvents() {
  if (!eventsBox) return;
  const items = upcomingEvents().map((e) => {
    const days = daysUntil(e.date);
    return `
      <li class="event-item${days === 0 ? ' is-today' : days <= 7 ? ' is-soon' : ''}">
        <b class="event-dday">${ddayText(days)}</b>
        <span class="event-name">📌 ${escapeHtml(e.name)}</span>
        <span class="event-date">${shortDate(e.date)}</span>
        <button type="button" class="btn-icon btn-delete" data-action="event-delete" data-id="${e.id}" title="삭제">✕</button>
      </li>`;
  }).join('');

  const form = eventFormOpen ? `
    <form class="dday-form event-form">
      <input name="name" maxlength="30" placeholder="일정 이름 (예: 중간고사)" autocomplete="off" required>
      <input type="date" name="date" min="${todayString()}" required>
      <button type="submit" class="btn-small btn-save">추가</button>
      <button type="button" class="btn-small" data-action="event-cancel">취소</button>
    </form>` : '<button type="button" class="event-add" data-action="event-open">📌 + 중요 일정 D-day</button>';

  eventsBox.innerHTML = `${items ? `<ul class="event-list">${items}</ul>` : ''}${form}`;
}

// ===== 이벤트 =====
function handleDdayClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === 'clinic-open') { clinicFormOpen = true; renderTopBar(); topBar.querySelector('input')?.focus(); }
  else if (action === 'clinic-cancel') { clinicFormOpen = false; renderTopBar(); }
  else if (action === 'clinic-clear') {
    ddayData.clinic = null; clinicFormOpen = false; saveDday(); renderTopBar(); showToast('외래 날짜를 지웠어요');
  }
  else if (action === 'go-meds') { showTab('meds'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else if (action === 'event-open') { eventFormOpen = true; renderEvents(); eventsBox.querySelector('input')?.focus(); }
  else if (action === 'event-cancel') { eventFormOpen = false; renderEvents(); }
  else if (action === 'event-delete') {
    const target = ddayData.events.find((e) => e.id === id);
    if (!target || !confirm(`"${target.name}" 일정을 삭제할까요?`)) return;
    ddayData.events = ddayData.events.filter((e) => e.id !== id);
    saveDday(); renderEvents(); showToast('일정을 삭제했어요');
  }
}

function handleDdaySubmit(event) {
  const form = event.target;
  if (!form.classList.contains('dday-form')) return;
  event.preventDefault();
  const date = form.elements.date.value;
  if (!date) { showToast('날짜를 골라 주세요'); return; }

  if (form.classList.contains('clinic-form')) {
    ddayData.clinic = date;
    clinicFormOpen = false;
    saveDday();
    renderTopBar();
    showToast(`다음 외래: ${shortDate(date)} · ${ddayText(Math.max(0, daysUntil(date)))}`);
  } else {
    const name = form.elements.name.value.trim();
    if (!name) { showToast('일정 이름을 넣어 주세요'); return; }
    // 지난 일정은 저장할 때 정리
    ddayData.events = upcomingEvents();
    ddayData.events.push({ id: Date.now().toString(36), name, date });
    eventFormOpen = false;
    saveDday();
    renderEvents();
    showToast(`📌 ${name} ${ddayText(Math.max(0, daysUntil(date)))}`);
  }
}

[topBar, eventsBox].forEach((box) => {
  if (!box) return;
  box.addEventListener('click', handleDdayClick);
  box.addEventListener('submit', handleDdaySubmit);
});

// 날짜가 바뀌었을 수 있으니 앱으로 돌아오면 다시 계산 (입력 중이면 그대로)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!clinicFormOpen) renderTopBar();
  if (!eventFormOpen) renderEvents();
});

// ===== 뒤로 가기 2번 종료 =====
// 원리: 화면을 한 번 만지면 방문 기록에 '가짜 한 칸'을 넣어 둠 → 뒤로 가기를 누르면 그 칸만 빠짐(앱 유지)
//      → 그때 꼭 알아야 할 정보(마감 할 일, 외래, 재고) 카드나 안내를 띄우고, 한 번 더 누르면 실제로 종료
// (크롬은 사용자가 화면을 만지기 전에 넣은 칸은 무시하므로, 만질 때 넣음)
const EXIT_HINT = '뒤로 가기를 한 번 더 누르면 종료돼요';
let backGuarded = false;

function armBackGuard() {
  if (backGuarded) return;
  history.pushState({ haru: 'guard' }, '');
  backGuarded = true;
}
['pointerdown', 'keydown'].forEach((type) => document.addEventListener(type, armBackGuard, true));

// 끄기 전에 꼭 확인할 것: 외래 오늘/내일, 재고 3일분 이하
function exitReminders() {
  const lines = [];
  if (ddayData.clinic) {
    const days = daysUntil(ddayData.clinic);
    if (days === 0) lines.push('🏥 오늘 외래 가는 날이에요');
    else if (days === 1) lines.push('🏥 내일 외래예요');
  }
  if (typeof medData !== 'undefined') {
    medData.meds.forEach((m) => {
      const days = daysOfStock(m);
      if (days <= STOCK_WARN_DAYS) lines.push(`⚠️ ${m.name} 재고 ${days}일분 남음`);
    });
  }
  return lines;
}

function showExitNotice() {
  const urgent = getUrgentTodos();
  const reminders = exitReminders();
  if (urgent.length === 0 && reminders.length === 0) { showToast(EXIT_HINT); return; }

  fillDeadlineAlert(urgent);
  if (urgent.length === 0) {
    deadlineTitle.textContent = '끄기 전에 확인하세요';
    document.querySelector('.deadline-sub').textContent = '';
  }
  if (reminders.length > 0) {
    const heading = document.createElement('p');
    heading.className = 'deadline-group-label due-over';
    heading.textContent = '꼭 확인';
    const ul = document.createElement('ul');
    ul.className = 'deadline-list exit-list';
    reminders.forEach((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });
    deadlineGroups.prepend(heading, ul);
  }
  document.getElementById('deadline-hint').textContent = `${EXIT_HINT}
바깥을 누르면 닫기`;
  deadlineAlert.classList.add('is-visible');
}

window.addEventListener('popstate', () => {
  backGuarded = false; // 가짜 칸이 빠짐 → 다음 뒤로 가기는 실제 종료 (그 전에 화면을 만지면 다시 넣음)
  const open = document.querySelectorAll('.overlay.is-visible, .celebration.is-visible');
  if (open.length > 0) {
    // 떠 있는 카드가 있으면 그것부터 닫음
    open.forEach((el) => el.classList.remove('is-visible'));
    showToast(EXIT_HINT);
    return;
  }
  showExitNotice();
});

// ===== 시작 =====
renderTopBar();
renderEvents();
