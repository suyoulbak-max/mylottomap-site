// 지도 인스턴스, 핀/클러스터 관리, 내 위치 및 실패 대안 처리
import { loadNaverMaps } from './loader.js';
import { GridClusterer } from './clusterer.js';
import { explorerMapTarget } from '../shared/map-explorer.js';

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
  constructor({ container, fallbackEl, ncpKeyId, mapType = 'normal', onSelectShop, onError, onViewportChange }) {
    this.container = container;
    this.fallbackEl = fallbackEl;
    this.ncpKeyId = ncpKeyId;
    this.mapType = mapType;
    this.onSelectShop = onSelectShop;
    this.onError = onError;
    this.onViewportChange = onViewportChange;
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
        zoomControl: true,
        zoomControlOptions: {
          position: this.naverMaps.Position.TOP_LEFT,
          style: this.naverMaps.ZoomControlStyle.SMALL,
        },
      });

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
      this.map.fitBounds(new maps.LatLngBounds(
        new maps.LatLng(target.south, target.west),
        new maps.LatLng(target.north, target.east)
      ), { top: 64, right: 48, bottom: 64, left: 48 });
    }
    return true;
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
    clearTimeout(this.viewportTimer);
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
