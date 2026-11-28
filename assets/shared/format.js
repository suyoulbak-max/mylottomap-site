// 형식 표시 헬퍼 함수

/** HTML 특수 문자 이스케이프 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 금액(원) 포맷. null이면 '미확보', 0은 '0원' */
export function formatMoney(amount) {
  if (amount === null || amount === undefined) return '미확보';
  return `${Number(amount).toLocaleString('ko-KR')}원`;
}

/** 인원(명) 포맷. null이면 '미확보', 0은 '0명' */
export function formatWinners(winners) {
  if (winners === null || winners === undefined) return '미확보';
  return `${Number(winners).toLocaleString('ko-KR')}명`;
}

/** 날짜 문자열 검증 및 포맷 */
export function formatDate(date) {
  if (!date) return '-';
  return String(date);
}

/** ISO 날짜·시간 문자열을 한국 시각 표시로 변환 */
export function formatDateTimeKst(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '데이터 준비 중';
    const kst = new Date(d.getTime() + 540 * 60000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kst.getUTCDate()).padStart(2, '0');
    const h = String(kst.getUTCHours()).padStart(2, '0');
    const min = String(kst.getUTCMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return '데이터 준비 중';
  }
}

/** 번호별 로또 공 색상 클래스 */
export function getBallColorClass(num) {
  const n = Number(num);
  if (n >= 1 && n <= 10) return 'ball-yellow';
  if (n >= 11 && n <= 20) return 'ball-blue';
  if (n >= 21 && n <= 30) return 'ball-red';
  if (n >= 31 && n <= 40) return 'ball-purple';
  if (n >= 41 && n <= 45) return 'ball-green';
  return 'ball-gray';
}

/** 단일 로또 공 HTML */
export function renderBall(num, { size = 'md', isBonus = false } = {}) {
  const cls = getBallColorClass(num);
  const bonusAttr = isBonus ? ' aria-label="보너스 번호 ' + num + '"' : ' aria-label="번호 ' + num + '"';
  return `<span class="lotto-ball ${cls} ball-${size}"${bonusAttr}>${escapeHtml(num)}</span>`;
}

/** 번호 목록 및 보너스 공 렌더링 */
export function renderBalls(numbers, bonus = null, { size = 'md' } = {}) {
  if (!Array.isArray(numbers)) return '';
  const mainBalls = numbers.map((n) => renderBall(n, { size })).join('');
  if (bonus == null) return `<div class="ball-group">${mainBalls}</div>`;
  const bonusBall = renderBall(bonus, { size, isBonus: true });
  return `<div class="ball-group">${mainBalls}<span class="ball-plus" aria-hidden="true">+</span>${bonusBall}</div>`;
}
