export const WINS_URL = 'https://www.dhlottery.co.kr/wnprchsplcsrch/home';
export const WINS_DATA_URL = 'https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do';

const provinces = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천',
  광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종',
  경기도: '경기', 강원도: '강원', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남',
  전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북',
  경상남도: '경남', 제주도: '제주', 제주특별자치도: '제주',
  // 2026-07-01 광주광역시·전라남도 통합. 공식 화면·공공데이터 판매점 목록 모두 '전남광주'로 표기한다.
  // 통합 전 당첨 기록의 '광주'·'전남' 주소도 도로명·건물번호는 그대로이므로 같은 점포로 묶이도록 현재 명칭으로 맞춘다.
  전남광주통합특별시: '전남광주', 전남광주: '전남광주',
};
for (const name of ['광주광역시', '전라남도']) provinces[name] = '전남광주';
const legacyProvinces = { 광주: '전남광주', 전남: '전남광주' };

export function normalizeRegion(value) {
  if (typeof value !== 'string') return '';
  const text = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const [province, ...rest] = text.split(' ');
  return [provinces[province] ?? legacyProvinces[province] ?? province, ...rest].join(' ');
}

export function inRegion(address, prefix) {
  const text = normalizeRegion(address);
  const region = normalizeRegion(prefix);
  return region !== '' && (text === region || text.startsWith(`${region} `));
}

export const stripPastLabel = value => (value === null ? null : value.replace(/^\(\s*당첨\s*당시[^)]*\)\s*/u, '') || null);

export function normalizeRoadAddress(value) {
  // docs/coordinates.md의 주소 대조 기준: 시도 축약명, 도로명, 건물 본번·부번.
  // 괄호의 동·건물 참고항목과 건물번호 뒤의 건물명/층/호/가판 문구는 제외한다.
  // 지번을 도로명으로 추정 변환하지 않는다. 같은 건물의 복수 점포는 매칭에서 보류한다.
  const text = normalizeRegion(value).replace(/\([^()]*\)/gu, '').replace(/\s+/gu, ' ').trim();
  // 지하 건물번호는 도로명주소 표기상 '도로명 지하 번호'이며 '지하'를 번호의 일부로 보존한다.
  // 도로명 끝말은 대로·로·길 외에 '거리'도 쓰인다(예: 울산 중구 새즈믄해거리).
  const match = text.match(/^(.+?\s+[^\s,]+(?:대로|로|길|거리)(?:\s+\d+번?길)?)\s*((?:지하\s*)?\d+(?:\s*-\s*\d+)?)(?=[\s,]|$)/u);
  if (!match || !/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남광주|전남|경북|경남|제주)\s/u.test(match[1])) return null;
  const road = match[1].replace(/\s+(\d+번?길)$/u, '$1');
  return `${road} ${match[2].replace(/\s/gu, '')}`;
}

function integer(value, label) {
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/u.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`공식 판매점 응답 ${label}: 정수 값이 필요합니다.`);
  }
  return Number(value);
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`공식 판매점 응답 ${label}: 문자열이 필요합니다.`);
  return value.trim();
}

function optionalText(value, label) {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim()) ? null : text(value, label);
}

export const OFFICIAL_COORD_SOURCE = '동행복권 공식 당첨 판매점 화면 좌표(shpLat·shpLot)';

function officialCoordinate(lat, lng) {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= 33 && lat <= 39
    && typeof lng === 'number' && Number.isFinite(lng) && lng >= 124 && lng <= 132 ? { lat, lng } : null;
}

