// 시도 단위 한국 지도(SVG). 회차별 1등 배출 판매점 페이지에서 시도별 건수를 색으로 보여 준다.
import { KOREA_MAP } from './korea-map-data.js';
import { escapeHtml } from './format.js';

/** 지도에 그릴 수 있는 시도 이름 */
export const MAP_SIDO = KOREA_MAP.regions.map((r) => r.sido);

// 이름표 위치(viewBox 단위). 작은 광역시끼리 겹치지 않도록 자동 위치 일부를 옮긴다.
const LABEL_AT = { 인천: [78, 78], 경기: [126, 86], 세종: [108, 106], 대전: [127, 127], 충남: [86, 126], 경남: [158, 181] };

/** 시도별 건수 → 색 단계: 0, 1건, 2~3건, 4건 이상 */
export const MAP_LEVELS = [
  { level: 1, label: '1건' },
  { level: 2, label: '2~3건' },
  { level: 3, label: '4건 이상' },
];
const levelOf = (n) => (n >= 4 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0);

/**
 * @param {Map<string, number>} counts 시도 → 1등 건수
 * @param {{ label: string }} options 지도 전체 설명(스크린리더용)
 */
export function renderKoreaMap(counts, { label }) {
  const regions = KOREA_MAP.regions.map((r) => {
    const n = counts.get(r.sido) || 0;
    const dokdo = r.sido === '경북'
      ? `<circle class="map-sido map-level-${levelOf(n)}" cx="${KOREA_MAP.dokdo[0]}" cy="${KOREA_MAP.dokdo[1]}" r="1.8"/>`
      : '';
    return `<path class="map-sido map-level-${levelOf(n)}" d="${r.d}"/>${dokdo}`;
  }).join('');
  const labels = KOREA_MAP.regions.filter((r) => counts.get(r.sido)).map((r) => {
    const [x, y] = LABEL_AT[r.sido] || r.label;
    return `<text class="map-label" x="${x}" y="${y}">${escapeHtml(r.sido)} ${counts.get(r.sido)}</text>`;
  }).join('');
  return `<svg class="korea-map" viewBox="${KOREA_MAP.viewBox}" role="img" aria-label="${escapeHtml(label)}">${regions}${labels}</svg>`;
}

// 홈 지도 미리보기: 네이버 지도를 받기 전 같은 자리에 먼저 그리는 윤곽과 시도별 판매점 수 말풍선.
// at: 지역 기준점(viewBox 단위, 그 시도 경계 안의 한 점 — tests/home-layout.test.js가 확인).
// place: 기준점 기준 말풍선 자리. c 가운데, l 기준점 왼쪽 8px에서 끝남, r 기준점 오른쪽 8px부터. dy: 위(−)·아래(+) px.
// 360·390·768px에서 1등·2등 중 넓은 숫자 기준으로 말풍선끼리·지도 조작부와 8px 이상 떨어지도록 정했다(측정: .tmp-evidence/home-b/measure-preview.mjs).
export const PREVIEW_AT = {
  경기: { at: [111, 54], dy: -20 },
  서울: { at: [114, 66] },
  인천: { at: [87, 66], place: 'l' },
  강원: { at: [168, 66] },
  충북: { at: [144, 108], place: 'r' },
  충남: { at: [93, 111], place: 'l' },
  세종: { at: [117, 111] },
  대전: { at: [125.4, 124.8], dy: 20 },
  경북: { at: [192, 117], place: 'r' },
  대구: { at: [176.7, 149.8] },
  울산: { at: [204, 165], place: 'r' },
  부산: { at: [192, 192], place: 'r', dy: 4 },
  경남: { at: [168, 183] },
  전북: { at: [114, 174] },
  전남광주: { at: [103.2, 204.2] },
  제주: { at: [92.3, 278.3] },
};

/** 미리보기 윤곽 SVG 파일 내용. 바다는 투명, 시도 경계는 흰 선. 큰 고유 크기는 LCP 후보 면적이 축소되지 않게 하기 위함. */
export function koreaOutlineSvg() {
  const [x, y] = KOREA_MAP.dokdo;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="2400" viewBox="${KOREA_MAP.viewBox}" preserveAspectRatio="xMidYMid meet">`
    + '<!-- 원본: Natural Earth 1:10m Admin-1 (퍼블릭 도메인, https://www.naturalearthdata.com/) — scripts/build-korea-map.mjs -->'
    + `<g fill="#e4ece0" stroke="#ffffff" stroke-width=".6" stroke-linejoin="round">${KOREA_MAP.regions.map((r) => `<path d="${r.d}"/>`).join('')}<circle cx="${x}" cy="${y}" r="1.8"/></g></svg>`;
}

/**
 * 지도 자리에 먼저 그리는 미리보기 HTML. 말풍선은 % 위치라 윤곽(contain 배치)과 같은 상자 안에서 맞물린다.
 * 1등·2등 수를 함께 담아, 지도를 받기 전 등수를 바꾸면 client/home.js가 숫자를 바꾼다. 화면 낭독은 '지역명 N곳'.
 * @param {{ rank1: Map<string, number>, rank2: Map<string, number> }} counts 시도 → 지도에 핀이 찍히는 판매점 수
 * @param {'rank1'|'rank2'} [rank] 처음 보일 등수
 */
export function renderMapPreview({ rank1, rank2 }, rank = 'rank1') {
  const [, , w, h] = KOREA_MAP.viewBox.split(' ').map(Number);
  const sidos = MAP_SIDO.filter((sido) => (rank1.get(sido) || rank2.get(sido)) && PREVIEW_AT[sido]);
  const bubbles = sidos.map((sido) => {
    const { at: [x, y], place = 'c', dy = 0 } = PREVIEW_AT[sido];
    const n1 = rank1.get(sido) || 0;
    const n2 = rank2.get(sido) || 0;
    const n = rank === 'rank2' ? n2 : n1;
    return `<span class="map-preview-bubble" data-sido="${escapeHtml(sido)}" data-place="${place}" data-n1="${n1}" data-n2="${n2}" style="left:${(x / w * 100).toFixed(2)}%;top:${(y / h * 100).toFixed(2)}%;--dy:${dy}px"${n ? '' : ' hidden'}>${previewBubbleText(sido, n)}</span>`;
  }).join('');
  return `<div id="map-preview" class="map-preview"><img class="map-preview-outline" src="/assets/shared/korea-outline.svg" alt="" width="2400" height="2400" fetchpriority="high"><div class="map-preview-fig" style="--preview-ratio:${(w / h).toFixed(4)}">${bubbles}</div></div>`;
}

/** 말풍선 안쪽: 보이는 숫자(좁은 화면은 '곳' 생략)와 화면 낭독용 '지역명 N곳' */
export function previewBubbleText(sido, n) {
  const count = n.toLocaleString('ko-KR');
  return `<span aria-hidden="true">${count}<small>곳</small></span><span class="sr-only">${escapeHtml(sido)} ${count}곳</span>`;
}
