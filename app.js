// 할 일 관리 앱
// 구조: 데이터(todos 배열)가 바뀌면 → saveTodos()로 저장 → render()로 화면 전체를 다시 그림

const STORAGE_KEY = 'todos';
const CATEGORIES = ['업무', '개인', '공부'];

// ===== 화면 요소 =====
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const categorySelect = document.getElementById('todo-category');
const dueInput = document.getElementById('todo-due');
const deadlineAlert = document.getElementById('deadline-alert');
const deadlineTitle = document.getElementById('deadline-title');
const deadlineGroups = document.getElementById('deadline-groups');
const list = document.getElementById('todo-list');
const toast = document.getElementById('toast');
const confettiCanvas = document.getElementById('confetti');
const celebration = document.getElementById('celebration');
const quoteText = document.getElementById('quote-text');
const quoteAuthor = document.getElementById('quote-author');
const quoteHanja = document.getElementById('quote-hanja');
const quoteReading = document.getElementById('quote-reading');
const celebrationMessage = document.getElementById('celebration-message');
const celebrationQuote = document.getElementById('celebration-quote');

// ===== 축하 카드에 띄울 명언 (출처가 비교적 확실한 것만) =====
// 한자 명언은 { hanja: 한자, reading: 음, text: 뜻풀이, author: 출처 } 형태로 한자·음·뜻을 함께 보여줌
const QUOTES = [
  { text: '적지만, 무르익은 것을.', author: '카를 프리드리히 가우스 (평생의 좌우명)' },
  { text: '수학은 과학의 여왕이고, 정수론은 수학의 여왕이다.', author: '카를 프리드리히 가우스' },
  { text: '가장 큰 즐거움을 주는 것은 지식 자체가 아니라 배우는 행위이고, 도달한 상태가 아니라 도달해 가는 과정이다.', author: '카를 프리드리히 가우스 (1808년, 볼야이에게 보낸 편지)' },
  { text: '내가 더 멀리 보았다면, 그것은 거인들의 어깨 위에 서 있었기 때문이다.', author: '아이작 뉴턴 (1675년, 훅에게 보낸 편지)' },
  { text: '우리는 무언가에 재능이 있다고 믿어야 하고, 어떤 대가를 치르더라도 그것을 이뤄내야 한다.', author: '마리 퀴리' },
  { text: '첫 번째 원칙은 자기 자신을 속이지 않는 것이다. 그리고 가장 속이기 쉬운 사람은 바로 자기 자신이다.', author: '리처드 파인만' },
  { text: '내가 만들 수 없는 것은, 내가 이해하지 못한 것이다.', author: '리처드 파인만 (마지막 칠판에 남긴 글)' },
  { text: '중요한 것은 질문을 멈추지 않는 것이다.', author: '알베르트 아인슈타인' },
  { text: '인생은 자전거를 타는 것과 같다. 균형을 잡으려면 계속 움직여야 한다.', author: '알베르트 아인슈타인 (1930년, 아들에게 보낸 편지)' },
  { text: '관찰의 영역에서 우연은 준비된 마음만을 돕는다.', author: '루이 파스퇴르' },
  { text: '모든 사람은 원한다면 자기 뇌의 조각가가 될 수 있다.', author: '산티아고 라몬 이 카할' },
  { text: '인생은 짧고, 의술은 길다.', author: '히포크라테스' },
  { text: '나는 내 성공의 이유를 이것으로 돌린다. 나는 핑계를 대지도, 받아주지도 않았다.', author: '플로렌스 나이팅게일' },
  { text: '한 시간을 감히 낭비하는 사람은 아직 삶의 가치를 발견하지 못한 것이다.', author: '찰스 다윈 (누이에게 보낸 편지)' },
  { text: '잃어버린 시간은 다시 찾을 수 없다.', author: '벤저민 프랭클린' },
  { text: '어려워서 감히 하지 못하는 것이 아니다. 감히 하지 않기 때문에 어려운 것이다.', author: '세네카' },
  { text: '앞을 가로막는 것이 곧 길이 된다.', author: '마르쿠스 아우렐리우스, 《명상록》' },

  // 한자 명언 · 고사성어
  { hanja: '學而時習之 不亦說乎', reading: '학이시습지 불역열호', text: '배우고 때때로 익히면 또한 기쁘지 아니한가.', author: '공자, 《논어》 학이편' },
  { hanja: '知之爲知之 不知爲不知 是知也', reading: '지지위지지 부지위부지 시지야', text: '아는 것을 안다고 하고, 모르는 것을 모른다고 하는 것이 진정 아는 것이다.', author: '공자, 《논어》 위정편' },
  { hanja: '必死則生 必生則死', reading: '필사즉생 필생즉사', text: '죽고자 하면 살고, 살고자 하면 죽는다.', author: '이순신, 《난중일기》' },
  { hanja: '盡人事待天命', reading: '진인사대천명', text: '사람으로서 할 수 있는 일을 다 하고 나서 하늘의 뜻을 기다린다.', author: '고사성어' },
  { hanja: '磨斧作針', reading: '마부작침', text: '도끼를 갈아 바늘을 만든다. 아무리 어려운 일도 끈기 있게 하면 이룰 수 있다.', author: '고사성어 (이백의 일화)' },
  { hanja: '愚公移山', reading: '우공이산', text: '어리석은 노인이 산을 옮긴다. 한 가지 일을 꾸준히 하면 결국 이룬다.', author: '《열자》' },
  { hanja: '水滴穿石', reading: '수적천석', text: '물방울이 떨어져 돌을 뚫는다. 작은 노력도 쌓이면 큰일을 해낸다.', author: '고사성어' },
  { hanja: '日新又日新', reading: '일신우일신', text: '날마다 새로워지고, 또 날마다 새로워진다.', author: '《대학》' },
  { hanja: '有志竟成', reading: '유지경성', text: '뜻이 있으면 마침내 이룬다.', author: '《후한서》' },
  { hanja: '千里之行 始於足下', reading: '천리지행 시어족하', text: '천 리 길도 발밑 한 걸음에서 시작된다.', author: '노자, 《도덕경》' },
  { hanja: '知之者不如好之者 好之者不如樂之者', reading: '지지자불여호지자 호지자불여낙지자', text: '아는 사람은 좋아하는 사람만 못하고, 좋아하는 사람은 즐기는 사람만 못하다.', author: '공자, 《논어》 옹야편' },

  // 탈무드 (미쉬나 《아보트》, 출처가 분명한 것만)
  { text: '내가 나를 위하지 않으면 누가 나를 위하겠는가? 내가 나만을 위한다면 나는 무엇인가? 지금이 아니면 언제인가?', author: '힐렐, 탈무드 《아보트》 1:14' },
  { text: '말은 적게 하고, 행동은 많이 하라.', author: '샴마이, 탈무드 《아보트》 1:15' },
  { text: '그 일을 끝마치는 것이 네 의무는 아니지만, 그만둘 자유도 너에게는 없다.', author: '랍비 타르폰, 탈무드 《아보트》 2:16' },
  { text: '누가 지혜로운가? 모든 사람에게서 배우는 사람이다.', author: '벤 조마, 탈무드 《아보트》 4:1' },
  { text: '누가 강한가? 자기 자신을 다스리는 사람이다.', author: '벤 조마, 탈무드 《아보트》 4:1' },
  { text: '누가 부유한가? 자기 몫에 만족하는 사람이다.', author: '벤 조마, 탈무드 《아보트》 4:1' },
  { text: '한 생명을 구하는 사람은 온 세상을 구하는 것이다.', author: '탈무드 《산헤드린》 4:5' },
];
const todayText = document.getElementById('today');
const filterBar = document.getElementById('filters');
const totalText = document.getElementById('progress-total-text');
const totalBar = document.getElementById('progress-total-bar');
const categoryProgressItems = document.querySelectorAll('.progress-categories li');

