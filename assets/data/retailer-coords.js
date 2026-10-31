import { normalizeRegion, nationwideRegion } from './wins.js';

export const RETAILERS_URL = 'https://www.dhlottery.co.kr/prchsplcsrch/home';
export const RETAILERS_DATA_URL = 'https://www.dhlottery.co.kr/prchsplcsrch/selectLtShp.do';
export const DISTRICTS_URL = 'https://www.dhlottery.co.kr/prchsplcsrch/selectAdmdst.do';
// PrchsPlcSrchM.ctpvMap, 공식 화면 확인 2026-10-10.
export const CTPV_MAP = Object.freeze({
  서울특별시: '서울', 경기도: '경기', 부산광역시: '부산', 대구광역시: '대구',
  인천광역시: '인천', 대전광역시: '대전', 울산광역시: '울산', 강원도: '강원',
  충청북도: '충북', 충청남도: '충남', 전남광주통합특별시: '전남광주', 전라북도: '전북',
  경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주', 세종특별자치시: '세종',
});
const fail = message => { throw new RetailerFormatError(message); };
export class RetailerFormatError extends Error {}
const text = (value, label) => typeof value === 'string' && value.trim() ? value.trim() : fail(`공식 판매점 ${label}: 문자열이 필요합니다.`);
const optionalText = (value, label) => value == null ? '' : typeof value === 'string' ? value.trim() : fail(`공식 판매점 ${label}: 문자열 형식 오류입니다.`);
const integer = (value, label) => ['number', 'string'].includes(typeof value) && /^\d+$/u.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : fail(`공식 판매점 ${label}: 정수 형식 오류입니다.`);

function responseData(response) {
  let body;
  try { body = typeof response === 'string' ? JSON.parse(response) : response; }
  catch { fail('공식 판매점 응답 JSON 형식 오류입니다.'); }
  if (!body || body.resultCode !== null || !Array.isArray(body.data?.list)) fail('공식 판매점 응답 형식이 변경되었거나 오류 응답입니다.');
  return body.data;
}

export function parseRegion(value) {
  const normalized = normalizeRegion(value);
  const region = nationwideRegion(normalized);
  if (!region || region.name !== normalized) fail('지역은 시도와 시군구까지 지정하세요(예: 서울 종로구, 경기 수원시 장안구, 세종).');
  const [ctpv, ...rest] = region.name.split(' ');
  if (!Object.values(CTPV_MAP).includes(ctpv)) fail('지원하지 않는 시도입니다.');
  return { ctpv, sgg: rest.join(' ') };
}

export function parseDistrictsResponse(response, ctpv) {
  if (!Object.values(CTPV_MAP).includes(ctpv)) fail('시도 형식 오류입니다.');
  const { list } = responseData(response);
  // 세종은 시군구가 없고 공식 응답이 [null]이다.
  if (ctpv === '세종' && (list.length === 0 || (list.length === 1 && list[0] === null))) return [''];
  if (!list.length) fail('공식 시군구 목록이 비어 있습니다.');
  const names = list.map(row => text(row?.sggNm, 'sggNm'));
  if (new Set(names).size !== names.length) fail('공식 시군구 목록이 중복됩니다.');
  for (const sgg of names) parseRegion(`${ctpv} ${sgg}`);
  return names;
}

export function officialCoordinate(lat, lng) {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= 33 && lat <= 39
    && typeof lng === 'number' && Number.isFinite(lng) && lng >= 124 && lng <= 132
    ? { lat, lng } : { lat: null, lng: null };
}

export function parseRetailersResponse(response, { ctpv, sgg, page }) {
  const requested = parseRegion([ctpv, sgg].filter(Boolean).join(' '));
  if (!Number.isSafeInteger(page) || page < 1) fail('요청 페이지 형식 오류입니다.');
  const data = responseData(response);
  const total = integer(data.total, 'total');
  const expected = Math.min(10, Math.max(0, total - (page - 1) * 10));
  if (data.list.length !== expected || (page > 1 && expected === 0)) fail('공식 판매점 페이지 건수와 total이 다릅니다.');
  const retailers = data.list.map((row, i) => {
    if (!row || typeof row !== 'object' || integer(row.rowId, 'rowId') !== (page - 1) * 10 + i + 1) fail('공식 판매점 페이지 rowId가 요청과 다릅니다.');
    const road = optionalText(row.bplcRdnmDaddr, 'bplcRdnmDaddr');
    const local = optionalText(row.bplcLctnDaddr, 'bplcLctnDaddr');
    const units = ['tm1BplcLctnAddr', 'tm2BplcLctnAddr', 'tm3BplcLctnAddr', 'tm4BplcLctnAddr'].map(key => optionalText(row[key], key)).filter(Boolean);
    const address = road || (local ? (nationwideRegion(local) ? local : [...units, local].join(' ')) : '');
    const region = nationwideRegion(address);
    if (!address || !region || region.name !== [requested.ctpv, requested.sgg].filter(Boolean).join(' ')) fail('공식 판매점 주소 지역이 요청과 다르거나 미확정입니다.');
    if (!['Y', 'N'].includes(row.l645LtNtslYn)) fail('공식 판매점 l645LtNtslYn 형식 오류입니다.');
    return { shopId: text(row.ltShpId, 'ltShpId'), name: text(row.conmNm, 'conmNm'), address,
      ...officialCoordinate(row.shpLat, row.shpLot), operStatus: text(row.slrOperSttsCd, 'slrOperSttsCd'),
      sellsLotto: row.l645LtNtslYn === 'Y', region: region.name };
  });
  if (new Set(retailers.map(row => row.shopId)).size !== retailers.length) fail('공식 판매점 페이지의 shopId가 중복됩니다.');
  return { total, retailers };
}

