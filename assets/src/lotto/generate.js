// 로또 6/45 번호 생성·검증. 브라우저와 Node 공용 순수 ES 모듈.

const MIN = 1;
const MAX = 45;
const PICK = 6;
const SUM_MIN = 21; // 1+2+3+4+5+6
const SUM_MAX = 255; // 40+41+42+43+44+45

const isLottoNumber = (n) => Number.isInteger(n) && n >= MIN && n <= MAX;

/** 조합 수 C(n, k). */
export function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

/** 1~45에서 6개를 고르는 전체 조합 수 = 1등 확률의 분모. */
export const TOTAL_COMBINATIONS = choose(MAX, PICK); // 8,145,060

/**
 * 바이트 공급 함수로 [0, n) 균등 정수를 만드는 함수를 만든다.
 * 상단 나머지 구간을 버리는 거부 샘플링으로 단순 나머지 연산의 편향을 없앤다.
 * n ≤ 256은 1바이트(256 % n 구간 버림), 그보다 크면 32비트(2^32 % n 구간 버림)를 쓴다.
 * 조건 생성은 조건에 맞는 조합 순번(최대 8,145,060)을 고르므로 32비트 범위가 필요하다.
 * @param {(buf: Uint8Array|Uint32Array) => Uint8Array|Uint32Array} getRandomValues
 */
export function makeRandomInt(getRandomValues) {
  return (n) => {
    if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new RangeError(`randomInt 범위 오류: ${n}`);
    const small = n <= 256;
    const span = small ? 256 : 2 ** 32;
    const limit = span - (span % n);
    const buf = small ? new Uint8Array(1) : new Uint32Array(1);
    for (;;) {
      getRandomValues(buf);
      if (buf[0] < limit) return buf[0] % n;
    }
  };
}

const defaultRandomInt = makeRandomInt((buf) => globalThis.crypto.getRandomValues(buf));

/**
 * 직접 입력·저장 번호 검증. 정상이면 null, 아니면 한국어 오류 문자열.
 * @param {unknown} numbers
 * @returns {string|null}
 */
export function validateTicket(numbers) {
  if (!Array.isArray(numbers) || numbers.length !== PICK) return '번호는 6개여야 합니다.';
  if (!numbers.every(isLottoNumber)) return '번호는 1~45 사이의 정수여야 합니다.';
  if (new Set(numbers).size !== PICK) return '중복된 번호가 있습니다.';
  return null;
}

/**
 * 오름차순 번호 6개의 특성: 홀수 개수, 합계, 가장 길게 이어진 연속 번호 개수.
 * @param {number[]} numbers 오름차순
 * @returns {{ odd: number, sum: number, maxRun: number }}
 */
export function gameFeatures(numbers) {
  let odd = 0;
  let sum = 0;
  let run = 0;
  let maxRun = 0;
  numbers.forEach((n, i) => {
    odd += n % 2;
    sum += n;
    run = i > 0 && n === numbers[i - 1] + 1 ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  });
  return { odd, sum, maxRun };
}

const fail = (error) => ({ ok: false, error });

/**
 * 생성 조건 검사·정규화. 오류 문구 순서는 포함·제외 → 홀짝 → 합계 → 연속 → 남은 번호 수이다.
 * 조건은 모두 선택 사항이며 값이 없으면 제한하지 않는다.
 * - oddCounts: 허용할 홀수 개수 목록(0~6). 빈 배열이면 제한 없음.
 * - sumMin·sumMax: 번호 합계 범위(21~255, 양끝 포함). null이면 그쪽 제한 없음.
 * - maxRun: 연속 번호(예: 7·8·9는 3개)를 최대 몇 개까지 허용할지(1~6). null이면 제한 없음.
 */
