// 저장 번호와 회차 결과 비교. 결과 미확보는 낙첨이 아니라 pending이다.

/**
 * @param {number[]} numbers 검증된 번호 6개
 * @param {{ numbers: number[], bonus: number } | null | undefined} draw 대상 회차 결과
 * @returns {{ status: 'pending' } | { status: 'done', rank: 1|2|3|4|5|null, matched: number, bonusMatched: boolean }}
 */
export function rankTicket(numbers, draw) {
  if (draw == null) return { status: 'pending' };
  const main = new Set(draw.numbers);
  const matched = numbers.filter((n) => main.has(n)).length;
  const bonusMatched = numbers.includes(draw.bonus);
  let rank = null;
  if (matched === 6) rank = 1;
  else if (matched === 5) rank = bonusMatched ? 2 : 3;
  else if (matched === 4) rank = 4;
  else if (matched === 3) rank = 5;
  return { status: 'done', rank, matched, bonusMatched };
}