// ===== 데이터 =====
// 할 일 하나: { id, text, category, done, createdAt, completedAt, dueDate }
// completedAt: 완료 체크한 시각 (미완료이거나 기록 없으면 null/없음)
// dueDate: 마감일 'YYYY-MM-DD' 문자열 (없으면 null/없음)
let todos = loadTodos();
let editingId = null; // 지금 수정 중인 할 일의 id (없으면 null)
let currentFilter = '전체'; // 화면에 보여줄 카테고리 (저장하지 않음, 표시용)

// localStorage에서 목록을 불러옴 (없거나 깨져 있으면 빈 배열)
function loadTodos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('저장된 데이터를 불러오지 못했어요:', error);
    return [];
  }
}

// 현재 목록을 localStorage에 저장
function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// id로 할 일 하나를 찾음
function findTodo(id) {
  return todos.find((todo) => todo.id === id);
}

// ===== 날짜 도우미 =====
// 오늘 날짜를 'YYYY-MM-DD'로 (내 휴대폰 시간대 기준)
function todayString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 마감일까지 남은 날 수 (내일=1, 오늘=0, 어제=-1)
function daysUntil(dueDate) {
  const [y, m, d] = dueDate.split('-').map(Number);
  const now = new Date();
  const due = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86400000);
}

