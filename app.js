// 할 일 관리 앱
// 구조: 데이터(todos 배열)가 바뀌면 → saveTodos()로 저장 → render()로 화면 전체를 다시 그림

const STORAGE_KEY = 'todos';
const CATEGORIES = ['업무', '개인', '공부'];

// ===== 화면 요소 =====
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const categorySelect = document.getElementById('todo-category');
const list = document.getElementById('todo-list');
const emptyMessage = document.getElementById('empty');
const todayText = document.getElementById('today');
const filterBar = document.getElementById('filters');
const totalText = document.getElementById('progress-total-text');
const totalBar = document.getElementById('progress-total-bar');
const categoryProgressItems = document.querySelectorAll('.progress-categories li');

// ===== 데이터 =====
// 할 일 하나: { id, text, category, done, createdAt }
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
  };
  todos.push(todo);
  saveTodos();
  render();
}

// 완료/미완료를 뒤집고 저장
function toggleTodo(id) {
  const todo = findTodo(id);
  if (!todo) return;
  todo.done = !todo.done;
  saveTodos();
  render();
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

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = todo.category;

  li.append(
    check,
    title,
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

  // 비어 있을 때 안내 문구
  if (todos.length === 0) {
    emptyMessage.textContent = '할 일이 없어요. 위에서 추가해 보세요.';
  } else {
    emptyMessage.textContent = `'${currentFilter}' 할 일이 없어요.`;
  }
  emptyMessage.hidden = visibleTodos.length > 0;

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
