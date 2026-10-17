// 판매점 목록 (/shops/) 렌더러: 시도별 판매점 수와 1등·2등 건수, 시도 페이지 링크
import { renderLayout } from '../shared/layout.js';
import { escapeHtml } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { renderDataStatus, getDataUpdateState } from '../shared/data-status.js';
import { groupShopsByRegion, internetWinsText, WIN_COUNT_NOTICE } from '../shared/regions.js';
import { scopeText, renderShopSources } from './shops-region.js';

export function renderShopsPage({ siteConfig, site = {}, shopsData, updateStatus = null, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const groups = groupShopsByRegion(shopsData);
  const shops = groups.flatMap((g) => g.shops);
  const scope = scopeText(shopsData);
  const n = (v) => v.toLocaleString('ko-KR');
  const state = getDataUpdateState({ meta: shopsData?.meta, updateStatus, hasData: shops.length > 0 });

  const bodyContent = shops.length === 0
    ? `
      <div class="card text-center py-12">
        <div class="empty-state-icon" aria-hidden="true">${icon('store')}</div>
        <h2 class="text-xl font-bold mb-2">검증된 판매점 데이터를 준비 중입니다.</h2>
        <p class="text-slate-500">공식 당첨 판매점 기록을 확인한 판매점부터 순차적으로 등록됩니다.</p>
      </div>
    `
    : `
      <section class="card">
        <div class="section-header">
          <h2 class="section-title">${icon('map')} 시도별 판매점</h2>
          <p class="section-desc">총 ${n(shops.length)}곳 · ${groups.length}개 시도 (${escapeHtml(scope)})</p>
        </div>
        <div class="table-wrap">
          <table class="data-table directory-table" role="table">
            <caption class="sr-only">시도별 1·2등 배출 판매점 수와 배출 건수</caption>
            <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">시도</th><th scope="col" role="columnheader">판매점</th><th scope="col" role="columnheader">1등 건수</th><th scope="col" role="columnheader">2등 건수</th></tr></thead>
            <tbody role="rowgroup">
              ${groups.map((g) => `<tr role="row"><th scope="row" role="rowheader"><a class="content-link" href="${g.path}">${escapeHtml(g.name)}<span class="directory-region-arrow" aria-hidden="true"> →</span></a></th><td role="cell"><span class="mobile-label">판매점</span>${n(g.shops.length)}곳</td><td role="cell"><span class="mobile-label">1등 건수</span>${n(g.rank1)}건</td><td role="cell"><span class="mobile-label">2등 건수</span>${n(g.rank2)}건</td></tr>`).join('\n              ')}
            </tbody>
          </table>
        </div>
      </section>
    `;

  const content = `
    <div class="shops-page-container content-page themed-page">
      <div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('store')}</span>
        <div><h1 class="mb-2">전국 로또 1·2등 배출 판매점</h1>
        <p>당첨 이력이 확인된 판매점을 시도별로 찾아보세요.<br>집계: ${escapeHtml(scope)}</p></div>
      </div>
      <section class="region-summary" aria-label="전국 배출 기록 요약">
        <div><span>판매점</span><strong>${shops.length ? n(shops.length) : '—'}<small>곳</small></strong></div>
        <div><span>1등 건수</span><strong>${shops.length ? n(groups.reduce((sum, g) => sum + g.rank1, 0)) : '—'}<small>건</small></strong></div>
        <div><span>2등 건수</span><strong>${shops.length ? n(groups.reduce((sum, g) => sum + g.rank2, 0)) : '—'}<small>건</small></strong></div>
      </section>
      ${state.status !== '정상' ? `<p class="alert alert-info" role="status">${escapeHtml(state.status)}</p>` : ''}
      ${bodyContent}
      <div class="shop-data-note">
        <p>배출 횟수는 당첨 확률을 뜻하지 않습니다. <a class="content-link" href="/data-methodology/#shop-count-methodology">집계 기준</a></p>
        <details><summary>집계 출처·판매점 상태 안내</summary>
          <p>${escapeHtml(WIN_COUNT_NOTICE)}</p>
          ${internetWinsText(shopsData?.meta) ? `<p>${escapeHtml(internetWinsText(shopsData.meta))}</p>` : ''}
          ${renderShopSources(shopsData)}
        </details>
      </div>
      ${renderDataStatus({ meta: shopsData?.meta, updateStatus, hasData: shops.length > 0, compact: true, sourceLabel: '동행복권 공식 당첨 판매점 화면' })}
    </div>
  `;

  return renderLayout({
    site,
    title: `전국 로또 1·2등 배출 판매점 - ${scope} - 마이로또맵`,
    description: `${scope} 전국 로또 1·2등 배출 판매점 ${n(shops.length)}곳을 시도별 판매점 수와 1등·2등 건수로 정리했습니다.`,
    canonicalUrl: `${siteUrl}/shops/`,
    currentPath: '/shops/',
    isFixture,
    content,
  });
}