// 남은 날 수 → 표시 글자와 색 종류
function dueLabel(days) {
  if (days < 0) return { text: `${-days}일 지남`, level: 'over' };
  if (days === 0) return { text: 'D-day · 오늘', level: 'today' };
  if (days === 1) return { text: 'D-1 · 내일', level: 'soon' };
  return { text: `D-${days}`, level: 'later' };
}

// 새 할 일을 만들어 목록에 넣고 저장
function addTodo(text, category, dueDate) {
  const todo = {
    id: Date.now().toString(),
    text: text,
    category: category,
    done: false,
    createdAt: Date.now(),
    completedAt: null,
    dueDate: dueDate || null,
  };
  todos.push(todo);
  saveTodos();
  render();
  showToast('추가됐어요');
}

// 완료/미완료를 뒤집고 저장 (완료하면 그 시각을 기록, 풀면 지움)
function toggleTodo(id) {
  const todo = findTodo(id);
  if (!todo) return;
  todo.done = !todo.done;
  todo.completedAt = todo.done ? Date.now() : null;
  saveTodos();
  render();

  // 방금 체크로 전부 완료됐으면 축하, 아니면 보통 토스트
  const allDone = todos.every((item) => item.done);
  if (todo.done && allDone) celebrate();
  else showToast(todo.done ? '완료했어요' : '완료를 취소했어요');
}

// 글자, 카테고리, 마감일을 바꾸고 저장
function updateTodo(id, text, category, dueDate) {
  const todo = findTodo(id);
  if (!todo) return;
  todo.text = text;
  todo.category = category;
  todo.dueDate = dueDate || null;
  editingId = null;
  saveTodos();
  render();
}

// 확인 창을 띄운 뒤 삭제하고 저장
function deleteTodo(id) {
  const todo = findTodo(id);
  if (!todo) return;
  if (!confirm(`"${todo.text}"을(를) 삭제할까요?`)) return;
  todos = todos.filter((item) => item.id !== id);
  saveTodos();
  render();
  showToast('삭제됐어요');
}

// 화면 아래에 알림을 2초간 띄웠다가 숨김
let toastTimer = null;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer); // 연속으로 누르면 이전 타이머는 취소하고 2초를 다시 셈
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2000);
}

// ===== 100% 축하 =====
// 명언 하나를 무작위로 고름 (바로 전에 나온 것은 제외)
let lastQuoteIndex = -1;
function pickQuote() {
  let index;
  do {
    index = Math.floor(Math.random() * QUOTES.length);
  } while (index === lastQuoteIndex && QUOTES.length > 1);
  lastQuoteIndex = index;
  return QUOTES[index];
}

// 축하 카드를 띄우고 폭죽을 터뜨림 (카드 바깥 클릭이나 Esc로 닫힘)
// message: 카드 문구 / withQuote: 명언을 같이 보여줄지 (할 일 100%일 때만)
function celebrate(message = '축하드려요,\n오늘 할 일을 모두 완료했습니다', withQuote = true) {
  celebrationMessage.textContent = message;
  celebrationQuote.hidden = !withQuote;
  if (withQuote) {
    const quote = pickQuote();
    // 한자 명언이면 한자 · 음 · 뜻풀이를 함께
    quoteHanja.hidden = !quote.hanja;
    quoteReading.hidden = !quote.hanja;
    quoteHanja.textContent = quote.hanja || '';
    quoteReading.textContent = quote.reading || '';
    quoteText.textContent = quote.hanja ? quote.text : `“${quote.text}”`;
    quoteAuthor.textContent = `— ${quote.author} —`;
  }

  toast.classList.remove('is-visible'); // 보통 토스트와 겹치지 않게
  celebration.classList.add('is-visible');

  // 움직임 줄이기 설정을 켠 사용자에게는 폭죽 없이 메시지만
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) launchConfetti();
}
function closeCelebration() {
  celebration.classList.remove('is-visible');
}

// 폭죽: 색종이 조각들을 화면 아래쪽에서 위로 쏘아 올리고 중력으로 떨어뜨림
const CONFETTI_COLORS = ['#e8590c', '#2f9e44', '#1c7ed6', '#f59f00', '#e64980', '#7048e8'];
let confettiPieces = [];
let confettiRunning = false;

function launchConfetti() {
  // 화면 크기에 맞춰 그림판 크기 조정 (고해상도 화면에서도 선명하게)
  const ratio = window.devicePixelRatio || 1;
  confettiCanvas.width = window.innerWidth * ratio;
  confettiCanvas.height = window.innerHeight * ratio;
  const ctx = confettiCanvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  // 왼쪽 아래, 오른쪽 아래 두 곳에서 75개씩 발사
  const w = window.innerWidth;
  const h = window.innerHeight;
  [[w * 0.2, 1], [w * 0.8, -1]].forEach(([startX, direction]) => {
    for (let i = 0; i < 75; i++) {
      confettiPieces.push({
        x: startX,
        y: h,
        vx: direction * (Math.random() * 6 + 1) + (Math.random() - 0.5) * 4, // 가로 속도
        vy: -(Math.random() * 10 + Math.max(h / 60, 10)),                    // 세로 속도 (위로)
        size: Math.random() * 6 + 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
      });
    }
  });

  if (!confettiRunning) {
    confettiRunning = true;
    requestAnimationFrame(() => drawConfetti(ctx));
  }
}

