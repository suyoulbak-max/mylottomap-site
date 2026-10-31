// 명당맵 홈 클라이언트 스크립트
import { MapManager } from '../map/manager.js';
import { createSettingsStore } from '../storage/settings.js';
import { escapeHtml } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { hasWinHistory, shopPeriodText } from '../shared/data-status.js';
import { rankShops, renderMapShopCard, shopStatusLabel } from '../shared/regions.js';
import { explorerState, explorerUrl, filterExplorerShops, explorerViewport, regionGroups, roundSummary, explorerEmptyMessage } from '../shared/map-explorer.js';

// 한 번에 그리는 목록 카드 수. 전국 수천 곳을 한꺼번에 DOM에 넣지 않는다.
const PAGE_SIZE = 100;

document.addEventListener('DOMContentLoaded', async () => {
  let storage;
  try { storage = window.localStorage; } catch { /* 기본 지역 없이 지도를 이용한다. */ }
  const settingsStore = createSettingsStore(storage);
  const currentSettings = settingsStore.get()?.settings || { defaultRegion: null, mapType: 'normal' };

  // 엘리먼트 참조
  const mapContainer = document.getElementById('map');
  const fallbackEl = document.getElementById('map-fallback-view');
  const myLocationBtn = document.getElementById('btn-my-location');
  const searchInput = document.getElementById('shop-search-input');
  const regionSelect = document.getElementById('region-select');
  const sidoSelect = document.getElementById('sido-select');
  const roundSelect = document.getElementById('round-select');
  const roundYearSelect = document.getElementById('round-year-select');
  const boot = JSON.parse(document.getElementById('map-explorer-data').textContent);
  const groups = regionGroups(boot.regions);
  let state = explorerState(new URLSearchParams(window.location.search), { ...boot, region: currentSettings.defaultRegion || '' });
  const shopListContainer = document.getElementById('shop-list-container');
  const coordinateNotice = document.createElement('details');
  coordinateNotice.className = 'map-update-alert';
  coordinateNotice.hidden = true;
  shopListContainer.before(coordinateNotice);
  const viewportNotice = document.createElement('p');
  viewportNotice.className = 'map-list-note map-viewport-note';
  viewportNotice.hidden = true;
  viewportNotice.textContent = '상위 100곳 표시 · 확대하면 더 많은 판매점을 볼 수 있습니다';
  shopListContainer.before(viewportNotice);
  let viewportBounds = null;
  const mobileToggleBtn = document.getElementById('mobile-sidebar-toggle');
  const mobileToggleText = document.getElementById('mobile-toggle-text');
  const sidebarEl = document.getElementById('map-sidebar');
  const detailModal = document.getElementById('shop-detail-modal');
  const detailName = document.getElementById('detail-shop-name');
  const detailAddress = document.getElementById('detail-shop-address');
  const detailWinsContent = document.getElementById('detail-wins-content');
  const detailNaverLink = document.getElementById('detail-naver-link');
  const btnCloseDetail = document.getElementById('btn-close-detail');

  let allShops = [];
  let shopsLoaded = false;
  let shownCount = PAGE_SIZE;
  const listTitle = document.getElementById('shop-list-title');
  let periodText = '배출 이력 기준 기간 준비 중';
  let fullPeriodText = periodText;
  const urlParams = new URLSearchParams(window.location.search);
  let naverKeyId = '';
  let selectedShopId = null;
  let sheetState = 'collapsed';
  let listCount = null;
  const mobileView = window.matchMedia('(max-width: 1023px)');
  const mapLayout = document.querySelector('.map-page-layout');
  const mapHeader = document.querySelector('.site-header');
  const mapNav = document.querySelector('.nav-main-links');
  const searchDialog = document.getElementById('map-search-dialog');
  const sidebarParent = sidebarEl.parentElement;
  const sidebarNext = sidebarEl.nextSibling;
  let savedScroll = 0;
  let returnFocus = null;
  function fitSearchDialog() {
    const viewport = window.visualViewport;
    searchDialog.style.setProperty('--map-dialog-height', `${viewport?.height || window.innerHeight}px`);
    searchDialog.style.setProperty('--map-dialog-top', `${viewport?.offsetTop || 0}px`);
  }
  window.visualViewport?.addEventListener('resize', fitSearchDialog);
  window.visualViewport?.addEventListener('scroll', fitSearchDialog);
  function fitMobileMap() {
    if (!mobileView.matches || searchDialog.open) return;
    const offset = mapLayout.getBoundingClientRect().top + window.scrollY + mapNav.getBoundingClientRect().height;
    mapLayout.style.setProperty('--map-mobile-offset', `${offset}px`);
  }
  const shellResize = new ResizeObserver(fitMobileMap);
  shellResize.observe(mapHeader);
  shellResize.observe(mapNav);
  fitMobileMap();
  const filterChips = document.getElementById('active-filter-chips');

  // 1. 설정 및 데이터 불러오기
  try {
    const configRes = await fetch('/assets/site.config.json');
    if (configRes.ok) {
      const cfg = await configRes.json();
      naverKeyId = cfg.naverMapKeyId || '';
    }
  } catch (e) {
    console.warn('site.config.json 로드 실패:', e);
  }

  try {
    const shopsRes = await fetch('/assets/data/shops.json');
    if (shopsRes.ok) {
      const sData = await shopsRes.json();
      allShops = rankShops(sData.shops || []);
      periodText = shopPeriodText(sData);
      fullPeriodText = periodText;
      state.period = state.mode === 'national' ? explorerState(urlParams, { ...boot, period: sData.meta?.period }).period : null;
      shopsLoaded = true;
    }
  } catch (e) {
    console.warn('shops.json 로드 실패:', e);
  }

  const targetShopId = urlParams.get('shop');
  const targetShop = allShops.find(shop => shop.id === targetShopId);
  const requestedRegion = urlParams.has('region') ? urlParams.get('region') : targetShop?.region;
  if (requestedRegion != null) {
    state.region = requestedRegion;
  } else if (urlParams.has('fromRound')) {
    state.region = '';
  }
  const targetWins = (targetShop?.wins || []).filter(w => !state.period || (w.round >= state.period.from && w.round <= state.period.to));
  if (targetShop && state.mode === 'national' && !urlParams.has('rank')
    && !targetWins.some(w => w.rank === 1)) state.rank = 'rank2';
  restoreInputs();

  // 2. MapManager 초기화
  const mapManager = new MapManager({
    container: mapContainer,
    fallbackEl,
    ncpKeyId: naverKeyId,
    mapType: currentSettings.mapType || 'normal',
    onSelectShop: (shopId) => {
      selectShop(shopId, true);
    },
    onError: (msg) => {
      alert(msg);
    },
    onViewportChange: bounds => {
      viewportBounds = bounds;
      shownCount = PAGE_SIZE;
      renderViewportList(filterShops());
    },
  });

  mapManager.init(filterShops()).then(() => {
    const filtered = filterShops();
    mapManager.setShops(filtered);
    mapManager.selectShop(selectedShopId);
    const selected = filtered.find(shop => shop.id === selectedShopId);
    if (selected) mapManager.panToShop(selected);
    else mapManager.fitShops(filtered);
    viewportBounds = mapManager.getViewport();
    renderViewportList(filtered);
  });

  // 3. 판매점 필터링 함수
  function filterShops() {
    return filterExplorerShops(allShops, boot.regions, state);
  }

  function restoreInputs() {
    const region = [...groups.values()].flat().find(r => r.id === state.region);
    const sido = state.region.startsWith('sido:') ? state.region.slice(5) : region?.sido || '';
    sidoSelect.value = groups.has(sido) ? sido : '';
    regionSelect.innerHTML = sidoSelect.value
      ? `<option value="">${escapeHtml(sidoSelect.value)} 전체</option>${groups.get(sidoSelect.value).map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.sigungu || r.sido)}</option>`).join('')}`
      : '<option value="">시·도 먼저 선택</option>';
    regionSelect.disabled = !sidoSelect.value;
    regionSelect.value = region?.id || '';
    state.region = regionSelect.value || (sidoSelect.value ? `sido:${sidoSelect.value}` : '');
    searchInput.value = state.query;
    restoreRoundInputs();
  }

  function restoreRoundInputs() {
    if (!roundSelect) return;
    const round = boot.rounds.find(r => r.round === state.round);
    roundYearSelect.value = round?.year || '';
    roundSelect.innerHTML = boot.rounds.filter(r => r.year === round?.year).map(r => `<option value="${r.round}">제${r.round}회 · ${escapeHtml(r.date)}</option>`).join('');
    roundSelect.value = String(state.round);
    const index = boot.rounds.indexOf(round);
    document.getElementById('round-older').disabled = index < 0 || index === boot.rounds.length - 1;
    document.getElementById('round-newer').disabled = index <= 0;
    document.getElementById('round-year-link').href = `/winning-shops/${round?.year || ''}/`;
    document.getElementById('round-jump-error').textContent = '';
  }

  function updateMenu() {
    document.querySelectorAll('[data-explorer-rank], [data-explorer-view]').forEach(button => {
      const active = button.dataset.explorerRank ? button.dataset.explorerRank === state.rank : button.dataset.explorerView === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const round = boot.rounds.find(r => r.round === state.round);
    if (state.mode === 'winning') {
      restoreRoundInputs();
      document.getElementById('map-round-field').hidden = state.view !== 'past';
      document.getElementById('map-current-round').textContent = round ? `제${round.round}회 · ${round.date}` : '회차 데이터 준비 중';
      document.getElementById('map-round-summary').innerHTML = roundSummary(round);
      document.getElementById('round-details')?.toggleAttribute('hidden', state.round !== boot.round);
      periodText = round ? `제${round.round}회 · ${round.date} 추첨` : '회차 데이터 준비 중';
      document.title = `제${state.round || ''}회 로또 1등 배출 판매점 - 마이로또맵`;
    } else periodText = state.period ? `${state.period.from}회 ~ ${state.period.to}회` : fullPeriodText;
    document.getElementById('map-explorer-period').textContent = `${state.mode === 'winning' ? '' : '집계 기간 · '}${periodText}`;
    const rule = document.getElementById('shop-list-rule');
    rule.querySelector('summary').textContent = `${state.rank === 'rank2' ? '2등' : '1등'} 배출 수가 많은 순`;
    rule.querySelector('p').textContent = `정렬: 선택 등수 배출 수, 최근 당첨 회차, 상호 순 · 기준: ${periodText}`;
    document.querySelector('#detail-shop-wins h5').textContent = `선택 조건의 배출 이력 (${periodText})`;
  }

  // 4. 화면 및 마커 갱신
  function updateListAndMap(moveMap = true) {
    if (!shopsLoaded) {
      // 전체 목록을 받지 못하면 서버가 그린 상위 목록과 지역 링크를 그대로 둔다.
      listTitle.textContent = '전체 목록을 불러오지 못했습니다. 상위 목록과 시도별 페이지를 이용하세요.';
      document.querySelectorAll('#shop-filter-form input, #shop-filter-form select, .map-sub-menu button').forEach(control => { control.disabled = true; });
      bindListClickEvents();
      return;
    }
    const filtered = filterShops();
    updateMenu();
    filterChips.innerHTML = [
      state.region ? `<button class="filter-chip active" type="button" data-clear-filter="region" aria-label="지역 필터 해제">${escapeHtml(regionSelect.value ? `${sidoSelect.value} ${regionSelect.selectedOptions[0].textContent}` : `${sidoSelect.value} 전체`)} ${icon('close')}</button>` : '',
      state.period ? `<button class="filter-chip active" type="button" data-clear-filter="period" aria-label="기간 필터 해제">${state.period.from}~${state.period.to}회 ${icon('close')}</button>` : '',
    ].join('');
    if (!filtered.some(shop => shop.id === selectedShopId)) {
      selectedShopId = null;
      detailModal.style.display = 'none';
      mapManager.selectShop(null);
    }

    // 지도 핀 동기화
    mapManager.setShops(filtered);
    if (moveMap) mapManager.fitShops(filtered);

    renderViewportList(filtered);
  }

  function renderViewportList(filtered) {
    if (!shopsLoaded) return;
    const result = explorerViewport(filtered, viewportBounds);
    listTitle.textContent = `${viewportBounds ? '현재 지도에서 찾은' : '조건에 맞는'} 판매점 ${result.total.toLocaleString('ko-KR')}곳`;
    listCount = result.total;
    if (sheetState === 'collapsed') setSheetState(sheetState);
    viewportNotice.hidden = !result.limited;
    coordinateNotice.hidden = !viewportBounds || !result.missing.length;
    coordinateNotice.innerHTML = `<summary>좌표 미확보 ${result.missing.length.toLocaleString('ko-KR')}곳</summary><p>좌표가 없어 지도에 표시되지 않는 판매점입니다.</p>`;
    let missingShown = PAGE_SIZE;
    const missingList = document.createElement('div');
    coordinateNotice.append(missingList);
    const renderMissing = () => {
      missingList.innerHTML = result.missing.slice(0, missingShown).map(shop => renderMapShopCard(shop, { periodText, selected: shop.id === selectedShopId, showMethods: state.mode === 'winning' })).join('')
        + (result.missing.length > missingShown ? '<button type="button" class="btn btn-secondary btn-block" data-more-missing>좌표 미확보 판매점 더 보기</button>' : '');
      missingList.querySelector('[data-more-missing]')?.addEventListener('click', () => { missingShown += PAGE_SIZE; renderMissing(); });
      bindListClickEvents(missingList);
    };
    coordinateNotice.ontoggle = () => { if (coordinateNotice.open) renderMissing(); };
    if (coordinateNotice.open) renderMissing();
    const filteredCount = filtered.length;
    filtered = result.shops;

    // 사이드바 목록 갱신
    if (filtered.length === 0) {
      shopListContainer.innerHTML = `<p class="map-empty-state">${escapeHtml(explorerEmptyMessage({ hasData: allShops.length > 0, filteredCount, hasBounds: !!viewportBounds, query: state.query }))}</p>`;
      return;
    }

    const visible = filtered.slice(0, shownCount);
    shopListContainer.innerHTML = visible.map((shop) => renderMapShopCard(shop, { periodText, selected: shop.id === selectedShopId, showMethods: state.mode === 'winning' })).join('\n')
      + (filtered.length > visible.length
        ? `<button type="button" id="btn-more-shops" class="btn btn-secondary btn-block">더 보기 (${visible.length.toLocaleString('ko-KR')} / ${filtered.length.toLocaleString('ko-KR')}곳)</button>`
        : '');
    document.getElementById('btn-more-shops')?.addEventListener('click', () => {
      shownCount += PAGE_SIZE;
      renderViewportList(filterShops());
    });

    bindListClickEvents(shopListContainer);
  }

  // 5. 판매점 선택 동기화 (핀·목록·카드)
  function selectShop(shopId, panMap = true) {
    const shop = filterShops().find((s) => s.id === shopId);
    if (!shop) return;
    selectedShopId = shopId;
    mapManager.selectShop(shopId);

    // 목록 항목 하이라이트 및 스크롤
    document.querySelectorAll('.shop-card-item').forEach((item) => {
      const isTarget = item.dataset.shopId === shopId;
      item.classList.toggle('selected', isTarget);
      item.setAttribute('aria-pressed', String(isTarget));
      if (isTarget && !mobileView.matches) {
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    // 지도 중심 이동
    if (panMap) {
      mapManager.panToShop(shop);
    }

    // 상세 카드 열기
    detailName.textContent = shop.name;
    detailAddress.textContent = `${shop.address} · ${shopStatusLabel(shop.status)}`;
    
    // 배출 이력 텍스트
    const wins = shop.wins || [];
    if (wins.length === 0) {
      detailWinsContent.textContent = hasWinHistory(shop) ? '확인된 1·2등 배출 0회' : '당첨 이력 미확보';
    } else {
      detailWinsContent.innerHTML = wins.map((w) => {
        const methodStr = w.method ? ` (${escapeHtml(w.method)})` : '';
        const badgeCls = w.rank === 1 ? 'badge-gold' : 'badge-silver';
        return `<div class="mb-1"><span class="badge ${badgeCls}">${w.rank}등</span> <strong>${w.round}회차</strong>${methodStr}</div>`;
      }).join('');
    }

    detailNaverLink.href = `https://map.naver.com/v5/search/${encodeURIComponent(shop.address || shop.name)}`;
    detailModal.style.display = 'block';
    if (mobileView.matches) setSheetState('collapsed');
  }

  function bindListClickEvents(root = document) {
    root.querySelectorAll('.shop-card-item').forEach((card) => {
      const shopId = card.dataset.shopId;
      const handler = () => selectShop(shopId, true);
      card.addEventListener('click', handler);
      card.addEventListener('keydown', (e) => {
        if (e.target !== card) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });
  }

  // 필터 이벤트 바인딩
  const resetAndUpdate = event => {
    state.query = searchInput.value;
    state.region = regionSelect.value || (sidoSelect.value ? `sido:${sidoSelect.value}` : '');
    shownCount = PAGE_SIZE;
    selectedShopId = null;
    detailModal.style.display = 'none';
    const url = explorerUrl(state);
    if (window.location.pathname + window.location.search !== url) {
      window.history[event?.type === 'input' ? 'replaceState' : 'pushState'](null, '', url);
    }
    updateListAndMap();
  };
  searchInput.addEventListener('input', resetAndUpdate);
  sidoSelect.addEventListener('change', () => {
    state.region = sidoSelect.value ? `sido:${sidoSelect.value}` : '';
    restoreInputs();
    resetAndUpdate();
  });
  regionSelect.addEventListener('change', resetAndUpdate);
  document.querySelectorAll('[data-explorer-rank]').forEach(button => button.addEventListener('click', () => {
    state.rank = button.dataset.explorerRank;
    resetAndUpdate();
  }));
  document.querySelectorAll('[data-explorer-view]').forEach(button => button.addEventListener('click', () => {
    state.view = button.dataset.explorerView;
    if (state.view === 'latest') state.round = boot.rounds[0]?.round;
    resetAndUpdate();
    if (state.view === 'past') {
      setSheetState('full');
      roundYearSelect.focus({ preventScroll: true });
      roundYearSelect.scrollIntoView({ block: 'nearest' });
    }
  }));
  roundSelect?.addEventListener('change', () => {
    state.round = Number(roundSelect.value);
    resetAndUpdate();
  });
  roundYearSelect?.addEventListener('change', () => {
    state.round = boot.rounds.find(r => r.year === roundYearSelect.value)?.round;
    resetAndUpdate();
  });
  for (const [id, step] of [['round-older', 1], ['round-newer', -1]]) {
    document.getElementById(id)?.addEventListener('click', () => {
      const next = boot.rounds[boot.rounds.findIndex(r => r.round === state.round) + step];
      if (!next) return;
      state.round = next.round;
      resetAndUpdate();
    });
  }
  const jumpInput = document.getElementById('round-jump-input');
  const jumpRound = () => {
    const round = boot.rounds.find(r => r.round === Number(jumpInput.value));
    if (!round) {
      document.getElementById('round-jump-error').textContent = '확보된 회차 번호를 입력해 주세요.';
      jumpInput.focus();
      return;
    }
    state.round = round.round;
    resetAndUpdate();
  };
  document.getElementById('round-jump-button')?.addEventListener('click', jumpRound);
  jumpInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); jumpRound(); }
  });
  window.addEventListener('popstate', () => {
    const routeRound = Number(window.location.pathname.match(/^\/winning-shops\/(\d+)\/$/)?.[1]) || null;
    state = explorerState(new URLSearchParams(window.location.search), { ...boot, round: routeRound, region: currentSettings.defaultRegion || '' });
    restoreInputs();
    shownCount = PAGE_SIZE;
    selectedShopId = null;
    detailModal.style.display = 'none';
    updateListAndMap();
    const restoredShopId = new URLSearchParams(window.location.search).get('shop');
    if (restoredShopId) selectShop(restoredShopId, true);
  });

  // 내 위치 버튼
  myLocationBtn.addEventListener('click', () => {
    mapManager.requestMyLocation();
  });

  // 상세 카드 닫기
  btnCloseDetail.addEventListener('click', () => {
    detailModal.style.display = 'none';
    selectedShopId = null;
    mapManager.selectShop(null);
    document.querySelectorAll('.shop-card-item').forEach(item => {
      item.classList.remove('selected');
      item.setAttribute('aria-pressed', 'false');
    });
  });

  function setSheetState(next) {
    sheetState = next;
    const open = mobileView.matches && next !== 'collapsed';
    if (open && !searchDialog.open) {
      savedScroll = window.scrollY;
      returnFocus = document.activeElement;
      document.body.style.setProperty('--map-saved-scroll', `${-savedScroll}px`);
      document.body.classList.add('map-sheet-open');
      searchDialog.append(sidebarEl);
      fitSearchDialog();
      searchDialog.showModal();
    } else if (!open && searchDialog.open) {
      searchDialog.close();
      sidebarParent.insertBefore(sidebarEl, sidebarNext);
      document.body.classList.remove('map-sheet-open');
      document.body.style.removeProperty('--map-saved-scroll');
      window.scrollTo({ top: savedScroll, behavior: 'instant' });
      if (mobileView.matches && returnFocus !== mobileToggleBtn) returnFocus?.focus({ preventScroll: true });
      fitMobileMap();
    }
    sidebarEl.dataset.sheet = open ? 'full' : next;
    const collapsed = mobileView.matches && next === 'collapsed';
    sidebarEl.classList.toggle('collapsed', collapsed);
    mobileToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    mobileToggleText.textContent = collapsed ? (listCount === null ? '판매점 목록 펼치기' : `판매점 ${listCount.toLocaleString('ko-KR')}곳 목록 펼치기`) : '지도 보기 · 검색 닫기';
    document.querySelector('.map-sidebar-body-inner').inert = collapsed;
  }
  searchDialog.addEventListener('cancel', event => { event.preventDefault(); setSheetState('collapsed'); });
  searchDialog.addEventListener('click', event => {
    if (event.target.closest('a')) setSheetState('collapsed');
  });

  if (mobileToggleBtn) {
    mobileToggleBtn.addEventListener('click', () => {
      setSheetState(sheetState === 'collapsed' ? 'full' : 'collapsed');
    });
    let pointerStart = null;
    mobileToggleBtn.addEventListener('pointerdown', e => { pointerStart = e.clientY; });
    mobileToggleBtn.addEventListener('pointerup', e => {
      if (pointerStart !== null && Math.abs(e.clientY - pointerStart) > 30) {
        setSheetState(e.clientY < pointerStart ? 'full' : 'collapsed');
      }
      pointerStart = null;
    });
  }
  document.getElementById('btn-open-list').addEventListener('click', () => setSheetState('full'));
  document.querySelector('.header-search').addEventListener('click', () => {
    setSheetState('full');
    searchInput.focus({ preventScroll: true });
  });
  // 지도 아래 다른 내용이 없는 홈은 모바일에서 푸터를 목록 패널 끝으로 옮겨 지도가 화면을 채우게 한다.
  const siteFooter = document.querySelector('.site-footer');
  const footerHome = siteFooter && !mapLayout.nextElementSibling ? siteFooter.parentElement : null;
  const footerAnchor = siteFooter?.nextSibling ?? null;
  function placeFooter() {
    if (!footerHome) return;
    if (mobileView.matches) document.querySelector('.map-sidebar-body-inner').append(siteFooter);
    else footerHome.insertBefore(siteFooter, footerAnchor);
  }
  mobileView.addEventListener('change', () => { setSheetState(sheetState); placeFooter(); });
  setSheetState(sheetState);
  placeFooter();
  filterChips.addEventListener('click', event => {
    const button = event.target.closest('[data-clear-filter]');
    if (!button) return;
    if (button.dataset.clearFilter === 'region') state.region = '';
    if (button.dataset.clearFilter === 'period') state.period = null;
    detailModal.style.display = 'none';
    selectedShopId = null;
    mapManager.selectShop(null);
    restoreInputs();
    resetAndUpdate();
  });

  // 초기 목록 이벤트 바인딩
  updateListAndMap();

  // URL ?shop= 파라미터 처리
  if (targetShopId) {
    selectShop(targetShopId, true);
  }
});
