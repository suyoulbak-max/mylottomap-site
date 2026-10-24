// 다음 회차 상태 문구 갱신과 홈 헤더 티커 순환(Design.md 20장). 추가 네트워크 요청 없음.
import { nextDrawStatus, jackpotLine, jackpotParts, partsHtml } from '../shared/next-draw.js';

const ROTATE_MS = 5000;
const REFRESH_MS = 30000;

let data = null;
try { data = JSON.parse(document.getElementById('next-draw-data')?.textContent || 'null'); } catch { data = null; }

const ticker = document.querySelector('[data-ticker]');
const visibleItems = () => (ticker ? [...ticker.querySelectorAll('.ticker-item')].filter(item => !item.hidden) : []);

function activate(item) {
  for (const li of ticker.querySelectorAll('.ticker-item')) li.classList.toggle('is-active', li === item);
}

function refresh() {
  const status = nextDrawStatus(data, data?.latestRound ?? null);
  if (!status) return;
  for (const el of document.querySelectorAll('[data-next-draw-status]')) {
    el.innerHTML = partsHtml(status.parts);
    const li = el.closest('.ticker-item');
    if (li) li.title = `${li.querySelector('.ticker-tag')?.textContent ?? ''} ${status.text}`.trim();
    el.dataset.state = status.state;
  }
  for (const el of document.querySelectorAll('[data-next-draw-jackpot]')) el.hidden = !status.showJackpot;
  if (data.jackpot) {
    const now = Date.now();
    for (const el of document.querySelectorAll('[data-next-draw-jackpot-line]')) {
      el.innerHTML = partsHtml(jackpotParts(data, now));
      const li = el.closest('.ticker-item');
      if (li) li.title = jackpotLine(data, now);
    }
  }
  // 숨긴 문구가 보이던 중이면 첫 문구로 돌린다.
  if (ticker && !ticker.querySelector('.ticker-item.is-active:not([hidden])') && visibleItems()[0]) activate(visibleItems()[0]);
}

if (data) {
  refresh();
  setInterval(refresh, REFRESH_MS);
}

if (ticker) {
  const toggle = ticker.querySelector('.ticker-toggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  let holding = false; // 마우스·키보드 포커스가 티커 위에 있음

  const syncToggle = () => {
    toggle.hidden = reduceMotion.matches || visibleItems().length < 2;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? '티커 재생' : '티커 멈춤');
  };
  toggle.addEventListener('click', () => { paused = !paused; syncToggle(); });
  ticker.addEventListener('mouseenter', () => { holding = true; });
  ticker.addEventListener('mouseleave', () => { holding = false; });
  ticker.addEventListener('focusin', () => { holding = true; });
  ticker.addEventListener('focusout', () => { holding = false; });
  reduceMotion.addEventListener?.('change', syncToggle);
  syncToggle();

  setInterval(() => {
    syncToggle();
    if (paused || holding || reduceMotion.matches || document.hidden) return;
    const items = visibleItems();
    if (items.length < 2) return;
    const current = items.findIndex(item => item.classList.contains('is-active'));
    const leaving = items[current];
    if (leaving) {
      leaving.classList.add('is-leaving');
      setTimeout(() => leaving.classList.remove('is-leaving'), 450);
    }
    activate(items[(current + 1) % items.length]);
  }, ROTATE_MS);
}
