// 회차별 1등 배출 판매점 페이지 렌더러
// /winning-shops/ (최신 10회 + 연도 목록), /winning-shops/<연도>/ (그해 전체), /winning-shops/<회차>/ (상세·지도)
import { renderLayout } from '../shared/layout.js';
import { escapeHtml, formatMoney, formatWinners } from '../shared/format.js';
import { renderDataStatus } from '../shared/data-status.js';
import { WIN_COUNT_NOTICE } from '../shared/regions.js';
import { buildWinningRounds, methodText } from '../shared/winning-shops.js';
import { renderKoreaMap, MAP_LEVELS } from '../shared/korea-map.js';
import { renderHomePage } from './home.js';
import { icon } from '../shared/icons.js';

const HUB = '/winning-shops/';
const HEAD = '<link rel="stylesheet" href="/assets/shared/winning-shops.css">';
const RESULT_SOURCE = 'https://www.dhlottery.co.kr/lt645/result';

export const winningRoundPath = (round) => `${HUB}${round}/`;
const yearPath = (year) => `${HUB}${year}/`;
const n = (v) => Number(v).toLocaleString('ko-KR');

function countLine(r) {
  return [`1등 ${formatWinners(r.winners)}`, `판매점 ${n(r.shopWins)}건`, r.internet === null ? null : `인터넷 ${n(r.internet)}건`]
    .filter(Boolean).join(' · ');
}

function checkText(r) {
  if (r.matched === null) return '인터넷 구매 기록이 없어 공식 1등 당첨자 수와 맞춰 보지 못했습니다.';
  const unlocated = r.unlocated?.length || 0;
  const gap = r.listGap || 0;
  const total = r.shopWins + r.internet + unlocated + gap;
  const parts = `판매점 ${n(r.shopWins)}건과 인터넷 ${n(r.internet)}건${unlocated ? `, 주소 미확정 ${n(unlocated)}건` : ''}${gap ? `, 공식 판매점 목록 미기재 ${n(gap)}건` : ''}`;
  return r.matched
    ? `${parts}을 더한 ${n(total)}건이 공식 1등 당첨자 수 ${n(r.winners)}명과 같습니다.`
    : `${parts}의 합(${n(total)}건)이 공식 1등 당첨자 수 ${n(r.winners)}명과 다릅니다. 아직 확인하지 못한 기록이 있을 수 있습니다.`;
}

function internetNote(r) {
  const internet = r.internet ? `<p class="winning-internet">인터넷 구매(동행복권 사이트) 1등 ${n(r.internet)}건은 판매점이 없어 표와 지도에서 제외했습니다.</p>` : '';
  const unlocated = r.unlocated?.length ? `<p class="winning-internet">공식 기록의 주소로 시도·시군구를 확인할 수 없는 1등 ${n(r.unlocated.length)}건은 표와 지도에서 제외했습니다(공식 주소 원문: ${r.unlocated.map((w) => escapeHtml(`${w.shopName} · ${w.address}`)).join(', ')}).</p>` : '';
  const gap = r.listGap ? `<p class="winning-internet">공식 1등 당첨자 수보다 동행복권 당첨 판매점 목록이 ${n(r.listGap)}건 적어, 해당 당첨의 판매점은 확인할 수 없습니다.</p>` : '';
  return internet + unlocated + gap;
}

const emptyText = (r) => `<p class="winning-empty">${r.internet ? '이 회차의 1등은 모두 인터넷 구매입니다.' : '확인된 1등 배출 판매점이 없습니다.'}</p>`;

/** 목록·연도 페이지용 간단한 표: 상호·구분·지역 */
function compactTable(r) {
  if (!r.shops.length) return emptyText(r);
  return `<div class="table-wrap"><table class="data-table winning-table winning-compact-table" role="table">
          <caption class="sr-only">제${r.round}회 1등 배출 판매점</caption>
          <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">상호</th><th scope="col" role="columnheader">구분</th><th scope="col" role="columnheader">지역</th></tr></thead>
          <tbody role="rowgroup">${r.shops.map((e) => `<tr role="row"><td role="cell"><span class="mobile-label">상호</span>${escapeHtml(e.shop.name)}</td><td role="cell"><span class="mobile-label">구분</span>${escapeHtml(methodText(e.methods))}</td><td role="cell"><span class="mobile-label">지역</span>${escapeHtml(`${e.sido} ${e.sigungu}`.trim())}</td></tr>`).join('')}</tbody>
        </table></div>`;
}

