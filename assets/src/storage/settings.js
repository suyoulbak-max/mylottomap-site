// 기본 지역·지도 표시 설정 저장. 정밀 위치(위도·경도)는 저장하지 않는다.

export const SETTINGS_KEY = 'mylottomap.settings.v1';
export const DEFAULT_SETTINGS = Object.freeze({ defaultRegion: null, mapType: 'normal' });

const MAP_TYPES = ['normal', 'satellite'];
const COORD_LIKE = /-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+/;

/** 알려진 필드만, 올바른 값만 허용. 정상이면 null, 아니면 한국어 오류. */
function validate(partial) {
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) return '설정 형식이 올바르지 않습니다.';
  for (const key of Object.keys(partial)) {
    if (!(key in DEFAULT_SETTINGS)) {
      return /^(lat|lng|lon|latitude|longitude|coords?|position|location)$/i.test(key)
        ? '정밀 위치는 저장하지 않습니다.'
        : `알 수 없는 설정 항목입니다: ${key}`;
    }
  }
  if ('defaultRegion' in partial) {
    const r = partial.defaultRegion;
    if (r !== null && (typeof r !== 'string' || !r.trim())) return '기본 지역 값이 올바르지 않습니다.';
    if (typeof r === 'string' && COORD_LIKE.test(r)) return '정밀 위치는 저장하지 않습니다.';
  }
  if ('mapType' in partial && !MAP_TYPES.includes(partial.mapType)) return '지도 종류 값이 올바르지 않습니다.';
  return null;
}

/**
 * @param {Storage|null|undefined} storage
 * get() 실패 시에도 settings에 기본값을 담아 화면이 계속 동작하게 한다.
 */
export function createSettingsStore(storage) {
  function get() {
    const fallback = { ...DEFAULT_SETTINGS };
    if (!storage) return { ok: false, error: '이 브라우저에서는 설정을 저장할 수 없습니다.', settings: fallback };
    let raw;
    try {
      raw = storage.getItem(SETTINGS_KEY);
    } catch {
      return { ok: false, error: '브라우저 저장소에 접근할 수 없어 기본 설정을 사용합니다.', settings: fallback };
    }
    if (raw == null) return { ok: true, settings: fallback };
    try {
      const saved = JSON.parse(raw);
      if (validate(saved) === null) return { ok: true, settings: { ...fallback, ...saved } };
    } catch { /* 아래 손상 처리 */ }
    return { ok: false, corrupted: true, error: '저장된 설정이 손상되어 기본 설정을 사용합니다.', settings: fallback };
  }

  /** @returns {{ ok: true, settings } | { ok: false, error: string }} */
  function set(partial) {
    const invalid = validate(partial);
    if (invalid) return { ok: false, error: invalid };
    const cur = get();
    // 사용자가 직접 바꾸는 값이므로 손상된 설정은 기본값 위에 새로 저장한다. 접근 불가면 중단.
    if (!cur.ok && !cur.corrupted) return { ok: false, error: cur.error };
    const settings = { ...cur.settings, ...partial };
    try {
      storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return { ok: true, settings };
    } catch (e) {
      return {
        ok: false,
        error: e?.name === 'QuotaExceededError' || e?.code === 22
          ? '저장 공간이 부족해 설정을 저장하지 못했습니다.'
          : '브라우저 저장소에 설정을 저장하지 못했습니다.',
      };
    }
  }

  return { get, set };
}
