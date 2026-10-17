// 회차별 당첨 결과 상세 (/results/<round>/) 렌더러
import { icon } from '../shared/icons.js';
import { renderLayout } from '../shared/layout.js';
import { escapeHtml, formatDate, formatDateTimeKst, formatMoney, formatWinners, renderBalls } from '../shared/format.js';
import { renderDataStatus } from '../shared/data-status.js';

export function renderResultDetailPage({ siteConfig, site = {}, draw, meta, updateStatus = null, prevRound, nextRound, isFixture = false, winningShopsPath = null }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const round = draw.round;

  // 1~5등 당첨 정보 표
  const defaultRanks = [1, 2, 3, 4, 5];
  const prizeRows = defaultRanks.map((rank) => {
    const p = draw.prizes?.find((item) => item.rank === rank);
    const amountStr = p ? formatMoney(p.amount) : '미확보';
    const winnersStr = p ? formatWinners(p.winners) : '미확보';

    let criteriaText = '';
    if (rank === 1) criteriaText = '6개 번호 일치';
    else if (rank === 2) criteriaText = '5개 번호 + 보너스 번호 일치';
    else if (rank === 3) criteriaText = '5개 번호 일치';
    else if (rank === 4) criteriaText = '4개 번호 일치 (고정 50,000원)';
    else if (rank === 5) criteriaText = '3개 번호 일치 (고정 5,000원)';

    return `
      <tr>
        <td class="font-bold text-center">
          <span class="badge ${rank === 1 ? 'badge-gold' : rank === 2 ? 'badge-silver' : 'badge-gray'}">${rank}등</span>
        </td>
        <td>${criteriaText}</td>
        <td class="font-bold text-right">${amountStr}</td>
        <td class="text-right">${winnersStr}</td>
      </tr>
    `.trim();
  }).join('\n');

  // 이전/다음 회차 네비게이션
  const prevBtn = prevRound
    ? `<a href="/results/${prevRound}/" class="btn btn-secondary btn-sm">&larr; ${prevRound}회 결과</a>`
    : '<span class="btn btn-secondary btn-sm disabled opacity-50 cursor-not-allowed">&larr; 이전 회차 없음</span>';

  const nextBtn = nextRound
    ? `<a href="/results/${nextRound}/" class="btn btn-secondary btn-sm">${nextRound}회 결과 &rarr;</a>`
    : '<span class="btn btn-secondary btn-sm disabled opacity-50 cursor-not-allowed">다음 회차 없음 &rarr;</span>';

  const content = `
    <article class="result-detail-container max-w-3xl mx-auto">
      ${renderDataStatus({ meta, updateStatus, hasData: true })}
      <nav class="flex justify-between items-center mb-6" aria-label="회차 이동">
        <div>${prevBtn}</div>
        <div>
          <a href="/results/" class="btn btn-secondary btn-sm">전체 결과 목록</a>
        </div>
        <div>${nextBtn}</div>
      </nav>

      <section class="card text-center mb-8">
        <header class="mb-4">
          <h1 class="text-3xl font-black mb-1">로또 6/45 ${round}회 당첨 결과</h1>
          <p class="text-slate-500">추첨일자: <strong>${formatDate(draw.date)}</strong></p>
        </header>

        <div class="my-8">
          <p class="text-sm text-slate-500 font-bold mb-3">당첨 번호 6개 + 보너스 번호</p>
          <div class="flex justify-center">
            ${renderBalls(draw.numbers, draw.bonus, { size: 'lg' })}
          </div>
        </div>

        ${winningShopsPath ? `<p class="mb-4"><a class="btn btn-secondary btn-sm" href="${winningShopsPath}">${round}회 1등 배출 판매점 보기</a></p>` : ''}
        <div class="text-xs text-slate-400 mt-4">
          <span>데이터 출처: ${escapeHtml(draw.source || '공식 기록')}</span> &bull;
          <span>확인 시각: ${formatDateTimeKst(draw.checkedAt)}</span>
        </div>
      </section>

      <section class="card mb-8">
        <div class="section-header">
          <h2 class="section-title">등수별 당첨금 및 당첨 인원</h2>
          <p class="section-desc">등수별 1인당 당첨금과 전국 당첨 인원 안내입니다.</p>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col" class="text-center" style="width: 80px;">등수</th>
                <th scope="col">당첨 기준</th>
                <th scope="col" class="text-right">1인당 당첨금</th>
                <th scope="col" class="text-right">당첨 인원</th>
              </tr>
            </thead>
            <tbody>
              ${prizeRows}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card bg-slate-50 border-slate-200">
        <h3 class="font-bold text-slate-700 mb-2">${icon('info')} 당첨금 수령 안내</h3>
        <ul class="text-sm text-slate-600 space-y-1 list-disc list-inside">
          <li>1등 당첨금은 농협은행 본점에서만 수령 가능합니다. (신분증 및 복권 원본 지참)</li>
          <li>2등, 3등 당첨금은 농협은행 각 지점에서 수령할 수 있습니다.</li>
          <li>4등, 5등 당첨금은 일반 로또 판매점 및 농협은행 각 지점에서 수령할 수 있습니다.</li>
          <li>당첨금 지급 기한은 해당 회차 지급개시일로부터 1년 이내입니다.</li>
        </ul>
      </section>
    </article>
  `;

  return renderLayout({
    site,
    title: `로또 ${round}회 당첨 결과 - 마이로또맵`,
    description: `로또 6/45 ${round}회 당첨 번호, 보너스 번호, 등수별 당첨금 및 당첨자 수 안내입니다.`,
    canonicalUrl: `${siteUrl}/results/${round}/`,
    currentPath: `/results/${round}/`,
    isFixture,
    content,
  });
}
