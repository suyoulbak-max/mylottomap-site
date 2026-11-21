// 격자(Grid) 기반 자체 구현 마커 클러스터러 (외부 의존성 없음, 샘플 코드 미복제)
import { renderShopMarker, renderClusterMarker, shopTier } from './markers.js';

// 이 확대 수준부터는 묶지 않는다(알약 핀이라 격자를 넓게 잡는다).
const UNCLUSTER_ZOOM = 17;
const TIER_Z = { multi: 40, once: 30, second: 20, none: 10 };

export class GridClusterer {
  /**
   * @param {object} options
   * @param {any} options.naverMaps - naver.maps 네임스페이스
   * @param {any} options.map - 지도 인스턴스
   * @param {number} [options.gridSize=84] - 격자 크기 (픽셀)
   * @param {function} options.onSelectShop - 판매점 마커 클릭 콜백
   */
  constructor({ naverMaps, map, gridSize = 84, onSelectShop }) {
    this.maps = naverMaps;
    this.map = map;
    this.gridSize = gridSize;
    this.onSelectShop = onSelectShop;
    this.shops = [];
    this.markers = [];
    this.selectedShopId = null;
  }

  /** 판매점 데이터 설정 및 다시 그리기 */
  setShops(shops) {
    this.shops = shops.filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number');
    this.refresh();
  }

  selectShop(shopId) {
    this.selectedShopId = shopId;
    this.refresh();
  }

  // 0×0 기준점 안에 핀을 CSS로 배치해 핀 폭과 무관하게 아래 꼭짓점(묶음은 가운데)이 좌표에 맞는다.
  addMarker(position, html, zIndex, title, activate) {
    const anchor = document.createElement('div');
    anchor.className = 'map-pin-anchor';
    anchor.innerHTML = html;
    anchor.firstElementChild.addEventListener('click', (event) => {
      event.stopPropagation();
      activate();
    });
    this.markers.push(new this.maps.Marker({
      position,
      map: this.map,
      title,
      zIndex,
      icon: { content: anchor, anchor: new this.maps.Point(0, 0) },
    }));
  }

  /** 모든 기존 마커 제거 */
  clear() {
    for (const marker of this.markers) {
      marker.setMap(null);
    }
    this.markers = [];
  }

  /** 현재 화면 범위와 줌 레벨에 따라 격자 클러스터링 계산 및 마커 배치 */
  refresh() {
    this.clear();
    if (!this.shops.length || !this.map) return;

    const bounds = this.map.getBounds();
    const projection = this.map.getProjection();
    if (!projection) return;
    const zoom = this.map.getZoom();

    // 픽셀 격자별로 현재 화면 안의 판매점 그룹화
    const gridMap = new Map();
    for (const shop of this.shops) {
      const coord = new this.maps.LatLng(shop.lat, shop.lng);
      if (!bounds.hasLatLng(coord)) continue;
      const pixel = projection.fromCoordToOffset(coord);
      const key = shop.id === this.selectedShopId || zoom >= UNCLUSTER_ZOOM
        ? `shop:${shop.id}`
        : `${Math.floor(pixel.x / this.gridSize)}_${Math.floor(pixel.y / this.gridSize)}`;
      if (!gridMap.has(key)) gridMap.set(key, []);
      gridMap.get(key).push(shop);
    }

    // 알약은 폭이 넓어 이웃 격자끼리 겹친다. 큰 묶음부터 놓고, 이미 놓은 묶음과 겹치는 칸은 그 묶음에 합친다.
    // ponytail: 칸 수 제곱 비교. 화면 안 칸이 수백 개를 넘으면 공간 색인으로 바꾼다.
    const placed = [];
    const cells = [...gridMap.entries()].map(([key, cellShops]) => ({ key, cellShops, pixel: projection.fromCoordToOffset(new this.maps.LatLng(cellShops[0].lat, cellShops[0].lng)) }));
    cells.sort((a, b) => b.cellShops.length - a.cellShops.length);
    for (const cell of cells) {
      const hit = !cell.key.startsWith('shop:') && placed.find(p => !p.key.startsWith('shop:') && Math.abs(p.pixel.x - cell.pixel.x) < this.gridSize && Math.abs(p.pixel.y - cell.pixel.y) < 40);
      if (hit) hit.cellShops.push(...cell.cellShops);
      else placed.push(cell);
    }

    for (const { cellShops } of placed) {
      if (cellShops.length === 1) {
        const shop = cellShops[0];
        const selected = shop.id === this.selectedShopId;
        this.addMarker(new this.maps.LatLng(shop.lat, shop.lng), renderShopMarker(shop, selected, zoom),
          selected ? 100 : TIER_Z[shopTier(shop)], shop.name, () => this.onSelectShop?.(shop.id));
        continue;
      }
      // 판매점 묶음: 평균 좌표에 판매점 수와 1등 배출 판매점 수를 표시
      const count = cellShops.length;
      const center = new this.maps.LatLng(
        cellShops.reduce((sum, s) => sum + s.lat, 0) / count,
        cellShops.reduce((sum, s) => sum + s.lng, 0) / count
      );
      const firsts = cellShops.filter((s) => s.wins?.some((w) => w.rank === 1)).length;
      this.addMarker(center, renderClusterMarker(count, firsts), 50, `판매점 ${count}곳 묶음`, () => {
        this.map.setCenter(center);
        this.map.setZoom(Math.min(zoom + 2, UNCLUSTER_ZOOM));
      });
    }
  }

  destroy() {
    this.clear();
  }
}
