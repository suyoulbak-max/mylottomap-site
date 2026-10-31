// 회차별 당첨 결과 상세 (/results/<round>/) 렌더러
import { icon } from '../shared/icons.js';
import { renderLayout } from '../shared/layout.js';
import { escapeHtml, formatDate, formatDateTimeKst, formatMoney, formatWinners, renderBalls } from '../shared/format.js';
import { renderDataStatus } from '../shared/data-status.js';
import { computeStats } from '../lotto/stats.js';

function renderDrawAnalysis(draw, draws) {
  const numbers = [...draw.numbers].sort((a, b) => a - b);
  const odd = numbers.filter((n) => n % 2).length;
  const sum = numbers.reduce((total, n) => total + n, 0);
  const pairs = numbers.slice(1).flatMap((n, i) => n === numbers[i] + 1 ? [`${numbers[i]}·${n}`] : []);
  const previous = draws.find((d) => d.round === draw.round - 1);
  const overlap = previous ? numbers.filter((n) => previous.numbers.includes(n)) : [];
  const firstPrize = draw.prizes?.find((p) => p.rank === 1);
  const winnersSummary = firstPrize?.winners == null
    ? '1등 당첨 게임 수는 아직 확보하지 못했습니다.'
    : `1등 당첨은 ${firstPrize.winners.toLocaleString('ko-KR')}게임입니다.`;
  const prizeSummary = firstPrize?.winners === 0
    ? '이번 회차에는 1등 당첨 게임이 없습니다.'
    : firstPrize?.amount == null
      ? '1게임당 세전 당첨금은 아직 확보하지 못했습니다.'
      : `1게임당 세전 당첨금은 ${formatMoney(firstPrize.amount)}입니다.`;
  const history = draws.filter((d) => d.round < draw.round);
  const stats = computeStats(history, { last: 50 });
  const bucket = stats.sumBuckets.find((b) => sum >= b.min && sum <= b.max);
  const comparison = stats.range.count ? `
        <p class="section-desc mb-3">비교 자료: ${stats.range.from}~${stats.range.to}회 중 확보된 ${stats.range.count}회. 이 회차와 이후 결과는 제외했습니다.</p>
        <div class="table-wrap"><table class="data-table">
          <caption class="sr-only">${draw.round}회 번호 구성과 이전 기록 비교</caption>
          <thead><tr><th scope="col">비교 항목</th><th scope="col">${draw.round}회</th><th scope="col">이전 ${stats.range.count}회에서 같은 유형</th></tr></thead>
          <tbody>
            <tr><th scope="row">홀수 : 짝수</th><td>${odd} : ${6 - odd}</td><td>${stats.oddEven[odd].count}회 / ${stats.range.count}회</td></tr>
            <tr><th scope="row">본번호 합계</th><td>${sum} (${bucket.min}~${bucket.max} 구간)</td><td>${bucket.count}회 / ${stats.range.count}회</td></tr>
          </tbody>
        </table></div>
        <p class="text-sm mt-4">같은 유형은 번호 6개가 같다는 뜻이 아닙니다. 홀짝은 홀수 개수, 합계는 표에 적힌 구간을 기준으로 셌습니다. 확보된 이전 기록이 50회보다 적으면 있는 기록만 비교합니다.</p>`
    : '<p class="section-desc">확보된 이전 회차가 없어 과거 기록과의 비교는 제공하지 않습니다.</p>';
  return `<section class="card mb-8" aria-labelledby="draw-summary-title">
        <div class="section-header"><h2 id="draw-summary-title" class="section-title">${draw.round}회 한눈에 보기</h2></div>
        <p class="mb-3">${winnersSummary} ${prizeSummary}</p>
        <p class="mb-3">본번호 6개는 홀수 ${odd}개·짝수 ${6 - odd}개이며, 합계는 ${sum}입니다. 보너스 번호는 제외했습니다.</p>
        <p class="mb-3">${previous ? `직전 ${previous.round}회 본번호와 겹친 번호는 ${overlap.length ? `${overlap.join(', ')} (${overlap.length}개)입니다` : '없습니다'}.` : `직전 ${draw.round - 1}회 기록이 없어 겹친 번호는 비교하지 않았습니다.`}</p>
        <p class="text-sm">당첨 게임 수는 실제 당첨자 수와 다를 수 있습니다. 아래 비교는 과거 결과를 설명하며 다음 회차의 당첨 가능성을 예측하지 않습니다.</p>
      </section>
      <section class="card mb-8" aria-labelledby="draw-analysis-title">
        <div class="section-header"><h2 id="draw-analysis-title" class="section-title">${draw.round}회 번호 구성과 이전 기록 비교</h2>
        <p class="section-desc">마이로또맵이 공식 본번호 6개로 계산한 결과입니다. 보너스 ${draw.bonus}번은 계산에서 제외합니다.</p></div>
        <p class="mb-3">본번호 합계는 <strong>${sum}</strong>, 홀수는 <strong>${odd}개</strong>, 짝수는 <strong>${6 - odd}개</strong>입니다. 연속한 번호 쌍은 ${pairs.length ? `${pairs.join(', ')} (${pairs.length}쌍)입니다` : '없습니다'}.</p>
        ${comparison}
        <p class="text-sm mt-4">이 비교는 이미 나온 결과를 읽는 방법입니다. 과거에 흔했던 유형이나 직전 회차와 겹친 번호가 다음 추첨에서 더 유리해지는 것은 아닙니다. 연속 번호 3개는 인접한 쌍 2개로 셉니다.</p>
        <p class="mt-4"><a class="content-link" href="/guides/reading-draw-1246/">실제 회차로 비교 표 읽어보기</a> · <a class="content-link" href="/stats/">기간을 바꿔 번호 통계 보기</a></p>
      </section>`;
}

export function renderResultDetailPage({ siteConfig, site = {}, draw, draws = [], meta, updateStatus = null, prevRound, nextRound, isFixture = false, winningShopsPath = null }) {
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

      ${renderDrawAnalysis(draw, draws)}

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