function normalize({ include = [], exclude = [], oddCounts = [], sumMin = null, sumMax = null, maxRun = null }) {
  if (!Array.isArray(include) || !Array.isArray(exclude)) return fail('포함·제외 번호 형식이 올바르지 않습니다.');
  if (![...include, ...exclude].every(isLottoNumber)) return fail('포함·제외 번호는 1~45 사이의 정수여야 합니다.');
  if (include.length > PICK) return fail('포함 번호는 최대 6개까지 선택할 수 있습니다.');
  if (new Set(include).size !== include.length) return fail('포함 번호에 중복이 있습니다.');

  const excluded = new Set(exclude);
  const conflict = include.filter((n) => excluded.has(n));
  if (conflict.length) return fail(`포함과 제외에 동시에 선택된 번호가 있습니다: ${conflict.join(', ')}`);

  const isOdd = (o) => Number.isInteger(o) && o >= 0 && o <= PICK;
  if (!Array.isArray(oddCounts) || !oddCounts.every(isOdd) || new Set(oddCounts).size !== oddCounts.length) {
    return fail('홀짝 조건이 올바르지 않습니다.');
  }
  const isSum = (v) => v === null || (Number.isInteger(v) && v >= SUM_MIN && v <= SUM_MAX);
  if (!isSum(sumMin) || !isSum(sumMax)) return fail(`번호 합계는 ${SUM_MIN}~${SUM_MAX} 사이의 정수로 입력해 주세요.`);
  if (sumMin !== null && sumMax !== null && sumMin > sumMax) return fail('합계 최솟값이 최댓값보다 큽니다.');
  if (!(maxRun === null || (Number.isInteger(maxRun) && maxRun >= 1 && maxRun <= PICK))) {
    return fail('연속 번호 조건이 올바르지 않습니다.');
  }

  const fixed = new Set(include);
  const pool = [];
  for (let n = MIN; n <= MAX; n++) if (!fixed.has(n) && !excluded.has(n)) pool.push(n);
  const need = PICK - include.length;
  if (pool.length < need) {
    return fail(`선택 가능한 번호가 ${pool.length}개로 부족합니다. 제외 번호를 줄여 주세요.`);
  }

  return {
    ok: true,
    include: [...include].sort((a, b) => a - b),
    excluded,
    pool,
    need,
    filtered: oddCounts.length > 0 || sumMin !== null || sumMax !== null || maxRun !== null,
    odd: oddCounts.length ? new Set(oddCounts) : null,
    sumMin: sumMin ?? SUM_MIN,
    sumMax: sumMax ?? SUM_MAX,
    maxRun: maxRun ?? PICK,
  };
}

/**
 * 조건을 만족하는 조합을 사전순으로 방문한다. visit이 true를 돌려주면 멈춘다.
 * 번호를 오름차순으로 고르면서 포함 번호는 건너뛸 수 없으므로, 다음 후보의 상한을
 * 아직 고르지 않은 가장 작은 포함 번호로 둔다. 합계 상한은 남은 번호를 가장 작게 골라도
 * 넘으면 이후 후보도 모두 넘으므로 반복을 끝낸다. 최악(조건만 있고 포함·제외 없음)은 8,145,060개 방문.
 * ponytail: 메인 스레드에서 수백 ms까지 걸릴 수 있다. 느리면 Web Worker나 DP 계수로 바꾼다.
 */
function walk(c, visit) {
  const pick = new Array(PICK);
  const rec = (depth, prev, sum, odd, run, inc) => {
    if (depth === PICK) return sum >= c.sumMin && (!c.odd || c.odd.has(odd)) && visit(pick);
    const left = PICK - depth;
    if (c.include.length - inc > left) return false;
    const hi = Math.min(inc < c.include.length ? c.include[inc] : MAX, MAX - left + 1);
    for (let n = prev + 1; n <= hi; n++) {
      if (sum + n * left + ((left - 1) * left) / 2 > c.sumMax) break;
      if (c.excluded.has(n)) continue;
      const r = n === prev + 1 ? run + 1 : 1;
      if (r > c.maxRun) continue;
      pick[depth] = n;
      if (rec(depth + 1, n, sum + n, odd + (n % 2), r, n === c.include[inc] ? inc + 1 : inc)) return true;
    }
    return false;
  };
  rec(0, 0, 0, 0, 0, 0);
}

