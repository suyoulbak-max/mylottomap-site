// 당첨 결과 목록 (/results/) 렌더러
import { renderLayout } from '../shared/layout.js';
import { escapeHtml, formatDate, formatMoney, formatWinners, renderBalls } from '../shared/format.js';
import { renderDataStatus } from '../shared/data-status.js';
import { icon } from '../shared/icons.js';
import { scheduledParts, partsHtml, drawDateText, jackpotText, nextDrawBoot, latestDrawOf } from '../shared/next-draw.js';

// 다음 회차 카드(Design.md 20장). 상태 문구는 최초 HTML에 시각과 무관한 문구로 넣고 브라우저가 갱신한다.
export function renderNextDrawCard(nextDraw, latestDraw) {
  const stale = !nextDraw || (latestDraw && latestDraw.round >= nextDraw.round);
  if (stale) {
    return `
      <section class="card next-draw-card" aria-labelledby="next-draw-title">
        <span class="eyebrow">다음 회차</span>
        <h2 id="next-draw-title" class="text-2xl font-black">다음 회차 정보 업데이트 대기 중</h2>
        <p class="next-draw-note">동행복권 공식 화면에서 다음 회차 정보를 확인하면 이곳에 표시합니다.</p>
      </section>`;
  }
  const { round, drawDate, salesCloseAt, drawAt, jackpot, meta } = nextDraw;
  return `
      <section class="card next-draw-card" aria-labelledby="next-draw-title">
        <span class="eyebrow">다음 회차</span>
        <h2 id="next-draw-title" class="text-2xl font-black">제${round}회 로또 6/45</h2>
        <p class="next-draw-status" data-next-draw-status>${partsHtml(scheduledParts(nextDraw))}</p>
        <dl class="next-draw-facts">
          <div><dt>추첨</dt><dd>${drawDateText(drawDate)} ${drawAt.slice(11, 16)}경</dd></div>
          <div><dt>판매 마감</dt><dd>${drawDateText(salesCloseAt.slice(0, 10))} ${salesCloseAt.slice(11, 16)} <span>인터넷 기준, 판매점마다 다를 수 있음</span></dd></div>
          ${jackpot ? `<div data-next-draw-jackpot><dt>1등 예상 총 당첨금</dt><dd>${jackpotText(jackpot.amount)} <span>${jackpot.asOf.slice(0, 10)} ${jackpot.asOf.slice(11, 16)} 기준 · 판매 중 바뀌는 예상치</span></dd></div>` : ''}
        </dl>
        <p class="next-draw-note">출처: <a class="content-link" href="${escapeHtml(meta.sourceUrl)}" rel="noopener" target="_blank">동행복권 로또6/45 소개 화면</a> · 확인 ${meta.checkedAt.slice(0, 10)} ${meta.checkedAt.slice(11, 16)}. 추첨 시각은 방송 사정에 따라 바뀔 수 있습니다.</p>
      </section>`;
}

