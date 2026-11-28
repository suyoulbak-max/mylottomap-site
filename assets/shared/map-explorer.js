import { splitRegionName, rankShops } from './regions.js';
import { filterShopPeriod, mapGuidePeriod } from './generator-guide.js';
import { escapeHtml, formatWinners } from './format.js';

export function hasMapCoordinates(shop) {
  return Number.isFinite(shop?.lat) && Number.isFinite(shop?.lng)
    && Math.abs(shop.lat) <= 90 && Math.abs(shop.lng) <= 180;
}

export function explorerViewport(shops, bounds = null, limit = 100) {
  const missing = shops.filter(shop => !hasMapCoordinates(shop));
  if (!bounds) return { shops, missing, total: shops.length, limited: false };
  const { south, north, west, east } = bounds;
  const visible = shops.filter(shop => hasMapCoordinates(shop)
    && shop.lat >= south && shop.lat <= north
    && (west <= east ? shop.lng >= west && shop.lng <= east : shop.lng >= west || shop.lng <= east));
  const wide = north - south >= 1 || (east - west + 360) % 360 >= 1;
  const cap = Number.isInteger(limit) && limit > 0 ? limit : 100;
  return { shops: wide ? visible.slice(0, cap) : visible, missing,
    total: visible.length, limited: wide && visible.length > cap };
}

export function explorerMapTarget(shops = []) {
  const coordinates = shops.filter(hasMapCoordinates);
  if (!coordinates.length) return null;
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const { lat, lng } of coordinates) {
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
  }
  if (south === north && west === east) return { type: 'point', lat: south, lng: west };
  return { type: 'bounds', south, north, west, east };
}

export function regionGroups(regions = []) {
  const groups = new Map();
  for (const region of regions) {
    const { sido, sigungu } = splitRegionName(region.name);
    if (!groups.has(sido)) groups.set(sido, []);
    groups.get(sido).push({ ...region, sido, sigungu });
  }
  return groups;
}

export function explorerState(params, { mode = 'national', round = null, rounds = [], period, region = '' } = {}) {
  const winning = mode === 'winning';
  const requested = Number(params.get('round')) || round;
  const selected = rounds.find(r => r.round === requested) || (params.get('view') === 'past' ? rounds[1] : null) || rounds[0];
  return {
    mode,
    rank: winning ? 'rank1' : params.get('rank') === 'rank2' ? 'rank2' : 'rank1',
    view: winning && (params.get('view') === 'past' || selected?.round !== rounds[0]?.round) ? 'past' : 'latest',
    round: winning ? selected?.round ?? null : null,
    region: params.has('region') ? params.get('region') : region,
    query: params.get('q') || '',
    period: winning ? null : mapGuidePeriod(params, period),
  };
}

export function filterExplorerShops(shops, regions, state) {
  if (state.mode === 'winning' && !state.round) return [];
  const groups = regionGroups(regions);
  const names = new Map([...groups.values()].flat().map(r => [r.id, r.sido]));
  const range = state.mode === 'winning' ? { from: state.round, to: state.round } : state.period;
  const rank = state.rank === 'rank2' ? 2 : 1;
  const query = state.query.trim().toLowerCase();
  const filtered = filterShopPeriod(shops, range)
    .map(shop => ({ ...shop, wins: (shop.wins || []).filter(w => w.rank === rank) }))
    .filter(shop => shop.wins.length && (!state.region || (state.region.startsWith('sido:')
      ? names.get(shop.region) === state.region.slice(5) : shop.region === state.region))
      && (!query || `${shop.name} ${shop.address}`.toLowerCase().includes(query)));
  return rankShops(filtered);
}

/** 시도별로, 지도에 핀이 찍히는(좌표가 있는) 판매점 수. 홈 미리보기 말풍선에 쓴다. */
export function sidoShopCounts(shops, regions, state) {
  const names = new Map([...regionGroups(regions).values()].flat().map(r => [r.id, r.sido]));
  const counts = new Map();
  for (const shop of filterExplorerShops(shops, regions, state)) {
    if (!hasMapCoordinates(shop)) continue;
    const sido = names.get(shop.region);
    counts.set(sido, (counts.get(sido) || 0) + 1);
  }
  return counts;
}

