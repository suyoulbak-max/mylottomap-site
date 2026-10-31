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

export function roundSummary(round) {
  if (!round) return '<p>회차별 1등 배출 판매점 데이터를 준비 중입니다.</p>';
  const count = value => Number(value).toLocaleString('ko-KR');
  const check = round.matched === null ? '인터넷 구매 기록 미확보 · 공식 인원 대조 대기'
    : round.matched ? '판매점·인터넷 건수와 공식 1등 인원이 일치합니다.'
      : '공식 1등 인원과 배출 기록 건수가 다릅니다. 미확보 기록이 있을 수 있습니다.';
  return `<p><strong>1등 ${formatWinners(round.winners)}</strong> · 판매점 ${count(round.shopWins)}건</p>
    <p>${round.internet === null ? '인터넷 구매 건수 미확보' : `인터넷 구매 ${count(round.internet)}건은 판매점 목록·지도에서 제외합니다.`}</p>
    <details><summary>회차 정보 자세히 보기</summary><p>${escapeHtml(check)}</p>
      <a class="content-link" href="/results/${round.round}/">당첨 번호 보기</a> · <a class="content-link" href="/winning-shops/${round.round}/#round-details">회차 상세 보기</a>
    </details>`;
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