function countValid(c) {
  if (!c.filtered) return choose(c.pool.length, c.need);
  let count = 0;
  walk(c, () => { count++; return false; });
  return count;
}

/**
 * 조건에 맞는 6개 조합 수. 전체는 TOTAL_COMBINATIONS(8,145,060)이다.
 * @returns {{ ok: true, count: number } | { ok: false, error: string }}
 */
export function countCombos(options = {}) {
  const c = normalize(options);
  return c.ok ? { ok: true, count: countValid(c) } : c;
}

/**
 * 오름차순 번호 6개가 생성 조건(포함·제외·홀짝·합계·연속)에 맞는지. 조건이 잘못되면 false.
 * 과거 당첨 번호 중 조건에 맞는 회차 비율을 보여 줄 때 쓴다.
 */
export function matchesOptions(numbers, options = {}) {
  const c = normalize(options);
  if (!c.ok) return false;
  const set = new Set(numbers);
  if (!c.include.every((n) => set.has(n)) || numbers.some((n) => c.excluded.has(n))) return false;
  const f = gameFeatures(numbers);
  return f.sum >= c.sumMin && f.sum <= c.sumMax && f.maxRun <= c.maxRun && (!c.odd || c.odd.has(f.odd));
}

/**
 * 조건에 맞는 조합 중에서 균등하게 고른 게임을 만든다. 조건이 없으면 1~45에서 6개를 균등하게 고른다.
 * 숨겨진 필터는 없다. 불가능한 조건은 생성 전에 검사해 오류로 돌려준다(반복 생성으로 해결하지 않음).
 * 조건이 있으면 조건에 맞는 조합 수 N을 센 뒤 [0, N) 순번을 균등하게 뽑아 그 조합을 고른다.
 * @param {{ include?: number[], exclude?: number[], count?: number,
 *   oddCounts?: number[], sumMin?: number|null, sumMax?: number|null, maxRun?: number|null }} options
 * @param {(n: number) => number} [randomInt] [0, n) 균등 정수. 테스트에서 주입.
 * @returns {{ ok: true, games: number[][] } | { ok: false, error: string }}
 */
export function generateGames({ count = 1, ...options } = {}, randomInt = defaultRandomInt) {
  if (!Array.isArray(options.include ?? []) || !Array.isArray(options.exclude ?? [])) {
    return fail('포함·제외 번호 형식이 올바르지 않습니다.');
  }
  if (!Number.isInteger(count) || count < 1 || count > 5) return fail('게임 수는 1~5 사이여야 합니다.');
  const c = normalize(options);
  if (!c.ok) return c;

  if (c.filtered) {
    const total = countValid(c);
    if (total === 0) return fail('조건에 맞는 번호 조합이 없습니다. 조건을 넓혀 주세요.');
    const targets = Array.from({ length: count }, (_, i) => [randomInt(total), i]).sort((a, b) => a[0] - b[0]);
    const games = new Array(count);
    let index = 0;
    let k = 0;
    walk(c, (pick) => {
      while (k < count && targets[k][0] === index) games[targets[k++][1]] = pick.slice();
      index++;
      return k === count;
    });
    return { ok: true, games };
  }

  const games = [];
  for (let g = 0; g < count; g++) {
    // 부분 Fisher-Yates: 앞쪽 need칸만 섞는다.
    const p = c.pool.slice();
    for (let i = 0; i < c.need; i++) {
      const j = i + randomInt(p.length - i);
      [p[i], p[j]] = [p[j], p[i]];
    }
    games.push([...c.include, ...p.slice(0, c.need)].sort((a, b) => a - b));
  }
  return { ok: true, games };
}
