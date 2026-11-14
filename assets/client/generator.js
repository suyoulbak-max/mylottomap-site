// 번호 생성 페이지 클라이언트 스크립트
import { icon } from '../shared/icons.js';
import { generateGames, countCombos, matchesOptions, gameFeatures, TOTAL_COMBINATIONS } from '../lotto/generate.js';
import { createMyNumbersStore } from '../storage/my-numbers.js';
import { createSettingsStore } from '../storage/settings.js';
import { buildGeneratorGuide, renderGeneratorGuideResults } from '../shared/generator-guide.js';
import { renderBalls } from '../shared/format.js';

/** 빈 칸은 제한 없음(null), 그 밖의 값은 숫자로 넘겨 검증 오류 문구를 받는다. */
function parseOptional(value) {
  return value.trim() === '' ? null : Number(value);
}

function formatShare(count, total) {
  if (count === 0) return '0%';
  const pct = (count / total) * 100;
  if (pct < 0.01) return '0.01% 미만';
  return `${pct.toFixed(pct < 1 ? 2 : 1)}%`;
}

function featureText(numbers) {
  const { odd, sum, maxRun } = gameFeatures(numbers);
  return `홀${odd} : 짝${6 - odd} · 합계 ${sum} · ${maxRun === 1 ? '연속 번호 없음' : `최장 연속 ${maxRun}개`}`;
}

