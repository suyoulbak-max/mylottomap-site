import { computeStats } from '../lotto/stats.js';
import { rankShops, splitRegionName, winCounts, shopStatusLabel, RANKING_RULE, WIN_COUNT_NOTICE } from './regions.js';
import { escapeHtml, renderBall, formatDateTimeKst } from './format.js';

export function guideBounds(drawsData, shopsData) {
  const rounds = (drawsData?.draws || []).map(d => d.round);
  const period = shopsData?.meta?.period;
  if (Number.isInteger(period?.fromRound) && Number.isInteger(period?.toRound) && period.fromRound > 0 && period.toRound >= period.fromRound) {
    rounds.push(period.fromRound, period.toRound);
  }
  return rounds.length ? { from: Math.min(...rounds), to: Math.max(...rounds) } : null;
}

export function guidePeriods(drawsData, shopsData) {
  const bounds = guideBounds(drawsData, shopsData);
  const span = bounds ? bounds.to - bounds.from + 1 : 0;
  return [10, 20, 50].filter(n => n <= span);
}

export function guideRegionOptions(regions = [], selected = '') {
  const groups = new Map();
  for (const region of regions) {
    const { sido } = splitRegionName(region.name);
    if (!groups.has(sido)) groups.set(sido, []);
    groups.get(sido).push(region);
  }
  const option = (value, label) => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  return option('', '전체 지역') + [...groups].map(([sido, list]) => `<optgroup label="${escapeHtml(sido)}">${option(`sido:${sido}`, `${sido} 전체`)}${list.map(r => option(r.id, r.name)).join('')}</optgroup>`).join('');
}

export function filterShopPeriod(shops, range) {
  if (!range) return shops;
  return shops.map(shop => ({ ...shop, wins: (shop.wins || []).filter(w => w.round >= range.from && w.round <= range.to) }))
    .filter(shop => shop.wins.length > 0);
}

/** Invalid/outside URL periods must not expand the verified source period. */
export function mapGuidePeriod(params, period) {
  const from = Number(params.get('fromRound'));
  const to = Number(params.get('toRound'));
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to < from || !period?.fromRound || !period?.toRound) return null;
  const range = { from: Math.max(from, period.fromRound), to: Math.min(to, period.toRound) };
  return range.from <= range.to ? range : null;
}

export function guideMapUrl(region, range, shopId = null) {
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  if (range) {
    params.set('fromRound', range.from);
    params.set('toRound', range.to);
  }
  if (shopId) params.set('shop', shopId);
  return `/?${params}`;
}

export function buildGeneratorGuide(drawsData, shopsData, { region = '', last = null } = {}) {
  const bounds = guideBounds(drawsData, shopsData);
  const range = bounds && { from: last ? Math.max(bounds.from, bounds.to - last + 1) : bounds.from, to: bounds.to };
  const draws = (drawsData?.draws || []).filter(d => range && d.round >= range.from && d.round <= range.to);
  const stats = computeStats(draws);
  const frequencies = stats.numbers.map(n => n.count);
  const most = draws.length ? stats.numbers.filter(n => n.count === Math.max(...frequencies)) : [];
  const least = draws.length ? stats.numbers.filter(n => n.count === Math.min(...frequencies)) : [];
  const names = new Map((shopsData?.regions || []).map(r => [r.id, r.name]));
  const period = shopsData?.meta?.period;
  const shopRange = range && period?.fromRound && period?.toRound
    ? { from: Math.max(range.from, period.fromRound), to: Math.min(range.to, period.toRound) } : null;
  const covered = shopRange && shopRange.from <= shopRange.to ? shopRange : null;
  const shops = covered ? rankShops(filterShopPeriod(shopsData?.shops || [], covered).filter(shop => {
    if (region.startsWith('sido:')) return splitRegionName(names.get(shop.region)).sido === region.slice(5);
    return !region || shop.region === region;
  })) : [];
  return {
    region, regionName: region.startsWith('sido:') ? `${region.slice(5)} 전체` : names.get(region) || '전체 지역',
    range, stats, most, least, shopRange: covered, shopCount: shops.length, shops: shops.slice(0, 3),
    drawMeta: drawsData?.meta, shopMeta: shopsData?.meta,
  };
}

