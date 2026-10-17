// 번호 통계 (/stats/) 렌더러
import { icon } from '../shared/icons.js';
import { renderLayout } from '../shared/layout.js';
import { renderBall, getBallColorClass } from '../shared/format.js';
import { renderDataStatus } from '../shared/data-status.js';
import { computeStats, theoreticalOddEven, theoreticalSumBuckets, expectedNumberCount } from '../lotto/stats.js';
import { TOTAL_COMBINATIONS } from '../lotto/generate.js';

const TOTAL_TEXT = TOTAL_COMBINATIONS.toLocaleString('ko-KR');
const pct = (count, total) => (total > 0 ? (count / total) * 100 : 0);

/** 실제 비율 막대 + 전체 조합 비율 눈금. scale은 표 안 가장 큰 비율(막대 끝). 수치는 같은 행 텍스트에 있다. */
function distBar(actual, theory, scale) {
  const w = (v) => `${((v / scale) * 100).toFixed(1)}%`;
  return `<span class="dist-bar" aria-hidden="true"><span class="dist-actual" style="width:${w(actual)}"></span><span class="dist-theory" style="left:${w(theory)}"></span></span>`;
}

/** 번호별 출현 횟수 막대 그래프. 글자는 SVG 밖 HTML에 두어 좁은 화면에서도 읽힌다. */
function renderFrequencyChart(numbers, drawCount) {
  const exp = expectedNumberCount(drawCount);
  const maxY = Math.max(1, Math.ceil(Math.max(exp.high, ...numbers.map((x) => x.count))));
  const W = 450;
  const H = 160;
  const bw = W / numbers.length;
  const y = (v) => H - (v / maxY) * H;
  const bars = numbers.map(({ n, count }, i) => {
    const top = y(count);
    return `<rect class="${getBallColorClass(n)}" x="${(i * bw + 1).toFixed(2)}" y="${top.toFixed(2)}" width="${(bw - 2).toFixed(2)}" height="${(H - top).toFixed(2)}"></rect>`;
  }).join('');
  const ticks = [1, 10, 20, 30, 40, 45]
    .map((n) => `<span style="left:${(((n - 0.5) / numbers.length) * 100).toFixed(2)}%">${n}</span>`).join('');
  const mean = exp.mean.toFixed(1);
  const range = `${exp.low.toFixed(1)}~${exp.high.toFixed(1)}회`;
  return `
        <figure class="freq-chart">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="번호 1~45의 전체 ${drawCount}회 출현 횟수 막대 그래프. 기대 출현 횟수 ${mean}회, 우연 변동 범위 약 ${range}. 정확한 수치는 아래 표에 있습니다.">
            <rect class="freq-band" x="0" y="${y(exp.high).toFixed(2)}" width="${W}" height="${(y(exp.low) - y(exp.high)).toFixed(2)}"></rect>
            ${bars}
            <line class="freq-mean" x1="0" x2="${W}" y1="${y(exp.mean).toFixed(2)}" y2="${y(exp.mean).toFixed(2)}" vector-effect="non-scaling-stroke"></line>
          </svg>
          <div class="freq-axis" aria-hidden="true">${ticks}</div>
          <figcaption class="freq-legend">
            <span><i class="legend-mean" aria-hidden="true"></i>기대 출현 횟수 ${mean}회 (${drawCount}회 × 6/45)</span>
            <span><i class="legend-band" aria-hidden="true"></i>우연 변동 범위 약 ${range} (평균 ± 2 표준편차)</span>
            <span>그래프 세로 최대 ${maxY}회</span>
          </figcaption>
        </figure>`;
}