export function parseWinsResponse(response, expectedRound) {
  const body = typeof response === 'string' ? JSON.parse(response) : response;
  if (!body || !Object.hasOwn(body, 'resultCode') || body.resultCode !== null || !Array.isArray(body.data?.list)) {
    throw new Error('공식 판매점 응답 형식이 변경되었거나 오류 응답입니다.');
  }
  // 화면은 페이지 변수 없이 전체 목록을 받는다. total 불일치는 부분 응답으로 간주한다.
  if (integer(body.data.total, 'total') !== body.data.list.length) throw new Error('공식 판매점 전체 건수와 목록 길이가 다릅니다.');
  return body.data.list.map(item => {
    if (!item || typeof item !== 'object') throw new Error('공식 판매점 항목은 객체여야 합니다.');
    const round = integer(item.draw, 'draw');
    const rank = integer(item.wnShpRnk, 'wnShpRnk');
    if (round < 1 || ![1, 2].includes(rank) || (expectedRound !== undefined && round !== expectedRound)) {
      throw new Error('공식 판매점 회차·등수가 요청과 다릅니다.');
    }
    const currentName = text(item.shpNm, 'shpNm');
    // 폐점 판매점은 현재 주소(shpAddr)가 공백으로 오고 당첨 당시 주소(befRdnm)만 남는다(예: 935회 경북 고령군).
    // 이전 점포 값은 공식 응답에 '(당첨 당시 주소) ...'처럼 표시 문구가 붙어 온다.
    const pastName = stripPastLabel(optionalText(item.befConmNm, 'befConmNm'));
    const pastAddress = stripPastLabel(optionalText(item.befRdnm, 'befRdnm'));
    // '    은관 지하1층 101호 …'처럼 상세 주소 조각만 오기도 한다(865회 폐점 판매점). 당첨 당시 주소가 있으면
    // 시도·시군구가 없는 현재 주소는 버린다(인터넷 판매 '동행복권(…)'은 당첨 당시 주소가 없어 그대로 둔다).
    const rawCurrentAddress = optionalText(item.shpAddr, 'shpAddr');
    const currentAddress = rawCurrentAddress && (nationwideRegion(rawCurrentAddress) || !pastAddress) ? rawCurrentAddress : null;
    if (!currentAddress && !pastAddress) throw new Error('공식 판매점 응답 shpAddr: 현재 주소와 당첨 당시 주소가 모두 없습니다.');
    const method = optionalText(item.atmtPsvYnTxt, 'atmtPsvYnTxt');
    if (method !== null && !['자동', '수동', '반자동'].includes(method)) throw new Error('공식 판매점 선택 방식이 변경되었습니다.');
    return {
      shopId: text(item.ltShpId, 'ltShpId'), officialStatus: optionalText(item.status, 'status'),
      officialCoord: officialCoordinate(item.shpLat, item.shpLot),
      round, rank, shopName: pastName ?? currentName, address: pastAddress ?? currentAddress, method,
      ...(pastAddress && currentAddress ? { currentAddress } : {}),
      ...(pastName ? { currentShopName: currentName } : {}),
    };
  });
}

export function matchWinsToShops(wins, shops) {
  const byAddress = new Map();
  for (const shop of shops) {
    const address = normalizeRoadAddress(shop.address);
    if (!address) continue;
    if (!byAddress.has(address)) byAddress.set(address, []);
    byAddress.get(address).push(shop);
  }
  const matched = [], unmatched = [];
  for (const win of wins) {
    const address = normalizeRoadAddress(win.address);
    const currentAddress = normalizeRoadAddress(win.currentAddress ?? win.address);
    const candidates = byAddress.get(address) ?? [];
    let reason;
    if (!address || !currentAddress) reason = '도로명주소 확인 불가';
    else if (address !== currentAddress) reason = '당첨 당시 주소와 현재 주소 다름';
    else if (candidates.length === 0) reason = '현재 판매점 목록에 같은 주소 없음';
    else if (candidates.length > 1) reason = '같은 도로명주소에 판매점 여러 곳';
    if (reason) {
      const affected = [...(byAddress.get(address) ?? []), ...(byAddress.get(currentAddress) ?? [])];
      unmatched.push({ ...win, reason, candidateShopIds: [...new Set(affected.map(shop => shop.id))] });
    } else matched.push({ ...win, shopId: candidates[0].id });
  }
  return { matched, unmatched };
}