export function roundSummary(round) {
  if (!round) return '<p>회차별 1등 배출 판매점 데이터를 준비 중입니다.</p>';
  const count = value => Number(value).toLocaleString('ko-KR');
  const check = round.matched === null ? '인터넷 구매 기록 미확보 · 공식 인원 대조 대기'
    : round.matched ? '판매점·인터넷 건수와 공식 1등 인원이 일치합니다.'
      : '공식 1등 인원과 배출 기록 건수가 다릅니다. 미확보 기록이 있을 수 있습니다.';
  return `${round.date ? `<p>제${round.round}회 · ${escapeHtml(round.date)} 추첨</p>` : ''}<p><strong>1등 ${formatWinners(round.winners)}</strong> · 판매점 ${count(round.shopWins)}건</p>
    <p>${round.internet === null ? '인터넷 구매 건수 미확보' : `인터넷 구매 ${count(round.internet)}건은 판매점 목록·지도에서 제외합니다.`}</p>
    <details><summary>회차 정보 자세히 보기</summary><p>${escapeHtml(check)}</p>
      <a class="content-link" href="/results/${round.round}/">당첨 번호 보기</a> · <a class="content-link" href="/winning-shops/${round.round}/#round-details">회차 상세 보기</a>
    </details>`;
}

/** 지도 위 '회차 선택' 칩 문구: 지난 회차를 보는 중이면 '제N회'(날짜는 시트의 회차 요약·선택 목록에만), 아니면 '회차 선택' */
export function roundPickerLabel(round, past) {
  if (!round) return '회차 데이터 준비 중';
  return past ? `제${round.round}회<span class="sr-only"> · 회차 선택</span>` : '회차 선택';
}

/**
 * 회차 선택 상자: 닫힌 상자(초점이 있어도)는 '제N회'만, 목록을 펼치는 동안에만 '제N회 · 날짜'.
 * 네이티브 select에는 '열림' 이벤트가 없어, 목록을 여는 조작(누르기, Alt+↑↓·F4·Space·Enter)에서 긴 형식으로 바꾸고
 * 값 바꾸기·초점 이탈·Esc·Tab에서 짧은 형식으로 되돌린다. 초점만 받을 때는 바꾸지 않는다.
 * 옵션에는 data-date가 있어야 한다.
 */
export function bindRoundOptionDates(select, doc = globalThis.document) {
  let open = false;
  const show = (full) => {
    open = full;
    for (const option of select.options) option.textContent = full ? `제${option.value}회 · ${option.dataset.date}` : `제${option.value}회`;
  };
  select.addEventListener('pointerdown', () => show(!open)); // 누르면 열리고, 열린 채 다시 누르면 닫힌다
  select.addEventListener('keydown', (event) => {
    if ((event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) || event.key === 'F4' || (!open && (event.key === ' ' || event.key === 'Enter'))) show(true);
    else if (event.key === 'Escape' || event.key === 'Tab') show(false);
  });
  for (const type of ['change', 'blur']) select.addEventListener(type, () => show(false));
  // 목록 바깥을 눌러 닫으면 blur가 오지 않는다(초점은 상자에 남음). 상자 밖을 누르면 짧은 형식으로.
  doc?.addEventListener('pointerdown', (event) => { if (open && event.target !== select) show(false); }, true);
}

export function explorerUrl(state, basePath = state.mode === 'winning' ? '/winning-shops/' : '/') {
  const params = new URLSearchParams();
  if (state.mode === 'winning') {
    if (state.round) params.set('round', state.round);
    if (state.view === 'past') params.set('view', 'past');
  } else if (state.rank === 'rank2') params.set('rank', 'rank2');
  if (state.region) params.set('region', state.region);
  if (state.query) params.set('q', state.query);
  if (state.period) {
    params.set('fromRound', state.period.from);
    params.set('toRound', state.period.to);
  }
  return `${basePath}${params.size ? `?${params}` : ''}`;
}

export function explorerEmptyMessage({ hasData, filteredCount = 0, hasBounds = false, query = '' }) {
  if (!hasData) return '검증된 판매점 데이터를 준비 중입니다.';
  if (!filteredCount) return query.trim()
    ? '검색어와 일치하는 판매점이 없습니다. 검색어를 줄이거나 지역 조건을 해제해 보세요.'
    : '조건에 맞는 판매점이 없습니다. 지역·등수 조건을 해제해 보세요.';
  return hasBounds ? '현재 지도 범위에 판매점이 없습니다. 지도를 이동하거나 확대 수준을 조정해 주세요.'
    : '조건에 맞는 판매점이 없습니다.';
}