function sourceText(meta) {
  const state = !meta || meta.status === 'empty' || !meta.source || !meta.checkedAt ? '데이터 준비 중'
    : meta.status === 'stale' ? '업데이트 지연 · 마지막 정상 자료' : '확인된 자료 기준';
  return `<p class="guide-source">${escapeHtml(state)}<br>출처: ${escapeHtml(meta?.source || '미확보')}<br>확인: ${escapeHtml(meta?.checkedAt ? `${formatDateTimeKst(meta.checkedAt)} (한국 시간)` : '미확보')}</p>`;
}

const rangeText = range => range ? `${range.from}~${range.to}회` : '기간 미확보';

export function renderGeneratorGuideResults(model) {
  const { stats, most, least, shops, shopCount, range, shopRange } = model;
  const frequency = (label, rows) => `<div class="guide-frequency"><h4>${label} <span>${rows[0].count}회 출현</span></h4><div class="guide-number-list">${rows.map(row => renderBall(row.n, { size: 'sm' })).join('')}</div></div>`;
  const partialDraws = range && stats.range.count < range.to - range.from + 1;
  const partialShops = shopRange && range && (shopRange.from > range.from || shopRange.to < range.to);
  return `
    <p class="guide-range">조회 범위 · ${rangeText(range)}</p>
    <section class="guide-section" aria-labelledby="guide-numbers-title">
      <h3 id="guide-numbers-title">전국 번호 통계</h3>
      <p class="guide-caption">본번호 6개 기준 · 보너스 제외 · 지역 선택과 무관합니다.</p>
      ${stats.range.count ? `<p class="guide-caption">실제 집계: ${rangeText(stats.range)} · ${stats.range.count}회분${partialDraws ? ' (선택 범위 중 확보된 회차만 집계)' : ''}</p><div class="guide-frequencies">${frequency('가장 많이 나온 번호', most)}${frequency('가장 적게 나온 번호', least)}</div><p class="guide-caption">동률 번호를 모두 표시합니다. 과거 출현 횟수는 다음 추첨 확률을 높이지 않습니다.</p>` : '<p class="guide-empty">이 기간의 당첨 번호를 아직 확보하지 못했습니다. 다른 기간을 선택하거나 당첨 결과를 확인하세요.</p>'}
      <a class="content-link guide-inline-link" href="/stats/">전체 번호 통계 보기</a>
      ${sourceText(model.drawMeta)}
    </section>
    <section class="guide-section" aria-labelledby="guide-shops-title">
      <h3 id="guide-shops-title">${escapeHtml(model.regionName)} 배출 판매점</h3>
      <p class="guide-caption">${rangeText(shopRange)} · 1·2등 배출 ${shopCount.toLocaleString('ko-KR')}곳${shopCount ? ` 중 ${shops.length}곳 표시` : ''}${partialShops ? ' · 선택 범위 중 확보된 기간만 집계' : ''}</p>
      ${shops.length ? `<p class="guide-caption">${RANKING_RULE}</p><ul class="guide-shop-list">${shops.map(shop => {
        const counts = winCounts(shop);
        return `<li class="guide-shop"><div><h4>${escapeHtml(shop.name)}</h4><p class="guide-caption">${escapeHtml(shop.address)}</p><div class="guide-badges"><span class="badge badge-gold">1등 ${counts.rank1}건</span><span class="badge badge-silver">2등 ${counts.rank2}건</span><span>최근 ${counts.lastRound}회</span></div><p class="guide-caption">${escapeHtml(shopStatusLabel(shop.status))}${typeof shop.lat === 'number' && typeof shop.lng === 'number' ? '' : ' · 좌표 미확보'}</p></div><a class="btn btn-secondary btn-sm" href="${escapeHtml(guideMapUrl(model.region, shopRange, shop.id))}" aria-label="${escapeHtml(shop.name)} 지도에서 보기">지도에서 보기</a></li>`;
      }).join('')}</ul><a class="content-link guide-inline-link" href="${escapeHtml(guideMapUrl(model.region, shopRange))}">선택 지역·기간의 판매점 모두 보기</a>` : `<p class="guide-empty">${shopRange ? '선택한 지역·기간에 확인된 1·2등 배출 판매점이 없습니다. 지역이나 기간을 바꿔 보세요.' : '이 기간의 판매점 이력을 아직 확보하지 못했습니다. 다른 기간을 선택해 주세요.'}</p><a class="content-link guide-inline-link" href="/shops/">확보된 판매점 목록 보기</a>`}
      <p class="guide-caption">${WIN_COUNT_NOTICE} 인터넷 구매분은 제외합니다.</p>
      ${sourceText(model.shopMeta)}
    </section>`;
}
