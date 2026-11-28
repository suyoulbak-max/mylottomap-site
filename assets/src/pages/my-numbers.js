// 내 번호 (/my-numbers/) 렌더러
import { icon } from '../shared/icons.js';
import { renderLayout } from '../shared/layout.js';

export function renderMyNumbersPage({ siteConfig, site = {}, drawsData, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const rawDraws = drawsData?.draws || [];
  const maxRound = rawDraws.length > 0 ? Math.max(...rawDraws.map((d) => d.round)) : null;
  const targetRound = maxRound ? maxRound + 1 : 1;

  const content = `
    <div class="my-numbers-container content-page themed-page">
      <div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('bookmark')}</span>
        <div>
        <h1 class="text-3xl font-black mb-2">내 번호 관리 및 당첨 확인</h1>
        <p class="text-slate-500">저장한 번호 조합을 회차별로 확인하고 실제 추첨 결과와 비교합니다.</p>
        </div>
      </div>

      <div class="privacy-note" role="status">
        <span>${icon('lock')} 저장된 번호는 <strong>이 기기의 브라우저(로컬 저장소)에만 저장</strong>되며, 외부 서버로 전송되지 않습니다.</span>
      </div>

      <!-- 수동 번호 직접 등록 카드 -->
      <section class="card mb-8">
        <div class="section-header">
          <h2 class="section-title">${icon('bookmark')} 직접 번호 등록</h2>
          <p class="section-desc">구매한 로또 번호 6개와 대상 회차를 입력하여 저장할 수 있습니다.</p>
        </div>

        <form id="add-ticket-form" onsubmit="return false;">
          <div class="manual-number-fields">
            <div>
              <label for="manual-round-input" class="form-label font-bold">대상 회차</label>
              <input type="number" id="manual-round-input" class="form-input" value="${targetRound}" min="1" required>
            </div>
            <div>
              <label for="manual-numbers-input" class="form-label font-bold">번호 6개</label>
              <input type="text" id="manual-numbers-input" class="form-input" placeholder="예: 3, 11, 19, 24, 33, 41" autocomplete="off" aria-describedby="manual-hint" required>
              <p id="manual-hint" class="form-hint">1~45 중 서로 다른 번호를 쉼표 또는 띄어쓰기로 구분하세요.</p>
            </div>
          </div>

          <div id="manual-error-alert" class="alert alert-danger mt-3" style="display: none;" role="alert">
            <span id="manual-error-message">-</span>
          </div>

          <div class="mt-4 text-right">
            <button type="submit" id="btn-add-manual" class="btn btn-primary">
              ${icon('bookmark')} 내 번호에 추가하기
            </button>
          </div>
        </form>
      </section>

      <!-- 저장된 내 번호 목록 섹션 -->
      <section id="saved-tickets" class="card">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <div>
            <h2 class="section-title">${icon('bookmark')} 저장된 번호 목록</h2>
            <p class="section-desc">저장된 회차의 공식 추첨 결과와 자동으로 비교됩니다.</p>
          </div>
          <div>
            <button type="button" id="btn-clear-all" class="btn btn-secondary btn-sm button-danger" title="저장된 번호 전체 삭제">전체 삭제</button>
          </div>
        </div>

        <div id="storage-error-alert" class="alert alert-danger" style="display: none;" role="alert">
          <span id="storage-error-message">-</span>
        </div>

        <div id="tickets-list-container" class="space-y-4">
          <!-- 클라이언트 스크립트에서 렌더링 -->
          <div class="text-center py-8 text-slate-400">
            저장된 번호를 불러오는 중...
          </div>
        </div>
        <p class="mt-4"><a class="content-link" href="/guides/check-my-numbers/">등수 판정·결과 대기·저장 오류 해결 방법</a></p>
        <div class="ticket-next-step">
          <div><strong>결과를 확인하셨나요?</strong><p>다음 회차 번호도 만들어 이 브라우저에 저장해 두세요.</p></div>
          <a class="btn btn-primary" href="/generator/">다음 회차 번호 만들기</a>
        </div>
      </section>
    </div>
  `;

  return renderLayout({
    site,
    title: '내 번호 관리 - 마이로또맵',
    description: '내가 저장한 로또 번호와 당첨 여부를 확인하세요.',
    canonicalUrl: `${siteUrl}/my-numbers/`,
    currentPath: '/my-numbers/',
    noindex: true, // 내 번호 페이지는 항상 noindex
    isFixture,
    content,
    headExtra: '<link rel="stylesheet" href="/assets/shared/generator-guide.css">',
    scriptExtra: '<script type="module" src="/assets/client/my-numbers.js"></script>',
  });
}