// 한 프레임 그리기: 위치 이동 → 그리기 → 화면 밖으로 나간 조각은 제거
function drawConfetti(ctx) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);

  confettiPieces.forEach((p) => {
    p.vy += 0.3;   // 중력
    p.vx *= 0.99;  // 공기 저항
    p.x += p.vx;
    p.y += p.vy;
    p.angle += p.spin;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); // 납작한 직사각형 종잇조각
    ctx.restore();
  });

  confettiPieces = confettiPieces.filter((p) => p.y < h + 20 || p.vy < 0);

  if (confettiPieces.length > 0) {
    requestAnimationFrame(() => drawConfetti(ctx));
  } else {
    ctx.clearRect(0, 0, w, h);
    confettiRunning = false;
  }
}

// 화면에 보이는 할 일들의 새 순서(id 목록)를 전체 배열에 반영하고 저장
// 필터 중이면 보이는 할 일끼리만 자리를 바꾸고, 안 보이는 할 일의 자리는 그대로 둠
function reorderVisible(newVisibleIds) {
  const visibleSet = new Set(newVisibleIds);
  const queue = newVisibleIds.map((id) => findTodo(id));
  todos = todos.map((todo) => (visibleSet.has(todo.id) ? queue.shift() : todo));
  saveTodos();
  render();
}

// 수정 모드 시작 / 취소
function startEdit(id) {
  editingId = id;
  render();
}
function cancelEdit() {
  editingId = null;
  render();
}

// ===== 화면 그리기 =====
// 카테고리 이름 → CSS 클래스
const CATEGORY_CLASS = { 업무: 'cat-work', 개인: 'cat-personal', 공부: 'cat-study' };

// 버튼 하나를 만드는 도우미
function createButton(className, label, title) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  if (title) button.title = title;
  return button;
}

// 완료 시각을 글자로 바꿈
// 오늘: "오후 9:45 완료" / 올해 다른 날: "11월 16일 오후 9:45 완료" / 다른 해: "2025년 11월 16일 ..."
function formatCompletedTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const time = date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

  if (date.toDateString() === now.toDateString()) return `${time} 완료`;

  const dayOptions = { month: 'long', day: 'numeric' };
  if (date.getFullYear() !== now.getFullYear()) dayOptions.year = 'numeric';
  return `${date.toLocaleDateString('ko-KR', dayOptions)} ${time} 완료`;
}

// 할 일 하나를 <li> 요소로 만듦 (보기 모드)
function createTodoElement(todo) {
  const li = document.createElement('li');
  li.className = `todo-item ${CATEGORY_CLASS[todo.category]}`;
  if (todo.done) li.classList.add('is-done');
  li.dataset.id = todo.id;

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'todo-check';
  check.checked = todo.done;

  const title = document.createElement('span');
  title.className = 'todo-title';
  title.textContent = todo.text; // textContent를 써야 입력한 글자가 HTML로 해석되지 않음

  // 글자 + 아랫줄(카테고리 태그, 마감 D-day, 완료 시각)을 세로로 묶는 칸
  // 태그를 아랫줄로 내려서 할 일 글자가 쓸 수 있는 폭을 넓힘
  const body = document.createElement('div');
  body.className = 'todo-body';
  body.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'todo-meta';

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = todo.category;
  meta.appendChild(tag);

  if (todo.dueDate) {
    const label = dueLabel(daysUntil(todo.dueDate));
    const due = document.createElement('small');
    due.className = `due due-${label.level}`;
    due.textContent = `⏰ ${label.text}`;
    due.title = `마감일: ${todo.dueDate}`;
    meta.appendChild(due);
  }
  if (todo.done && todo.completedAt) {
    const time = document.createElement('small');
    time.className = 'todo-time';
    time.textContent = formatCompletedTime(todo.completedAt);
    meta.appendChild(time);
  }
  body.appendChild(meta);

  // 드래그 손잡이 (이걸 잡고 끌어야 순서가 바뀜)
  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '⠿';
  handle.title = '끌어서 순서 바꾸기';

  li.append(
    handle,
    check,
    body,
    createButton('btn-icon btn-edit', '✎', '수정'),
    createButton('btn-icon btn-delete', '✕', '삭제'),
  );
  return li;
}

