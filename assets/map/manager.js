// 지도 인스턴스, 핀/클러스터 관리, 내 위치 및 실패 대안 처리
import { loadNaverMaps } from './loader.js';
import { GridClusterer } from './clusterer.js';
import { explorerMapTarget } from '../shared/map-explorer.js';

/** 전국 맞춤 기본 여백(px). 핀이 좌표 위로 솟는 높이·알약 반 폭을 감안한 값이라 가리는 것이 없을 때도 이만큼은 둔다. */
export const FIT_PADDING = { top: 64, right: 48, bottom: 64, left: 48 };
const PIN_RISE = 37; // .map-pin top: -37px — 핀 몸통이 좌표 위로 솟는 높이

/**
 * 지도 위에 겹친 조작 줄(rows)과 도구 버튼(tools)의 실제 사각형을 피하는 fitBounds 여백.
 * 위 = 조작 줄 하단 + 8px + 핀 높이, 옆 = 지도 가장자리에서 버튼까지 + 8px + 알약 반 폭(기본 여백). 숨은 요소(폭 0)는 무시.
 */
export function fitPadding(map, { rows = [], tools = [] } = {}, gap = 8) {
  const pad = { ...FIT_PADDING };
  if (!map) return pad;
  for (const r of rows) if (r.width > 0) pad.top = Math.max(pad.top, Math.ceil(r.bottom - map.top + gap + PIN_RISE));
  for (const r of tools) {
    if (!(r.width > 0)) continue;
    if (r.left + r.right > map.left + map.right) pad.right = Math.max(pad.right, Math.ceil(map.right - r.left + gap + FIT_PADDING.right));
    else pad.left = Math.max(pad.left, Math.ceil(r.right - map.left + gap + FIT_PADDING.left));
  }
  return pad;
}

