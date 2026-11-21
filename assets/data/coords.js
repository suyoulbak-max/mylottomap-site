// UTM-K(EPSG:5179) ↔ 위경도 변환. GRS80 횡메르카토르, Krüger 6차 급수(Karney 2011, "Transverse Mercator with an accuracy of a few nanometers").
// 근거와 매개변수: docs/coordinates.md. 받은 자료의 좌표계 설명이 다르면 params로 바꾼다.

export const EPSG_5179 = Object.freeze({
  a: 6378137,
  invF: 298.257222101,
  lat0: 38,
  lng0: 127.5,
  k0: 0.9996,
  falseEasting: 1000000,
  falseNorthing: 2000000,
});

// validateShopsFile과 같은 한국 범위.
export const KOREA_BOUNDS = Object.freeze({ minLat: 33, maxLat: 39, minLng: 124, maxLng: 132 });

const RAD = Math.PI / 180;

function setup(params) {
  const p = { ...EPSG_5179, ...params };
  for (const [key, value] of Object.entries(p)) {
    if (!Number.isFinite(value)) throw new Error(`좌표계 매개변수 ${key}가 숫자가 아닙니다.`);
  }
  const f = 1 / p.invF;
  const n = f / (2 - f);
  const e = Math.sqrt(f * (2 - f));
  const n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;
  const A = p.a / (1 + n) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
  const alpha = [
    n / 2 - 2 * n2 / 3 + 5 * n3 / 16 + 41 * n4 / 180 - 127 * n5 / 288 + 7891 * n6 / 37800,
    13 * n2 / 48 - 3 * n3 / 5 + 557 * n4 / 1440 + 281 * n5 / 630 - 1983433 * n6 / 1935360,
    61 * n3 / 240 - 103 * n4 / 140 + 15061 * n5 / 26880 + 167603 * n6 / 181440,
    49561 * n4 / 161280 - 179 * n5 / 168 + 6601661 * n6 / 7257600,
    34729 * n5 / 80640 - 3418889 * n6 / 1995840,
    212378941 * n6 / 319334400,
  ];
  const beta = [
    n / 2 - 2 * n2 / 3 + 37 * n3 / 96 - n4 / 360 - 81 * n5 / 512 + 96199 * n6 / 604800,
    n2 / 48 + n3 / 15 - 437 * n4 / 1440 + 46 * n5 / 105 - 1118711 * n6 / 3870720,
    17 * n3 / 480 - 37 * n4 / 840 - 209 * n5 / 4480 + 5569 * n6 / 90720,
    4397 * n4 / 161280 - 11 * n5 / 504 - 830251 * n6 / 7257600,
    4583 * n5 / 161280 - 108847 * n6 / 3991680,
    20648693 * n6 / 638668800,
  ];
  const s = { ...p, e, A, alpha, beta };
  s.y0 = project(s, p.lat0 * RAD, 0).y; // 원점 위도까지의 자오선 길이(축척 적용)
  return s;
}

function project(s, phi, dLambda) {
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - s.e * Math.atanh(s.e * Math.sin(phi)));
  const xi1 = Math.atan2(t, Math.cos(dLambda));
  const eta1 = Math.atanh(Math.sin(dLambda) / Math.sqrt(1 + t * t));
  let xi = xi1, eta = eta1;
  s.alpha.forEach((a, i) => {
    const j = 2 * (i + 1);
    xi += a * Math.sin(j * xi1) * Math.cosh(j * eta1);
    eta += a * Math.cos(j * xi1) * Math.sinh(j * eta1);
  });
  return { x: s.k0 * s.A * eta, y: s.k0 * s.A * xi };
}

function round7(value) {
  return Math.round(value * 1e7) / 1e7;
}

function checkLatLng(lat, lng, label) {
  const b = KOREA_BOUNDS;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) {
    throw new Error(`${label}가 한국 범위(위도 ${b.minLat}~${b.maxLat}, 경도 ${b.minLng}~${b.maxLng}) 밖입니다: ${lat}, ${lng}`);
  }
}

// x: 동(Easting) m, y: 북(Northing) m → { lat, lng } 소수 7자리.
export function utmkToLatLng(x, y, params) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('UTM-K 좌표는 숫자여야 합니다.');
  const s = setup(params);
  const xi = (y - s.falseNorthing + s.y0) / (s.k0 * s.A);
  const eta = (x - s.falseEasting) / (s.k0 * s.A);
  let xi1 = xi, eta1 = eta;
  s.beta.forEach((b, i) => {
    const j = 2 * (i + 1);
    xi1 -= b * Math.sin(j * xi) * Math.cosh(j * eta);
    eta1 -= b * Math.cos(j * xi) * Math.sinh(j * eta);
  });
  // 등각위도의 tan → 측지위도의 tan (Karney 2011 식 19~21, 뉴턴 반복)
  const tau1 = Math.sin(xi1) / Math.sqrt(Math.sinh(eta1) ** 2 + Math.cos(xi1) ** 2);
  const e2 = s.e * s.e;
  let tau = tau1;
  for (let i = 0; i < 10; i++) {
    const sigma = Math.sinh(s.e * Math.atanh(s.e * tau / Math.sqrt(1 + tau * tau)));
    const tauI = tau * Math.sqrt(1 + sigma * sigma) - sigma * Math.sqrt(1 + tau * tau);
    const delta = (tau1 - tauI) / Math.sqrt(1 + tauI * tauI)
      * (1 + (1 - e2) * tau * tau) / ((1 - e2) * Math.sqrt(1 + tau * tau));
    tau += delta;
    if (Math.abs(delta) < 1e-14) break;
  }
  const lat = round7(Math.atan(tau) / RAD);
  const lng = round7(s.lng0 + Math.atan2(Math.sinh(eta1), Math.cos(xi1)) / RAD);
  checkLatLng(lat, lng, '변환한 위경도');
  return { lat, lng };
}

// 위경도 → { x, y } m(반올림하지 않음). 검증·왕복 검사용.
export function latLngToUtmk(lat, lng, params) {
  checkLatLng(lat, lng, '입력 위경도');
  const s = setup(params);
  const { x, y } = project(s, lat * RAD, (lng - s.lng0) * RAD);
  return { x: x + s.falseEasting, y: y - s.y0 + s.falseNorthing };
}