// 할 일 하나를 <li> 요소로 만듦 (수정 모드: 입력창 + 카테고리 선택 + 저장/취소)
function createEditElement(todo) {
  const li = document.createElement('li');
  li.className = `todo-item is-editing ${CATEGORY_CLASS[todo.category]}`;
  li.dataset.id = todo.id;

  // 여러 줄 입력칸 (글자가 길면 아랫줄로 넘어가며 높이가 늘어남)
  const textInput = document.createElement('textarea');
  textInput.className = 'edit-input';
  textInput.rows = 1;
  textInput.enterKeyHint = 'done';
  textInput.value = todo.text;

  const select = document.createElement('select');
  select.className = 'edit-category';
  CATEGORIES.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.selected = name === todo.category;
    select.appendChild(option);
  });

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'edit-due';
  dateInput.value = todo.dueDate || '';
  dateInput.title = '마감일 (비우면 없음)';

  li.append(
    textInput,
    dateInput,
    select,
    createButton('btn-small btn-save', '저장'),
    createButton('btn-small btn-cancel', '취소'),
  );
  return li;
}

// 완료 수, 전체 수, 퍼센트를 계산
function getProgress(items) {
  const total = items.length;
  const done = items.filter((todo) => todo.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}

// 진행률 영역 갱신 (필터와 상관없이 전체 할 일 기준)
function renderProgress() {
  const all = getProgress(todos);
  totalText.textContent = `${all.done} / ${all.total}, ${all.percent}%`;
  totalBar.style.width = `${all.percent}%`;

  categoryProgressItems.forEach((item) => {
    const category = item.dataset.category;
    const p = getProgress(todos.filter((todo) => todo.category === category));
    item.querySelector('.cat-count').textContent = `${p.done} / ${p.total}`;
    item.querySelector('.bar-fill').style.width = `${p.percent}%`;
  });
}

// 필터 탭의 선택 표시 갱신
function renderFilters() {
  filterBar.querySelectorAll('.filter').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.filter === currentFilter);
  });
}

// 목록 전체를 다시 그림 (목록 + 진행률 + 필터 탭)
function render() {
  const visibleTodos = currentFilter === '전체'
    ? todos
    : todos.filter((todo) => todo.category === currentFilter);

  list.innerHTML = '';
  visibleTodos.forEach((todo) => {
    const element = todo.id === editingId ? createEditElement(todo) : createTodoElement(todo);
    list.appendChild(element);
  });

  // 보여줄 할 일이 없으면 목록 자리에 안내 문구를 고정으로 그림
  if (visibleTodos.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = todos.length === 0
      ? '할 일을 추가해보세요'
      : `'${currentFilter}' 할 일이 없어요`;
    list.appendChild(empty);
  }

  renderProgress();
  renderFilters();

  // 수정 중이면 입력창에 커서를 둠
  const editInput = list.querySelector('.edit-input');
  if (editInput) {
    autoResize(editInput);
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length); // 커서를 맨 끝으로
  }
}

// 오늘 날짜 표시 (예: 2026년 11월 17일 화요일)
function showToday() {
  todayText.textContent = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
}

// 수정 중인 항목의 입력값을 읽어 저장 (빈 칸이면 저장 안 함)
function submitEdit(li) {
  const text = li.querySelector('.edit-input').value.trim();
  const category = li.querySelector('.edit-category').value;
  const dueDate = li.querySelector('.edit-due').value;
  if (text === '') {
    li.querySelector('.edit-input').focus();
    return;
  }
  updateTodo(li.dataset.id, text, category, dueDate);
}

// ===== 여러 줄 입력칸 (할 일 입력, 수정) =====
// 글자 길이에 맞춰 입력칸 높이를 늘리거나 줄임
function autoResize(textarea) {
  textarea.style.height = 'auto';
  const border = textarea.offsetHeight - textarea.clientHeight; // 위아래 테두리 두께도 포함해야 글자가 안 잘림
  textarea.style.height = `${textarea.scrollHeight + border}px`;
}

// 할 일 안에는 줄바꿈을 넣지 않음 (붙여 넣은 글의 줄바꿈은 띄어쓰기로)
function removeLineBreaks(textarea) {
  if (/[\r\n]/.test(textarea.value)) {
    const cursor = textarea.selectionStart;
    textarea.value = textarea.value.replace(/\r?\n/g, ' ');
    textarea.setSelectionRange(cursor, cursor);
  }
}

// 맨 위 입력칸: 글자가 바뀔 때마다 줄바꿈 정리 + 높이 맞춤
input.addEventListener('input', () => {
  removeLineBreaks(input);
  autoResize(input);
});

