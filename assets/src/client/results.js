export function resultRoundPath(value, availableRounds) {
  const text = value.trim();
  const round = Number(text);
  return /^\d+$/.test(text) && Number.isSafeInteger(round) && round > 0 && availableRounds.has(round)
    ? `/results/${round}/` : null;
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('result-round-form');
  if (form) {
    const rounds = new Set(JSON.parse(document.getElementById('results-rounds').textContent));
    const input = document.getElementById('result-round-input');
    const error = document.getElementById('result-round-error');
    form.hidden = false;
    input.addEventListener('input', () => {
      error.textContent = '';
      input.removeAttribute('aria-invalid');
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const path = resultRoundPath(input.value, rounds);
      if (path) location.assign(path);
      else {
        error.textContent = '결과가 확보된 회차 번호를 입력해 주세요. 아래 연도별 목록에서도 찾을 수 있습니다.';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      }
    });
  }
}