export function emptyRetailerCoords(checkedAt) {
  return { meta: { source: `${RETAILERS_URL} (${RETAILERS_DATA_URL}, ${DISTRICTS_URL})`, checkedAt, status: 'partial' },
    progress: { discoveredCtpvs: [], regions: [] }, retailers: [] };
}

export function assertRetailerCoords(file) {
  if (typeof file?.meta?.source !== 'string' || !file.meta.source.trim()
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+09:00$/u.test(file.meta.checkedAt) || !Number.isFinite(Date.parse(file.meta.checkedAt))
    || !['partial', 'complete', 'stale'].includes(file.meta.status)
    || !Array.isArray(file?.progress?.regions) || !Array.isArray(file?.progress?.discoveredCtpvs) || !Array.isArray(file?.retailers)) fail('기존 좌표 파일 메타·진행 형식 오류입니다.');
  const provinces = file.progress.discoveredCtpvs;
  if (new Set(provinces).size !== provinces.length || provinces.some(p => !Object.values(CTPV_MAP).includes(p))) fail('기존 시도 목록 형식 오류입니다.');
  const keys = new Set();
  for (const row of file.progress.regions) {
    parseRegion([row?.ctpv, row?.sgg].filter(Boolean).join(' '));
    const key = `${row.ctpv}/${row.sgg}`;
    if (keys.has(key) || typeof row.sgg !== 'string' || !Array.isArray(row.pagesDone) || typeof row.complete !== 'boolean'
      || !(row.total === null || (Number.isSafeInteger(row.total) && row.total >= 0))) fail('기존 지역 진행 형식 오류입니다.');
    keys.add(key);
    const count = row.total === null ? 0 : Math.max(1, Math.ceil(row.total / 10));
    if (row.pagesDone.some((p, i) => p !== i + 1) || row.pagesDone.length > count
      || row.complete !== (count > 0 && row.pagesDone.length === count)) fail('기존 페이지 진행 형식 오류입니다.');
  }
  const ids = new Set();
  for (const row of file.retailers) {
    text(row?.shopId, 'shopId'); text(row.name, 'name'); text(row.address, 'address'); text(row.operStatus, 'operStatus');
    parseRegion(row.region);
    const coord = officialCoordinate(row.lat, row.lng);
    if (ids.has(row.shopId) || typeof row.sellsLotto !== 'boolean' || coord.lat !== row.lat || coord.lng !== row.lng
      || nationwideRegion(row.address)?.name !== row.region) fail('기존 판매점 값·좌표·shopId 형식 오류입니다.');
    ids.add(row.shopId);
  }
  return file;
}

export function mergeRetailerPage(existing, parsed, { ctpv, sgg, page, checkedAt }) {
  assertRetailerCoords(existing);
  const file = structuredClone(existing);
  let region = file.progress.regions.find(row => row.ctpv === ctpv && row.sgg === sgg);
  if (!region) {
    region = { ctpv, sgg, total: null, pagesDone: [], complete: false };
    file.progress.regions.push(region);
  }
  if (page > region.pagesDone.length + 1 || (region.total !== null && region.total !== parsed.total)) fail('공식 판매점 total 변경 또는 페이지 순서 불일치입니다. 기존 파일을 유지합니다.');
  region.total = parsed.total;
  region.pagesDone = [...new Set([...region.pagesDone, page])].sort((a, b) => a - b);
  region.complete = region.pagesDone.length === Math.max(1, Math.ceil(parsed.total / 10));
  const shops = new Map(file.retailers.map(row => [row.shopId, row]));
  for (const row of parsed.retailers) shops.set(row.shopId, row);
  file.retailers = [...shops.values()].sort((a, b) => a.shopId.localeCompare(b.shopId));
  file.meta.checkedAt = checkedAt;
  file.meta.status = file.progress.discoveredCtpvs.length === Object.keys(CTPV_MAP).length && file.progress.regions.every(row => row.complete) ? 'complete' : 'partial';
  return assertRetailerCoords(file);
}