function parseNumbers(inputStr) {
  if (!inputStr || !inputStr.trim()) return [];
  const parts = inputStr.trim().split(/[\s,]+/);
  const nums = [];
  for (const part of parts) {
    if (!part) continue;
    const n = Number(part);
    nums.push(n); // 숫자가 아닌 토큰도 검증에 넘겨 입력 오류로 처리한다.
  }
  return nums;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('generator-form');
  const targetRoundInput = document.getElementById('target-round-input');
  const includeInput = document.getElementById('include-input');
  const excludeInput = document.getElementById('exclude-input');
  const countSelect = document.getElementById('count-select');
  const errorAlert = document.getElementById('gen-error-alert');
  const errorMessage = document.getElementById('gen-error-message');
  const resultsCard = document.getElementById('results-card');
  const gamesList = document.getElementById('generated-games-list');
  const btnCopyAll = document.getElementById('btn-copy-all');
  const btnSaveAll = document.getElementById('btn-save-all');
  const saveFeedback = document.getElementById('save-feedback');
  const sumMinInput = document.getElementById('sum-min-input');
  const sumMaxInput = document.getElementById('sum-max-input');
  const runSelect = document.getElementById('run-select');
  const comboCount = document.getElementById('combo-count');
  const comboShare = document.getElementById('combo-share');
  const historyShare = document.getElementById('history-share');
  const advancedState = document.getElementById('advanced-condition-state');
  const conditionSummary = document.getElementById('condition-summary');
  const advancedDetails = form.querySelector('.generator-advanced');

  form.addEventListener('invalid', (event) => {
    if (advancedDetails.contains(event.target)) advancedDetails.open = true;
  }, true);

  let currentGames = [];
  let generatedRound = null;
  let draws = [];
  let storage;
  try { storage = window.localStorage; } catch { /* 생성과 가이드는 저장소 없이도 동작한다. */ }
  const store = createMyNumbersStore(storage);
  const guideRegion = document.getElementById('guide-region');
  const guidePeriod = document.getElementById('guide-period');
  const guideResults = document.getElementById('guide-results');
  const guideLoadState = document.getElementById('guide-load-state');

  function readOptions() {
    return {
      include: parseNumbers(includeInput.value),
      exclude: parseNumbers(excludeInput.value),
      oddCounts: [...form.querySelectorAll('input[name="odd-count"]:checked')].map((el) => Number(el.value)),
      sumMin: parseOptional(sumMinInput.value),
      sumMax: parseOptional(sumMaxInput.value),
      maxRun: runSelect.value === '' ? null : Number(runSelect.value),
    };
  }

  function updateSummary() {
    const options = readOptions();
    const result = countCombos(options);
    const selectedConditions = [
      options.oddCounts.length ? options.oddCounts.map((odd) => `홀${odd}:짝${6 - odd}`).join(', ') : '',
      options.sumMin != null || options.sumMax != null ? `합계 ${options.sumMin ?? 21}~${options.sumMax ?? 255}` : '',
      options.maxRun != null ? (options.maxRun === 1 ? '연속 없음' : `최대 ${options.maxRun}개 연속`) : '',
    ].filter(Boolean);
    advancedState.textContent = selectedConditions.join(' · ') || '선택한 추가 조건 없음';
    conditionSummary.dataset.state = result.ok ? 'ready' : 'error';
    if (!result.ok) {
      comboCount.textContent = '조건 확인 필요';
      comboShare.textContent = `· ${result.error}`;
      historyShare.hidden = true;
      return;
    }
    comboCount.textContent = `${result.count.toLocaleString('ko-KR')}개`;
    comboShare.textContent = `(전체 ${TOTAL_COMBINATIONS.toLocaleString('ko-KR')}개 중 ${formatShare(result.count, TOTAL_COMBINATIONS)})`;
    if (draws.length) {
      const matched = draws.filter((d) => matchesOptions(d.numbers, options)).length;
      const rounds = draws.map((d) => d.round);
      historyShare.textContent = `확보된 당첨 번호 ${draws.length}회(${Math.min(...rounds)}~${Math.max(...rounds)}회) 중 ${matched}회(${formatShare(matched, draws.length)})가 이 조건에 맞았습니다.`;
      historyShare.hidden = false;
    }
  }

  let summaryTimer = null;
  form.addEventListener('input', () => {
    clearTimeout(summaryTimer);
    summaryTimer = setTimeout(updateSummary, 300);
  });

  const loadData = async (path, field) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error('데이터 로드 실패');
    const data = await response.json();
    if (!Array.isArray(data?.[field])) throw new Error('데이터 형식 오류');
    return data;
  };
  Promise.allSettled([
    loadData('/assets/data/draws.json', 'draws').then(data => {
      draws = data.draws;
      updateSummary();
      return data;
    }),
    loadData('/assets/data/shops.json', 'shops'),
  ]).then(([drawResult, shopResult]) => {
    if (drawResult.status !== 'fulfilled' || shopResult.status !== 'fulfilled') {
      guideLoadState.innerHTML = '필터 자료를 불러오지 못해 기본 기록을 표시합니다. 번호 생성·저장은 계속 이용할 수 있습니다. <a class="content-link" href="/generator/#generator-guide">다시 불러오기</a>';
      return;
    }
    const defaultRegion = createSettingsStore(storage).get().settings.defaultRegion;
    if ([...guideRegion.options].some(option => option.value === defaultRegion)) guideRegion.value = defaultRegion;
    const updateGuide = () => {
      const model = buildGeneratorGuide(drawResult.value, shopResult.value, {
        region: guideRegion.value,
        last: guidePeriod.value === 'all' ? null : Number(guidePeriod.value),
      });
      guideResults.innerHTML = renderGeneratorGuideResults(model);
    };
    guideRegion.disabled = false;
    guidePeriod.disabled = false;
    guideRegion.addEventListener('change', updateGuide);
    guidePeriod.addEventListener('change', updateGuide);
    guideLoadState.hidden = true;
    updateGuide();
  });

  function showError(msg) {
    errorMessage.textContent = msg;
    errorAlert.style.display = 'flex';
  }

  function hideError() {
    errorAlert.style.display = 'none';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    hideError();
    saveFeedback.style.display = 'none';

    const count = parseInt(countSelect.value, 10);

    const round = Number(targetRoundInput.value);
    if (!Number.isSafeInteger(round) || round < 1) {
      showError('올바른 대상 회차를 입력해 주세요.');
      return;
    }
    const options = readOptions();
    const result = generateGames({ ...options, count });
    if (!result.ok) {
      showError(result.error);
      return;
    }

    currentGames = result.games;
    generatedRound = round;
    const conditions = [
      options.include.length ? `포함 ${options.include.join(', ')}` : '',
      options.exclude.length ? `제외 ${options.exclude.join(', ')}` : '',
      options.oddCounts.length ? options.oddCounts.map(odd => `홀${odd}:짝${6 - odd}`).join(', ') : '',
      options.sumMin != null || options.sumMax != null ? `합계 ${options.sumMin ?? 21}~${options.sumMax ?? 255}` : '',
      options.maxRun != null ? `최대 ${options.maxRun}개 연속` : '',
    ].filter(Boolean);
    const generatedContext = document.getElementById('generated-context');
    generatedContext.textContent = `${round}회차 · ${conditions.join(' · ') || '조건 없는 무작위 생성'}`;
    generatedContext.hidden = false;
    gamesList.innerHTML = currentGames.map((game, idx) => {
      const label = String.fromCharCode(65 + idx); // A, B, C, D, E
      return `
        <div class="generated-game">
          <span class="game-label">${label}</span>
          <div>
            ${renderBalls(game, null, { size: 'md' })}
            <p class="game-features">${featureText(game)}</p>
          </div>
        </div>
      `.trim();
    }).join('\n');

    resultsCard.style.display = 'block';
    document.getElementById('result-actions').hidden = false;
  });

  // 클립보드 복사
  btnCopyAll.addEventListener('click', async () => {
    if (!currentGames.length) return;
    const text = currentGames.map((game, idx) => {
      const label = String.fromCharCode(65 + idx);
      return `[${label}] ${game.join(', ')}`;
    }).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      btnCopyAll.innerHTML = `${icon('check')} 복사 완료!`;
      setTimeout(() => { btnCopyAll.innerHTML = `${icon('copy')} 번호 복사`; }, 2000);
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    }
  });

  // 내 번호로 저장
  btnSaveAll.addEventListener('click', () => {
    if (!currentGames.length) return;
    const round = generatedRound;
    if (!round || round < 1) {
      showError('올바른 대상 회차를 입력해 주세요.');
      return;
    }

    let savedCount = 0;
    for (const game of currentGames) {
      const res = store.add({ round, numbers: game });
      if (res.ok) savedCount++;
      else {
        showError(res.error);
        return;
      }
    }

    if (savedCount > 0) {
      saveFeedback.querySelector('span').innerHTML = `${round}회차 ${savedCount}개 게임이 이 브라우저에 저장되었습니다. 추첨 결과가 확보되면 해당 회차와 비교합니다. <a href="/my-numbers/#saved-tickets" class="underline font-bold">저장 번호·결과 확인하기</a>`;
      saveFeedback.style.display = 'block';
      setTimeout(() => {
        saveFeedback.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
      }, 100);
    }
  });
});