function roundSection(r) {
  const path = winningRoundPath(r.round);
  return `
      <details class="card winning-round" id="r${r.round}">
        <summary class="winning-round-head"><strong>제${r.round}회 1등 배출 판매점</strong><span class="winning-meta">${escapeHtml(r.date)} 추첨 · ${countLine(r)}</span></summary>
        <h2 class="sr-only">제${r.round}회 1등 배출 판매점</h2>
        ${compactTable(r)}
        ${internetNote(r)}
        <p class="winning-more"><a class="btn btn-secondary btn-sm" href="${path}">제${r.round}회 전체 주소와 지도 보기 →</a></p>
      </details>`;
}

function breadcrumb(items) {
  return `<nav class="breadcrumb text-sm mb-4" aria-label="현재 위치"><a class="content-link" href="${HUB}">회차별 1등 판매점</a>${items.map((x) => ` / ${x.path ? `<a class="content-link" href="${x.path}">${escapeHtml(x.label)}</a>` : `<span aria-current="page">${escapeHtml(x.label)}</span>`}`).join('')}</nav>`;
}

const chipList = (label, items) => `<nav class="winning-chips" aria-label="${escapeHtml(label)}"><ul>${items.map((x) => `<li><a class="filter-chip" href="${x.path}">${escapeHtml(x.label)}</a></li>`).join('')}</ul></nav>`;

const yearLinks = (label, items) => `<nav class="winning-year-links" aria-label="${escapeHtml(label)}"><ul>${items.map((x) => `<li><a href="${x.path}"><span><strong>${escapeHtml(x.label)}</strong><span class="winning-year-hint">회차별 판매점 모아보기</span></span><span aria-hidden="true">→</span></a></li>`).join('')}</ul></nav>`;

const sidoSummary = (r) => r.bySido.map((g) => `${g.sido} ${g.count}건`).join(', ');

