// 다음 회차 정보: 동행복권 로또6/45 소개 화면(/lt645/intro)이 표시하는 다음 회차·판매 마감·1등 예상 총 당첨금
export const INTRO_URL = 'https://www.dhlottery.co.kr/lt645/intro';
export const NEXT_INFO_URL = 'https://www.dhlottery.co.kr/lt645/selectThsLt645Info.do';
export const JACKPOT_URL = 'https://www.dhlottery.co.kr/lt645/selectRnk1ExpcAmt.do';
// 소개 화면 문구 '추첨시간 매주 토요일 20:35분 경(방송국 사정에 따라 변동 가능)'
export const DRAW_TIME = '20:35';

const KST_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+09:00$/;

function result(response, label) {
  const body = typeof response === 'string' ? JSON.parse(response) : response;
  if (!body || body.resultCode !== null || !body.data?.result || typeof body.data.result !== 'object') {
    throw new Error(`공식 ${label} 응답 형식이 변경되었거나 오류 응답입니다.`);
  }
  return body.data.result;
}

function validDate(ymd) {
  const date = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === ymd;
}

/** selectThsLt645Info.do → { round, drawDate, salesCloseAt, drawAt } */
export function parseNextInfo(response) {
  const r = result(response, '다음 회차');
  const round = Number(r.ltEpsd);
  const ymd = String(r.ltRflYmd ?? '');
  const hh = String(r.ltRflHh ?? '');
  const mm = String(r.ltRflMm ?? '');
  if (!Number.isSafeInteger(round) || round < 1) throw new Error('공식 다음 회차 번호 형식이 변경되었습니다.');
  if (!/^\d{8}$/.test(ymd) || !/^\d{2}$/.test(hh) || !/^\d{2}$/.test(mm)) throw new Error('공식 다음 회차 마감 시각 형식이 변경되었습니다.');
  const drawDate = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  if (!validDate(drawDate) || Number(hh) > 23 || Number(mm) > 59) throw new Error('공식 다음 회차 날짜·시각이 올바르지 않습니다.');
  return { round, drawDate, salesCloseAt: `${drawDate}T${hh}:${mm}:00+09:00`, drawAt: `${drawDate}T${DRAW_TIME}:00+09:00` };
}

/** selectRnk1ExpcAmt.do → { amount, asOf } 또는 금액이 0이면 null(집계 전) */
export function parseJackpot(response) {
  const r = result(response, '1등 예상 당첨금');
  const amount = Number(r.rnk1ExpcAmt);
  const at = String(r.giveDt ?? '');
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('공식 1등 예상 당첨금 형식이 변경되었습니다.');
  if (!/^\d{14}$/.test(at)) throw new Error('공식 1등 예상 당첨금 기준 시각 형식이 변경되었습니다.');
  const date = `${at.slice(0, 4)}-${at.slice(4, 6)}-${at.slice(6, 8)}`;
  if (!validDate(date)) throw new Error('공식 1등 예상 당첨금 기준 시각이 올바르지 않습니다.');
  return amount === 0 ? null : { amount, asOf: `${date}T${at.slice(8, 10)}:${at.slice(10, 12)}:${at.slice(12, 14)}+09:00` };
}

/** 저장 파일 검증. latestDraw는 검증된 draws.json의 최신 회차({ round, date }) */
export function validateNextDraw(data, latestDraw = null) {
  const errors = [];
  if (!data || typeof data !== 'object') return { ok: false, errors: ['객체가 아닙니다.'] };
  const { meta, round, drawDate, salesCloseAt, drawAt, jackpot } = data;
  if (!meta?.source || !meta?.sourceUrl || !KST_ISO.test(meta?.checkedAt ?? '')) errors.push('meta.source·sourceUrl·checkedAt(+09:00)이 필요합니다.');
  if (!Number.isSafeInteger(round) || round < 1) errors.push('round는 양의 정수여야 합니다.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(drawDate ?? '') || !validDate(drawDate)) errors.push('drawDate 형식이 올바르지 않습니다.');
  for (const [key, value] of [['salesCloseAt', salesCloseAt], ['drawAt', drawAt]]) {
    if (!KST_ISO.test(value ?? '') || value.slice(0, 10) !== drawDate) errors.push(`${key}는 drawDate의 한국 시각이어야 합니다.`);
  }
  if (!errors.length && Date.parse(salesCloseAt) > Date.parse(drawAt)) errors.push('판매 마감이 추첨 시각보다 늦습니다.');
  if (jackpot !== null) {
    if (!jackpot || !Number.isSafeInteger(jackpot.amount) || jackpot.amount < 1 || !KST_ISO.test(jackpot.asOf ?? '')) errors.push('jackpot은 null 또는 { amount, asOf }여야 합니다.');
    else if (!errors.length && Date.parse(jackpot.asOf) > Date.parse(drawAt)) errors.push('예상 당첨금 기준 시각이 추첨 이후입니다.');
  }
  if (latestDraw && Number.isSafeInteger(round)) {
    if (round <= latestDraw.round) errors.push(`다음 회차 ${round}회가 이미 확보된 최신 결과 ${latestDraw.round}회 이하입니다.`);
    if (drawDate && latestDraw.date && drawDate <= latestDraw.date) errors.push('다음 회차 추첨일이 최신 결과 추첨일 이전입니다.');
    // 예상 당첨금은 직전 회차 추첨 이후에 집계된 값이어야 한다(지난 회차 값이 남은 응답 차단).
    if (round === latestDraw.round + 1 && jackpot?.asOf && jackpot.asOf.slice(0, 10) < latestDraw.date) errors.push('예상 당첨금 기준 시각이 직전 회차 추첨일 이전입니다.');
  }
  return { ok: errors.length === 0, errors };
}
