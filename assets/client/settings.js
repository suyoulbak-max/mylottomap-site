// 설정 페이지 클라이언트 스크립트
import { createSettingsStore } from '../storage/settings.js';

document.addEventListener('DOMContentLoaded', () => {
  const store = createSettingsStore(window.localStorage);
  const form = document.getElementById('settings-form');
  const regionSelect = document.getElementById('setting-default-region');
  const mapTypeSelect = document.getElementById('setting-map-type');
  const errorAlert = document.getElementById('settings-error-alert');
  const errorMessage = document.getElementById('settings-error-message');
  const successAlert = document.getElementById('settings-success-alert');

  // 현재 설정 불러오기
  const res = store.get();
  if (res.ok && res.settings) {
    if (res.settings.defaultRegion) {
      regionSelect.value = res.settings.defaultRegion;
    }
    if (res.settings.mapType) {
      mapTypeSelect.value = res.settings.mapType;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorAlert.style.display = 'none';
    successAlert.style.display = 'none';

    const defaultRegion = regionSelect.value ? regionSelect.value : null;
    const mapType = mapTypeSelect.value;

    const saveRes = store.set({ defaultRegion, mapType });
    if (!saveRes.ok) {
      errorMessage.textContent = saveRes.error;
      errorAlert.style.display = 'flex';
      return;
    }

    successAlert.style.display = 'flex';
  });
});
