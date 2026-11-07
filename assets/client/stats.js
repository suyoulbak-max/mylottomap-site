const grid = document.querySelector('.frequency-grid');
const chart = document.querySelector('.freq-chart svg');
const selectedCount = document.querySelector('.freq-selection');
const selectedPeriods = document.querySelector('.frequency-picked');

function selectNumber(number) {
  const tile = grid?.querySelector(`[data-number="${number}"]`);
  if (!tile) return;
  grid.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
  tile.setAttribute('aria-pressed', 'true');
  chart.querySelector('.is-selected')?.classList.remove('is-selected');
  chart.querySelector(`rect[data-number="${number}"]`)?.classList.add('is-selected');
  selectedCount.textContent = `${number}번 · 전체 ${tile.dataset.all}회 출현`;
  selectedPeriods.textContent = `${number}번 · 전체 ${tile.dataset.all}회 · 최근 100회 ${tile.dataset.last100}회 · 최근 50회 ${tile.dataset.last50}회 · 최근 10회 ${tile.dataset.last10}회 · ${tile.dataset.gap}`;
}

if (grid && chart && selectedCount && selectedPeriods) {
  chart.addEventListener('pointerover', (event) => {
    const bar = event.target.closest('rect[data-number]');
    if (bar) selectNumber(bar.dataset.number);
  });
  chart.addEventListener('pointerdown', (event) => {
    const bar = event.target.closest('rect[data-number]');
    if (bar) selectNumber(bar.dataset.number);
  });
  grid.addEventListener('focusin', (event) => {
    if (event.target.matches('.freq-tile')) selectNumber(event.target.dataset.number);
  });
  grid.addEventListener('click', (event) => {
    const tile = event.target.closest('.freq-tile');
    if (tile) selectNumber(tile.dataset.number);
  });
}
