// 가이드 목록 (/guides/) 렌더러
import { renderLayout } from '../shared/layout.js';
import { escapeHtml } from '../shared/format.js';
import { icon } from '../shared/icons.js';

export function renderGuidesPage({ siteConfig, guides, site = {}, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const sections = [
    { id: 'practical-guides', title: '실용 가이드', description: '당첨 확인·수령·보관과 번호 통계를 이해하는 데 필요한 안내입니다.', guides: guides.filter((g) => g.category !== 'column') },
    { id: 'winner-stories', title: '꿈·당첨 사연', description: '과거 보도 속 당첨자의 이야기와 꿈 설문을 출처·한계와 함께 읽는 칼럼입니다.', guides: guides.filter((g) => g.category === 'column') },
  ];
  const sectionsHtml = sections.filter((s) => s.guides.length).map((s) => `<section class="mb-8" aria-labelledby="${s.id}">
      <div class="section-header"><h2 id="${s.id}" class="section-title">${s.title}</h2><p class="section-desc">${s.description}</p></div>
      <ul class="guide-grid">${s.guides.map((g) => `
        <li class="card guide-card">
          <span class="guide-card-icon" aria-hidden="true">${icon('bookmark')}</span>
          <h3><a href="/guides/${escapeHtml(g.slug)}/" class="content-link">${escapeHtml(g.title)}</a></h3>
          <p class="text-slate-600 mb-2">${escapeHtml(g.description)}</p>
          <p class="guide-card-meta">수정일 ${escapeHtml(g.updatedAt)} <span aria-hidden="true">읽어보기 →</span></p>
        </li>`).join('')}</ul></section>`).join('');

  const content = `
    <div class="content-page themed-page info-page guides-page">
      <div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('bookmark')}</span>
        <div><h1 class="mb-2">로또 이용 가이드</h1>
        <p>당첨금 수령과 복권 보관부터 번호 통계, 꿈·당첨 사연까지 출처와 함께 읽어 보세요.</p></div>
      </div>
      <nav class="mb-8" aria-label="가이드 분류"><a class="content-link" href="#practical-guides">실용 가이드</a> · <a class="content-link" href="#winner-stories">꿈·당첨 사연</a></nav>
      ${sectionsHtml}
    </div>
  `;
  return renderLayout({
    title: '로또 이용 가이드 - 마이로또맵',
    description: '로또 당첨금 수령·세금·복권 보관 실용 가이드와 번호 통계 해설, 꿈 설문과 1등 당첨자의 과거 사연을 읽는 마이로또맵 가이드·칼럼 목록입니다.',
    canonicalUrl: `${siteUrl}/guides/`,
    currentPath: '/guides/',
    isFixture,
    site,
    content,
  });
}
