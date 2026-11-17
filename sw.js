// 서비스 워커: 인터넷이 없어도 앱이 열리게 파일을 저장(캐시)해 둠
// 방식: 인터넷이 되면 항상 최신 파일을 받아오고(그리고 캐시 갱신), 안 되면 캐시에서 꺼내 씀
// → git push 한 수정 사항이 바로 반영되면서도 오프라인에서 동작

const CACHE_NAME = 'harugyeol-v3'; // 파일 구성이 바뀌면 숫자를 올림
const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './meds.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

// 설치: 앱 파일을 미리 캐시에 저장
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting(); // 새 버전이 오면 기다리지 않고 바로 적용
});

// 활성화: 이름이 다른 옛날 캐시는 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
    ),
  );
  self.clients.claim();
});

// 요청 처리: 네트워크 먼저, 실패하면 캐시
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
