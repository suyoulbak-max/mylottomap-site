// 번호 생성기 (/generator/) 렌더러
import { icon } from '../shared/icons.js';
import { renderLayout } from '../shared/layout.js';
import { TOTAL_COMBINATIONS } from '../lotto/generate.js';
import { buildGeneratorGuide, guidePeriods, guideRegionOptions, renderGeneratorGuideResults } from '../shared/generator-guide.js';
import { drawDateText } from '../shared/next-draw.js';

const TOTAL_TEXT = TOTAL_COMBINATIONS.toLocaleString('ko-KR');

const oddChips = Array.from({ length: 7 }, (_, odd) => `
              <label class="choice-chip"><input type="checkbox" name="odd-count" value="${odd}"><span>홀${odd} : 짝${6 - odd}</span></label>`).join('');

export function renderGeneratorPage({ siteConfig, site = {}, drawsData, shopsData, isFixture = false, nextDraw = null }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const rawDraws = drawsData?.draws || [];
  const maxRound = rawDraws.length > 0 ? Math.max(...rawDraws.map((d) => d.round)) : null;
  const targetRound = maxRound ? maxRound + 1 : 1;
  // 다음 회차 정보가 최신 결과의 다음 회차일 때만 추첨 예정일을 함께 쓴다.
  const roundHint = nextDraw && maxRound && nextDraw.round === targetRound
    ? `제${targetRound}회 · ${drawDateText(nextDraw.drawDate)} 추첨 예정`
    : maxRound ? `최신 ${maxRound}회차 다음 회차` : '저장할 대상 회차를 입력하세요.';
  const periods = guidePeriods(drawsData, shopsData);
  const defaultPeriod = periods.includes(50) ? 50 : null;
  const guide = buildGeneratorGuide(drawsData, shopsData, { last: defaultPeriod });

  const content = `
    <div class="generator-page-container content-page">
      <div class="page-intro generator-intro">
        <span class="generator-intro-icon" aria-hidden="true">${icon('spark')}</span>
        <div>
        <h1 class="text-3xl font-black mb-2">로또 6/45 번호 생성기</h1>
        <p>1~45에서 중복 없이 6개를 무작위로 고릅니다.<br>원하는 조건을 정하고, 만든 번호를 내 번호에 저장하세요.</p>
        </div>
      </div>

      <div class="generator-layout">
      <section class="card generator-settings">
        <div class="section-header">
          <h2 class="section-title">${icon('settings')} 조건 설정</h2>
          <p class="section-desc">포함·제외와 추가 조건은 비워 두면 제한하지 않습니다.</p>
        </div>
        <form id="generator-form" onsubmit="return false;">
          <div class="generator-basics">
          <div class="form-group">
            <label for="target-round-input" class="form-label font-bold">대상 회차</label>
            <input type="number" id="target-round-input" class="form-input" value="${targetRound}" min="1" required aria-describedby="round-hint">
            <p id="round-hint" class="form-hint">${roundHint}</p>
          </div>
          <div class="form-group">
            <label for="count-select" class="form-label">게임 수</label>
            <select id="count-select" class="form-select">
              <option value="1">1 게임</option>
              <option value="2">2 게임</option>
              <option value="3">3 게임</option>
              <option value="4">4 게임</option>
              <option value="5" selected>5 게임 (1세트)</option>
            </select>
          </div>
          </div>

          <div class="generator-number-fields">
          <div class="form-group generator-number-box include-box">
            <label for="include-input" class="form-label">포함할 번호 <span class="label-optional">선택 · 최대 6개</span></label>
            <input type="text" id="include-input" class="form-input" placeholder="예: 7, 14, 21" autocomplete="off" aria-describedby="include-hint">
            <p id="include-hint" class="form-hint">반드시 넣을 번호를 쉼표 또는 띄어쓰기로 구분하세요.</p>
          </div>

          <div class="form-group generator-number-box exclude-box">
            <label for="exclude-input" class="form-label">제외할 번호 <span class="label-optional">선택</span></label>
            <input type="text" id="exclude-input" class="form-input" placeholder="예: 4, 13, 22" autocomplete="off" aria-describedby="exclude-hint">
            <p id="exclude-hint" class="form-hint">빼고 싶은 번호를 쉼표 또는 띄어쓰기로 구분하세요.</p>
          </div>
          </div>

          <details class="generator-advanced">
            <summary><span>추가 조건 <small>홀짝 · 합계 · 연속 번호</small><span id="advanced-condition-state" class="advanced-condition-state">선택한 추가 조건 없음</span></span>${icon('chevron')}</summary>
            <div class="generator-advanced-body">

          <fieldset class="form-group condition-fieldset" aria-describedby="odd-hint">
            <legend class="form-label">홀짝 비율 <span class="label-optional">선택 · 여러 개 가능</span></legend>
            <div class="choice-chips">${oddChips}
            </div>
            <p id="odd-hint" class="form-hint">6개 번호 중 홀수와 짝수의 개수입니다. 고르지 않으면 제한하지 않습니다.</p>
          </fieldset>

          <div class="form-group">
            <span class="form-label" id="sum-label">번호 합계 범위 <span class="label-optional">선택 · 21~255</span></span>
            <div class="range-inputs" role="group" aria-labelledby="sum-label" aria-describedby="sum-hint">
              <label for="sum-min-input" class="sr-only">합계 최솟값</label>
              <input type="number" id="sum-min-input" class="form-input input-short" min="21" max="255" step="1" inputmode="numeric" placeholder="21">
              <span aria-hidden="true">~</span>
              <label for="sum-max-input" class="sr-only">합계 최댓값</label>
              <input type="number" id="sum-max-input" class="form-input input-short" min="21" max="255" step="1" inputmode="numeric" placeholder="255">
            </div>
            <p id="sum-hint" class="form-hint">6개 번호를 더한 값의 범위입니다. 한쪽만 입력해도 됩니다.</p>
          </div>

          <div class="form-group">
            <label for="run-select" class="form-label">연속 번호 <span class="label-optional">선택</span></label>
            <select id="run-select" class="form-select" aria-describedby="run-hint">
              <option value="">제한 없음</option>
              <option value="1">연속 번호 없음</option>
              <option value="2">최대 2개 연속 (예: 7, 8)</option>
              <option value="3">최대 3개 연속 (예: 7, 8, 9)</option>
            </select>
            <p id="run-hint" class="form-hint">7, 8, 9처럼 1씩 이어지는 번호를 몇 개까지 허용할지 정합니다.</p>
          </div>
          </div>
          </details>

          <div id="gen-error-alert" class="alert alert-danger" style="display: none;" role="alert">
            <span id="gen-error-message">-</span>
          </div>

          <div class="generator-submit">
            <button type="submit" id="btn-generate" class="btn btn-primary btn-lg btn-block">
              ${icon('spark')} 번호 생성하기
            </button>
          </div>
        </form>
      </section>

      <!-- 생성 결과 표시 영역 -->
      <div class="generator-output">
      <section id="results-card" class="card generated-results" aria-labelledby="generated-title">
        <div class="card-heading">
          <h2 id="generated-title" class="section-title">${icon('bookmark')} 생성된 번호</h2>
          <p id="generated-context" class="section-desc" hidden></p>
        </div>

        <div id="generated-games-list" class="space-y-3" aria-live="polite">
          <div class="empty-state">
            <div class="empty-number-preview" aria-hidden="true">${Array.from({length:6}, () => '<span>–</span>').join('')}</div>
            <h3>나만의 번호 조합을 만들어 보세요</h3>
            <p><strong>번호 생성하기</strong>를 누르면 이곳에 표시됩니다.<br>조건 없이 바로 생성해도 됩니다.</p>
          </div>
        </div>

        <div id="result-actions" class="result-actions" hidden>
          <button type="button" id="btn-copy-all" class="btn btn-secondary btn-sm" title="클립보드에 복사">${icon('copy')} 번호 복사</button>
          <button type="button" id="btn-save-all" class="btn btn-primary btn-sm" title="내 번호 목록에 저장">${icon('bookmark')} 내 번호로 저장</button>
        </div>

        <div id="save-feedback" class="alert alert-success mt-4" style="display: none;" role="status">
          <span>번호가 내 번호 목록에 저장되었습니다. <a href="/my-numbers/" class="underline font-bold">내 번호에서 확인하기</a></span>
        </div>
        <p class="guide-caption ticket-storage-note">저장한 번호는 이 브라우저에만 남습니다. 추첨 후 <a class="content-link" href="/my-numbers/#saved-tickets">내 번호에서 결과 확인</a>을 할 수 있습니다.</p>
      </section>
      <section id="condition-summary" class="card condition-summary" aria-live="polite" aria-labelledby="condition-summary-title">
        <h2 id="condition-summary-title" class="summary-kicker">조건에 맞는 조합</h2>
        <p><strong id="combo-count">${TOTAL_TEXT}개</strong><span id="combo-share" class="text-muted">전체의 100%</span></p>
        <p id="history-share" class="text-muted" hidden></p>
        <p class="probability-note">어떤 조합을 고르든 1등 확률은 1/${TOTAL_TEXT}로 같습니다. 조건은 확률을 높이지 않고 고르는 범위만 좁힙니다.</p>
      </section>
      </div>
      </div>

      <section id="generator-guide" class="card generator-guide" aria-labelledby="generator-guide-title">
        <div class="section-header">
          <h2 id="generator-guide-title" class="section-title">${icon('map')} 번호 통계와 지역 가이드</h2>
          <p class="section-desc">과거 번호 기록을 살펴보고, 관심 지역의 배출 판매점을 찾아보세요.</p>
        </div>
        <div class="guide-controls">
          <div><label for="guide-region" class="form-label">관심 지역</label><select id="guide-region" class="form-select" disabled aria-describedby="guide-scope-note">${guideRegionOptions(shopsData?.regions)}</select></div>
          <div><label for="guide-period" class="form-label">조회 기간</label><select id="guide-period" class="form-select" disabled>${periods.map(n => `<option value="${n}"${n === defaultPeriod ? ' selected' : ''}>최근 ${n}회</option>`).join('')}<option value="all"${defaultPeriod === null ? ' selected' : ''}>확보된 전체 기간</option></select></div>
        </div>
        <p id="guide-scope-note" class="guide-caption">지역·기간 선택은 아래 참고 정보에만 적용되며 생성 번호를 바꾸지 않습니다.</p>
        <p id="guide-load-state" class="guide-caption" role="status">필터를 준비하고 있습니다. 아래는 기본 기간의 기록입니다.</p>
        <noscript><p class="guide-caption">지역·기간을 바꾸려면 JavaScript를 켜 주세요. 아래 기본 기록과 판매점 링크는 바로 이용할 수 있습니다.</p></noscript>
        <div id="guide-results" aria-live="polite">${renderGeneratorGuideResults(guide)}</div>
      </section>

      <details class="content-note generator-principles">
        <summary>
          <span class="principles-summary-icon" aria-hidden="true">${icon('info')}</span>
          <span class="principles-summary-text">번호 생성 원칙 안내<small>무작위 추출 방식과 조건의 의미를 확인하세요.</small></span>
          <span class="principles-chevron" aria-hidden="true">${icon('chevron')}</span>
        </summary>
        <div class="principles-body">
          <div class="principles-grid">
            <section class="principle-panel" aria-labelledby="principle-random-title">
              <h2 id="principle-random-title">기본 추출 방식</h2>
              <p>브라우저의 암호학적 난수 생성기를 사용해 <strong>1~45에서 중복 없이 6개</strong>를 고릅니다. 조건이 없으면 모든 번호 조합을 같은 확률로 선택합니다.</p>
            </section>
            <section class="principle-panel" aria-labelledby="principle-filter-title">
              <h2 id="principle-filter-title">조건을 적용했을 때</h2>
              <p>홀짝·합계·연속 번호 조건에 맞는 조합 수를 모두 센 뒤, <strong>그 안에서 같은 확률로</strong> 고릅니다. 가능한 조합이 없으면 생성하지 않고 이유를 알려 드립니다.</p>
            </section>
          </div>
          <div class="principles-guide">
            <p>홀짝 3 : 3이나 합계 121~160이 자주 보이는 것은 그런 조합의 수가 많기 때문입니다.</p>
            <a href="/guides/odd-even-sum/" class="content-link">홀짝 비율·번호 합계 통계 읽는 법 →</a>
          </div>
          <p class="principles-disclaimer">조건은 고르는 범위를 좁힐 뿐, 당첨 확률을 높이지 않습니다. AI 예측이나 당첨 보장 기능은 제공하지 않습니다.</p>
          <p class="mt-3"><a href="/guides/number-generator-guide/" class="content-link">번호 생성·저장 사용법과 입력 오류 해결</a></p>
        </div>
      </details>
    </div>
  `;

  return renderLayout({
    site,
    title: '로또 번호 생성기 - 마이로또맵',
    description: '로또 6/45 번호를 균등하게 무작위로 생성합니다. 포함·제외 번호와 홀짝·합계·연속 번호 조건에 맞는 조합 수를 확인하고 내 번호로 저장하세요.',
    canonicalUrl: `${siteUrl}/generator/`,
    currentPath: '/generator/',
    isFixture,
    content,
    headExtra: '<link rel="stylesheet" href="/assets/shared/generator-guide.css">',
    scriptExtra: '<script type="module" src="/assets/client/generator.js"></script>',
  });
}
