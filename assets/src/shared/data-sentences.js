// 데이터로 만드는 사실 문장(지역 허브·회차 결과·회차별 판매점). 수치·회차·출처를 같은 문단에 둔다.
// 데이터가 없는 항목은 문장을 만들지 않는다(null). 문장은 이스케이프 전 평문이다.

const n = (v) => Number(v).toLocaleString('ko-KR');
const METHOD_ORDER = ['자동', '반자동', '수동', '구분 미확보'];

/** 같은 지역은 늘 같은 변형을 쓰도록 이름으로 고르는 0..count-1 */
export function variantIndex(key, count) {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % count;
}

const names = (list) => list.map((s) => s.name).join(', ');

/**
 * 시군구 허브 사실 요약(1등 건수, 최근 1등 회차, 1등 최다 판매점). 반환: { variant, text } 또는 null
 * omit: 같은 쪽의 Writer 글이 이미 말한 문장(count 건수·recent 최근 1등·top 최다 판매점)은 뺀다. 남는 문장이 없으면 null
 * @param {{ label: string, shops: object[], period: { fromRound, toRound }, drawDate?: (round) => string|undefined, omit?: { count?, recent?, top? } }} p
 */
export function regionSummary({ label, shops, period, drawDate = () => undefined, omit = {} }) {
  if (!period?.fromRound || !period?.toRound || !shops?.length) return null;
  const { fromRound: from, toRound: to } = period;
  const wins = shops.flatMap((s) => (s.wins || []).map((w) => ({ ...w, shop: s })));
  if (!wins.length) return null;
  const r1 = wins.filter((w) => w.rank === 1);
  const r2 = wins.filter((w) => w.rank === 2).length;
  const k = new Set(r1.map((w) => w.shop)).size;
  const v = variantIndex(label, 3);
  const when = (round) => (drawDate(round) ? `${round}회(${drawDate(round)})` : `${round}회`);
  const sentences = [];

  if (!omit.count) sentences.push(r1.length
    ? [
      `${label}에서는 ${from}~${to}회 동안 1등 ${n(r1.length)}건과 2등 ${n(r2)}건이 나왔고, 1등을 낸 판매점은 ${n(k)}곳입니다.`,
      `${from}~${to}회 기록으로 보면 ${label}의 1등은 ${n(r1.length)}건, 2등은 ${n(r2)}건이며 1등을 낸 판매점은 ${n(k)}곳입니다.`,
      `${label} 판매점의 ${from}~${to}회 배출 기록은 1등 ${n(r1.length)}건, 2등 ${n(r2)}건입니다. 이 가운데 1등을 낸 판매점은 ${n(k)}곳입니다.`,
    ][v]
    : [
      `${label}에서는 ${from}~${to}회 동안 1등 기록이 없고, 2등이 ${n(r2)}건 나왔습니다.`,
      `${from}~${to}회 기록으로 보면 ${label}에는 1등 기록이 없고 2등이 ${n(r2)}건입니다.`,
      `${label} 판매점의 ${from}~${to}회 배출 기록은 2등 ${n(r2)}건이며, 1등 기록은 없습니다.`,
    ][v]);

  if (r1.length) {
    const last = Math.max(...r1.map((w) => w.round));
    const at = names([...new Set(r1.filter((w) => w.round === last).map((w) => w.shop))]);
    if (!omit.recent) sentences.push([
      `가장 최근 1등은 ${when(last)}에 ${at}에서 나왔습니다.`,
      `최근 1등 기록은 ${when(last)} ${at}입니다.`,
      `${label}의 마지막 1등은 ${when(last)}, ${at}에서 나왔습니다.`,
    ][v]);

    // 1등 2건 이상인 판매점이 3곳 이하로 가장 많을 때만 쓴다(1건씩 여러 곳이면 '가장 많다'가 뜻이 없다).
    const count = new Map();
    for (const w of r1) count.set(w.shop, (count.get(w.shop) || 0) + 1);
    const max = Math.max(...count.values());
    const top = [...count].filter(([, c]) => c === max).map(([s]) => s);
    if (max >= 2 && top.length <= 3 && !omit.top) {
      sentences.push([
        `1등을 가장 많이 낸 판매점은 ${names(top)}(${n(max)}건)입니다.`,
        `판매점별 1등은 ${names(top)}의 ${n(max)}건이 가장 많습니다.`,
        `1등 ${n(max)}건으로 기록이 가장 많은 판매점은 ${names(top)}입니다.`,
      ][v]);
    }
  }
  if (!sentences.length) return null;
  const asOf = drawDate(to);
  sentences.push(`(출처: 동행복권 당첨 판매점 기록, ${to}회${asOf ? `·${asOf} 추첨` : ''} 기준)`);
  return { variant: v, text: sentences.join(' ') };
}