export function applyWins(existing, wins, { fromRound, toRound, region, checkedAt }) {
  const relevant = wins.filter(win => inRegion(win.address, region) || inRegion(win.currentAddress, region));
  const { matched, unmatched } = matchWinsToShops(relevant, existing.shops);
  const blocked = new Set(unmatched.flatMap(win => win.candidateShopIds));
  const matchedById = new Map();
  for (const win of matched) {
    if (!matchedById.has(win.shopId)) matchedById.set(win.shopId, []);
    matchedById.get(win.shopId).push({ round: win.round, rank: win.rank, method: win.method });
  }
  const unverifiedShops = [];
  let checkedShops = 0;
  const shops = existing.shops.map(shop => {
    if (!inRegion(shop.address, region)) return shop;
    const address = normalizeRoadAddress(shop.address);
    const duplicate = address && existing.shops.filter(candidate => normalizeRoadAddress(candidate.address) === address).length > 1;
    if (!address || duplicate || blocked.has(shop.id)) {
      unverifiedShops.push({ shopId: shop.id, shopName: shop.name, address: shop.address, reason: !address ? '도로명주소 확인 불가' : duplicate ? '같은 도로명주소에 판매점 여러 곳' : '미매칭 당첨 기록 관련 판매점' });
      return shop;
    }
    checkedShops++;
    const kept = shop.wins.filter(win => win.round < fromRound || win.round > toRound);
    const fetched = matchedById.get(shop.id) ?? [];
    const key = win => JSON.stringify([win.round, win.rank, win.method]);
    const remaining = new Map();
    for (const win of fetched) remaining.set(key(win), (remaining.get(key(win)) ?? 0) + 1);
    for (const win of shop.wins.filter(win => win.round >= fromRound && win.round <= toRound)) {
      const count = remaining.get(key(win)) ?? 0;
      if (!count) throw new Error(`판매점 ${shop.id}: 조회 결과가 기존 당첨 이력과 충돌합니다.`);
      remaining.set(key(win), count - 1);
    }
    return { ...shop, wins: [...kept, ...fetched].sort((a, b) => a.round - b.round || a.rank - b.rank), winsSource: WINS_URL, winsCheckedAt: checkedAt };
  });
  return {
    data: { ...existing, meta: { ...existing.meta, checkedAt, updatedAt: checkedAt, period: { fromRound, toRound }, status: shops.length ? 'ok' : 'empty' }, shops },
    matched, unmatched, unverifiedShops, checkedShops,
  };
}

const cleanText = value => value.normalize('NFC').replace(/\s+/gu, ' ').trim();
const knownProvinces = new Set(Object.values(provinces));
const positiveRound = value => Number.isSafeInteger(value) && value > 0;

export function nationwideRegion(address) {
  const [province, ...parts] = normalizeRegion(address).split(' ');
  if (!knownProvinces.has(province)) return null;
  if (province === '세종') return { id: '세종', name: '세종' };
  if (!/^[가-힣]+[시군구]$/u.test(parts[0] ?? '')) return null;
  const units = [parts[0]];
  if (parts[0].endsWith('시') && /^[가-힣]+구$/u.test(parts[1] ?? '')) units.push(parts[1]);
  const name = [province, ...units].join(' ');
  return { id: name.replaceAll(' ', '-'), name };
}

