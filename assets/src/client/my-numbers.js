// 내 번호 페이지 클라이언트 스크립트
import { icon } from '../shared/icons.js';
import { validateTicket } from '../lotto/generate.js';
import { rankTicket } from '../lotto/rank.js';
import { createMyNumbersStore } from '../storage/my-numbers.js';
import { renderBalls, escapeHtml } from '../shared/format.js';

function parseNumbers(inputStr) {
  if (!inputStr || !inputStr.trim()) return [];
  const parts = inputStr.trim().split(/[\s,]+/);
  const nums = [];
  for (const part of parts) {
    if (!part) continue;
    const n = Number(part);
    nums.push(n); // 잘못된 토큰을 조용히 무시하고 저장하지 않는다.
  }
  return nums;
}

document.addEventListener('DOMContentLoaded', async () => {
  let storage;
  try { storage = window.localStorage; } catch { /* 아래 저장 오류 안내로 연결한다. */ }
  const store = createMyNumbersStore(storage);
  const ticketsContainer = document.getElementById('tickets-list-container');
  const storageErrorAlert = document.getElementById('storage-error-alert');
  const storageErrorMessage = document.getElementById('storage-error-message');
  const addForm = document.getElementById('add-ticket-form');
  const roundInput = document.getElementById('manual-round-input');
  const numbersInput = document.getElementById('manual-numbers-input');
  const manualErrorAlert = document.getElementById('manual-error-alert');
  const manualErrorMessage = document.getElementById('manual-error-message');
  const btnClearAll = document.getElementById('btn-clear-all');

  let draws = [];
  try {
    const res = await fetch('/assets/data/draws.json');
    if (res.ok) {
      const data = await res.json();
      draws = data.draws || [];
    }
  } catch (e) {
    console.warn('회차 데이터 불러오기 실패:', e);
  }

  function showStorageError(msg) {
    storageErrorMessage.textContent = msg;
    storageErrorAlert.style.display = 'flex';
  }

  function renderTickets() {
    storageErrorAlert.style.display = 'none';
    const listRes = store.list();
    if (!listRes.ok) {
      showStorageError(listRes.error);
      ticketsContainer.innerHTML = '<div class="text-center py-6 text-red-500">저장소 오류로 번호를 불러오지 못했습니다.</div>';
      return;
    }

    const items = listRes.items || [];
    if (items.length === 0) {
      ticketsContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">${icon('bookmark')}</span>
          <h3>저장된 번호가 없습니다.</h3>
          <p>위에서 번호를 직접 등록하거나 새 번호를 생성해 보세요.</p>
          <a href="/generator/" class="btn btn-primary btn-sm">번호 생성기에서 번호 뽑기</a>
        </div>
      `;
      return;
    }

    // 최신 저장순 또는 회차순 정렬 (회차 내림차순, 동일 회차는 저장시간 내림차순)
    const sorted = [...items].sort((a, b) => {
      if (b.round !== a.round) return b.round - a.round;
      return (b.savedAt || '').localeCompare(a.savedAt || '');
    });

    ticketsContainer.innerHTML = sorted.map((ticket) => {
      const draw = draws.find((d) => d.round === ticket.round);
      const rankRes = rankTicket(ticket.numbers, draw);

      let statusBadge = '';
      if (rankRes.status === 'pending') {
        statusBadge = '<span class="badge badge-gray">결과 대기 · 해당 회차 결과 미확보</span>';
      } else if (rankRes.rank === 1) {
        statusBadge = `<span class="badge badge-gold">${icon('trophy')} 1등 당첨 (6개 일치)</span>`;
      } else if (rankRes.rank === 2) {
        statusBadge = `<span class="badge badge-gold">${icon('trophy')} 2등 당첨 (5개+보너스 일치)</span>`;
      } else if (rankRes.rank === 3) {
        statusBadge = '<span class="badge badge-silver">3등 당첨 (5개 일치)</span>';
      } else if (rankRes.rank === 4) {
        statusBadge = '<span class="badge badge-silver">4등 당첨 (4개 일치)</span>';
      } else if (rankRes.rank === 5) {
        statusBadge = '<span class="badge badge-silver">5등 당첨 (3개 일치)</span>';
      } else {
        statusBadge = `<span class="badge badge-gray">낙첨 (${rankRes.matched}개 일치)</span>`;
      }

      return `
        <div class="saved-ticket flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 border border-slate-200 rounded-xl gap-3" data-id="${escapeHtml(ticket.id)}">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-blue-700">${ticket.round}회차</span>
              ${statusBadge}
            </div>
            <div>
              ${renderBalls(ticket.numbers, null, { size: 'sm' })}
            </div>
            ${rankRes.status === 'done' ? `<p class="ticket-match-summary">일치한 본번호: ${ticket.numbers.filter(n => draw.numbers.includes(n)).join(', ') || '없음'}${rankRes.bonusMatched ? ` · 보너스 ${draw.bonus} 일치` : ''}</p><a class="content-link guide-inline-link" href="/results/${ticket.round}/">${ticket.round}회 공식 결과 보기</a>` : '<p class="ticket-match-summary">결과가 업데이트된 뒤 다시 방문하면 이 회차와 비교됩니다.</p>'}
          </div>
          <div class="flex items-center gap-2 self-end sm:self-center">
            <button type="button" class="btn btn-secondary btn-sm btn-delete-ticket text-red-500" data-id="${escapeHtml(ticket.id)}" title="해당 번호 삭제">삭제</button>
          </div>
        </div>
      `.trim();
    }).join('\n');

    // 개별 삭제 이벤트 연결
    document.querySelectorAll('.btn-delete-ticket').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const res = store.remove(id);
        if (res.ok) {
          renderTickets();
        } else {
          showStorageError(res.error);
        }
      });
    });
  }

  // 직접 등록
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    manualErrorAlert.style.display = 'none';

    const round = parseInt(roundInput.value, 10);
    if (!round || round < 1) {
      manualErrorMessage.textContent = '올바른 회차를 입력해 주세요.';
      manualErrorAlert.style.display = 'flex';
      return;
    }

    const numbers = parseNumbers(numbersInput.value);
    const validateErr = validateTicket(numbers);
    if (validateErr) {
      manualErrorMessage.textContent = validateErr;
      manualErrorAlert.style.display = 'flex';
      return;
    }

    const addRes = store.add({ round, numbers });
    if (!addRes.ok) {
      manualErrorMessage.textContent = addRes.error;
      manualErrorAlert.style.display = 'flex';
      return;
    }

    numbersInput.value = '';
    renderTickets();
  });

  // 전체 삭제
  btnClearAll.addEventListener('click', () => {
    if (confirm('저장된 모든 번호를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      const res = store.clear();
      if (!res.ok) {
        showStorageError(res.error);
      } else {
        renderTickets();
      }
    }
  });

  renderTickets();
});
