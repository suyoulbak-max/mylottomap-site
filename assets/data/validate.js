const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const positive = value => Number.isSafeInteger(value) && value > 0;
const lottoNumber = value => Number.isInteger(value) && value >= 1 && value <= 45;
const nonnegative = value => value === null || (Number.isSafeInteger(value) && value >= 0);

function realDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function timestamp(value) {
  return hasText(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && realDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}
function provenance(value, label, errors, sourceKey = 'source', timeKey = 'checkedAt') {
  if (!hasText(value[sourceKey])) errors.push(`${label}: ${sourceKey} 출처가 필요합니다.`);
  if (!timestamp(value[timeKey])) errors.push(`${label}: ${timeKey} 확인 시각은 시간대가 포함된 실제 ISO 날짜·시간이어야 합니다.`);
}
function envelope(obj, collection, errors) {
  if (!isObject(obj)) { errors.push('파일: JSON 객체가 필요합니다.'); return false; }
  if (!isObject(obj.meta)) errors.push('파일: meta 객체가 필요합니다.');
  else {
    if (!['ok', 'empty', 'stale'].includes(obj.meta.status)) errors.push('파일 meta.status: ok, empty, stale 중 하나여야 합니다.');
    if (Array.isArray(obj[collection])) {
      if (obj[collection].length > 0) {
        provenance(obj.meta, '파일 meta', errors);
        if (obj.meta.status === 'empty') errors.push(`파일 meta.status: ${collection} 기록이 있으면 empty일 수 없습니다.`);
      } else if (obj.meta.status !== 'empty') errors.push(`파일 meta.status: ${collection} 기록이 없으면 empty여야 합니다.`);
    }
  }
  if (!Array.isArray(obj[collection])) { errors.push(`파일: ${collection} 배열이 필요합니다.`); return false; }
  return true;
}

export function validateDrawsFile(obj) {
  const errors = [];
  if (!envelope(obj, 'draws', errors)) return { ok: false, errors };
  const rounds = new Set();
  let previous = null;
  for (const [index, draw] of obj.draws.entries()) {
    const label = isObject(draw) ? `${String(draw.round)}회차 (항목 ${index + 1})` : `회차 항목 ${index + 1}`;
    if (!isObject(draw)) { errors.push(`${label}: 객체여야 합니다.`); continue; }
    if (!positive(draw.round)) errors.push(`${label}: round는 양의 정수여야 합니다.`);
    if (rounds.has(draw.round)) errors.push(`${label}: round 회차가 중복됩니다.`);
    rounds.add(draw.round);
    if (previous && draw.round <= previous.round) errors.push(`${label}: round는 오름차순이어야 합니다.`);
    if (!realDate(draw.date)) errors.push(`${label}: date는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.`);
    if (previous && realDate(draw.date) && realDate(previous.date) && draw.date <= previous.date) {
      errors.push(`${label}: date는 앞 회차 추첨일보다 늦어야 합니다.`);
    }
    if (!Array.isArray(draw.numbers) || draw.numbers.length !== 6) errors.push(`${label}: numbers 본번호는 6개여야 합니다.`);
    if (Array.isArray(draw.numbers)) {
      if (!draw.numbers.every(lottoNumber)) errors.push(`${label}: numbers 본번호는 1~45 정수여야 합니다.`);
      if (new Set(draw.numbers).size !== draw.numbers.length) errors.push(`${label}: numbers 본번호가 중복됩니다.`);
      if (draw.numbers.some((n, i) => i > 0 && n <= draw.numbers[i - 1])) errors.push(`${label}: numbers 본번호는 오름차순이어야 합니다.`);
    }
    if (!lottoNumber(draw.bonus)) errors.push(`${label}: bonus는 1~45 정수여야 합니다.`);
    if (Array.isArray(draw.numbers) && draw.numbers.includes(draw.bonus)) errors.push(`${label}: bonus는 본번호와 중복될 수 없습니다.`);
    if (draw.prizes !== null) {
      if (!Array.isArray(draw.prizes)) errors.push(`${label}: prizes는 null 또는 배열이어야 합니다.`);
      else {
        const ranks = new Set();
        for (const [i, prize] of draw.prizes.entries()) {
          const pLabel = `${label} prizes 항목 ${i + 1}`;
          if (!isObject(prize)) { errors.push(`${pLabel}: 객체여야 합니다.`); continue; }
          if (!Number.isInteger(prize.rank) || prize.rank < 1 || prize.rank > 5) errors.push(`${pLabel}: rank는 1~5여야 합니다.`);
          if (ranks.has(prize.rank)) errors.push(`${pLabel}: rank 등수가 중복됩니다.`);
          ranks.add(prize.rank);
          if (!nonnegative(prize.amount)) errors.push(`${pLabel}: amount는 null 또는 0 이상 정수(원)여야 합니다.`);
          if (!nonnegative(prize.winners)) errors.push(`${pLabel}: winners는 null 또는 0 이상 정수(명)여야 합니다.`);
        }
      }
    }
    provenance(draw, label, errors);
    previous = draw;
  }
  return { ok: errors.length === 0, errors };
}

export function validateShopsFile(obj) {
  const errors = [];
  if (!envelope(obj, 'shops', errors)) return { ok: false, errors };
  const regions = new Set();
  if (!Array.isArray(obj.regions)) errors.push('파일: regions 배열이 필요합니다.');
  else for (const [index, region] of obj.regions.entries()) {
    const label = `지역 항목 ${index + 1}`;
    if (!isObject(region)) { errors.push(`${label}: 객체여야 합니다.`); continue; }
    if (!hasText(region.id)) errors.push(`${label}: id가 필요합니다.`);
    if (!hasText(region.name)) errors.push(`${label}: name이 필요합니다.`);
    if (regions.has(region.id)) errors.push(`${label}: id가 중복됩니다.`);
    regions.add(region.id);
  }
  const ids = new Set();
  for (const [index, shop] of obj.shops.entries()) {
    const label = isObject(shop) ? `판매점 ${String(shop.id)} (항목 ${index + 1})` : `판매점 항목 ${index + 1}`;
    if (!isObject(shop)) { errors.push(`${label}: 객체여야 합니다.`); continue; }
    for (const key of ['id', 'name', 'address']) if (!hasText(shop[key])) errors.push(`${label}: ${key}는 비어 있지 않은 문자열이어야 합니다.`);
    if (ids.has(shop.id)) errors.push(`${label}: id가 중복됩니다.`);
    ids.add(shop.id);
    if (!regions.has(shop.region)) errors.push(`${label}: region은 regions에 등록된 지역이어야 합니다.`);
    const noCoords = shop.lat === null && shop.lng === null;
    const validCoords = typeof shop.lat === 'number' && Number.isFinite(shop.lat) && shop.lat >= 33 && shop.lat <= 39
      && typeof shop.lng === 'number' && Number.isFinite(shop.lng) && shop.lng >= 124 && shop.lng <= 132;
    if (!noCoords && !validCoords) errors.push(`${label}: lat·lng는 둘 다 null이거나 한국 범위 숫자(위도 33~39, 경도 124~132)여야 합니다.`);
    if (!noCoords) provenance(shop, label, errors, 'coordSource', 'coordCheckedAt');
    if (!['open', 'closed', 'moved', 'unknown'].includes(shop.status)) errors.push(`${label}: status는 open, closed, moved, unknown 중 하나여야 합니다.`);
    if (!Array.isArray(shop.wins)) errors.push(`${label}: wins 배열이 필요합니다.`);
    else for (const [i, win] of shop.wins.entries()) {
      const wLabel = `${label} wins 항목 ${i + 1}`;
      if (!isObject(win)) { errors.push(`${wLabel}: 객체여야 합니다.`); continue; }
      if (!positive(win.round)) errors.push(`${wLabel}: round는 양의 정수여야 합니다.`);
      if (![1, 2].includes(win.rank)) errors.push(`${wLabel}: rank는 1 또는 2여야 합니다.`);
      if (win.method !== null && !hasText(win.method)) errors.push(`${wLabel}: method는 null 또는 문자열이어야 합니다.`);
    }
    // 빈 wins + 출처·시각 null = 이력 미확보. 출처가 있으면 '확인된 0건'이다.
    const winsUnknown = Array.isArray(shop.wins) && shop.wins.length === 0
      && shop.winsSource === null && shop.winsCheckedAt === null;
    if (!winsUnknown) provenance(shop, label, errors, 'winsSource', 'winsCheckedAt');
  }
  return { ok: errors.length === 0, errors };
}
