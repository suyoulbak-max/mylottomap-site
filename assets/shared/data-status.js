import { escapeHtml, formatDateTimeKst } from './format.js';

export function hasWinHistory(shop) {
  return Boolean(shop.wins?.length || shop.winsSource || shop.winsCheckedAt);
}

export function shopPeriodText(data) {
  const period = data?.meta?.period;
  return period?.fromRound && period?.toRound
    ? `${period.fromRound}회 ~ ${period.toRound}회`
    : '배출 이력 기준 기간 준비 중';
}

export function renderShopCoverage(data) {
  const shops = data?.shops || [];
  const names = new Map((data?.regions || []).map((r) => [r.id, r.name]));
  const regions = [...new Set(shops.map((s) => names.get(s.region) || s.region))].filter(Boolean);
  return `<p class="data-coverage">제공 지역: ${escapeHtml(regions.length ? regions.join(', ') : '데이터 준비 중')}<br>배출 이력 기준 기간: ${escapeHtml(shopPeriodText(data))}</p>`;
}

export function getDataUpdateState({ meta, updateStatus, hasData = false }) {
  const pending = !hasData || !meta || meta.status === 'empty' || !meta.source || !meta.checkedAt;
  const delayed = !pending && (meta.status === 'stale' || (updateStatus?.ok === false && updateStatus?.lastAttemptAt));
  const status = pending ? '데이터 준비 중'
    : delayed ? '업데이트 지연 — 마지막 정상 데이터 기준'
    : !updateStatus || updateStatus.ok == null ? '데이터 준비 중'
    : '정상';
  return { pending, delayed: Boolean(delayed), status };
}

export function renderDataStatus({ meta, updateStatus, hasData = false, compact = false, sourceLabel = null }) {
  const { delayed, status } = getDataUpdateState({ meta, updateStatus, hasData });
  const time = (value) => value ? formatDateTimeKst(value) : '데이터 준비 중';
  if (compact) {
    return `<section class="data-status data-status-compact${delayed ? ' data-status-delayed' : ''}" aria-label="데이터 업데이트 상태">
      <div class="status-summary">
        <strong class="status-label">상태: ${status}</strong>
        <span>출처: ${escapeHtml(sourceLabel || meta?.source || '데이터 준비 중')}</span>
        <span>확인: ${escapeHtml(time(meta?.checkedAt))} (한국 시간)</span>
      </div>
      <details class="status-details">
        <summary>업데이트 상세</summary>
        <div class="status-times">
          ${sourceLabel && meta?.source && sourceLabel !== meta.source ? `<p>전체 출처: ${escapeHtml(meta.source)}</p>` : ''}
          <p>마지막 확인 시각 (한국 시간): ${escapeHtml(time(meta?.checkedAt))}</p>
          <p>데이터 갱신 시각 (한국 시간): ${escapeHtml(time(meta?.updatedAt))}</p>
          ${updateStatus?.lastAttemptAt ? `<p>마지막 업데이트 시도 (한국 시간): ${escapeHtml(time(updateStatus.lastAttemptAt))}</p>` : ''}
          ${updateStatus?.lastSuccessAt ? `<p>마지막 정상 업데이트 (한국 시간): ${escapeHtml(time(updateStatus.lastSuccessAt))}</p>` : ''}
        </div>
      </details>
    </section>`;
  }
  return `<section class="data-status${delayed ? ' data-status-delayed' : ''}" aria-label="데이터 업데이트 상태">
    <p><strong>상태: ${status}</strong></p>
    <p>출처: ${escapeHtml(meta?.source || '데이터 준비 중')}</p>
    <p>마지막 확인 시각 (한국 시간): ${escapeHtml(time(meta?.checkedAt))}</p>
    <p>데이터 갱신 시각 (한국 시간): ${escapeHtml(time(meta?.updatedAt))}</p>
    ${updateStatus?.lastAttemptAt ? `<p>마지막 업데이트 시도 (한국 시간): ${escapeHtml(time(updateStatus.lastAttemptAt))}</p>` : ''}
    ${updateStatus?.lastSuccessAt ? `<p>마지막 정상 업데이트 (한국 시간): ${escapeHtml(time(updateStatus.lastSuccessAt))}</p>` : ''}
  </section>`;
}
