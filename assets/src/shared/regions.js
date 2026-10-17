// 판매점 지역 분해·순위·지역 페이지 주소 (서버 렌더링과 브라우저가 함께 쓴다)
import { escapeHtml } from './format.js';
import { icon } from './icons.js';
import { hasWinHistory } from './data-status.js';

/** 시군구 페이지를 만드는 최소 판매점 수. 적으면 시도 페이지 안에서만 보인다(얇은 페이지 방지). */
export const MIN_SIGUNGU_SHOPS = 3;

/** '서울 종로구' → { sido: '서울', sigungu: '종로구' }, '세종' → { sido: '세종', sigungu: '' } */
export function splitRegionName(name) {
  const s = String(name || '').trim().replace(/\s+/g, ' ');
  const i = s.indexOf(' ');
  return i < 0 ? { sido: s, sigungu: '' } : { sido: s.slice(0, i), sigungu: s.slice(i + 1) };
}

const segment = (text) => encodeURIComponent(text.replace(/ /g, '-'));

/** 지역 페이지 주소. 한글은 percent-encoding, 시군구 안의 공백은 '-' ('수원시 장안구' → '수원시-장안구') */
export function regionPath(sido, sigungu = '') {
  return `/shops/${segment(sido)}/${sigungu ? `${segment(sigungu)}/` : ''}`;
}

/** 수집 기간 내 1등·2등 건수와 가장 최근 당첨 회차 */
export function winCounts(shop) {
  const wins = shop?.wins || [];
  return {
    rank1: wins.filter((w) => w.rank === 1).length,
    rank2: wins.filter((w) => w.rank === 2).length,
    lastRound: wins.reduce((max, w) => Math.max(max, Number(w.round) || 0), 0),
  };
}

export const RANKING_RULE = '1등 배출 수가 많은 순, 같으면 2등 배출 수, 그다음 최근 당첨 회차 순';

/** RANKING_RULE 순서로 정렬한 새 배열 */
export function rankShops(shops) {
  return shops
    .map((shop) => ({ shop, c: winCounts(shop) }))
    .sort((a, b) => b.c.rank1 - a.c.rank1 || b.c.rank2 - a.c.rank2 || b.c.lastRound - a.c.lastRound || String(a.shop.name).localeCompare(String(b.shop.name), 'ko'))
    .map((x) => x.shop);
}

const sum = (shops) => shops.reduce((acc, s) => {
  const c = winCounts(s);
  acc.rank1 += c.rank1;
  acc.rank2 += c.rank2;
  return acc;
}, { rank1: 0, rank2: 0 });

/**
 * 1·2등 이력이 있는 판매점을 시도 → 시군구로 묶는다(이력 없는 판매점은 배출 판매점으로 세지 않는다).
 * 지역 이름은 regions[].name에서 얻고, 목록에 없으면 판매점 region 값을 쓴다.
 * 반환: [{ name, path, shops, rank1, rank2, sigungus: [{ name, path|null, shops, rank1, rank2 }] }] (판매점 수 많은 순)
 */
export function groupShopsByRegion(shopsData) {
  const names = new Map((shopsData?.regions || []).map((r) => [r.id, r.name]));
  const bySido = new Map();
  for (const shop of shopsData?.shops || []) {
    if (!shop.wins?.length) continue;
    const { sido, sigungu } = splitRegionName(names.get(shop.region) || shop.region);
    if (!sido) continue;
    if (!bySido.has(sido)) bySido.set(sido, new Map());
    const bySigungu = bySido.get(sido);
    if (!bySigungu.has(sigungu)) bySigungu.set(sigungu, []);
    bySigungu.get(sigungu).push(shop);
  }
  const byCount = (a, b) => b.shops.length - a.shops.length || a.name.localeCompare(b.name, 'ko');
  return [...bySido].map(([sido, bySigungu]) => {
    const sigungus = [...bySigungu].map(([name, shops]) => ({
      name,
      path: name && shops.length >= MIN_SIGUNGU_SHOPS ? regionPath(sido, name) : null,
      shops: rankShops(shops),
      ...sum(shops),
    })).sort(byCount);
    return { name: sido, path: regionPath(sido), shops: sigungus.flatMap((g) => g.shops), sigungus, ...sum(sigungus.flatMap((g) => g.shops)) };
  }).sort(byCount);
}

/** 판매점 영업 상태 배지 문구 */
export function shopStatusLabel(status) {
  return status === 'open' ? '현재 판매점 목록 확인' : '현재 목록에서 확인 안 됨(폐업·이전 가능)';
}

const naverSearchUrl = (shop) => `https://map.naver.com/v5/search/${encodeURIComponent(shop.address || shop.name)}`;

