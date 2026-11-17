// 할 일 관리 앱
// 구조: 데이터(todos 배열)가 바뀌면 → saveTodos()로 저장 → render()로 화면 전체를 다시 그림

const STORAGE_KEY = 'todos';

// ===== 화면 요소 =====
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const categorySelect = document.getElementById('todo-category');
const list = document.getElementById('todo-list');
const emptyMessage = document.getElementById('empty');
const todayText = document.getElementById('today');

// ===== 데이터 =====
// 할 일 하나: { id, text, category, done, createdAt }
let todos = loadTodos();

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

// ===== 화면 그리기 =====
// 카테고리 이름 → CSS 클래스
const CATEGORY_CLASS = { 업무: 'cat-work', 개인: 'cat-personal', 공부: 'cat-study' };

// 할 일 하나를 <li> 요소로 만듦
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

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'btn-icon';
  editButton.title = '수정';
  editButton.textContent = '✎';

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'btn-icon btn-delete';
  deleteButton.title = '삭제';
  deleteButton.textContent = '✕';

  li.append(check, title, tag, editButton, deleteButton);
  return li;
}

// 목록 전체를 다시 그림
function render() {
  list.innerHTML = '';
  todos.forEach((todo) => list.appendChild(createTodoElement(todo)));
  emptyMessage.hidden = todos.length > 0;
}

// 오늘 날짜 표시 (예: 2026년 11월 17일 화요일)
function showToday() {
  todayText.textContent = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
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

// ===== 시작 =====
showToday();
render();
