// 할 일 관리 앱
// 구조: 데이터(todos 배열)가 바뀌면 → saveTodos()로 저장 → render()로 화면 전체를 다시 그림

const STORAGE_KEY = 'todos';
const CATEGORIES = ['업무', '개인', '공부'];

// ===== 화면 요소 =====
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const categorySelect = document.getElementById('todo-category');
const list = document.getElementById('todo-list');
const toast = document.getElementById('toast');
const confettiCanvas = document.getElementById('confetti');
const celebration = document.getElementById('celebration');
const quoteText = document.getElementById('quote-text');
const quoteAuthor = document.getElementById('quote-author');

// ===== 축하 카드에 띄울 명언 (출처가 비교적 확실한 것만) =====
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
  { text: '배우고 때때로 익히면 또한 기쁘지 아니한가.', author: '공자, 《논어》' },
  { text: '아는 것을 안다고 하고, 모르는 것을 모른다고 하는 것이 진정 아는 것이다.', author: '공자, 《논어》' },
  { text: '죽고자 하면 살고, 살고자 하면 죽는다.', author: '이순신, 《난중일기》' },
];
const todayText = document.getElementById('today');
const filterBar = document.getElementById('filters');
const totalText = document.getElementById('progress-total-text');
const totalBar = document.getElementById('progress-total-bar');
const categoryProgressItems = document.querySelectorAll('.progress-categories li');

// ===== 데이터 =====
// 할 일 하나: { id, text, category, done, createdAt, completedAt }
// completedAt: 완료 체크한 시각 (미완료이거나 기록 없으면 null/없음)
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

// 새 할 일을 만들어 목록에 넣고 저장
function addTodo(text, category) {
  const todo = {
    id: Date.now().toString(),
    text: text,
    category: category,
    done: false,
    createdAt: Date.now(),
    completedAt: null,
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

// 글자와 카테고리를 바꾸고 저장
function updateTodo(id, text, category) {
  const todo = findTodo(id);
  if (!todo) return;
  todo.text = text;
  todo.category = category;
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

// 축하 카드(명언 포함)를 띄우고 폭죽을 터뜨림 (카드 바깥 클릭이나 Esc로 닫힘)
function celebrate() {
  const quote = pickQuote();
  quoteText.textContent = `“${quote.text}”`;
  quoteAuthor.textContent = `— ${quote.author}`;

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

  // 글자 + (완료 시각) 을 세로로 묶는 칸
  const body = document.createElement('div');
  body.className = 'todo-body';
  body.appendChild(title);
  if (todo.done && todo.completedAt) {
    const time = document.createElement('small');
    time.className = 'todo-time';
    time.textContent = formatCompletedTime(todo.completedAt);
    body.appendChild(time);
  }

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = todo.category;

  li.append(
    check,
    body,
    tag,
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

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'edit-input';
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

  li.append(
    textInput,
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
  if (editInput) editInput.focus();
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
  if (text === '') {
    li.querySelector('.edit-input').focus();
    return;
  }
  updateTodo(li.dataset.id, text, category);
}

// ===== 이벤트 =====
// 추가 버튼 클릭 또는 Enter → 폼 제출
form.addEventListener('submit', (event) => {
  event.preventDefault(); // 페이지 새로고침 막기
  const text = input.value.trim();
  if (text === '') {
    input.focus();
    return; // 빈 칸이면 추가하지 않음
  }
  addTodo(text, categorySelect.value);
  input.value = '';
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

// 축하 카드 바깥(어두운 배경)을 클릭했을 때만 닫기 (카드 안을 누르면 그대로)
celebration.addEventListener('click', (event) => {
  if (event.target === celebration) closeCelebration();
});

// Esc 키로도 축하 카드 닫기
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && celebration.classList.contains('is-visible')) closeCelebration();
});

// 수정 중 Enter → 저장, Esc → 취소
list.addEventListener('keydown', (event) => {
  const li = event.target.closest('.is-editing');
  if (!li || event.isComposing) return; // 한글 조합 중에 누른 Enter는 무시 (두 번 실행 방지)
  if (event.key === 'Enter') submitEdit(li);
  else if (event.key === 'Escape') cancelEdit();
});

// ===== 시작 =====
showToday();
render();
