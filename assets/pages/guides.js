// 가이드 목록 (/guides/) 렌더러
import { renderLayout } from '../shared/layout.js';
import { escapeHtml } from '../shared/format.js';
import { icon } from '../shared/icons.js';

export function renderGuidesPage({ siteConfig, guides, site = {}, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const items = guides.map((g) => `
        <li class="card guide-card">
          <span class="guide-card-icon" aria-hidden="true">${icon('bookmark')}</span>
          <h2><a href="/guides/${escapeHtml(g.slug)}/" class="content-link">${escapeHtml(g.title)}</a></h2>
          <p class="text-slate-600 mb-2">${escapeHtml(g.description)}</p>
          <p class="guide-card-meta">수정일 ${escapeHtml(g.updatedAt)} <span aria-hidden="true">읽어보기 →</span></p>
        </li>`).join('');

  const content = `
    <div class="content-page themed-page info-page guides-page">
      <div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('bookmark')}</span>
        <div><h1 class="mb-2">로또 이용 가이드</h1>
        <p>마이로또맵의 번호 도구 사용법과 당첨 결과·통계·명당 정보를 읽는 방법을 정리했습니다.</p></div>
      </div>
      <ul class="guide-grid">${items}
      </ul>
    </div>
  `;
  return renderLayout({
    title: '로또 이용 가이드 - 마이로또맵',
    description: '로또 6/45 당첨 확률, 번호 통계 읽는 법, 번호 생성·저장과 당첨 확인, 명당 배출 횟수 해석을 설명하는 마이로또맵 가이드 목록입니다.',
    canonicalUrl: `${siteUrl}/guides/`,
    currentPath: '/guides/',
    isFixture,
    site,
    content,
  });
}