export function renderStatsPage({ siteConfig, site = {}, drawsData, updateStatus = null, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const draws = drawsData?.draws || [];

  let bodyContent = '';

  if (draws.length === 0) {
    bodyContent = `
      <div class="card text-center py-12">
        <div class="text-4xl mb-3" aria-hidden="true">${icon('chart')}</div>
        <h2 class="text-xl font-bold mb-2">통계를 계산할 회차 데이터가 없습니다.</h2>
        <p class="text-slate-500">검증된 회차 데이터가 확보된 후 자동으로 통계가 산출됩니다.</p>
      </div>
    `;
  } else {
    // computeStats 호출 (전체, 최근 100회, 최근 50회, 최근 10회)
    const statsAll = computeStats(draws, { last: null });
    const stats100 = computeStats(draws, { last: 100 });
    const stats50 = computeStats(draws, { last: 50 });
    const stats10 = computeStats(draws, { last: 10 });

    const totalCount = statsAll.range.count;
    const rangeText = totalCount > 0
      ? `${statsAll.range.from}회 ~ ${statsAll.range.to}회 (총 ${totalCount}회차 분석)`
      : '분석 대상 없음';

    // 번호별 출현 빈도 및 연속 미출현(gap) 행 렌더링
    const numRows = statsAll.numbers.map((item, index) => {
      const n = item.n;
      const countAll = item.count;
      const count100 = stats100.numbers[index]?.count ?? 0;
      const count50 = stats50.numbers[index]?.count ?? 0;
      const count10 = stats10.numbers[index]?.count ?? 0;

      const gap = item.gap;
      const gapText = gap === null
        ? '<span class="text-slate-400">기간 내 미출현</span>'
        : gap === 0
          ? '<span class="text-primary font-bold">최근 출현 (0회)</span>'
          : `${gap}회 연속 미출현`;

      return `
        <tr role="row">
          <td class="stat-number text-center" role="cell">
            ${renderBall(n, { size: 'sm' })}
          </td>
          <td class="stat-count stat-count-all" role="cell"><span class="mobile-label">전체</span><strong>${countAll}회</strong><meter min="0" max="${totalCount}" value="${countAll}" aria-label="${n}번 전체 ${totalCount}회 중 ${countAll}회 출현">${countAll} / ${totalCount}</meter></td>
          <td class="stat-count" role="cell"><span class="mobile-label">최근 100회</span>${count100}회</td>
          <td class="stat-count" role="cell"><span class="mobile-label">최근 50회</span>${count50}회</td>
          <td class="stat-count" role="cell"><span class="mobile-label">최근 10회</span>${count10}회</td>
          <td class="stat-gap" role="cell"><span class="mobile-label">미출현 기간</span>${gapText}</td>
        </tr>
      `.trim();
    }).join('\n');

    // 홀짝·합계 행: 실제 비율과 전체 조합 비율(이론값)을 나란히 둔다.
    const distRows = (rows, theory, label) => {
      const shares = rows.map((r, i) => [pct(r.count, totalCount), pct(theory[i].combos, TOTAL_COMBINATIONS)]);
      const scale = Math.max(...shares.flat(), 1);
      return rows.map((r, i) => {
        const [actual, ideal] = shares[i];
        return `
        <tr>
          <td class="font-bold text-center">${label(r)}</td>
          <td class="text-right font-medium">${r.count}회</td>
          <td class="text-right">${actual.toFixed(1)}%${distBar(actual, ideal, scale)}</td>
          <td class="text-right text-slate-500">${ideal.toFixed(1)}%</td>
        </tr>
      `.trim();
      }).join('\n');
    };
    const oddEvenRows = distRows(statsAll.oddEven, theoreticalOddEven(), (r) => `${r.odd} : ${6 - r.odd}`);
    const sumRows = distRows(statsAll.sumBuckets, theoreticalSumBuckets(), (r) => `${r.min} ~ ${r.max}`);

    bodyContent = `
      <section class="card stats-overview">
        <div class="card-heading">
          <div>
            <h2 class="section-title">${icon('info')} 통계 기준</h2>
            <p class="text-sm text-blue-700 mt-1">기준 범위: <strong>${rangeText}</strong></p>
          </div>
          <div class="stats-sample">
            <span class="metric-label">분석한 회차</span><strong>${totalCount}<small>회</small></strong>
          </div>
        </div>
        <p class="section-desc">본번호 6개 기준 · 보너스 제외 · 확보된 기록 안에서 집계</p>
      </section>

      <section class="card mb-8">
        <div class="section-header">
          <h2 class="section-title">${icon('chart')} 번호별 출현 기록</h2>
          <p class="section-desc">기간별 출현 횟수와 마지막으로 나온 뒤 지나간 회차 수입니다.</p>
          <p class="section-desc">실제 집계: 전체 ${totalCount}회 · 최근 100회 중 ${stats100.range.count}회 · 최근 50회 중 ${stats50.range.count}회 · 최근 10회 중 ${stats10.range.count}회</p>
        </div>
${renderFrequencyChart(statsAll.numbers, totalCount)}

        <div class="table-wrap">
          <table class="data-table frequency-table" role="table">
            <caption class="sr-only">1~45 번호별 기간별 출현 횟수와 연속 미출현 기간</caption>
            <thead>
              <tr>
                <th scope="col" class="text-center">번호</th>
                <th scope="col" class="text-right">전체<span class="table-subtitle">${totalCount}회 집계</span></th>
                <th scope="col" class="text-right">최근 100회<span class="table-subtitle">${stats100.range.count}회 집계</span></th>
                <th scope="col" class="text-right">최근 50회<span class="table-subtitle">${stats50.range.count}회 집계</span></th>
                <th scope="col" class="text-right">최근 10회<span class="table-subtitle">${stats10.range.count}회 집계</span></th>
                <th scope="col" class="text-center">미출현 기간</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              ${numRows}
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <section class="card mb-0">
          <div class="section-header">
            <h2 class="section-title">${icon('chart')} 홀수 / 짝수 비율 분포</h2>
            <p class="section-desc">당첨 번호의 홀짝 구성별 회차 수와, 전체 ${TOTAL_TEXT}개 조합에서 그 구성이 차지하는 비율입니다. 막대 위 눈금이 전체 조합 비율입니다.</p>
          </div>
          <div class="table-wrap">
            <table class="data-table dist-table">
              <thead>
                <tr>
                  <th scope="col" class="text-center">홀 : 짝</th>
                  <th scope="col" class="text-right">출현 횟수</th>
                  <th scope="col" class="text-right">실제 비율</th>
                  <th scope="col" class="text-right">전체 조합 비율</th>
                </tr>
              </thead>
              <tbody>
                ${oddEvenRows}
              </tbody>
            </table>
          </div>
        </section>

        <section class="card mb-0">
          <div class="section-header">
            <h2 class="section-title">${icon('chart')} 번호 합계 구간 분포</h2>
            <p class="section-desc">당첨 번호 6개의 합계(21~255) 구간별 회차 수와, 전체 ${TOTAL_TEXT}개 조합에서 그 구간이 차지하는 비율입니다.</p>
          </div>
          <div class="table-wrap">
            <table class="data-table dist-table">
              <thead>
                <tr>
                  <th scope="col" class="text-center">합계 구간</th>
                  <th scope="col" class="text-right">출현 횟수</th>
                  <th scope="col" class="text-right">실제 비율</th>
                  <th scope="col" class="text-right">전체 조합 비율</th>
                </tr>
              </thead>
              <tbody>
                ${sumRows}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section class="content-note">
        <h3 class="font-bold text-slate-700 mb-2">${icon('info')} 통계 데이터 안내</h3>
        <p class="text-sm text-slate-600 leading-relaxed">
          본 통계는 공식 검증된 회차 결과의 본번호 6개만을 기준으로 집계한 객관적 사실 기록입니다.
          로또 추첨은 매 회차 독립 시행이므로 과거의 출현 빈도나 미출현 기간이 미래의 당첨 확률을 높이거나 낮추지 않습니다.
        </p>
        <p class="text-sm text-slate-600 leading-relaxed">
          기대 출현 횟수와 전체 조합 비율은 1~45에서 6개를 고르는 ${TOTAL_TEXT}개 조합을 모두 센 이론값입니다. 실제 값이 이론값과 다른 것은 회차 수가 적을 때 흔히 생기는 우연한 차이이며, 특정 번호나 패턴이 더 잘 나온다는 뜻이 아닙니다.
        </p>
      </section>
    `;
  }

  const content = `
    <div class="stats-page-container content-page themed-page">
      <div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('chart')}</span>
        <div>
        <h1 class="text-3xl font-black mb-2">로또 6/45 번호 통계</h1>
        <p class="text-slate-500">역대 당첨 번호 출현 빈도, 미출현 기간, 홀짝 및 합계 통계 분석표입니다.</p>
        </div>
      </div>

      ${renderDataStatus({ meta: drawsData?.meta, updateStatus, hasData: draws.length > 0, compact: true })}
      ${bodyContent}
    </div>
  `;

  return renderLayout({
    site,
    title: '로또 번호 통계 - 마이로또맵',
    description: '로또 6/45 번호별 출현 빈도, 미출현 기간, 홀짝 및 합계 통계 분석표입니다.',
    canonicalUrl: `${siteUrl}/stats/`,
    currentPath: '/stats/',
    isFixture,
    content,
  });
}
