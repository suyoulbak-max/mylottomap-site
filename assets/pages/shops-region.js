// 지역별 판매점 페이지 (/shops/<시도>/, /shops/<시도>/<시군구>/) 렌더러
import { renderLayout } from '../shared/layout.js';
import { escapeHtml } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { shopPeriodText, renderDataStatus } from '../shared/data-status.js';
import { groupShopsByRegion, renderShopDirectoryCard, WIN_COUNT_NOTICE } from '../shared/regions.js';

/** 시도 페이지에 보여 주는 상위 판매점 수 */
const SIDO_TOP_SHOPS = 10;
const n = (v) => v.toLocaleString('ko-KR');

/** 제목·설명용 집계 범위: '1193~1244회(52회) 기준' */
export function scopeText(shopsData) {
  const p = shopsData?.meta?.period;
  return p?.fromRound && p?.toRound
    ? `${p.fromRound}~${p.toRound}회(${p.toRound - p.fromRound + 1}회) 기준`
    : '수집 기간 준비 중';
}

/** 당첨 이력 출처와 영업 상태 배지의 뜻 */
export function renderShopSources(shopsData) {
  const sources = [...new Set((shopsData?.shops || []).map((s) => s.winsSource).filter(Boolean))];
  return `<p class="data-coverage">당첨 이력 출처: ${escapeHtml(sources.length ? sources.join(' · ') : '데이터 준비 중')}<br>영업 상태: 판매점 목록 출처와 주소가 일치하면 '현재 판매점 목록 확인', 찾지 못하면 '현재 목록에서 확인 안 됨(폐업·이전 가능)'으로 표시합니다.</p>`;
}

const summaryRow = (label, g) => `<tr><th scope="row">${label}</th><td>${n(g.shops.length)}곳</td><td>${n(g.rank1)}건</td><td>${n(g.rank2)}건</td></tr>`;

function summaryTable(caption, rows) {
  return `<div class="table-wrap">
          <table class="data-table">
            <caption class="sr-only">${escapeHtml(caption)}</caption>
            <thead><tr><th scope="col">지역</th><th scope="col">판매점</th><th scope="col">1등 건수</th><th scope="col">2등 건수</th></tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>`;
}

const linkList = (label, items) => items.length
  ? `<nav class="card mt-6" aria-label="${escapeHtml(label)}"><h2 class="section-title mb-3">${icon('map')} ${escapeHtml(label)}</h2><ul class="region-link-list">${items.map((x) => `<li><a class="filter-chip" href="${x.path}">${escapeHtml(x.label)}</a></li>`).join('')}</ul></nav>`
  : '';

function breadcrumb(items) {
  return `<nav class="breadcrumb text-sm mb-4" aria-label="현재 위치"><a class="content-link" href="/shops/">전국 판매점</a>${items.map((x) => ` / ${x.path ? `<a class="content-link" href="${x.path}">${escapeHtml(x.label)}</a>` : `<span aria-current="page">${escapeHtml(x.label)}</span>`}`).join('')}</nav>`;
}

const cardGrid = (shops, opts) => `<div class="shop-directory-grid">${shops.map((s) => renderShopDirectoryCard(s, opts)).join('\n')}</div>`;

function regionIntro(name, group, scope) {
  return `<div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('store')}</span>
        <div><h1 class="mb-2">${escapeHtml(name)} 로또 1·2등 배출 판매점</h1>
        <p>수집 기간의 배출 기록을 지역·판매점별로 확인하세요.<br>집계: ${escapeHtml(scope)}</p></div>
      </div>
      <section class="region-summary" aria-label="지역 배출 기록 요약">
        <div><span>판매점</span><strong>${n(group.shops.length)}<small>곳</small></strong></div>
        <div><span>1등 건수</span><strong>${n(group.rank1)}<small>건</small></strong></div>
        <div><span>2등 건수</span><strong>${n(group.rank2)}<small>건</small></strong></div>
      </section>`;
}

/**
 * 지역 페이지 목록. 시도는 판매점 1곳 이상, 시군구는 MIN_SIGUNGU_SHOPS 이상일 때만 만든다.
 * 반환: [{ path(percent-encoding), html }]
 */
