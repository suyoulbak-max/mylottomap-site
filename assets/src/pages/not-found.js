// 없는 주소 안내 (dist/404.html). Cloudflare Pages는 최상위 404.html을 404 상태로 제공한다(docs/deploy.md).
import { renderLayout } from '../shared/layout.js';

export function renderNotFoundPage({ site = {}, isFixture = false }) {
  const content = `
    <div class="card text-center py-12">
      <h1 class="text-2xl font-bold mb-2">페이지를 찾을 수 없습니다</h1>
      <p class="text-slate-500 mb-6">주소가 바뀌었거나 아직 제공하지 않는 페이지입니다.</p>
      <div class="flex gap-2 justify-center">
        <a href="/" class="btn btn-primary">명당맵으로 가기</a>
        <a href="/results/" class="btn btn-secondary">당첨 결과 보기</a>
        <a href="/shops/" class="btn btn-secondary">지역별 판매점 보기</a>
      </div>
    </div>
  `;
  // 상대 경로 대신 절대 경로 자원만 쓰므로 어느 깊이의 없는 주소에서도 같은 화면이 나온다.
  return renderLayout({
    site,
    title: '페이지를 찾을 수 없음 - 마이로또맵',
    description: '요청한 페이지를 찾을 수 없습니다.',
    canonicalUrl: '',
    currentPath: '/404/',
    noindex: true,
    isFixture,
    content,
  });
}