// 맨 위 입력칸: Enter → 추가 (줄바꿈 대신). 한글 조합 중 Enter는 무시해서 두 번 추가 방지
input.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  form.requestSubmit();
});

// 수정 입력칸도 같은 처리
list.addEventListener('input', (event) => {
  if (!event.target.classList.contains('edit-input')) return;
  removeLineBreaks(event.target);
  autoResize(event.target);
});

// 화면 폭이 바뀌면(휴대폰 회전 등) 줄 수가 달라지니 높이 다시 맞춤
window.addEventListener('resize', () => {
  autoResize(input);
  const editInput = list.querySelector('.edit-input');
  if (editInput) autoResize(editInput);
});

// ===== 이벤트 =====
// 추가 버튼 클릭 또는 Enter → 폼 제출
form.addEventListener('submit', (event) => {
  event.preventDefault(); // 페이지 새로고침 막기
  const text = input.value.trim();
  if (text === '') {
    input.focus();
    return; // 빈 칸이면 추가하지 않음
  }
  addTodo(text, categorySelect.value, dueInput.value);
  input.value = '';
  dueInput.value = '';
  autoResize(input); // 비웠으니 다시 한 줄 높이로
  input.focus();
});

// 필터 탭 클릭 → 해당 카테고리만 보기
filterBar.addEventListener('click', (event) => {
  const button = event.target.closest('.filter');
  if (!button) return;
  currentFilter = button.dataset.filter;
  editingId = null; // 필터를 바꾸면 수정 중이던 것은 취소
  // 카테고리 필터를 고르면 입력창 카테고리도 같이 맞춤 ('전체'면 그대로 둠)
  if (currentFilter !== '전체') categorySelect.value = currentFilter;
  render();
});

// 목록 안의 클릭을 한 곳에서 처리 (이벤트 위임)
list.addEventListener('click', (event) => {
  const li = event.target.closest('.todo-item');
  if (!li) return;
  const id = li.dataset.id;

  if (event.target.classList.contains('todo-check')) toggleTodo(id);
  else if (event.target.classList.contains('btn-edit')) startEdit(id);
  else if (event.target.classList.contains('btn-delete')) deleteTodo(id);
  else if (event.target.classList.contains('btn-save')) submitEdit(li);
  else if (event.target.classList.contains('btn-cancel')) cancelEdit();
});

// ===== 드래그로 순서 바꾸기 =====
// 마우스와 터치를 모두 처리하는 Pointer 이벤트 사용 (휴대폰에서도 동작)
// - ⠿ 손잡이: 누르는 즉시 드래그
// - 칸의 다른 곳: 마우스는 5px 이상 움직이면, 터치는 0.3초 꾹 누르면 드래그
//   (터치로 바로 쓸어내리면 드래그가 아니라 평소처럼 스크롤)
// 끄는 동안 항목을 화면에서 바로 옮기고, 손을 떼면 그 순서를 저장
const MOUSE_DRAG_DISTANCE = 5;   // 마우스: 이만큼(px) 움직이면 드래그 시작
const LONG_PRESS_MS = 300;       // 터치: 이만큼(ms) 누르고 있으면 드래그 시작
const TOUCH_SCROLL_DISTANCE = 10; // 터치: 그 전에 이만큼(px) 움직이면 스크롤로 보고 취소

let draggingItem = null; // 지금 끌고 있는 항목
let pending = null;      // 드래그가 시작될지 기다리는 중인 상태 { item, pointerId, x, y, type, timer }

// 드래그 시작
function startDrag(item, pointerId) {
  draggingItem = item;
  item.classList.add('is-dragging');
  document.body.classList.add('is-dragging-page');
  try {
    item.setPointerCapture(pointerId); // 손가락/마우스가 칸 밖으로 나가도 계속 추적
  } catch (error) { /* 이미 손을 뗀 경우 등은 무시 */ }
  if (navigator.vibrate) navigator.vibrate(20); // 휴대폰이면 살짝 진동으로 시작을 알림
}

// 기다리던 상태 취소
function clearPending() {
  if (pending) clearTimeout(pending.timer);
  pending = null;
}

list.addEventListener('pointerdown', (event) => {
  if (editingId !== null || event.button > 0) return; // 수정 중이거나 마우스 오른쪽 버튼이면 무시
  const item = event.target.closest('.todo-item');
  if (!item) return;

  // 손잡이는 바로 드래그
  if (event.target.closest('.drag-handle')) {
    event.preventDefault();
    startDrag(item, event.pointerId);
    return;
  }

  // 체크박스, 버튼에서는 드래그 시작 안 함 (원래 기능대로)
  if (event.target.closest('input, button, select')) return;

  pending = { item, pointerId: event.pointerId, x: event.clientX, y: event.clientY, type: event.pointerType };
  if (event.pointerType !== 'mouse') {
    pending.timer = setTimeout(() => {
      const { item: pressedItem, pointerId } = pending;
      pending = null;
      startDrag(pressedItem, pointerId);
    }, LONG_PRESS_MS);
  }
});