export function renderRegionPages({ siteConfig, site = {}, shopsData, updateStatus = null, isFixture = false }) {
  const siteUrl = (siteConfig?.siteUrl || 'https://mylottomap.com').replace(/\/+$/, '');
  const groups = groupShopsByRegion(shopsData);
  const scope = scopeText(shopsData);
  const periodText = shopPeriodText(shopsData);
  const common = `
      <div class="shop-data-note">
        <p>${escapeHtml(WIN_COUNT_NOTICE)}</p>
        <details><summary>집계 출처·판매점 상태 안내</summary>${renderShopSources(shopsData)}</details>
      </div>
      ${renderDataStatus({ meta: shopsData?.meta, updateStatus, hasData: true, compact: true, sourceLabel: '동행복권 공식 당첨 판매점 화면' })}`;
  const page = ({ path, title, description, content }) => ({
    path,
    html: renderLayout({ site, title, description, canonicalUrl: `${siteUrl}${path}`, currentPath: decodeURI(path), isFixture, content }),
  });
  const pages = [];

  for (const g of groups) {
    const otherSido = groups.filter((o) => o !== g).map((o) => ({ path: o.path, label: `${o.name} ${n(o.shops.length)}곳` }));
    const withPage = g.sigungus.filter((s) => s.path);
    const inline = g.sigungus.filter((s) => !s.path);
    const label = (s) => (s.name ? `${g.name} ${s.name}` : g.name);

    pages.push(page({
      path: g.path,
      title: `${g.name} 로또 1·2등 배출 판매점 - ${n(g.shops.length)}곳, ${scope} - 마이로또맵`,
      description: `${g.name} 지역 로또 1·2등 배출 판매점 ${n(g.shops.length)}곳의 상호·주소·배출 회차를 ${scope}으로 정리했습니다. 1등 ${n(g.rank1)}건, 2등 ${n(g.rank2)}건.`,
      content: `
    <div class="shops-page-container content-page themed-page">
      ${breadcrumb([{ label: g.name }])}
      ${regionIntro(g.name, g, scope)}
      ${common}
      <section class="card">
        <h2 class="section-title mb-3">${icon('map')} 시군구별 판매점</h2>
        ${summaryTable(`${g.name} 시군구별 판매점 수와 배출 건수`, g.sigungus.map((s) => summaryRow(s.path ? `<a class="content-link" href="${s.path}">${escapeHtml(s.name)}</a>` : escapeHtml(s.name || g.name), s)))}
      </section>
      ${withPage.length ? `<section class="card mt-6">
        <h2 class="section-title mb-3">${icon('store')} ${escapeHtml(g.name)} 1등 배출 상위 ${Math.min(SIDO_TOP_SHOPS, g.shops.length)}곳</h2>
        <p class="section-desc mb-3">정렬: 1등 배출 수 → 2등 배출 수 → 최근 당첨 회차</p>
        ${cardGrid(g.shops.slice(0, SIDO_TOP_SHOPS), { periodText })}
      </section>` : ''}
      ${inline.map((s) => `<section class="card mt-6">
        <h2 class="section-title mb-3">${icon('store')} ${escapeHtml(label(s))} 판매점 ${n(s.shops.length)}곳</h2>
        ${cardGrid(s.shops, { periodText })}
      </section>`).join('')}
      ${linkList('다른 시도 판매점', otherSido)}
    </div>`,
    }));

    for (const s of withPage) {
      const siblings = withPage.filter((o) => o !== s).map((o) => ({ path: o.path, label: `${o.name} ${n(o.shops.length)}곳` }));
      pages.push(page({
        path: s.path,
        title: `${label(s)} 로또 1·2등 배출 판매점 - ${n(s.shops.length)}곳, ${scope} - 마이로또맵`,
        description: `${label(s)} 로또 1·2등 배출 판매점 ${n(s.shops.length)}곳의 상호·주소·배출 회차와 길찾기를 ${scope}으로 안내합니다. 1등 ${n(s.rank1)}건, 2등 ${n(s.rank2)}건.`,
        content: `
    <div class="shops-page-container content-page themed-page">
      ${breadcrumb([{ label: g.name, path: g.path }, { label: s.name }])}
      ${regionIntro(label(s), s, scope)}
      ${common}
      <section class="card">
        <h2 class="section-title mb-3">${icon('store')} 판매점 목록</h2>
        <p class="section-desc mb-3">정렬: 1등 배출 수 → 2등 배출 수 → 최근 당첨 회차</p>
        ${cardGrid(s.shops, { periodText })}
      </section>
      ${linkList(`${g.name} 다른 시군구`, [{ path: g.path, label: `${g.name} 전체 ${n(g.shops.length)}곳` }, ...siblings])}
    </div>`,
      }));
    }
  }
  return pages;
}
