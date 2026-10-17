// 회차별 1등 배출 판매점 집계 (빌드와 테스트가 함께 쓴다)
import { splitRegionName } from './regions.js';

/** 시도 표시 순서. 판매점 주소의 시도 표기를 따른다(광주·전남은 '전남광주'). 목록에 없는 시도는 뒤에 붙는다. */
export const SIDO_ORDER = ['서울', '부산', '대구', '인천', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남광주', '경북', '경남', '제주'];

const METHOD_ORDER = ['자동', '반자동', '수동'];
const NO_METHOD = '구분 미확보';

/** { 자동: 2, 수동: 1 } → '자동 2 · 수동 1', 한 가지면 '자동' 또는 '수동 2건' */
export function methodText(methods) {
  const keys = Object.keys(methods).sort((a, b) => (METHOD_ORDER.indexOf(a) + 1 || 9) - (METHOD_ORDER.indexOf(b) + 1 || 9));
  if (keys.length === 1) return methods[keys[0]] > 1 ? `${keys[0]} ${methods[keys[0]]}건` : keys[0];
  return keys.map((k) => `${k} ${methods[k]}`).join(' · ');
}

const sidoRank = (sido) => (SIDO_ORDER.includes(sido) ? SIDO_ORDER.indexOf(sido) : SIDO_ORDER.length);

/**
 * 회차별 1등 배출 목록. 판매점 수집 기간(meta.period) 안이면서 당첨 결과가 있는 회차만, 최신 회차부터.
 * 판매점 1등 건수 + 인터넷 1등 건수가 공식 1등 당첨자 수와 같은지(matched)도 함께 돌려준다.
 * 인터넷 기록(meta.internetWins)이 없으면 internet·matched는 null(확인 불가)이다.
 * @returns {{ round, date, year, winners: number|null, amount: number|null, internet: number|null,
 *   shopWins: number, unlocated: { shopName: string, address: string }[], matched: boolean|null, methods: Object<string, number>,
 *   bySido: { sido: string, count: number, places: string[] }[],
 *   shops: { shop, sido: string, sigungu: string, count: number, methods: Object<string, number> }[] }[]}
 */
export function buildWinningRounds({ shopsData, drawsData }) {
  const period = shopsData?.meta?.period;
  if (!period?.fromRound || !period?.toRound) return [];
  const names = new Map((shopsData.regions || []).map((r) => [r.id, r.name]));
  const internetRows = Array.isArray(shopsData.meta.internetWins) ? shopsData.meta.internetWins : null;
  const internetByRound = new Map((internetRows || []).map((r) => [r.round, Number.isInteger(r.rank1) ? r.rank1 : 0]));
  // 주소에서 시도·시군구를 확정하지 못한 공식 1등 기록(지도·표 제외, 공식 인원 대조에는 포함)
  const unlocatedRows = (Array.isArray(shopsData.meta.unlocatedWins) ? shopsData.meta.unlocatedWins : []).filter((w) => w.rank === 1);

  // 회차 → 판매점 id → { shop, count, methods }
  const byRound = new Map();
  for (const shop of shopsData.shops || []) {
    for (const w of shop.wins || []) {
      if (w.rank !== 1) continue;
      const shops = byRound.get(w.round) ?? byRound.set(w.round, new Map()).get(w.round);
      const entry = shops.get(shop.id) ?? shops.set(shop.id, { shop, count: 0, methods: {} }).get(shop.id);
      const method = w.method || NO_METHOD;
      entry.count++;
      entry.methods[method] = (entry.methods[method] || 0) + 1;
    }
  }

  return (drawsData?.draws || [])
    .filter((d) => d.round >= period.fromRound && d.round <= period.toRound)
    .sort((a, b) => b.round - a.round)
    .map((draw) => {
      const prize = (draw.prizes || []).find((p) => p.rank === 1);
      const winners = Number.isInteger(prize?.winners) ? prize.winners : null;
      const shops = [...(byRound.get(draw.round)?.values() || [])].map((e) => {
        const { sido, sigungu } = splitRegionName(names.get(e.shop.region) || e.shop.region);
        return { ...e, sido, sigungu };
      }).sort((a, b) => sidoRank(a.sido) - sidoRank(b.sido) || a.sido.localeCompare(b.sido, 'ko')
        || a.sigungu.localeCompare(b.sigungu, 'ko') || String(a.shop.name).localeCompare(String(b.shop.name), 'ko'));

      const shopWins = shops.reduce((s, e) => s + e.count, 0);
      const internet = internetRows ? (internetByRound.get(draw.round) ?? 0) : null;
      const unlocated = unlocatedRows.filter((w) => w.round === draw.round);
      const methods = {};
      const sidoMap = new Map();
      for (const e of shops) {
        for (const [m, n] of Object.entries(e.methods)) methods[m] = (methods[m] || 0) + n;
        const g = sidoMap.get(e.sido) ?? sidoMap.set(e.sido, { sido: e.sido, count: 0, places: [] }).get(e.sido);
        g.count += e.count;
        if (e.sigungu && !g.places.includes(e.sigungu)) g.places.push(e.sigungu);
      }
      return {
        round: draw.round,
        date: draw.date,
        year: String(draw.date || '').slice(0, 4),
        winners,
        amount: Number.isFinite(prize?.amount) ? prize.amount : null,
        internet,
        shopWins,
        unlocated,
        matched: winners !== null && internet !== null ? shopWins + internet + unlocated.length === winners : null,
        methods,
        bySido: [...sidoMap.values()],
        shops,
      };
    });
}
