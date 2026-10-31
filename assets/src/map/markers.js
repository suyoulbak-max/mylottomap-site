import { escapeHtml } from '../shared/format.js';
import { hasWinHistory } from '../shared/data-status.js';

// 시안 D(2026-10-10 확정): 흰 알약 + 형광 테두리, 등급은 테두리·아이콘 색으로 함께 구분한다.
export const COMPACT_BELOW_ZOOM = 15;
const CROWN = '<svg class="pin-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5l4.6 3.8L12 4.5l4.4 6.8L21 7.5 19.2 18H4.8z"/></svg>';
const STAR = '<svg class="pin-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>';

export function winCounts(shop) {
  const wins = shop.wins ?? [];
  return { first: wins.filter(w => w.rank === 1).length, second: wins.filter(w => w.rank === 2).length };
}

export function shopTier(shop) {
  const { first, second } = winCounts(shop);
  return first > 1 ? 'multi' : first === 1 ? 'once' : second > 0 ? 'second' : 'none';
}

export function renderShopMarker(shop, selected = false, zoom = COMPACT_BELOW_ZOOM) {
  const { first, second } = winCounts(shop);
  const tier = shopTier(shop);
  const history = tier !== 'none' ? [first && `1등 ${first}회`, second && `2등 ${second}회`].filter(Boolean).join(' · ') :hasWinHistory(shop) ? '확인된 1·2등 배출 0회' : '당첨 이력 미확보';
  const cls = `map-pin pin-${tier}${shop.status === 'closed' ? ' pin-closed' : ''}${selected ? ' selected' : ''}`;
  const attrs = `type="button" data-shop-id="${escapeHtml(shop.id)}" aria-pressed="${selected}" aria-label="${escapeHtml(shop.name)} 판매점, ${history}"`;
  if (tier === 'none') return `<button ${attrs} class="${cls} pin-dot"></button>`;
  const ico = first ? CROWN : STAR;
  if (zoom < COMPACT_BELOW_ZOOM) return `<button ${attrs} class="${cls} pin-compact">${ico}${first || second}</button>`;
  const parts = [first && `1등 ${first}`, second && `2등 ${second}`].filter(Boolean);
  return `<button ${attrs} class="${cls}">${ico}${parts.join('<span class="pin-sep" aria-hidden="true">·</span>')}</button>`;
}

export function renderClusterMarker(count, firstShops = 0) {
  if (!Number.isSafeInteger(count) || count < 2) throw new RangeError('판매점 묶음은 2곳 이상이어야 합니다.');
  // 묶음 전체가 1등 배출점이면(1등 명당 보기) 같은 숫자가 반복되므로 생략한다.
  const firsts = Number.isSafeInteger(firstShops) && firstShops > 0 && firstShops < count ? firstShops : 0;
  return `<button type="button" class="map-pin-cluster" aria-label="판매점 ${count}곳 묶음${firsts ? `, 1등 배출 ${firsts}곳 포함` : ''}, 선택하면 확대"><span>${count}</span><small>곳</small>${firsts ? `<span class="cluster-first">1등 ${firsts}곳</span>` : ''}</button>`;
}
