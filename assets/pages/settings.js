// 환경 설정 (/settings/) 렌더러
import { icon } from '../shared/icons.js';
import { renderLayout } from '../shared/layout.js';
import { escapeHtml } from '../shared/format.js';

export function renderSettingsPage({ siteConfig, site = {}, shopsData, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const regions = shopsData?.regions || [];

  const regionOptions = [
    '<option value="">기본값 (전체 지역)</option>',
    ...regions.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`),
  ].join('\n');

  const content = `
    <div class="settings-container max-w-xl mx-auto">
      <div class="section-header text-center mb-6">
        <h1 class="text-3xl font-black mb-2">환경 설정</h1>
        <p class="text-slate-500">명당맵 기본 시작 지역 및 지도 표시 설정을 지정합니다.</p>
      </div>

      <div class="alert alert-info mb-6" role="status">
        <span>${icon('lock')} 설정은 <strong>이 기기의 브라우저에만 저장</strong>되며, 정밀 위치(위도·경도)는 수집하거나 저장하지 않습니다.</span>
      </div>

      <div class="card">
        <form id="settings-form" onsubmit="return false;">
          <div class="form-group">
            <label for="setting-default-region" class="form-label font-bold">기본 지도 시작 지역</label>
            <select id="setting-default-region" class="form-select">
              ${regionOptions}
            </select>
            <p class="form-hint">명당맵 접속 시 우선적으로 탐색할 기본 지역입니다.</p>
          </div>

          <div class="form-group">
            <label for="setting-map-type" class="form-label font-bold">지도 표시 형태</label>
            <select id="setting-map-type" class="form-select">
              <option value="normal">일반 지도</option>
              <option value="satellite">위성 지도 (하이브리드)</option>
            </select>
            <p class="form-hint">명당맵 지도 표시 시 기본 레이어를 지정합니다.</p>
          </div>

          <div id="settings-error-alert" class="alert alert-danger" style="display: none;" role="alert">
            <span id="settings-error-message">-</span>
          </div>

          <div id="settings-success-alert" class="alert alert-success" style="display: none;" role="status">
            <span>설정이 브라우저에 안전하게 저장되었습니다.</span>
          </div>

          <div class="mt-6">
            <button type="submit" id="btn-save-settings" class="btn btn-primary btn-block">
              설정 저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  return renderLayout({
    site,
    title: '설정 - 마이로또맵',
    description: '마이로또맵 기본 지역 및 지도 표시 환경 설정입니다.',
    canonicalUrl: `${siteUrl}/settings/`,
    currentPath: '/settings/',
    noindex: true, // 설정 페이지는 항상 noindex
    isFixture,
    content,
    scriptExtra: '<script type="module" src="/assets/client/settings.js"></script>',
  });
}
