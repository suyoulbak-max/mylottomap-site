// 네이버 지도 SDK v3 동적 로더 및 인증/로드 실패 처리

let loadPromise = null;

/**
 * 네이버 지도 스크립트 로드
 * @param {string} ncpKeyId - NCP 클라이언트 아이디
 * @returns {Promise<{ ok: true, maps: any } | { ok: false, error: 'NO_KEY' | 'LOAD_FAILED' | 'AUTH_FAILED' }>}
 */
export function loadNaverMaps(ncpKeyId, onAuthFailure) {
  if (!ncpKeyId || !ncpKeyId.trim()) {
    return Promise.resolve({ ok: false, error: 'NO_KEY' });
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    // 이미 로드된 경우
    if (globalThis.naver && globalThis.naver.maps) {
      return resolve({ ok: true, maps: globalThis.naver.maps });
    }

    // 전역 인증 실패 콜백 등록 (네이버 지도 v3 스펙)
    globalThis.navermap_authFailure = () => {
      onAuthFailure?.();
      resolve({ ok: false, error: 'AUTH_FAILED' });
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(ncpKeyId.trim())}`;
    script.async = true;

    script.onload = () => {
      if (globalThis.naver && globalThis.naver.maps) {
        resolve({ ok: true, maps: globalThis.naver.maps });
      } else {
        resolve({ ok: false, error: 'LOAD_FAILED' });
      }
    };

    script.onerror = () => {
      resolve({ ok: false, error: 'LOAD_FAILED' });
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