export function assertRetailersFile(file) {
  const timestamp = file?.meta?.checkedAt;
  if (typeof file?.meta?.source !== 'string' || !file.meta.source.trim()
    || typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(timestamp)
    || !Number.isFinite(Date.parse(timestamp)) || new Date(`${timestamp.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== timestamp.slice(0, 10)
    || !Array.isArray(file?.retailers)) throw new Error('현재 판매점 목록: 출처·확인 시각·retailers 배열이 필요합니다.');
  for (const [i, row] of file.retailers.entries()) {
    if (typeof row?.name !== 'string' || !row.name.trim() || typeof row.address !== 'string' || !row.address.trim()
      || row.normalizedAddress !== normalizeRoadAddress(row.address)) {
      throw new Error(`현재 판매점 목록 ${i + 1}행: 상호·주소·정규화 주소가 잘못되었습니다.`);
    }
  }
}

export function continuousPeriod(existing, fromRound, toRound) {
  if (!positiveRound(fromRound) || !positiveRound(toRound) || fromRound > toRound) throw new Error('조회 기간은 양의 회차로 된 오름차순 범위여야 합니다.');
  const previous = existing.meta.period;
  if (previous?.fromRound === null && previous?.toRound === null) {
    if (existing.shops.some(shop => shop.wins.length)) throw new Error('기존 배출 이력의 연속 조회 기간이 미확보입니다.');
    return { fromRound, toRound };
  }
  if (!positiveRound(previous?.fromRound) || !positiveRound(previous?.toRound) || previous.fromRound > previous.toRound) throw new Error('기존 연속 조회 기간이 잘못되었습니다.');
  if (toRound < previous.fromRound - 1 || fromRound > previous.toRound + 1) throw new Error('조회 범위가 기존 기간과 연속하지 않습니다. 과거 보충은 fromRound-1부터 내려가세요.');
  if (existing.shops.some(shop => shop.wins.some(win => win.round < previous.fromRound || win.round > previous.toRound))) throw new Error('기존 배출 이력이 조회 기간 범위 밖에 있습니다.');
  return { fromRound: Math.min(fromRound, previous.fromRound), toRound: Math.max(toRound, previous.toRound) };
}

const nationwideId = shopId => `dh-${shopId}`;
const winKey = win => JSON.stringify([win.round, win.rank, win.method]);

export function assertNationwideShopIds(existing) {
  for (const shop of existing.shops) {
    if (typeof shop.dhlotteryShopId !== 'string' || !shop.dhlotteryShopId.trim()
      || shop.id !== nationwideId(shop.dhlotteryShopId)) {
      throw new Error(`기존 판매점 ${shop.id}: 공식 판매점ID 없는 레거시 데이터는 병합할 수 없습니다. 빈 데이터 폴더에서 재수집하세요.`);
    }
  }
}

// 동행복권 인터넷 판매분은 실제 판매점이 없어 판매점 대신 회차별 건수만 meta.internetWins에 둔다.
export const isInternetWin = win => /^동행복권\s*\(/u.test(cleanText(win.address ?? '')) || cleanText(win.shopName ?? '') === '인터넷 복권판매사이트';

function mergeInternetWins(previous, fetched, fromRound, toRound) {
  const kept = (Array.isArray(previous) ? previous : []).filter(row => row.round < fromRound || row.round > toRound);
  return [...kept, ...fetched.values()].sort((a, b) => a.round - b.round);
}

export function applyNationwideWins(existing, wins, { fromRound, toRound, checkedAt, retailers }) {
  assertNationwideShopIds(existing);
  const period = continuousPeriod(existing, fromRound, toRound);
  assertRetailersFile(retailers);
  const openAddresses = new Set(retailers.retailers.map(row => row.normalizedAddress).filter(Boolean));
  const groups = new Map(), fetched = new Map();
  const matched = [], unmatched = [];
  for (const shop of existing.shops) {
    if (!shop.wins.length) continue;
    const region = nationwideRegion(shop.address);
    if (!region) throw new Error(`기존 판매점 ${shop.id}: 지역이 미확정입니다.`);
    const key = shop.dhlotteryShopId;
    if (groups.has(key)) throw new Error(`기존 판매점 ${shop.id}: 공식 판매점ID가 중복됩니다.`);
    const group = { key, region, normalized: normalizeRoadAddress(shop.address), name: shop.name, address: shop.address,
      latestRound: Math.max(...shop.wins.map(win => win.round)), officialStatus: shop.status === 'closed' ? '폐점' : null,
      officialCoord: shop.officialCoord ?? null, wins: [], previous: [] };
    groups.set(key, group);
    group.wins.push(...shop.wins.filter(win => win.round < fromRound || win.round > toRound));
    group.previous.push(...shop.wins.filter(win => win.round >= fromRound && win.round <= toRound));
  }
  const internet = new Map(), unlocated = [];
  for (const win of wins) {
    const key = text(win.shopId, 'shopId');
    if (!positiveRound(win.round) || win.round < fromRound || win.round > toRound) throw new Error('당첨 기록이 조회 범위 밖에 있습니다.');
    if (![1, 2].includes(win.rank) || ![null, '자동', '수동', '반자동'].includes(win.method)) throw new Error('당첨 기록의 등수·방식이 잘못되었습니다.');
    if (isInternetWin(win)) {
      const row = internet.get(win.round) ?? { round: win.round, rank1: 0, rank2: 0 };
      row[`rank${win.rank}`] += 1;
      internet.set(win.round, row);
      continue;
    }
    const address = win.currentAddress ?? win.address;
    const region = nationwideRegion(address);
    if (!region) {
      // 사용자 결정(2026-10-16): 지역을 근거 없이 추정하지 않고 원문만 meta.unlocatedWins에 보관해 공식 인원 대조에 포함한다(지도·지역 제외).
      unmatched.push({ ...win, reason: '주소에서 시도·시군구 확정 불가', candidateShopIds: [] });
      unlocated.push({ round: win.round, rank: win.rank, method: win.method, shopName: cleanText(win.shopName ?? ''), address: cleanText(address ?? '') });
      continue;
    }
    if (!groups.has(key)) groups.set(key, { key, latestRound: 0, wins: [], previous: [] });
    const group = groups.get(key);
    if (win.round >= group.latestRound) Object.assign(group, {
      latestRound: win.round, region, normalized: normalizeRoadAddress(address),
      name: cleanText(win.currentShopName ?? win.shopName), address: normalizeRegion(address),
      officialStatus: win.officialStatus ?? null, officialCoord: win.officialCoord ?? null,
    });
    const record = { round: win.round, rank: win.rank, method: win.method };
    if (!fetched.has(group.key)) fetched.set(group.key, []);
    fetched.get(group.key).push(record);
    matched.push({ ...win, shopId: nationwideId(group.key) });
  }
  const shops = [], regions = new Map();
  for (const group of groups.values()) {
    const records = fetched.get(group.key) ?? [];
    const remaining = new Map();
    for (const record of records) remaining.set(winKey(record), (remaining.get(winKey(record)) ?? 0) + 1);
    for (const record of group.previous) {
      const count = remaining.get(winKey(record)) ?? 0;
      if (!count) throw new Error(`판매점 ${nationwideId(group.key)}: 조회 결과가 기존 당첨 이력과 충돌합니다.`);
      remaining.set(winKey(record), count - 1);
    }
    const combined = [...group.wins, ...records].sort((a, b) => a.round - b.round || a.rank - b.rank || (a.method ?? '').localeCompare(b.method ?? '', 'ko'));
    if (!combined.length) continue;
    regions.set(group.region.id, group.region);
    shops.push({
      id: nationwideId(group.key), name: group.name, address: group.address, region: group.region.id,
      dhlotteryShopId: group.key, officialCoord: group.officialCoord,
      // 사용자 결정(2026-10-10): 공식 당첨 판매점 응답 좌표를 지도 핀에 쓴다. 없으면 핀 없음(임의 위치 금지).
      lat: group.officialCoord?.lat ?? null, lng: group.officialCoord?.lng ?? null,
      coordSource: group.officialCoord ? OFFICIAL_COORD_SOURCE : null,
      coordCheckedAt: group.officialCoord ? checkedAt : null,
      status: group.officialStatus === '폐점' ? 'closed' : openAddresses.has(group.normalized) ? 'open' : 'unknown',
      wins: combined, winsSource: WINS_URL, winsCheckedAt: checkedAt,
    });
  }
  shops.sort((a, b) => a.id.localeCompare(b.id));
  return {
    data: { meta: { ...existing.meta, scope: 'nationwide', source: `동행복권 공식 당첨 판매점 화면 (${WINS_URL}), 전국 1·2등 배출 이력`, checkedAt, updatedAt: checkedAt, retailersSource: retailers.meta.source, retailersCheckedAt: retailers.meta.checkedAt, period, status: shops.length ? 'ok' : 'empty', internetWins: mergeInternetWins(existing.meta?.internetWins, internet, fromRound, toRound), unlocatedWins: mergeInternetWins(existing.meta?.unlocatedWins, unlocated, fromRound, toRound) }, regions: [...regions.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko')), shops },
    matched, unmatched, checkedShops: shops.length, unverifiedShops: [],
  };
}
