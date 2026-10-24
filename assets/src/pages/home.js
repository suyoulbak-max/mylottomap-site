// 명당맵 홈 페이지 (/) 렌더러
import { renderLayout } from '../shared/layout.js';
import { escapeHtml } from '../shared/format.js';
import { icon, mapIllustration } from '../shared/icons.js';
import { shopPeriodText, renderDataStatus, getDataUpdateState } from '../shared/data-status.js';
import { groupShopsByRegion, renderMapShopCard, splitRegionName, RANKING_RULE } from '../shared/regions.js';
import { buildWinningRounds } from '../shared/winning-shops.js';
import { filterExplorerShops, roundSummary } from '../shared/map-explorer.js';
import { buildTicker, latestDrawOf, nextDrawBoot } from '../shared/next-draw.js';

/** 최초 HTML에 담는 상위 판매점 수 */
export const TOP_SHOPS = 30;

export function renderHomePage({ siteConfig, site = {}, shopsData, drawsData, updateStatus = null, isFixture = false, explorerMode = 'national', selectedRound = null, currentPath = '/', contentExtra = '', headExtra = '', hasDetail = false, nextDraw = null }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const regions = shopsData?.regions || [];
  const shops = shopsData?.shops || [];
  const dataState = getDataUpdateState({ meta: shopsData?.meta, updateStatus, hasData: shops.length > 0 });

  const winning = explorerMode === 'winning';
  const rounds = buildWinningRounds({ shopsData, drawsData });
  const round = rounds.find(r => r.round === selectedRound) || rounds[0];
  const initialState = { mode: explorerMode, rank: 'rank1', round: round?.round ?? null, region: '', query: '', period: null };
  const periodText = winning && round ? `제${round.round}회 · ${round.date} 추첨` : shopPeriodText(shopsData);
  const groups = groupShopsByRegion(shopsData);

  // 지역 선택: 시도 묶음 안에 '시도 전체'와 시군구
  const bySido = new Map();
  for (const r of regions) {
    const { sido } = splitRegionName(r.name);
    if (!bySido.has(sido)) bySido.set(sido, []);
    bySido.get(sido).push(r);
  }
  const regionOptions = [
    '<option value="">전체 지역</option>',
    ...[...bySido.keys()].map(sido => `<option value="${escapeHtml(sido)}">${escapeHtml(sido)}</option>`),
  ].join('\n');

  // 최초 HTML에는 상위 판매점만 담는다. 전체 목록은 브라우저가 shops.json을 받아 그린다.
  const winShops = shops.filter((s) => s.wins?.length);
  const initialShops = filterExplorerShops(shops, regions, initialState);
  const top = initialShops.slice(0, TOP_SHOPS);
  const shopListHtml = winning && round && !top.length
    ? `<p class="map-empty-state">${round.internet && round.matched ? '이 회차의 1등은 모두 인터넷 구매입니다.' : '확인된 1등 배출 판매점이 없습니다.'}</p>`
    : top.length === 0
    ? `
      <div class="alert alert-info" role="status">
        <p><strong>검증된 판매점 데이터를 준비 중입니다.</strong></p>
        <p class="text-sm mt-1">공식 당첨 판매점 기록을 확인한 판매점부터 순차적으로 제공할 예정입니다.</p>
      </div>
    `
    : top.map((shop) => renderMapShopCard(shop, { periodText, showMethods: winning })).join('\n');

  const regionLinks = groups.length
    ? `<details class="region-links">
          <summary>${icon('map')}시도별 판매점 (${groups.length}개 시도)</summary>
          <p class="region-links-hint">지역을 선택하면 판매점 목록으로 이동합니다.</p>
          <ul class="region-link-list">${groups.map((g) => `<li><a class="region-directory-link" href="${g.path}"><span>${escapeHtml(g.name)}</span><span class="region-directory-count">판매점 ${g.shops.length.toLocaleString('ko-KR')}곳</span><span class="region-directory-arrow" aria-hidden="true">→</span></a></li>`).join('')}</ul>
          <p class="text-xs"><a class="content-link" href="/shops/">지역별 판매점 목록 전체 보기</a></p>
        </details>`
    : '';

  const content = `
    <div class="map-page-layout">
      <!-- 좌측: 검색 / 필터 / 판매점 목록 사이드바 (모바일에서는 하단 패널) -->
      <aside id="map-sidebar" class="map-sidebar">
        <!-- 모바일 전용 접기/펼치기 토글 핸들 -->
        <button id="mobile-sidebar-toggle" class="map-sidebar-toggle" aria-expanded="true" aria-controls="map-sidebar-content">
          <span class="panel-handle" aria-hidden="true"></span>
          <span id="mobile-toggle-text">판매점 목록</span>
        </button>

        <div id="map-sidebar-content" class="map-sidebar-body">
        <div class="map-sidebar-menu">
          ${hasDetail ? '' : `<h1 class="sr-only">${winning ? '회차별 로또 1등 배출 판매점' : '전국 로또 명당맵'}</h1>`}
          <nav class="map-mode-menu" aria-label="판매점 탐색 메뉴">
            <a href="/" class="map-menu-item${winning ? '' : ' is-active'}"${winning ? '' : ' aria-current="page"'}>${icon('map')}<span>전국 명당맵</span></a>
            <a href="/winning-shops/" class="map-menu-item${winning ? ' is-active' : ''}"${winning ? ' aria-current="page"' : ''}>${icon('trophy')}<span>회차별 1등 배출점</span></a>
          </nav>
          <div class="map-sub-menu" role="group" aria-label="${winning ? '회차 조회' : '배출 등수'}">
            ${winning
              ? `<button type="button" class="map-sub-item${round?.round === rounds[0]?.round ? ' is-active' : ''}" data-explorer-view="latest" aria-pressed="${round?.round === rounds[0]?.round}">최신 회차</button><button type="button" class="map-sub-item${round?.round !== rounds[0]?.round ? ' is-active' : ''}" data-explorer-view="past" aria-pressed="${round?.round !== rounds[0]?.round}"${rounds.length < 2 ? ' disabled' : ''}>지난 회차</button>`
              : '<button type="button" class="map-sub-item is-active" data-explorer-rank="rank1" aria-pressed="true">1등 명당</button><button type="button" class="map-sub-item" data-explorer-rank="rank2" aria-pressed="false">2등 명당</button>'}
          </div>
        </div>
        <div class="map-sidebar-body-inner">
        <div class="map-sidebar-header">
          <p id="map-explorer-period" class="map-period">${winning ? '' : '집계 기간 · '}${escapeHtml(periodText)}</p>
          <div id="map-round-summary" class="map-round-summary"${winning ? '' : ' hidden'}>${winning ? roundSummary(round) : ''}</div>

          <form id="shop-filter-form" class="map-filter-group" onsubmit="return false;" role="search">
            ${winning ? `<div id="map-round-field" class="map-filter-field"${round?.round === rounds[0]?.round ? ' hidden' : ''}><label for="round-select" class="form-label">지난 회차 선택</label><select id="round-select" class="form-select">${rounds.slice(1).map(r => `<option value="${r.round}"${r.round === round?.round ? ' selected' : ''}>제${r.round}회 · ${escapeHtml(r.date)}</option>`).join('')}</select></div>` : ''}
            <div class="map-search-row">
              ${icon('search')}
              <label for="shop-search-input" class="sr-only">판매점 상호 또는 주소 검색</label>
              <input type="search" id="shop-search-input" class="form-input" placeholder="상호명 또는 주소 검색" autocomplete="off">
            </div>

            <div class="map-filter-row">
              <div class="map-filter-field">
              <label for="sido-select" class="form-label">시·도</label>
              <select id="sido-select" class="form-select">
                ${regionOptions}
              </select>
              </div>

              <div class="map-filter-field">
              <label for="region-select" class="form-label">시·군·구</label>
              <select id="region-select" class="form-select" disabled>
                <option value="">시·도 먼저 선택</option>
              </select>
              </div>
            </div>
          </form>
          <div id="active-filter-chips" class="filter-chips" aria-label="적용된 검색 조건"></div>
          ${dataState.status !== '정상' ? `<p class="map-update-alert" role="status">${escapeHtml(dataState.status)}</p>` : ''}
        </div>

        <div class="shop-list-header">
          <span id="shop-list-title" role="status">${top.length ? `1등 배출 상위 ${top.length}곳 (전체 ${initialShops.length.toLocaleString('ko-KR')}곳)` : '판매점 목록 (0곳)'}</span>
          <details id="shop-list-rule" class="shop-sort-details">
            <summary>1등 배출 수가 많은 순</summary>
            <p>정렬: ${escapeHtml(RANKING_RULE)}<br>기준: ${escapeHtml(periodText)}</p>
          </details>
          <p class="map-list-note">배출 횟수 ≠ 당첨 확률 <a class="content-link" href="/data-methodology/#shop-count-methodology">집계 기준</a></p>
          ${!winning ? '<p class="map-list-note"><a class="content-link" href="#map-reading-guide">지도 이용·기록 해석 안내</a></p>' : ''}
        </div>

        <div id="shop-list-container" class="shop-list-scroll">
          ${shopListHtml}
        </div>
        <div id="map-data-source" class="map-sidebar-footer">
          ${renderDataStatus({ meta: shopsData?.meta, updateStatus, hasData: shops.length > 0, compact: true,
            sourceLabel: shopsData?.meta?.source?.replace(/\s*\(https?:\/\/[^)]+\)/g, '').split(',')[0] })}
          ${regionLinks}
        </div>
        </div></div>
      </aside>

      <!-- 우측: 네이버 지도 뷰포트 -->
      <section class="map-canvas-container" aria-label="명당 지도">
        <div class="map-viewport">
        <button type="button" id="btn-my-location" class="btn-my-location" aria-label="내 현재 위치로 지도 이동">
          ${icon('locate')}<span class="sr-only">내 위치</span>
        </button>
        <button type="button" id="btn-open-list" class="btn-open-list" aria-label="판매점 목록 펼치기" aria-controls="map-sidebar-content">${icon('bookmark')}</button>

        <div id="map"></div>

        <!-- 지도 로드 실패 또는 API 키 미설정 시 대체 안내 -->
        <div id="map-fallback-view" class="map-fallback-view" style="display: none;">
          <div class="map-fallback-box">
            <div class="map-fallback-icon">${mapIllustration()}</div>
            <h2 class="map-fallback-title">판매점 탐색은 계속할 수 있어요</h2>
            <p class="map-fallback-desc">지도를 연결하고 있습니다.</p>
            <p class="map-fallback-help"><span class="desktop-list-label">왼쪽 목록</span><span class="mobile-list-label">아래 목록</span>에서 판매점을 선택하고 길찾기를 이용하세요.</p>
            <a href="/shops/" class="btn btn-primary">전체 판매점 목록 보기</a>
          </div>
        </div>
        </div>

        <!-- 판매점 선택 시 표시되는 상세 모달/카드 -->
        <div id="shop-detail-modal" class="shop-detail-modal" style="display: none;" role="dialog" aria-modal="false" aria-labelledby="detail-shop-name">
          <div class="shop-detail-header">
            <h3 id="detail-shop-name" class="shop-detail-title">-</h3>
            <button type="button" id="btn-close-detail" class="shop-detail-close" aria-label="상세 정보 닫기">${icon('close')}</button>
          </div>
          <p id="detail-shop-address" class="shop-detail-address">-</p>
          <div id="detail-shop-wins" class="shop-detail-wins-list">
            <h5>확인된 배출 이력 (${escapeHtml(periodText)})</h5>
            <div id="detail-wins-content">-</div>
          </div>
          <div class="shop-detail-actions">
            <a id="detail-naver-link" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm btn-block">네이버 지도 길찾기 ${icon('external')}</a>
          </div>
        </div>
      </section>
    </div>
    ${!winning ? `<section id="map-reading-guide" class="map-archive-links content-page themed-page" aria-labelledby="map-reading-title">
      <div class="card">
        <h2 id="map-reading-title" class="section-title mb-3">명당맵에서 확인할 수 있는 것</h2>
        <p class="mb-4">마이로또맵은 동행복권의 당첨 기록을 판매점·지역·회차별로 묶어, 같은 기간의 배출 이력을 지도와 목록에서 비교하는 서비스입니다. 현재 집계 범위는 <strong>${escapeHtml(periodText)}</strong>입니다. 이 범위 밖의 이력을 포함한 평생 누적 순위는 아닙니다.</p>
        <h3 class="font-bold mb-2">방문할 판매점을 찾는 순서</h3>
        <ol class="list-inside space-y-1 mb-4">
          <li>시·도와 시·군·구를 고른 뒤 상호나 주소로 좁혀 보세요.</li>
          <li>1등·2등 중 비교할 등수를 선택하고, 같은 집계 기간의 기록을 확인하세요.</li>
          <li>판매점 카드에서 배출 회차를 확인한 뒤 길찾기를 여세요. 현재 목록에서 확인되지 않는 점포는 폐업·이전 가능성이 있어 방문 전 확인이 필요합니다.</li>
        </ol>
        <h3 class="font-bold mb-2">숫자가 커도 당첨 확률을 뜻하지는 않습니다</h3>
        <p class="mb-4">지도 묶음의 숫자는 판매점 수이고, 카드의 1등·2등 숫자는 해당 기간의 당첨 기록 수입니다. 같은 판매점에서 한 회차에 여러 건의 당첨이 나올 수 있습니다. 판매량과 구매자 수가 없으므로 이 기록으로 점포별 당첨률이나 다음 당첨 가능성을 계산할 수는 없습니다.</p>
        <p class="mb-4"><a class="content-link" href="/guides/shop-win-count/">배출 횟수를 해석할 때 알아둘 점</a> · <a class="content-link" href="/data-methodology/">출처와 집계 방법 확인</a></p>
        <h3 class="font-bold mb-2">결과를 읽고 내 번호 확인하기</h3>
        <p class="mb-4"><a class="content-link" href="/results/">회차별 결과</a>에서는 본번호와 보너스를 구분하고, 그 회차 이전의 기록과 번호 구성을 비교할 수 있습니다. <a class="content-link" href="/my-numbers/">내 번호</a>는 저장한 대상 회차와 비교합니다. 저장 내용은 해당 브라우저에만 남습니다.</p>
        <p><a class="content-link" href="/guides/reading-draw-1246/">1246회 사례: 연속 번호와 홀짝을 읽는 방법</a> · <a class="content-link" href="/guides/">전체 이용 가이드</a></p>
      </div>
    </section>` : ''}
    ${contentExtra}
  `;

  const latestDraw = latestDrawOf(drawsData);
  const boot = JSON.stringify({ mode: explorerMode, round: round?.round ?? null, rounds: rounds.map(({ shops: entries, bySido, methods, ...r }) => r), regions, period: shopsData?.meta?.period }).replace(/</g, '\\u003c');

  return renderLayout({
    site,
    navTicker: buildTicker({ nextDraw, latestDraw, shopCount: winShops.length }),
    title: winning ? `${selectedRound ? `제${round?.round}회` : '회차별'} 로또 1등 배출 판매점 - 마이로또맵` : '마이로또맵 - 전국 로또 1·2등 배출 판매점 명당맵과 당첨 결과',
    description: `${periodText} 기준 전국 로또 1·2등 배출 판매점을 지역·상호로 찾고, 회차별 당첨 결과와 번호 통계를 확인하세요.`,
    canonicalUrl: `${siteUrl}${currentPath}`,
    currentPath,
    mapPage: true,
    headExtra,
    isFixture,
    content,
    scriptExtra: `<script id="map-explorer-data" type="application/json">${boot}</script><script type="module" src="/assets/client/home.js"></script>${nextDrawBoot(nextDraw, latestDraw?.round ?? null)}<script type="module" src="/assets/client/next-draw.js"></script>`,
  });
}
