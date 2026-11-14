// 회차 데이터 통계. 본번호 6개만 집계하고 보너스는 제외한다.
import { choose } from './generate.js';

/**
 * 번호 합계 구간(양끝 포함). 가능한 합계는 21(1~6) ~ 255(40~45)이며 모든 합계가 정확히 한 구간에 속한다.
 * 21~80, 81~100, 101~120, 121~140, 141~160, 161~180, 181~200, 201~255
 */
export const SUM_BUCKETS = [
  [21, 80], [81, 100], [101, 120], [121, 140], [141, 160], [161, 180], [181, 200], [201, 255],
];

/**
 * @param {{ round: number, numbers: number[] }[]} draws 회차 오름차순
 * @param {{ last?: number|null }} [options] last가 양의 정수면 최근 last회만 집계
 * @returns {{
 *   range: { from: number|null, to: number|null, count: number },
 *   numbers: { n: number, count: number, gap: number|null }[],
 *   oddEven: { odd: number, count: number }[],
 *   sumBuckets: { min: number, max: number, count: number }[],
 * }}
 * gap: 기간 내 마지막 출현 회차 이후 기간 끝 회차까지 연속 미출현한 회차 수(끝 회차 출현 시 0).
 * 기간 내 출현이 없으면 null. 기간 안의 회차 개수 기준으로 센다.
 */
export function computeStats(draws, { last = null } = {}) {
  if (last !== null && !(Number.isInteger(last) && last > 0)) {
    throw new RangeError(`last는 null 또는 양의 정수여야 합니다: ${last}`);
  }
  const sorted = [...draws].sort((a, b) => a.round - b.round);
  const picked = last === null ? sorted : sorted.slice(-last);

  const count = new Array(46).fill(0);
  const lastIdx = new Array(46).fill(-1);
  const oddEven = Array.from({ length: 7 }, (_, odd) => ({ odd, count: 0 }));
  const sumBuckets = SUM_BUCKETS.map(([min, max]) => ({ min, max, count: 0 }));

  picked.forEach((d, i) => {
    let odd = 0;
    let sum = 0;
    for (const n of d.numbers) {
      count[n]++;
      lastIdx[n] = i;
      odd += n % 2;
      sum += n;
    }
    oddEven[odd].count++;
    const bucket = sumBuckets.find((b) => sum >= b.min && sum <= b.max);
    if (bucket) bucket.count++;
  });

  const end = picked.length - 1;
  return {
    range: {
      from: picked.length ? picked[0].round : null,
      to: picked.length ? picked[end].round : null,
      count: picked.length,
    },
    numbers: Array.from({ length: 45 }, (_, k) => {
      const n = k + 1;
      return { n, count: count[n], gap: lastIdx[n] < 0 ? null : end - lastIdx[n] };
    }),
    oddEven,
    sumBuckets,
  };
}

// ---------- 이론값: 1~45에서 6개를 고르는 전체 조합 8,145,060개 기준 ----------

/** 홀수 개수별 조합 수. 홀수 23개·짝수 22개이므로 C(23, odd) × C(22, 6 − odd). */
export function theoreticalOddEven() {
  return Array.from({ length: 7 }, (_, odd) => ({ odd, combos: choose(23, odd) * choose(22, 6 - odd) }));
}

/** SUM_BUCKETS 구간별 조합 수. 번호를 하나씩 더하며 (고른 개수, 합계)별 조합 수를 센다. */
export function theoreticalSumBuckets() {
  const ways = Array.from({ length: 7 }, () => new Array(256).fill(0));
  ways[0][0] = 1;
  for (let n = 1; n <= 45; n++) {
    for (let k = 6; k >= 1; k--) for (let s = 255; s >= n; s--) ways[k][s] += ways[k - 1][s - n];
  }
  return SUM_BUCKETS.map(([min, max]) => ({
    min,
    max,
    combos: ways[6].slice(min, max + 1).reduce((a, b) => a + b, 0),
  }));
}

/**
 * drawCount회 동안 번호 하나의 기대 출현 횟수와 대략적인 우연 변동 범위(평균 ± 2 표준편차).
 * 번호 하나가 한 회차 본번호에 나올 확률은 6/45이다. 범위는 정규 근사라 회차가 적으면 거칠다.
 */
export function expectedNumberCount(drawCount) {
  const p = 6 / 45;
  const mean = (drawCount * 6) / 45;
  const sd = Math.sqrt(drawCount * p * (1 - p));
  return { mean, low: Math.max(0, mean - 2 * sd), high: mean + 2 * sd };
}