const methodsText = (methods) => METHOD_ORDER.filter((m) => methods[m]).map((m) => `${m} ${n(methods[m])}건`).join(', ');
const byCount = (bySido) => [...bySido].sort((a, b) => b.count - a.count);

/**
 * 회차 결과 쪽: 이번 회차 1등 판매점 지역 분포와 자동·수동 건수. round는 buildWinningRounds()의 한 항목. 없으면 null
 */
export function roundRegionSentence(round) {
  if (!round?.winners || (!round.shopWins && !round.internet)) return null;
  const parts = [round.shopWins
    ? `${round.round}회 1등 ${n(round.winners)}게임 가운데 판매점에서 나온 ${n(round.shopWins)}건의 지역은 ${byCount(round.bySido).map((g) => `${g.sido} ${n(g.count)}건`).join(', ')}입니다.`
    : `${round.round}회 1등 ${n(round.winners)}게임 가운데 판매점에서 나온 1등은 없습니다.`];
  if (round.internet) parts.push(`인터넷 구매 1등은 ${n(round.internet)}건입니다.`);
  const methods = methodsText(round.methods || {});
  if (methods) parts.push(`판매점 1등의 구입 방식은 ${methods}입니다.`);
  parts.push(`(출처: 동행복권 당첨 결과·당첨 판매점 기록, ${round.date} 추첨)`);
  return parts.join(' ');
}

/**
 * 회차별 1등 판매점 쪽: 1등이 나온 지역 요약 + 같은 판매점의 이전 1등 이력(이 회차 이전 기록만 써서 나중에 바뀌지 않는다). 없으면 null
 */
export function roundShopHistorySentence(round, period) {
  if (!round?.shops?.length || !period?.fromRound) return null;
  const places = byCount(round.bySido).map((g) => `${g.sido}${g.places.length ? `(${g.places.join('·')})` : ''} ${n(g.count)}건`).join(', ');
  const parts = [`${round.round}회 1등 판매점 ${n(round.shops.length)}곳은 ${places}에 있습니다.`];
  // 비교할 이전 회차가 수집 기간 안에 있을 때만 이력 문장을 쓴다.
  if (round.round > period.fromRound) {
    const range = `${period.fromRound}~${round.round - 1}회`;
    const prior = round.shops.map((e) => {
      const earlier = (e.shop.wins || []).filter((w) => w.rank === 1 && w.round < round.round);
      return { name: e.shop.name, count: earlier.length, last: Math.max(0, ...earlier.map((w) => w.round)) };
    }).filter((x) => x.count).sort((a, b) => b.count - a.count || b.last - a.last);
    const shown = prior.slice(0, 3).map((x) => `${x.name}(1등 ${n(x.count)}건, 최근 ${x.last}회)`).join(', ');
    parts.push(prior.length
      ? `이 가운데 ${range}에도 1등을 낸 판매점은 ${n(prior.length)}곳으로, ${shown}${prior.length > 3 ? ` 외 ${n(prior.length - 3)}곳` : ''}입니다.`
      : `이 판매점들 가운데 ${range}에 1등을 낸 곳은 없습니다.`);
  }
  parts.push(`(출처: 동행복권 당첨 판매점 기록, ${period.fromRound}~${round.round}회 기준)`);
  return parts.join(' ');
}