document.addEventListener('pointermove', (event) => {
  // 아직 드래그 시작 전: 시작할지/취소할지 판단
  if (pending && event.pointerId === pending.pointerId) {
    const distance = Math.hypot(event.clientX - pending.x, event.clientY - pending.y);
    if (pending.type === 'mouse' && distance >= MOUSE_DRAG_DISTANCE) {
      const { item, pointerId } = pending;
      clearPending();
      startDrag(item, pointerId);
    } else if (pending.type !== 'mouse' && distance >= TOUCH_SCROLL_DISTANCE) {
      clearPending(); // 꾹 누르기 전에 움직였으면 스크롤하려는 것
    }
  }

  if (!draggingItem) return;

  // 마우스 위치보다 아래에 중심이 있는 첫 항목 앞에 끼워 넣음 (없으면 맨 끝)
  const others = [...list.querySelectorAll('.todo-item:not(.is-dragging)')];
  const next = others.find((item) => {
    const box = item.getBoundingClientRect();
    return event.clientY < box.top + box.height / 2;
  });
  if (next) list.insertBefore(draggingItem, next);
  else list.appendChild(draggingItem);

  // 화면 위/아래 끝 근처에서는 자동으로 스크롤 (긴 목록, 휴대폰 대비)
  const edge = 60;
  if (event.clientY < edge) window.scrollBy(0, -10);
  else if (event.clientY > window.innerHeight - edge) window.scrollBy(0, 10);
});

// 손을 떼면 바뀐 순서를 저장
function endDrag() {
  clearPending();
  if (!draggingItem) return;
  draggingItem.classList.remove('is-dragging');
  document.body.classList.remove('is-dragging-page');
  draggingItem = null;
  const newOrder = [...list.querySelectorAll('.todo-item')].map((item) => item.dataset.id);
  reorderVisible(newOrder);
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// 휴대폰: 드래그 중에는 화면이 스크롤되지 않게 막음
document.addEventListener('touchmove', (event) => {
  if (draggingItem) event.preventDefault();
}, { passive: false });

// 휴대폰: 꾹 누를 때 뜨는 메뉴(복사/공유 등)가 드래그를 방해하지 않게 막음
list.addEventListener('contextmenu', (event) => {
  if (draggingItem || (pending && pending.type !== 'mouse')) event.preventDefault();
});

// 축하 카드 바깥(어두운 배경)을 클릭했을 때만 닫기 (카드 안을 누르면 그대로)
celebration.addEventListener('click', (event) => {
  if (event.target === celebration) closeCelebration();
});

// Esc 키로도 축하 카드 / 마감 경고 카드 닫기
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (celebration.classList.contains('is-visible')) closeCelebration();
  if (deadlineAlert.classList.contains('is-visible')) closeDeadlineAlert();
  document.getElementById('dose-alert').classList.remove('is-visible');
});

// ===== 마감 경고 카드 =====
// 하루 두 번: 그날 처음 열 때 한 번, 밤(21시 이후) 처음 열 때 한 번
// (브라우저는 앱을 "닫는 순간"에 화면을 띄울 수 없어서, 하루 마무리 시간대로 대신함)
const DEADLINE_SHOWN_KEY = 'deadlineAlertShown'; // { date: 'YYYY-MM-DD', slots: ['day', 'night'] }
const NIGHT_HOUR = 21;

// 마감이 내일 이하(내일, 오늘, 지남)인 미완료 할 일 모으기
function getUrgentTodos() {
  return todos
    .filter((todo) => !todo.done && todo.dueDate && daysUntil(todo.dueDate) <= 1)
    .map((todo) => ({ todo, days: daysUntil(todo.dueDate) }));
}

