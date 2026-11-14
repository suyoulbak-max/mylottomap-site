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