function winBadges(shop) {
  const { rank1, rank2 } = winCounts(shop);
  const badges = [];
  if (rank1) badges.push(`<span class="badge badge-gold">1등 ${rank1}회</span>`);
  if (rank2) badges.push(`<span class="badge badge-silver">2등 ${rank2}회</span>`);
  if (!badges.length) badges.push(`<span class="badge badge-gray">${hasWinHistory(shop) ? '확인된 1·2등 배출 0회' : '당첨 이력 미확보'}</span>`);
  return badges.join(' ');
}

const statusBadge = (shop) => `<span class="badge ${shop.status === 'open' ? 'badge-success' : 'badge-gray'}">${shopStatusLabel(shop.status)}</span>`;

/** 명당맵 목록 카드 (서버 렌더링 상위 목록과 브라우저 목록이 같은 마크업을 쓴다) */
export function renderMapShopCard(shop, { periodText, selected = false, showMethods = false }) {
  const hasCoords = typeof shop.lat === 'number' && typeof shop.lng === 'number';
  const methods = new Map();
  if (showMethods) for (const win of shop.wins || []) {
    const method = win.method || '구분 미확보';
    methods.set(method, (methods.get(method) || 0) + 1);
  }
  return `
        <article class="shop-card-item${selected ? ' selected' : ''}" data-shop-id="${escapeHtml(shop.id)}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="${escapeHtml(shop.name)} 판매점">
          <div class="shop-item-name">
            <span>${escapeHtml(shop.name)}</span>
            ${hasCoords ? '' : '<span class="badge badge-no-coord" title="위도·경도가 등록되지 않았습니다">좌표 미확보</span>'}
          </div>
          <p class="shop-item-address">${escapeHtml(shop.address)}</p>
          ${showMethods ? `<p class="shop-item-method">구분 · ${[...methods].map(([method, count]) => `${escapeHtml(method)}${count > 1 ? ` ${count}건` : ''}`).join(' · ')}</p>` : ''}
          <div class="shop-item-wins">
            ${winBadges(shop)} ${statusBadge(shop)}
            <span class="text-xs text-slate-400">(${escapeHtml(periodText)})</span>
          </div>
          <div class="mt-2 text-right">
            <a href="${naverSearchUrl(shop)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" onclick="event.stopPropagation();" title="외부 네이버 지도에서 길찾기 및 위치 확인">길찾기 ${icon('external')}</a>
          </div>
        </article>`.trim();
}

/** 지역 페이지 판매점 카드: 상호·주소·배출 회차와 방식·영업 상태·길찾기 */
export function renderShopDirectoryCard(shop, { regionLabel = '', periodText }) {
  const wins = [...(shop.wins || [])].sort((a, b) => a.rank - b.rank || b.round - a.round);
  const winList = wins.length
    ? `<ul class="shop-win-list">${wins.map((w) => `<li><span class="badge ${w.rank === 1 ? 'badge-gold' : 'badge-silver'}">${w.rank}등</span> ${escapeHtml(w.round)}회${w.method ? ` · ${escapeHtml(w.method)}` : ''}</li>`).join('')}</ul>`
    : '';
  return `
        <article class="shop-directory-card">
          <h3 class="shop-item-name">${escapeHtml(shop.name)}</h3>
          ${regionLabel ? `<p class="text-xs text-slate-500">${escapeHtml(regionLabel)}</p>` : ''}
          <p class="shop-item-address">${escapeHtml(shop.address)}</p>
          <div class="shop-item-wins">${winBadges(shop)} ${statusBadge(shop)}</div>
          ${winList}
          <p class="text-xs text-slate-500">집계: ${escapeHtml(periodText)}</p>
          <div class="flex gap-2">
            <a href="/?shop=${encodeURIComponent(shop.id)}" class="btn btn-primary btn-sm">명당맵에서 보기</a>
            <a href="${naverSearchUrl(shop)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" title="외부 네이버 지도">길찾기 ${icon('external')}</a>
          </div>
        </article>`.trim();
}

/** 배출 횟수 해석 주의 문구 */
export const WIN_COUNT_NOTICE = '판매량 정보 없이 수집 기간의 1·2등 배출 횟수만 집계했습니다. 배출 횟수는 판매점별 당첨 확률이나 명당 효과를 뜻하지 않습니다.';

/** 인터넷 구매분 안내(판매점이 없어 지도·목록 집계에서 제외). 기록이 없으면 빈 문자열. */
export function internetWinsText(meta) {
  const rows = Array.isArray(meta?.internetWins) ? meta.internetWins : null;
  if (!rows) return '';
  const sum = (key) => rows.reduce((total, row) => total + (Number.isInteger(row[key]) ? row[key] : 0), 0);
  const n = (v) => v.toLocaleString('ko-KR');
  return `인터넷 구매(동행복권 사이트) 당첨 1등 ${n(sum('rank1'))}건 · 2등 ${n(sum('rank2'))}건은 실제 판매점이 없어 지도·판매점 집계에서 제외했습니다.`;
}
