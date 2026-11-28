// 명당맵 홈 클라이언트 스크립트
import { MapManager } from '../map/manager.js';
import { createSettingsStore } from '../storage/settings.js';
import { escapeHtml } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { hasWinHistory, shopPeriodText } from '../shared/data-status.js';
import { rankShops, renderMapShopCard, shopStatusLabel } from '../shared/regions.js';
import { explorerState, explorerUrl, filterExplorerShops, explorerViewport, regionGroups, roundSummary, roundPickerLabel, bindRoundOptionDates, explorerEmptyMessage } from '../shared/map-explorer.js';
import { previewBubbleText } from '../shared/korea-map.js';

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
  const preview = document.getElementById('map-preview');
  const myLocationBtn = document.getElementById('btn-my-location');
  const searchInput = document.getElementById('shop-search-input');
  const regionSelect = document.getElementById('region-select');
  const sidoSelect = document.getElementById('sido-select');
  const regionChip = document.getElementById('map-region-chip');
  const regionChipText = document.getElementById('map-region-chip-text');
  const regionPanel = document.getElementById('map-region-panel');
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
  const sheetToggle = document.getElementById('mobile-sidebar-toggle');
  const sheetToggleText = document.getElementById('mobile-toggle-text');
  const sheetEl = document.getElementById('map-sidebar');
  const sheetPanel = document.getElementById('map-sidebar-content');
  const sheetClose = document.getElementById('map-sheet-close');
  const detailModal = document.getElementById('shop-detail-modal');
  const detailName = document.getElementById('detail-shop-name');
  const detailAddress = document.getElementById('detail-shop-address');
  const detailWinsContent = document.getElementById('detail-wins-content');
  const detailNaverLink = document.getElementById('detail-naver-link');
  const btnCloseDetail = document.getElementById('btn-close-detail');

  let allShops = [];
  let shopsLoaded = false;
  // 전체 목록(shops.json)을 받기 전에는 조작을 state에만 담아 두고, 받은 뒤 그 선택으로 목록·지도를 그린다.
  let ready = false;
  let changedBeforeLoad = false;
  let shownCount = PAGE_SIZE;
  const listTitle = document.getElementById('shop-list-title');
  let periodText = '배출 이력 기준 기간 준비 중';
  let fullPeriodText = periodText;
  let selectedShopId = null;
  let sheetOpen = false;
  let listCount = null;
  const mapLayout = document.getElementById('map-explorer');
  const filterChips = document.getElementById('active-filter-chips');

  // 미리보기는 네이버 지도가 같은 자리에 그려지면(또는 실패 안내로 바뀌면) 지운다. 바깥 치수는 그대로다.
  const hidePreview = () => preview?.remove();
  // 미리보기 숫자는 지금 고른 등수를 따른다(1등·2등 수를 HTML에 함께 담았다).
  function updatePreview() {
    preview?.querySelectorAll('.map-preview-bubble').forEach((bubble) => {
      const n = Number(state.rank === 'rank2' ? bubble.dataset.n2 : bubble.dataset.n1);
      bubble.hidden = !n;
      bubble.innerHTML = previewBubbleText(bubble.dataset.sido, n);
    });
  }
  // 지도 실패 상태: 지도 도구는 비활성으로 표시하고(보조 기술에도 전달) 목록으로 탐색을 잇는다.
  const mapTools = ['btn-my-location', 'btn-zoom-in', 'btn-zoom-out'].map((id) => document.getElementById(id));
  const toolDisabled = (button) => button.getAttribute('aria-disabled') === 'true';
  // 회차별: '회차 선택'으로 열면 찾기 영역을 펼치고, 목록 막대로 열면 접어 첫 판매점부터 보인다.
  let roundFieldOpen = true;

  const mapManager = new MapManager({
    container: mapContainer,
    fallbackEl,
    ncpKeyId: '',
    mapType: currentSettings.mapType || 'normal',
    onSelectShop: (shopId) => {
      selectShop(shopId, true);
    },
    onError: (msg) => {
      alert(msg);
    },
    onReady: hidePreview,
    // 전국 맞춤 때 지도 위 조작 줄과 도구 버튼(휴대폰은 오른쪽 세로 줄, 넓은 화면은 왼쪽 확대·축소와 오른쪽 내 위치)을 피한다.
    fitObstacles: () => ({
      rows: [...document.querySelectorAll('.map-overlay-row')].map((el) => el.getBoundingClientRect()),
      tools: mapTools.map((el) => el.getBoundingClientRect()),
    }),
    onFallback: () => {
      hidePreview();
      mapTools.forEach((button) => button.setAttribute('aria-disabled', 'true'));
    },
    onViewportChange: bounds => {
      viewportBounds = bounds;
      shownCount = PAGE_SIZE;
      renderViewportList(filterShops());
    },
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
    regionChipText.textContent = regionSelect.value ? `${sidoSelect.value} ${regionSelect.selectedOptions[0].textContent}` : sidoSelect.value ? `${sidoSelect.value} 전체` : '지역 전체';
    searchInput.value = state.query;
    restoreRoundInputs();
  }

  function restoreRoundInputs() {
    if (!roundSelect) return;
    const round = boot.rounds.find(r => r.round === state.round);
    roundYearSelect.value = round?.year || '';
    roundSelect.innerHTML = boot.rounds.filter(r => r.year === round?.year).map(r => `<option value="${r.round}" data-date="${escapeHtml(r.date)}">제${r.round}회</option>`).join('');
    roundSelect.value = String(state.round);
    document.getElementById('round-select-date').textContent = round ? `${round.date} 추첨` : '';
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
    updatePreview();
    const round = boot.rounds.find(r => r.round === state.round);
    if (state.mode === 'winning') {
      restoreRoundInputs();
      document.getElementById('map-round-field').hidden = state.view !== 'past' || !roundFieldOpen;
      document.getElementById('map-current-round').innerHTML = roundPickerLabel(round, state.view === 'past');
      document.getElementById('map-round-summary').innerHTML = roundSummary(round);
      document.getElementById('round-details')?.toggleAttribute('hidden', state.round !== boot.round);
      periodText = round ? `제${round.round}회 · ${round.date} 추첨` : '회차 데이터 준비 중';
      document.title = `로또 ${state.round || ''}회 1등 판매점 위치${round ? ` (${round.date})` : ''} - 마이로또맵`;
    } else periodText = state.period ? `${state.period.from}회 ~ ${state.period.to}회` : fullPeriodText;
    if (!ready) return; // 받기 전에는 서버가 그린 기간·정렬 문구를 그대로 둔다.
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
      state.region ? `<button class="filter-chip active" type="button" data-clear-filter="region" aria-label="지역 필터 해제">${escapeHtml(regionChipText.textContent)} ${icon('close')}</button>` : '',
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
    updateSheetLabel();
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

    // 목록 갱신
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

    // 목록 항목 하이라이트(시트를 다시 열면 선택한 카드로 스크롤한다)
    document.querySelectorAll('.shop-card-item').forEach((item) => {
      const isTarget = item.dataset.shopId === shopId;
      item.classList.toggle('selected', isTarget);
      item.setAttribute('aria-pressed', String(isTarget));
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
    // 지도 위 상세 카드가 보이도록 시트를 닫는다.
    if (sheetOpen) setSheet(false);
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
    if (!ready) {
      // shops.json을 받는 중: 선택만 기억하고 버튼 상태를 바꾼다. 주소는 받은 뒤 기간 조건과 함께 만든다.
      changedBeforeLoad = true;
      updateMenu();
      return;
    }
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
  regionSelect.addEventListener('change', () => {
    state.region = regionSelect.value || (sidoSelect.value ? `sido:${sidoSelect.value}` : '');
    restoreInputs();
    resetAndUpdate();
  });
  document.querySelectorAll('[data-explorer-rank]').forEach(button => button.addEventListener('click', () => {
    state.rank = button.dataset.explorerRank;
    resetAndUpdate();
  }));
  document.querySelectorAll('[data-explorer-view]').forEach(button => button.addEventListener('click', () => {
    state.view = button.dataset.explorerView;
    if (state.view === 'latest') state.round = boot.rounds[0]?.round;
    if (state.view === 'past') roundFieldOpen = true;
    resetAndUpdate();
    if (state.view === 'past') {
      setSheet(true);
      roundYearSelect.focus({ preventScroll: true });
      roundYearSelect.scrollIntoView({ block: 'nearest' });
    }
  }));
  // 닫힌 회차 선택 상자는 초점이 있어도 '제N회'만, 목록을 펼치는 동안에만 날짜까지 보인다.
  if (roundSelect) bindRoundOptionDates(roundSelect);
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
    if (!ready) return;
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

  // 지도 도구: 확대·축소·내 위치(지도를 받기 전 누르면 받기를 시작하고, 받은 뒤 다시 누르면 동작한다)
  myLocationBtn.addEventListener('click', () => { if (!toolDisabled(myLocationBtn)) mapManager.requestMyLocation(); });
  mapTools[1].addEventListener('click', () => { if (!toolDisabled(mapTools[1])) mapManager.zoomBy(1); });
  mapTools[2].addEventListener('click', () => { if (!toolDisabled(mapTools[2])) mapManager.zoomBy(-1); });
  document.getElementById('map-fallback-open-list').addEventListener('click', () => setSheet(true));

  // 지역 칩(휴대폰): 시·도와 시·군·구를 고르는 패널을 연다. 넓은 화면에서는 패널이 늘 한 줄에 보인다.
  function setRegionPanel(open) {
    regionChip.setAttribute('aria-expanded', String(open));
    regionPanel.classList.toggle('is-open', open);
    if (open) sidoSelect.focus();
  }
  regionChip.addEventListener('click', () => setRegionPanel(regionChip.getAttribute('aria-expanded') !== 'true'));
  regionPanel.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !regionPanel.classList.contains('is-open')) return;
    event.stopPropagation();
    setRegionPanel(false);
    regionChip.focus();
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

  // 판매점 목록 시트: 아래에서 겹쳐 열리고(지도·본문 위치는 그대로), 닫으면 초점이 펼치기 버튼으로 돌아온다.
  function updateSheetLabel() {
    sheetToggleText.textContent = sheetOpen ? '판매점 목록 접기'
      : listCount === null ? '판매점 목록 펼치기' : `판매점 ${listCount.toLocaleString('ko-KR')}곳 목록 펼치기`;
  }
  function setSheet(open) {
    sheetOpen = open;
    sheetEl.classList.toggle('is-open', open);
    sheetToggle.setAttribute('aria-expanded', String(open));
    updateSheetLabel();
    if (open) {
      sheetPanel.querySelector('.shop-card-item.selected')?.scrollIntoView({ block: 'nearest' });
      sheetClose.focus({ preventScroll: true });
    } else {
      sheetToggle.focus({ preventScroll: true });
    }
  }
  sheetToggle.addEventListener('click', () => {
    const roundField = document.getElementById('map-round-field');
    if (!sheetOpen && roundField) {
      roundFieldOpen = false;
      roundField.hidden = true;
    }
    setSheet(!sheetOpen);
    if (sheetOpen && roundField) {
      const body = sheetPanel.querySelector('.map-sheet-body');
      body.scrollTop += shopListContainer.getBoundingClientRect().top - body.getBoundingClientRect().top;
    }
  });
  sheetClose.addEventListener('click', () => setSheet(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sheetOpen) setSheet(false);
  });
  sheetPanel.addEventListener('click', event => {
    // 같은 페이지 안 링크(#…)로 이동할 때는 시트를 닫아 본문을 가리지 않는다.
    if (event.target.closest('a[href^="#"]')) setSheet(false);
  });

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

  updatePreview();

  // 지도 SDK·shops.json은 첫 화면을 그린 뒤 받는다: load 뒤 한가할 때 또는 지도 영역 첫 조작 중 먼저 오는 때.
  // 그 전에는 서버가 그린 미리보기·상위 판매점·글·링크가 그대로 보이고, 지도 자리 크기는 CSS가 미리 잡는다.
  await new Promise((resolve) => {
    for (const type of ['pointerdown', 'keydown', 'focusin']) mapLayout.addEventListener(type, resolve, { once: true });
    const whenIdle = () => (window.requestIdleCallback ? requestIdleCallback(resolve, { timeout: 3000 }) : setTimeout(resolve, 0));
    // 미리보기 그림(첫 화면의 가장 큰 요소)이 실제로 그려진 뒤에 받는다. 큰 파일이 첫 그림과 대역을 다투지 않게.
    // LCP API가 없는 브라우저는 바로, 있으면 최대 3초까지 기다린다.
    const painted = new Promise((done) => {
      if (!preview || !window.PerformanceObserver?.supportedEntryTypes?.includes('largest-contentful-paint')) return done();
      const observer = new PerformanceObserver((list) => {
        if (list.getEntries().some((entry) => preview.contains(entry.element))) { observer.disconnect(); done(); }
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(done, 3000);
    });
    const idle = () => painted.then(whenIdle);
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  });

  // 1. 설정 및 데이터 불러오기
  try {
    const configRes = await fetch('/assets/site.config.json');
    if (configRes.ok) {
      const cfg = await configRes.json();
      mapManager.ncpKeyId = cfg.naverMapKeyId || '';
    }
  } catch (e) {
    console.warn('site.config.json 로드 실패:', e);
  }

  // 회차 모드: 전체 회차 요약은 별도 파일(캐시 가능). 실패하면 HTML에 담긴 선택 회차만 쓴다.
  if (boot.mode === 'winning') {
    try {
      const res = await fetch('/assets/data/rounds.json');
      if (res.ok) boot.rounds = await res.json();
    } catch (e) {
      console.warn('rounds.json 로드 실패:', e);
    }
    // 처음 상태는 HTML의 선택 회차 하나만 보고 정했으므로, 전체 회차를 받은 뒤 최신/지난 회차 구분을 다시 맞춘다.
    if (!changedBeforeLoad) {
      const restored = explorerState(new URLSearchParams(window.location.search), { ...boot, region: state.region });
      state.round = restored.round;
      state.view = restored.view;
    } else if (state.round !== boot.rounds[0]?.round) state.view = 'past';
  }

  const urlParams = new URLSearchParams(window.location.search);
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

  // 받는 동안 바뀐 선택이 없으면 주소(?region=, ?shop= 등)를 기준으로 상태를 맞춘다.
  const targetShopId = changedBeforeLoad ? null : urlParams.get('shop');
  const targetShop = allShops.find(shop => shop.id === targetShopId);
  const requestedRegion = urlParams.has('region') ? urlParams.get('region') : targetShop?.region;
  if (!changedBeforeLoad && requestedRegion != null) {
    state.region = requestedRegion;
  } else if (!changedBeforeLoad && urlParams.has('fromRound')) {
    state.region = '';
  }
  const targetWins = (targetShop?.wins || []).filter(w => !state.period || (w.round >= state.period.from && w.round <= state.period.to));
  if (targetShop && state.mode === 'national' && !urlParams.has('rank')
    && !targetWins.some(w => w.rank === 1)) state.rank = 'rank2';
  restoreInputs();
  ready = true;
  if (changedBeforeLoad && shopsLoaded) {
    const url = explorerUrl(state);
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, '', url);
  }

  // 2. 지도 초기화(목록은 지도를 기다리지 않는다)
  mapManager.init(filterShops()).then((ok) => {
    if (!ok) { hidePreview(); return; }
    setTimeout(hidePreview, 4000); // tilesloaded가 오지 않는 경우의 안전장치
    const filtered = filterShops();
    mapManager.setShops(filtered);
    mapManager.selectShop(selectedShopId);
    const selected = filtered.find(shop => shop.id === selectedShopId);
    if (selected) mapManager.panToShop(selected);
    else mapManager.fitShops(filtered);
    viewportBounds = mapManager.getViewport();
    renderViewportList(filtered);
  });

  updateListAndMap();

  // URL ?shop= 파라미터 처리
  if (targetShopId) {
    selectShop(targetShopId, true);
  }
});