// 경고 카드 내용 채우기 (지남 / 오늘 / 내일 묶음)
function fillDeadlineAlert(urgent) {
  const groups = [
    { label: '기한 지남', level: 'over', items: urgent.filter((u) => u.days < 0) },
    { label: '오늘 마감', level: 'today', items: urgent.filter((u) => u.days === 0) },
    { label: '내일 마감', level: 'soon', items: urgent.filter((u) => u.days === 1) },
  ].filter((group) => group.items.length > 0);

  // 내일 마감만 있으면 요청하신 문구 그대로, 섞여 있으면 더 넓은 문구
  const onlyTomorrow = groups.length === 1 && groups[0].level === 'soon';
  deadlineTitle.textContent = onlyTomorrow ? '마감일이 내일입니다' : '마감이 다가온 할 일이 있어요';

  deadlineGroups.innerHTML = '';
  groups.forEach((group) => {
    const heading = document.createElement('p');
    heading.className = `deadline-group-label due-${group.level}`;
    heading.textContent = `${group.label} ${group.items.length}개`;

    const ul = document.createElement('ul');
    ul.className = 'deadline-list';
    group.items.forEach(({ todo }) => {
      const li = document.createElement('li');
      li.className = CATEGORY_CLASS[todo.category];
      const text = document.createElement('span');
      text.textContent = todo.text;
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = todo.category;
      li.append(text, tag);
      ul.appendChild(li);
    });
    deadlineGroups.append(heading, ul);
  });
}

// 지금 띄워야 하면 띄움 (이번 시간대에 이미 띄웠으면 건너뜀)
function checkDeadlineAlert() {
  const urgent = getUrgentTodos();
  if (urgent.length === 0) return;

  const now = new Date();
  const today = todayString(now);
  const slot = now.getHours() >= NIGHT_HOUR ? 'night' : 'day';

  let shown = { date: today, slots: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(DEADLINE_SHOWN_KEY));
    if (saved && saved.date === today) shown = saved;
  } catch (error) { /* 기록이 깨졌으면 새로 시작 */ }
  if (shown.slots.includes(slot)) return;

  // 밤에 처음 열었으면 낮 몫도 함께 본 것으로 침 (같은 날 두 번 연속 뜨지 않게)
  shown.slots = slot === 'night' ? ['day', 'night'] : [...shown.slots, 'day'];
  try { localStorage.setItem(DEADLINE_SHOWN_KEY, JSON.stringify(shown)); } catch (error) { /* 무시 */ }

  fillDeadlineAlert(urgent);
  deadlineAlert.classList.add('is-visible');
}

function closeDeadlineAlert() {
  deadlineAlert.classList.remove('is-visible');
}

// 카드 바깥 클릭 → 닫기
deadlineAlert.addEventListener('click', (event) => {
  if (event.target === deadlineAlert) closeDeadlineAlert();
});

// 설치한 앱은 껐다 켜지 않고 다시 화면으로 돌아오는 경우가 많아서, 돌아올 때도 확인
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    render(); // 날짜가 바뀌었으면 D-day도 새로 계산
    checkDeadlineAlert();
  }
});

// 수정 중 Enter → 저장, Esc → 취소
list.addEventListener('keydown', (event) => {
  const li = event.target.closest('.is-editing');
  if (!li || event.isComposing) return; // 한글 조합 중에 누른 Enter는 무시 (두 번 실행 방지)
  if (event.key === 'Enter') {
    event.preventDefault(); // 여러 줄 입력칸이라도 Enter는 줄바꿈이 아니라 저장
    submitEdit(li);
  }
  else if (event.key === 'Escape') cancelEdit();
});

// ===== 하단 탭 (할 일 / 복약 / 건강수첩) =====
const TAB_KEY = 'activeTab'; // 마지막으로 본 탭을 기억 (다시 열면 그 탭부터)
const tabBar = document.getElementById('tab-bar');

// 탭 전환: 해당 화면만 보이고, 탭 버튼 강조
function showTab(name) {
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.dataset.view !== name;
  });
  tabBar.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active);
  });
  try { localStorage.setItem(TAB_KEY, name); } catch (error) { /* 저장 실패해도 탭 전환은 됨 */ }
}

tabBar.addEventListener('click', (event) => {
  const tab = event.target.closest('.tab');
  if (tab) showTab(tab.dataset.tab);
});

// ===== 시작 =====
showToday();
render();
const savedTab = localStorage.getItem(TAB_KEY);
showTab(['todo', 'meds', 'health'].includes(savedTab) ? savedTab : 'todo');
checkDeadlineAlert();

// 날짜·시각 칸: 작은 아이콘이 아니라 칸 아무 곳이나 눌러도 선택 창이 열리게
document.addEventListener('click', (event) => {
  const input = event.target.closest('input[type="date"], input[type="time"], input[type="datetime-local"]');
  if (!input || typeof input.showPicker !== 'function') return;
  try { input.showPicker(); } catch (error) { /* 이미 열려 있거나 지원 안 함 → 기본 동작 */ }
});

// PWA: 서비스 워커 등록 (오프라인 실행 + 앱 설치 가능하게)
// 내 컴퓨터에서 index.html을 더블클릭해 열 때(file://)는 지원 안 되므로 건너뜀
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((error) => {
    console.error('서비스 워커 등록 실패:', error);
  });
}