export function renderResultsPage({ siteConfig, site = {}, drawsData, updateStatus = null, isFixture = false, nextDraw = null, year = null }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const rawDraws = drawsData?.draws || [];
  // 최신 회차 순 (내림차순) 정렬
  const allDraws = [...rawDraws].sort((a, b) => b.round - a.round);
  const years = [...new Set(allDraws.map((d) => Number(d.date.slice(0, 4))))].sort((a, b) => b - a);
  const draws = year === null ? allDraws.slice(0, 20) : allDraws.filter((d) => Number(d.date.slice(0, 4)) === year);
  const currentPath = year === null ? '/results/' : `/results/${year}/`;
  const heading = year === null ? '로또 6/45 당첨 결과' : `${year}년 로또 6/45 당첨 결과`;
  const description = year === null
    ? '로또 최신 당첨 결과와 최근 20회 기록을 확인하고, 회차 번호 또는 추첨 연도로 과거 당첨 번호·당첨금을 찾아보세요.'
    : `${year}년 추첨한 로또 6/45 중 확보된 ${draws.length}회차의 당첨 번호·보너스·1인당 1등 당첨금·인원을 최신순으로 확인하세요.`;
  const yearIndex = years.indexOf(year);
  const newerYear = yearIndex > 0 ? years[yearIndex - 1] : null;
  const olderYear = yearIndex >= 0 ? years[yearIndex + 1] : null;
  const navigation = allDraws.length ? `
      <section class="card mb-8" aria-labelledby="results-navigation-title">
        <h2 id="results-navigation-title" class="section-title mb-3">회차·연도로 찾기</h2>
        <form id="result-round-form" class="mb-4" hidden>
          <div class="results-jump-fields">
            <div class="form-group">
              <label class="form-label" for="result-round-input">회차 번호</label>
              <input id="result-round-input" class="form-input" type="text" inputmode="numeric" required aria-describedby="result-round-help result-round-error" placeholder="예: ${allDraws[0].round}">
            </div>
            <button class="btn btn-primary" type="submit">회차 바로가기</button>
          </div>
          <p id="result-round-help" class="text-sm mt-2">결과가 확보된 회차의 번호를 입력하세요. 준비 중인 회차는 이동하지 않습니다.</p>
          <p id="result-round-error" class="error-text" role="status" aria-live="polite"></p>
        </form>
        <nav aria-label="추첨 연도별 결과"><ul class="results-year-links">
          <li><a class="filter-chip${year === null ? ' active' : ''}" href="/results/"${year === null ? ' aria-current="page"' : ''}>최근 20회</a></li>
          ${years.map((y) => `<li><a class="filter-chip${year === y ? ' active' : ''}" href="/results/${y}/"${year === y ? ' aria-current="page"' : ''}>${y}년</a></li>`).join('')}
        </ul></nav>
        ${year === null ? '' : `<nav class="results-year-links mt-4" aria-label="이전·다음 연도">
          ${olderYear ? `<a class="btn btn-secondary btn-sm" href="/results/${olderYear}/">&larr; ${olderYear}년</a>` : ''}
          <a class="btn btn-secondary btn-sm" href="/results/">최신 결과로 돌아가기</a>
          ${newerYear ? `<a class="btn btn-secondary btn-sm" href="/results/${newerYear}/">${newerYear}년 &rarr;</a>` : ''}
        </nav>`}
      </section>` : '';

  let bodyContent = '';

  if (draws.length === 0) {
    bodyContent = `
      <div class="card text-center py-12">
        <div class="empty-state-icon" aria-hidden="true">${icon('trophy')}</div>
        <h2 class="text-xl font-bold mb-2">검증된 당첨 결과 데이터를 준비 중입니다.</h2>
        <p class="text-slate-500">동행복권 공식 데이터 검증이 완료된 회차부터 순차적으로 제공됩니다.</p>
      </div>
    `;
  } else {
    const latest = draws[0];
    const firstPrize = latest.prizes?.find((p) => p.rank === 1);
    const firstPrizeAmount = firstPrize ? formatMoney(firstPrize.amount) : '미확보';
    const firstPrizeWinners = firstPrize ? formatWinners(firstPrize.winners) : '미확보';

    const latestCard = `
      <section class="card latest-result">
        <div class="card-heading">
          <div>
            <span class="eyebrow">${year === null ? '최신 회차' : `${year}년 확보된 최근 회차`}</span>
            <h2 class="text-2xl font-black">${latest.round}회 당첨 결과</h2>
            <p class="text-sm text-slate-500">추첨일: ${formatDate(latest.date)}</p>
          </div>
          <div>
            <a href="/results/${latest.round}/" class="btn btn-primary btn-sm">회차 상세 보기 &rarr;</a>
          </div>
        </div>

        <div class="latest-numbers">
          <p class="metric-label">당첨 번호 <span>· 마지막 공은 보너스</span></p>
          ${renderBalls(latest.numbers, latest.bonus, { size: 'lg' })}
        </div>

        <div class="prize-summary">
          <div>
            <p class="metric-label">1등 당첨금 <span>1인당</span></p>
            <p class="prize-amount">${firstPrizeAmount}</p>
          </div>
          <div>
            <p class="metric-label">1등 당첨 인원</p>
            <p class="prize-winners">${firstPrizeWinners}</p>
          </div>
        </div>
      </section>
    `;

    const rows = draws.map((d) => {
      const p1 = d.prizes?.find((p) => p.rank === 1);
      const prize1Str = p1 ? formatMoney(p1.amount) : '미확보';
      const winners1Str = p1 ? formatWinners(p1.winners) : '미확보';

      return `
        <tr role="row">
          <td class="result-round" role="cell">
            <a href="/results/${d.round}/" class="content-link font-bold">${d.round}회</a>
          </td>
          <td class="result-date" role="cell"><span class="mobile-label">추첨일 </span>${formatDate(d.date)}</td>
          <td class="result-balls" role="cell">
            <span class="mobile-label">당첨 번호 · 마지막 공은 보너스</span>
            ${renderBalls(d.numbers, d.bonus, { size: 'sm' })}
          </td>
          <td class="result-prize" role="cell"><span class="mobile-label">1등 당첨금 · 1인당</span>${prize1Str}</td>
          <td class="result-winners" role="cell"><span class="mobile-label">1등 인원</span>${winners1Str}</td>
          <td class="result-link" role="cell">
            <a href="/results/${d.round}/" class="table-link" aria-label="${d.round}회 상세 보기">상세 &rarr;</a>
          </td>
        </tr>
      `.trim();
    }).join('\n');

    const tableSection = `
      <section class="card">
        <div class="section-header">
          <h2 class="section-title">${icon('trophy')} ${year === null ? '최근 20회 당첨 결과' : `${year}년 회차별 당첨 결과`}</h2>
          <p class="section-desc">${year === null ? `전체 확보 ${allDraws.length}회 중 최신 ${draws.length}회를 표시합니다. 이전 기록은 연도별 목록에서 확인하세요.` : `추첨일이 ${year}년인 확보된 ${draws.length}회 전체입니다. 미확보 회차는 포함하지 않습니다.`}</p>
        </div>

        <div class="table-wrap">
          <table class="data-table results-table" role="table">
            <caption class="sr-only">회차별 추첨일, 당첨 번호와 보너스, 1인당 1등 당첨금 및 인원</caption>
            <thead>
              <tr>
                <th scope="col">회차</th>
                <th scope="col">추첨일</th>
                <th scope="col">당첨 번호 (보너스)</th>
                <th scope="col" class="text-right">1등 당첨금<span class="table-subtitle">1인당</span></th>
                <th scope="col">1등 인원</th>
                <th scope="col">상세</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              ${rows}
            </tbody>
          </table>
        </div>
      </section>
    `;

    bodyContent = `${latestCard}\n${navigation}\n${tableSection}`;
  }

  const content = `
    <div class="results-page-container content-page themed-page">
      <div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('trophy')}</span>
        <div>
        <h1 class="text-3xl font-black mb-2">${heading}</h1>
        <p class="text-slate-500">동행복권 공식 검증 데이터를 기반으로 회차별 당첨 번호와 당첨금을 제공합니다.</p>
        </div>
      </div>

      ${renderDataStatus({ meta: drawsData?.meta, updateStatus, hasData: draws.length > 0, compact: true })}
      ${isFixture || year !== null ? '' : renderNextDrawCard(nextDraw, latestDrawOf(drawsData))}
      ${bodyContent}
    </div>
  `;

  return renderLayout({
    site,
    title: `${heading} - 마이로또맵`,
    description,
    canonicalUrl: `${siteUrl}${currentPath}`,
    currentPath,
    isFixture,
    content,
    scriptExtra: `${allDraws.length ? `<script id="results-rounds" type="application/json">${JSON.stringify(allDraws.map((d) => d.round)).replace(/</g, '\\u003c')}</script><script type="module" src="/assets/client/results.js"></script>` : ''}${nextDraw && !isFixture && year === null ? `${nextDrawBoot(nextDraw, latestDrawOf(drawsData)?.round ?? null)}<script type="module" src="/assets/client/next-draw.js"></script>` : ''}`,
  });
}
