// 내 번호 저장(브라우저 localStorage 형태의 저장소). 예외를 던지지 않고 { ok } 결과로 알린다.
import { validateTicket } from '../lotto/generate.js';

export const MY_NUMBERS_KEY = 'mylottomap.myNumbers.v1';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date를 한국시간 ISO 문자열로. 예: 2026-10-07T22:30:00.000+09:00 */
export function toKstIso(date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().replace('Z', '+09:00');
}

function writeError(e) {
  if (e?.name === 'QuotaExceededError' || e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e?.code === 22) {
    return '저장 공간이 부족해 저장하지 못했습니다. 저장한 번호 일부를 삭제한 뒤 다시 시도해 주세요.';
  }
  return '브라우저 저장소에 저장하지 못했습니다. 브라우저 설정(사생활 보호 모드 등)을 확인해 주세요.';
}

const UNAVAILABLE = '이 브라우저에서는 번호 저장 기능을 사용할 수 없습니다.';
const ACCESS_DENIED = '브라우저 저장소에 접근할 수 없습니다. 브라우저 설정을 확인해 주세요.';

const isEntry = (x) =>
  x && typeof x === 'object' && typeof x.id === 'string' && Number.isInteger(x.round) && x.round > 0 &&
  validateTicket(x.numbers) === null && typeof x.savedAt === 'string';

/**
 * @param {Storage|null|undefined} storage localStorage 또는 getItem/setItem/removeItem을 가진 객체
 * @param {{ now?: () => Date, newId?: () => string }} [deps] 테스트용 주입
 */
export function createMyNumbersStore(storage, { now = () => new Date(), newId } = {}) {
  const makeId = newId ?? (() =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

  function read() {
    if (!storage) return { ok: false, error: UNAVAILABLE };
    let raw;
    try {
      raw = storage.getItem(MY_NUMBERS_KEY);
    } catch {
      return { ok: false, error: ACCESS_DENIED };
    }
    if (raw == null) return { ok: true, items: [] };
    try {
      const items = JSON.parse(raw);
      if (Array.isArray(items) && items.every(isEntry)) return { ok: true, items };
    } catch { /* 아래 손상 처리 */ }
    // 손상 데이터는 덮어쓰지 않는다. 초기화는 clear()로만.
    return { ok: false, corrupted: true, error: '저장된 번호 데이터가 손상되어 읽을 수 없습니다. 초기화하면 다시 저장할 수 있습니다.' };
  }

  function write(items) {
    try {
      storage.setItem(MY_NUMBERS_KEY, JSON.stringify(items));
      return null;
    } catch (e) {
      return writeError(e);
    }
  }

  return {
    /** @returns {{ ok: true, items: {id,round,numbers,savedAt}[] } | { ok: false, error: string }} */
    list: read,

    /** @returns {{ ok: true, item } | { ok: false, error: string }} */
    add({ round, numbers } = {}) {
      if (!Number.isInteger(round) || round < 1) return { ok: false, error: '대상 회차는 1 이상의 정수여야 합니다.' };
      const invalid = validateTicket(numbers);
      if (invalid) return { ok: false, error: invalid };
      const cur = read();
      if (!cur.ok) return cur;
      const item = { id: makeId(), round, numbers: [...numbers].sort((a, b) => a - b), savedAt: toKstIso(now()) };
      const error = write([...cur.items, item]);
      return error ? { ok: false, error } : { ok: true, item };
    },

    /** @returns {{ ok: true } | { ok: false, error: string }} */
    remove(id) {
      const cur = read();
      if (!cur.ok) return cur;
      const items = cur.items.filter((x) => x.id !== id);
      if (items.length === cur.items.length) return { ok: false, error: '삭제할 번호를 찾을 수 없습니다.' };
      const error = write(items);
      return error ? { ok: false, error } : { ok: true };
    },

    /** 저장된 번호 전체 삭제(손상 데이터 초기화 포함). 사용자가 명시적으로 요청할 때만 호출한다. */
    clear() {
      if (!storage) return { ok: false, error: UNAVAILABLE };
      try {
        storage.removeItem(MY_NUMBERS_KEY);
        return { ok: true };
      } catch {
        return { ok: false, error: ACCESS_DENIED };
      }
    },
  };
}
