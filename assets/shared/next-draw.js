// 다음 회차 상태 문구(서버 렌더·브라우저 공용). 시각 비교는 절대 시각(+09:00)으로 하므로 방문자 시간대와 무관하다.

export function remainingText(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '1분 미만';
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return [d && `${d}일`, h && `${h}시간`, m && `${m}분`].filter(Boolean).join(' ');
}

/** 1등 예상 총 당첨금: 1억 원 이상은 '약 239.6억 원', 미만은 원 단위 */
export function jackpotText(amount) {
  if (amount >= 1e8) return `약 ${(Math.floor(amount / 1e7) / 10).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억 원`;
  return `${amount.toLocaleString('ko-KR')}원`;
}

const hhmm = iso => iso.slice(11, 16);
const weekday = ymd => '일월화수목금토'[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
export const drawDateText = ymd => `${ymd}(${weekday(ymd)})`;

// 문구 조각: [글자, 강조 여부]. 강조 조각은 <strong>으로 그린다(Design.md 20장).
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const partsText = parts => parts.map(([t]) => t).join('');
export const partsHtml = parts => parts.map(([t, strong]) => (strong ? `<strong>${esc(t)}</strong>` : esc(t))).join('');

/** 시각과 무관한 최초 HTML용 문구 */
export const scheduledParts = nextDraw => [[`제${nextDraw.round}회 · `], [drawDateText(nextDraw.drawDate), true], [' 추첨 예정']];
export const scheduledText = nextDraw => partsText(scheduledParts(nextDraw));

/**
 * @param {object|null} nextDraw - data/next-draw.json
 * @param {number|null} latestRound - 확보된 최신 결과 회차
 * @returns {{ state: 'selling'|'closed'|'drawn'|'stale', text: string, parts: Array, showJackpot: boolean } | null}
 */
export function nextDrawStatus(nextDraw, latestRound, now = Date.now()) {
  if (!nextDraw) return null;
  const { round } = nextDraw;
  const status = (state, parts, showJackpot) => ({ state, text: partsText(parts), parts, showJackpot });
  if (latestRound !== null && latestRound >= round) return status('stale', [['다음 회차 정보 업데이트 대기 중']], false);
  const close = Date.parse(nextDraw.salesCloseAt);
  const draw = Date.parse(nextDraw.drawAt);
  const showJackpot = Boolean(nextDraw.jackpot) && now < draw;
  if (now < close) return status('selling', [[`제${round}회 · 마감까지 `], [remainingText(close - now), true]], showJackpot);
  if (now < draw) return status('closed', [[`제${round}회 `], ['판매 마감', true], [` · ${hhmm(nextDraw.drawAt)}경 추첨`]], showJackpot);
  return status('drawn', [[`제${round}회 `], ['추첨 완료', true], [' · 결과 업데이트 대기 중']], false);
}

/** now를 주면 기준일이 오늘(한국 날짜)일 때 '오늘'로 줄인다. 최초 HTML은 시각과 무관하게 연-월-일로 쓴다. */
// 기준일이 오늘·어제(한국 날짜)면 줄여 쓴다. now가 없으면(최초 HTML) 연-월-일.
function asOfText(asOf, now) {
  const kstDay = offset => new Date(now + (9 - 24 * offset) * 3600000).toISOString().slice(0, 10);
  const day = asOf.slice(0, 10);
  const label = now === null ? day : day === kstDay(0) ? '오늘' : day === kstDay(1) ? '어제' : day;
  return `${label} ${hhmm(asOf)} 기준`;
}
export function jackpotLine(nextDraw, now = null) {
  return `1등 예상 총 당첨금 ${jackpotText(nextDraw.jackpot.amount)} (${asOfText(nextDraw.jackpot.asOf, now)})`;
}
/** 티커용: [1등 예상] 총 **약 241.1억 원** · 오늘 15:20 기준 */
export const jackpotParts = (nextDraw, now = null) => [['총 '], [jackpotText(nextDraw.jackpot.amount), true], [` · ${asOfText(nextDraw.jackpot.asOf, now)}`]];

/** 브라우저 갱신용 데이터(JSON 스크립트 태그에 넣는다) */
export function nextDrawBoot(nextDraw, latestRound) {
  if (!nextDraw) return '';
  const data = { round: nextDraw.round, drawDate: nextDraw.drawDate, salesCloseAt: nextDraw.salesCloseAt, drawAt: nextDraw.drawAt, jackpot: nextDraw.jackpot, latestRound };
  return `<script id="next-draw-data" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/** 최신 결과 회차. 다음 회차 상태 판단에 쓴다. */
export const latestDrawOf = drawsData => (drawsData?.draws || []).reduce((a, b) => (!a || b.round > a.round ? b : a), null);

/**
 * 홈 헤더 티커 문구(최초 HTML은 시각과 무관한 문구, 브라우저가 상태 문구로 바꾼다)
 * 항목: { tag, tone, html, title, attrs(li), textAttrs(본문 span) }. html은 여기서 이스케이프한다.
 */
export function buildTicker({ nextDraw = null, latestDraw = null, shopCount = null }) {
  const items = [];
  const item = (tag, tone, parts, extra = {}) => items.push({ tag, tone, html: partsHtml(parts), title: `${tag} ${partsText(parts)}`, ...extra });
  if (nextDraw) {
    const stale = latestDraw && latestDraw.round >= nextDraw.round;
    item('다음 회차', 'next', stale ? [['다음 회차 정보 업데이트 대기 중']] : scheduledParts(nextDraw), { textAttrs: 'data-next-draw-status' });
    if (nextDraw.jackpot && !stale) item('1등 예상', 'gold', jackpotParts(nextDraw), { title: jackpotLine(nextDraw), attrs: 'data-next-draw-jackpot', textAttrs: 'data-next-draw-jackpot-line' });
  }
  if (Array.isArray(latestDraw?.numbers)) item('지난 회차', 'neutral', [[`${latestDraw.round}회 `], [latestDraw.numbers.join('·'), true], [` + 보너스 ${latestDraw.bonus}`]]);
  if (shopCount !== null) item('명당', 'neutral', shopCount ? [['전국 1·2등 배출 '], [`${shopCount.toLocaleString('ko-KR')}곳`, true]] : [['판매점 데이터 준비 중']]);
  return items;
}