/** 경계가 주어진 확대 수준에서 여백을 뺀 지도 안에 들어가는지(웹 메르카토르, 256px 타일). */
export function boundsFit({ south, north, west, east }, { width, height }, pad, zoom) {
  const scale = 256 * 2 ** zoom;
  const y = (lat) => { const s = Math.sin((lat * Math.PI) / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale; };
  return ((east - west) / 360) * scale <= width - pad.left - pad.right && y(south) - y(north) <= height - pad.top - pad.bottom;
}

export class MapManager {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container - 지도 엘리먼트
   * @param {HTMLElement} options.fallbackEl - 실패 시 대체 UI 엘리먼트
   * @param {string} options.ncpKeyId - 네이버 지도 NCP Key
   * @param {string} [options.mapType='normal'] - 초기 지도 유형
   * @param {function} options.onSelectShop - 판매점 선택 시 호출
   * @param {function} options.onError - 에러 발생 시 알림 호출
   */
  constructor({ container, fallbackEl, ncpKeyId, mapType = 'normal', onSelectShop, onError, onViewportChange, onReady, onFallback, fitObstacles }) {
    this.container = container;
    this.fallbackEl = fallbackEl;
    this.ncpKeyId = ncpKeyId;
    this.mapType = mapType;
    this.onSelectShop = onSelectShop;
    this.onError = onError;
    this.onViewportChange = onViewportChange;
    this.onReady = onReady;
    this.onFallback = onFallback;
    this.fitObstacles = fitObstacles; // () => ({ rows, tools }) 지도 위에 겹친 요소의 사각형
    this.viewportTimer = null;
    this.viewportListener = null;
    this.available = false;

    this.naverMaps = null;
    this.map = null;
    this.clusterer = null;
    this.allShops = [];
    this.myLocationMarker = null;
  }

  /** 지도 초기화 시도 */
  async init(shops) {
    this.allShops = shops;

    const result = await loadNaverMaps(this.ncpKeyId, () => this.showFallback('AUTH_FAILED'));
    if (!result.ok) {
      this.showFallback(result.error);
      return false;
    }

    this.naverMaps = result.maps;

    // 기본 중심 좌표: 첫 번째 좌표가 있는 판매점 위치 또는 서울 중심
    let centerLat = 37.5665;
    let centerLng = 126.9780;
    const firstWithCoords = this.allShops.find((s) => typeof s.lat === 'number' && typeof s.lng === 'number');
    if (firstWithCoords) {
      centerLat = firstWithCoords.lat;
      centerLng = firstWithCoords.lng;
    }

    try {
      const mapTypeId = this.mapType === 'satellite'
        ? this.naverMaps.MapTypeId.HYBRID
        : this.naverMaps.MapTypeId.NORMAL;

      this.map = new this.naverMaps.Map(this.container, {
        center: new this.naverMaps.LatLng(centerLat, centerLng),
        zoom: 14,
        mapTypeId,
        // 확대·축소는 지도 위 조작 줄 아래의 자체 버튼(zoomBy)으로 한다. 네이버 로고·축척은 기본 위치(아래)에 둔다.
        zoomControl: false,
      });
      // 첫 타일이 그려지면 같은 자리의 미리보기를 걷는다.
      this.naverMaps.Event.once(this.map, 'tilesloaded', () => this.onReady?.());

      this.clusterer = new GridClusterer({
        naverMaps: this.naverMaps,
        map: this.map,
        onSelectShop: (shopId) => {
          if (this.onSelectShop) this.onSelectShop(shopId);
        },
      });

      this.clusterer.setShops(this.allShops);
      this.available = true;
      // 첫 fitBounds 직후 idle이 오지 않는 경우가 있어(모바일 첫 로드) bounds_changed도 함께 듣는다.
      const onMove = () => {
        clearTimeout(this.viewportTimer);
        this.viewportTimer = setTimeout(() => {
          this.clusterer?.refresh();
          this.onViewportChange?.(this.getViewport());
        }, 150);
      };
      this.viewportListener = ['idle', 'bounds_changed'].map(event => this.naverMaps.Event.addListener(this.map, event, onMove));
      return true;
    } catch (e) {
      console.error('지도 초기화 실패:', e);
      this.showFallback('LOAD_FAILED');
      return false;
    }
  }

  /** 필터링된 판매점 목록으로 마커 갱신 */
  setShops(filteredShops) {
    if (this.clusterer) {
      this.clusterer.setShops(filteredShops);
    }
  }

  selectShop(shopId) {
    this.clusterer?.selectShop(shopId);
  }

  getViewport() {
    if (!this.available || !this.map) return null;
    const bounds = this.map.getBounds();
    const sw = bounds.getSW();
    const ne = bounds.getNE();
    return { south: sw.lat(), north: ne.lat(), west: sw.lng(), east: ne.lng() };
  }

  fitShops(shops) {
    const target = explorerMapTarget(shops);
    if (!this.map || !this.naverMaps || !target) return false;
    const maps = this.naverMaps;
    if (target.type === 'point') {
      this.map.setCenter(new maps.LatLng(target.lat, target.lng));
      this.map.setZoom(15);
    } else {
      const rect = this.container?.getBoundingClientRect?.();
      let padding = fitPadding(rect, this.fitObstacles?.());
      // 좁은 화면에서 최소 확대 수준(네이버 기본 6)으로도 전국이 여백 안에 안 들어가면 SDK가 양쪽으로 넘기므로 기존 여백을 쓴다.
      // shortcut: 휴대폰(390px 이하)은 오른쪽 도구 줄과 울릉도 핀이 겹칠 수 있음, 도구 배치나 최소 확대 수준을 바꿀 때 다시 본다.
      if (rect && !boundsFit(target, rect, padding, this.map.getMinZoom?.() ?? 6)) padding = FIT_PADDING;
      this.map.fitBounds(new maps.LatLngBounds(
        new maps.LatLng(target.south, target.west),
        new maps.LatLng(target.north, target.east)
      ), padding);
    }
    return true;
  }

  zoomBy(delta) {
    if (!this.map) return;
    this.map.setZoom(this.map.getZoom() + delta, true);
  }

  /** 특정 판매점으로 지도 이동 */
  panToShop(shop) {
    if (!this.map || !this.naverMaps || !shop) return false;
    if (!explorerMapTarget([shop])) {
      return false; // 좌표 미확보 점포는 지도 이동 불가
    }
    const coord = new this.naverMaps.LatLng(shop.lat, shop.lng);
    this.map.panTo(coord);
    return true;
  }

  /** 지도 유형 설정 ('normal' | 'satellite') */
  setMapType(type) {
    this.mapType = type;
    if (!this.map || !this.naverMaps) return;
    const mapTypeId = type === 'satellite'
      ? this.naverMaps.MapTypeId.HYBRID
      : this.naverMaps.MapTypeId.NORMAL;
    this.map.setMapTypeId(mapTypeId);
  }

  /**
   * 내 위치 요청 - 사용자가 버튼을 클릭했을 때만 호출
   */
  requestMyLocation() {
    if (!navigator.geolocation) {
      if (this.onError) {
        this.onError('이 브라우저는 위치 정보 조회를 지원하지 않습니다.');
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!this.map || !this.naverMaps) return;

        const myCoord = new this.naverMaps.LatLng(latitude, longitude);
        this.map.setCenter(myCoord);
        this.map.setZoom(15);

        // 내 위치 임시 마커 표시
        if (this.myLocationMarker) {
          this.myLocationMarker.setMap(null);
        }

        this.myLocationMarker = new this.naverMaps.Marker({
          position: myCoord,
          map: this.map,
          title: '내 위치',
          icon: {
            content: `
              <div class="my-location-marker" aria-hidden="true"></div>
            `.trim(),
            anchor: new this.naverMaps.Point(8, 8),
          },
        });
      },
      (error) => {
        let msg = '위치 정보를 가져올 수 없습니다.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = '위치 정보 접근 권한이 거부되었습니다. 수동으로 지역을 검색해 주세요.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = '현재 위치 정보를 확인할 수 없습니다.';
        } else if (error.code === error.TIMEOUT) {
          msg = '위치 정보 요청 시간이 초과되었습니다.';
        }
        if (this.onError) this.onError(msg);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }

  /** 지도 로드 실패 또는 키 없음 대체 UI 노출 */
  showFallback(reason) {
    this.available = false;
    // 인증 실패 뒤의 지도 객체는 쓸 수 없다(핀 갱신이 SDK 안에서 예외를 내어 목록 갱신을 막는다).
    this.clusterer = null;
    this.map = null;
    clearTimeout(this.viewportTimer);
    this.onFallback?.(reason);
    this.onViewportChange?.(null);
    if (this.container) {
      this.container.style.display = 'none';
    }
    if (this.fallbackEl) {
      this.fallbackEl.style.display = 'flex';
      const descEl = this.fallbackEl.querySelector('.map-fallback-desc');
      if (descEl) {
        if (reason === 'NO_KEY') {
          descEl.textContent = '지도 연결을 준비 중입니다.';
        } else if (reason === 'AUTH_FAILED') {
          descEl.textContent = '지금은 지도에 연결할 수 없습니다.';
        } else {
          descEl.textContent = '지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
        }
      }
    }
  }
}
