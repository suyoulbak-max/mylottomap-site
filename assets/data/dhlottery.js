import { validateDrawsFile } from './validate.js';

export const RESULT_URL = 'https://www.dhlottery.co.kr/lt645/result';
export const RESULT_DATA_URL = 'https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do';

function integer(value, label, nullable = false) {
  if (nullable && (value === undefined || value === null || value === '')) return null;
  if ((typeof value !== 'number' && typeof value !== 'string')
      || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`공식 응답 ${label}: 정수 형식이 변경되었거나 값이 없습니다.`);
  }
  return Number(value);
}

export function parseLatestRound(html) {
  // 정기 점검 중에는 200 응답으로 점검 화면이 온다(2026-10-18 00~04시 확인). 구조 변경과 구분해 알린다.
  if (typeof html === 'string' && /<title>\s*시스템 점검/u.test(html)) throw new Error('동행복권 시스템 점검 중입니다(점검 화면 응답). 점검이 끝난 뒤 다시 실행하세요.');
  if (typeof html !== 'string' || !html.includes('/lt645/selectPstLt645InfoNew.do')) {
    throw new Error('공식 결과 HTML의 조회 경로가 변경되었습니다.');
  }
  const input = html.match(/<input\b[^>]*\bid=["']opt_val["'][^>]*>/i)?.[0];
  const value = input?.match(/\bvalue=["'](\d+)["']/i)?.[1];
  const round = integer(value, '최신 회차');
  if (round < 1) throw new Error('공식 최신 회차는 양의 정수여야 합니다.');
  return round;
}

export function parseDrawsResponse(response, checkedAt) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+09:00$/.test(checkedAt)) {
    throw new Error('공식 확인 시각에는 한국 시간대 +09:00이 필요합니다.');
  }
  const body = typeof response === 'string' ? JSON.parse(response) : response;
  if (!body || !Array.isArray(body.data?.list)
      || !Object.hasOwn(body, 'resultCode') || body.resultCode !== null) {
    throw new Error('공식 결과 응답 형식이 변경되었거나 오류 응답입니다.');
  }
  const draws = body.data.list.map(item => {
    if (!item || typeof item !== 'object') throw new Error('공식 회차 항목이 객체가 아닙니다.');
    const date = String(item.ltRflYmd ?? '');
    if (!/^\d{8}$/.test(date)) throw new Error('공식 응답 추첨일 형식이 변경되었습니다.');
    const prizes = Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1,
      amount: integer(item[`rnk${i + 1}WnAmt`], `${i + 1}등 금액`, true),
      winners: integer(item[`rnk${i + 1}WnNope`], `${i + 1}등 인원`, true),
    }));
    return {
      round: integer(item.ltEpsd, '회차'),
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      numbers: Array.from({ length: 6 }, (_, i) => integer(item[`tm${i + 1}WnNo`], `본번호 ${i + 1}`)),
      bonus: integer(item.bnsWnNo, '보너스'),
      // 추첨 직후에는 당첨금 집계 전이라 전 등수 금액·인원이 0으로 온다(2026-10-24 1247회 20:47 확인). 5등까지 모두 0인 실제 결과는 없으므로 미확보로 둔다.
      prizes: prizes.every(p => !p.amount && !p.winners) ? null : prizes,
      source: RESULT_URL, checkedAt,
    };
  }).sort((a, b) => a.round - b.round);
  const validated = validateDrawsFile({ meta: { source: RESULT_URL, checkedAt, status: draws.length ? 'ok' : 'empty' }, draws });
  if (!validated.ok) throw new Error(`공식 결과 검증 실패: ${validated.errors.join('; ')}`);
  if (draws.some(draw => draw.date > checkedAt.slice(0, 10))) throw new Error('미래 추첨일의 결과는 반영할 수 없습니다.');
  return draws;
}