/** 판매점 수집 기간 안의 회차별 페이지 목록. 반환: [{ path, html }] (회차가 없으면 빈 배열) */
export function renderWinningShopsPages({ siteConfig, site = {}, shopsData, drawsData, updateStatus = null, isFixture = false }) {
  const rounds = buildWinningRounds({ shopsData, drawsData });
  if (!rounds.length) return [{ path: HUB, html: renderHomePage({ siteConfig, site, shopsData, drawsData, updateStatus, isFixture, explorerMode: 'winning', currentPath: HUB }) }];
  const siteUrl = (siteConfig?.siteUrl || 'https://mylottomap.com').replace(/\/+$/, '');
  const sources = [...new Set((shopsData.shops || []).map((s) => s.winsSource).filter(Boolean))];
  const notes = `
      <section class="content-note">
        <p>${escapeHtml(WIN_COUNT_NOTICE)}</p>
        <p>출처: 1등 배출 판매점·자동/수동 구분은 동행복권 당첨 판매점 화면(${escapeHtml(sources.join(', ') || '확인 중')}), 1등 당첨자 수·당첨금은 동행복권 당첨 결과(${RESULT_SOURCE})입니다. 판매점 상호·주소는 당첨 당시 기록이며 현재 영업 여부와 다를 수 있습니다.</p>
      </section>
      ${renderDataStatus({ meta: shopsData.meta, updateStatus, hasData: true })}`;
  const page = (path, title, description, content) => {
    const selected = rounds.find(r => winningRoundPath(r.round) === path);
    return {
      path,
      html: selected ? renderHomePage({ siteConfig, site, shopsData, drawsData, updateStatus, isFixture,
        explorerMode: 'winning', selectedRound: selected.round, currentPath: path, hasDetail: true,
        contentExtra: content.replace('<div class="winning-page content-page">', '<div id="round-details" class="winning-page content-page">'), headExtra: HEAD })
        : renderLayout({ site, title, description, canonicalUrl: `${siteUrl}${path}`, currentPath: path, isFixture, content, headExtra: HEAD, scriptExtra: '<script type="module" src="/assets/client/winning-shops.js"></script>' }),
    };
  };

  const years = [...new Set(rounds.map((r) => r.year))].sort((a, b) => b - a)
    .map((year) => ({ year, rounds: rounds.filter((r) => r.year === year) }));
  const yearChips = years.map((y) => ({ path: yearPath(y.year), label: `${y.year}년 · ${y.rounds.length}회` }));
  const pages = [];

  pages.push({ path: HUB, html: renderHomePage({ siteConfig, site, shopsData, drawsData, updateStatus, isFixture,
    explorerMode: 'winning', currentPath: HUB, headExtra: HEAD,
    contentExtra: `<section class="map-archive-links content-page themed-page"><div class="card winning-archive-card"><div class="section-header"><h2 class="section-title">${icon('bookmark')}연도별 모아보기</h2><p class="section-desc">연도를 선택하면 해당 연도의 1등 배출 판매점을 회차별로 볼 수 있습니다.</p></div>${yearLinks('연도별 모아보기', yearChips)}</div></section>` }) });

  // 연도: 그해 전체 회차 + 회차 바로가기
  for (const y of years) {
    const yearIndex = years.indexOf(y);
    const olderYear = years[yearIndex + 1];
    const newerYear = years[yearIndex - 1];
    const lo = y.rounds.at(-1).round;
    const hi = y.rounds[0].round;
    const sum = (key) => y.rounds.reduce((s, r) => s + (r[key] || 0), 0);
    pages.push(page(
      yearPath(y.year),
      `${y.year}년 로또 1등 배출 판매점 (제${lo}~${hi}회) - 마이로또맵`,
      `${y.year}년 로또 제${lo}~${hi}회 ${y.rounds.length}회의 1등 배출 판매점을 회차 순서로 모았습니다. 판매점 1등 ${n(sum('shopWins'))}건, 인터넷 ${n(sum('internet'))}건.`,
      `
    <div class="winning-page winning-year-page content-page themed-page">
      ${breadcrumb([{ label: `${y.year}년` }])}
      <div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('store')}</span>
        <div>
        <h1>${y.year}년 로또 1등 배출 판매점</h1>
        <p>제${lo}~${hi}회 ${y.rounds.length}회 · 판매점 1등 ${n(sum('shopWins'))}건 · 인터넷 ${n(sum('internet'))}건. 최신 회차부터 차례로 보여 드립니다.</p>
        </div>
      </div>
      <nav class="winning-year-pager" aria-label="연도 이동">${olderYear ? `<a class="btn btn-secondary" href="${yearPath(olderYear.year)}">← ${olderYear.year}년</a>` : ''}<a class="btn btn-secondary" href="${HUB}" aria-label="최신 회차 지도">최신 지도</a>${newerYear ? `<a class="btn btn-secondary" href="${yearPath(newerYear.year)}">${newerYear.year}년 →</a>` : ''}</nav>
      <details class="card winning-jump">
        <summary>회차 바로가기 · ${y.rounds.length}회</summary>
        ${chipList('회차 바로가기', y.rounds.map((r) => ({ path: `#r${r.round}`, label: `${r.round}회` })))}
      </details>
      ${y.rounds.map(roundSection).join('')}
      ${years.length > 1 ? `<section class="card winning-years"><h2 class="section-title">${icon('bookmark')}다른 연도</h2>${yearLinks('다른 연도', yearChips.filter((c) => c.path !== yearPath(y.year)))}</section>` : ''}
      ${notes}
    </div>`,
    ));
  }

  // 회차 상세: 전체 주소·구분, 시도 지도, 이전·다음 회차
  rounds.forEach((r, i) => {
    const newer = rounds[i - 1];
    const older = rounds[i + 1];
    const methodsText = Object.keys(r.methods).length ? methodText(r.methods) : '구분 없음';
    const mapLabel = r.bySido.length ? `제${r.round}회 시도별 1등 판매점 건수: ${sidoSummary(r)}` : `제${r.round}회 판매점 1등 없음`;
    pages.push(page(
      winningRoundPath(r.round),
      `제${r.round}회 로또 1등 배출 판매점 (${r.date}) - 마이로또맵`,
      `제${r.round}회(${r.date}) 로또 1등 ${formatWinners(r.winners)}의 배출 판매점 ${n(r.shops.length)}곳을 상호·자동/수동 구분·주소로 정리했습니다.${r.bySido.length ? ` ${sidoSummary(r)}.` : ''}`,
      `
    <div class="winning-page content-page">
      ${breadcrumb([{ label: `${r.year}년`, path: yearPath(r.year) }, { label: `제${r.round}회` }])}
      <section class="card winning-hero">
        <h1>제${r.round}회 로또 1등 배출 판매점</h1>
        <p class="winning-meta">${escapeHtml(r.date)} 추첨 · 1등 ${formatWinners(r.winners)} · 1인당 ${formatMoney(r.amount)}</p>
        <ul class="winning-stats">
          <li><span>판매점</span><strong>${n(r.shops.length)}곳 · ${n(r.shopWins)}건</strong></li>
          <li><span>인터넷</span><strong>${r.internet === null ? '미확보' : `${n(r.internet)}건`}</strong></li>
          <li><span>구분</span><strong>${escapeHtml(methodsText)}</strong></li>
        </ul>
        <p class="winning-check">${checkText(r)}</p>
        <p><a class="btn btn-secondary btn-sm" href="/results/${r.round}/">제${r.round}회 당첨 번호 보기</a></p>
      </section>

      <section class="card">
        <h2 class="section-title">1등 배출 판매점 ${n(r.shops.length)}곳</h2>
        ${r.shops.length ? `<div class="table-wrap"><table class="data-table winning-table">
          <caption class="sr-only">제${r.round}회 1등 배출 판매점 상호·구분·소재지</caption>
          <thead><tr><th scope="col">상호</th><th scope="col">구분</th><th scope="col">소재지</th></tr></thead>
          <tbody>${r.shops.map((e) => `<tr><td><a class="content-link" href="/?shop=${encodeURIComponent(e.shop.id)}" title="명당맵에서 보기">${escapeHtml(e.shop.name)}</a></td><td>${escapeHtml(methodText(e.methods))}</td><td>${escapeHtml(e.shop.address)}</td></tr>`).join('')}</tbody>
        </table></div>` : emptyText(r)}
        ${internetNote(r)}
      </section>

      <section class="card">
        <h2 class="section-title">지도로 보는 1등 판매점</h2>
        <div class="winning-map-layout">
          <figure class="winning-map">
            ${renderKoreaMap(new Map(r.bySido.map((g) => [g.sido, g.count])), { label: mapLabel })}
            <figcaption class="winning-legend"><span><i class="map-swatch map-level-0" aria-hidden="true"></i>없음</span>${MAP_LEVELS.map((l) => `<span><i class="map-swatch map-level-${l.level}" aria-hidden="true"></i>${l.label}</span>`).join('')}</figcaption>
          </figure>
          <ul class="winning-sido-list">
            ${r.bySido.map((g) => `<li><strong>${escapeHtml(g.sido)} ${g.count}건</strong><span>${escapeHtml(g.places.join(', '))}</span></li>`).join('')}
            ${r.internet ? `<li><strong>인터넷 ${r.internet}건</strong><span>판매점 없음(지도 제외)</span></li>` : ''}
          </ul>
        </div>
        <p class="winning-map-note">판매점 좌표가 아니라 주소의 시도를 기준으로 칠한 지도입니다. 광주와 전남은 판매점 주소 표기에 따라 '전남광주'로 묶었습니다.</p>
      </section>

      <nav class="winning-pager" aria-label="회차 이동">
        ${older ? `<a class="btn btn-secondary btn-sm" href="${winningRoundPath(older.round)}">← 제${older.round}회</a>` : '<span></span>'}
        <a class="btn btn-secondary btn-sm" href="${yearPath(r.year)}#r${r.round}">${r.year}년 모아보기</a>
        ${newer ? `<a class="btn btn-secondary btn-sm" href="${winningRoundPath(newer.round)}">제${newer.round}회 →</a>` : '<span></span>'}
      </nav>
      ${notes}
    </div>`,
    ));
  });

  return pages;
}
