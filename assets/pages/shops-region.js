// 지역별 판매점 페이지 (/shops/<시도>/, /shops/<시도>/<시군구>/) 렌더러
import { renderLayout, breadcrumbLd } from '../shared/layout.js';
import { escapeHtml } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { shopPeriodText, renderDataStatus } from '../shared/data-status.js';
import { groupShopsByRegion, mergeSigungus, renderShopDirectoryCard, WIN_COUNT_NOTICE } from '../shared/regions.js';
import { regionSummary } from '../shared/data-sentences.js';
import { markdownToHtml, extractFaq, faqLd } from './guide-detail.js';

/** 시도 페이지에 보여 주는 상위 판매점 수 */
const SIDO_TOP_SHOPS = 10;
const n = (v) => v.toLocaleString('ko-KR');

// 지역 허브 본문을 1차 보강한 날(배포일로 맞춘다). 사이트맵 lastmod는 이 날과 최근 배출 회차 추첨일 중 늦은 날.
// 디자인·제목 틀만 바꿀 때는 올리지 않는다(docs/operations.md lastmod 규칙).
export const REGION_CONTENT_UPDATED_AT = '2026-11-25';

/** 지역 허브와 서로 연결하는 가이드. 시군구는 앞 2편, 시도는 3편. 저장소에 없는 글은 건너뛴다. */
export const REGION_GUIDES = ['shop-win-count', 'auto-manual-selection', 'lotto-odds'];
const SIGUNGU_GUIDE_COUNT = 2;

/**
 * 시도 페이지 제목 틀. Writer 문구가 오면 이 문자열만 바꾼다.
 * {name} 시도 이름, {count} 판매점 수, {scope} 집계 범위
 */
export const SIDO_TITLE_TEMPLATE = '{name} 로또 1·2등 배출 판매점 - {count}곳, {scope}';
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (all, key) => values[key] ?? all);

// 광역시·도 이름과 같은 짧은 이름(경기 광주시 → '광주')은 혼동되므로 시도를 붙인다.
const METRO_NAMES = new Set(['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '제주']);
const baseName = (word) => (/^.{2,}[시군구]$/.test(word) ? word.slice(0, -1) : '');

/**
 * 제목 앞에 쓰는 짧은 지명. '부천시' → '부천', '수원시 장안구' → '수원 장안구'.
 * 줄인 이름이 다른 시군구와 겹치거나, 한 글자이거나(중구), 광역시·도 이름과 같으면 '서울 중구'처럼 시도를 붙인다.
 * @param {{ sido: string, sigungu: string }[]} all 모든 시군구 페이지(겹침 확인용). 같은 순서로 이름을 돌려준다.
 */
export function shortRegionNames(all) {
  const candidate = ({ sigungu }) => {
    const [first, ...rest] = sigungu.split(' ');
    const base = baseName(first);
    return base ? [base, ...rest].join(' ') : '';
  };
  const count = new Map();
  for (const r of all) count.set(candidate(r), (count.get(candidate(r)) || 0) + 1);
  return all.map((r) => {
    const c = candidate(r);
    return c && count.get(c) === 1 && !METRO_NAMES.has(c) ? c : `${r.sido} ${r.sigungu}`;
  });
}

const winningShopCount = (shops) => shops.filter((s) => (s.wins || []).some((w) => w.rank === 1)).length;

/** 시군구 제목 핵심: '부천 로또 명당·1등 판매점 12곳 (262~1251회)'. 1등 판매점이 없으면 1·2등 판매점 수를 쓴다. */
export function sigunguHeadline(short, group, period) {
  const winners = winningShopCount(group.shops);
  const range = period?.fromRound && period?.toRound ? ` (${period.fromRound}~${period.toRound}회)` : '';
  return winners
    ? `${short} 로또 명당·1등 판매점 ${n(winners)}곳${range}`
    : `${short} 로또 명당·1·2등 판매점 ${n(group.shops.length)}곳${range}`;
}

/** 화면에 카드로 보이는 판매점 그대로의 CollectionPage + ItemList(Store) */
export function regionCollectionLd({ siteUrl, path, name, description, shops }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `${siteUrl}${path}`,
    inLanguage: 'ko-KR',
    isPartOf: { '@type': 'WebSite', name: '마이로또맵', url: `${siteUrl}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: shops.length,
      itemListElement: shops.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: { '@type': 'Store', name: s.name, address: { '@type': 'PostalAddress', streetAddress: s.address, addressCountry: 'KR' } },
      })),
    },
  };
}

/** 제목·설명용 집계 범위: '1193~1244회(52회) 기준' */
export function scopeText(shopsData) {
  const p = shopsData?.meta?.period;
  return p?.fromRound && p?.toRound
    ? `${p.fromRound}~${p.toRound}회(${p.toRound - p.fromRound + 1}회) 기준`
    : '수집 기간 준비 중';
}

/** 당첨 이력 출처와 영업 상태 배지의 뜻 */
export function renderShopSources(shopsData) {
  const sources = [...new Set((shopsData?.shops || []).map((s) => s.winsSource).filter(Boolean))];
  return `<p class="data-coverage">당첨 이력 출처: ${escapeHtml(sources.length ? sources.join(' · ') : '데이터 준비 중')}<br>영업 상태: 판매점 목록 출처와 주소가 일치하면 '현재 판매점 목록 확인', 찾지 못하면 '현재 목록에서 확인 안 됨(폐업·이전 가능)'으로 표시합니다.</p>`;
}

const summaryRow = (label, g) => `<tr><th scope="row">${label}</th><td>${n(g.shops.length)}곳</td><td>${n(g.rank1)}건</td><td>${n(g.rank2)}건</td></tr>`;

function summaryTable(caption, rows) {
  return `<div class="table-wrap">
          <table class="data-table">
            <caption class="sr-only">${escapeHtml(caption)}</caption>
            <thead><tr><th scope="col">지역</th><th scope="col">판매점</th><th scope="col">1등 건수</th><th scope="col">2등 건수</th></tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>`;
}

const linkList = (label, items) => items.length
  ? `<nav class="card mt-6" aria-label="${escapeHtml(label)}"><h2 class="section-title mb-3">${icon('map')} ${escapeHtml(label)}</h2><ul class="region-link-list">${items.map((x) => `<li><a class="filter-chip" href="${x.path}">${escapeHtml(x.label)}</a></li>`).join('')}</ul></nav>`
  : '';

function breadcrumb(items) {
  return `<nav class="breadcrumb text-sm mb-4" aria-label="현재 위치"><a class="content-link" href="/shops/">전국 판매점</a>${items.map((x) => ` / ${x.path ? `<a class="content-link" href="${x.path}">${escapeHtml(x.label)}</a>` : `<span aria-current="page">${escapeHtml(x.label)}</span>`}`).join('')}</nav>`;
}

const cardGrid = (shops, opts) => `<div class="shop-directory-grid">${shops.map((s) => renderShopDirectoryCard(s, opts)).join('\n')}</div>`;

function regionIntro(h1, lead, group, scope) {
  return `<div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('store')}</span>
        <div><h1 class="mb-2">${escapeHtml(h1)}</h1>
        <p>${escapeHtml(lead)}<br>집계: ${escapeHtml(scope)}</p></div>
      </div>
      <section class="region-summary" aria-label="지역 배출 기록 요약">
        <div><span>1·2등 배출 판매점</span><strong>${n(group.shops.length)}<small>곳</small></strong></div>
        <div><span>1등 건수</span><strong>${n(group.rank1)}<small>건</small></strong></div>
        <div><span>2등 건수</span><strong>${n(group.rank2)}<small>건</small></strong></div>
      </section>`;
}

/**
 * 지역 페이지 목록. 시도는 판매점 1곳 이상, 시군구는 MIN_SIGUNGU_SHOPS 이상일 때만 만든다.
 * 반환: [{ path(percent-encoding), html }]
 */
/** Writer 본문 슬롯(content/regions/*.md). 본문이 비면 아무것도 내지 않는다. */
const writerSection = (slot) => (slot?.body ? `<section class="card mt-6 writer-content">${markdownToHtml(slot.body)}</section>` : '');
// 시군구 쪽 두 기준을 한 줄에: 1등 배출 판매점 수와 1·2등 배출 판매점 수
const countPhrase = (rank1Shops, shops) => (rank1Shops ? `1등 배출 ${n(rank1Shops)}곳 · 1·2등 배출 포함 ${n(shops)}곳` : `1·2등 배출 ${n(shops)}곳(1등 배출 없음)`);

/**
 * @param {Map<string, { title?, description?, updatedAt?, body }>} [slots] Writer 슬롯. 키는 '경기', '경기/부천시-원미구'
 * @param {(round: number) => string|undefined} [drawDate] 회차 → 추첨일(사실 요약 문장용)
 */
const sigunguLink = (s, label) => (s.path ? `<a class="content-link" href="${s.path}">${escapeHtml(label)}</a>` : escapeHtml(label));
// 묶은 줄 안의 주소 표기: '부천시 원미구' → '원미구', 시 이름만 있는 기록 → '부천시(구 표기 없음)'
const memberLabel = (current, name) => (name === current ? (current.endsWith('시') ? `${current}(구 표기 없음)` : current) : name.replace(`${current} `, ''));

/**
 * @param {{ merge: object[] }} [regionMerge] 옛·새 주소 대응표(data/region-merge.json). 시도 표에서만 한 줄로 묶는다.
 */
export function renderRegionPages({ siteConfig, site = {}, shopsData, updateStatus = null, isFixture = false, guides = [], slots = new Map(), drawDate, regionMerge = { merge: [] } }) {
  const siteUrl = (siteConfig?.siteUrl || 'https://mylottomap.com').replace(/\/+$/, '');
  const groups = groupShopsByRegion(shopsData);
  const scope = scopeText(shopsData);
  const regionGuides = REGION_GUIDES.map((slug) => guides.find((x) => x.slug === slug)).filter(Boolean).map((x) => ({ path: `/guides/${x.slug}/`, label: x.title }));
  const period = shopsData?.meta?.period;
  const sigunguPages = groups.flatMap((g) => g.sigungus.filter((s) => s.path).map((s) => ({ sido: g.name, sigungu: s.name, group: s })));
  const shortNames = new Map(shortRegionNames(sigunguPages).map((name, i) => [sigunguPages[i].group, name]));
  const lead = '수집 기간의 배출 기록을 지역·판매점별로 확인하세요.';
  // 여러 구 페이지를 한 글로 다루는 Writer 시군구 원고(paths)는 url 쪽에만 싣고, 나머지 쪽에서는 그 쪽으로 링크한다.
  const linkedSlots = new Map();
  for (const [key, slot] of slots) {
    for (const p of slot.paths?.length > 1 ? slot.paths : []) {
      const other = p.replace(/^\/shops\/|\/$/g, '');
      if (other !== key) linkedSlots.set(other, { path: encodeURI(`/shops/${key}/`), title: slot.linkTitle });
    }
  }
  const periodText = shopPeriodText(shopsData);
  // 시군구 쪽은 주황 안내 앞에 '명당'의 뜻을 붙인다(당첨 확률과 무관하다는 말은 바로 뒤 안내 문장이 이미 한다).
  const note = (prefix = '') => `
      <div class="shop-data-note">
        <p>${prefix}${escapeHtml(WIN_COUNT_NOTICE)}</p>
        <details><summary>집계 출처·판매점 상태 안내</summary>${renderShopSources(shopsData)}</details>
      </div>
      ${renderDataStatus({ meta: shopsData?.meta, updateStatus, hasData: true, compact: true, sourceLabel: '동행복권 공식 당첨 판매점 화면' })}`;
  const common = note();
  const sigunguNote = note('이 사이트에서 ‘명당’은 1등 배출 기록이 많은 판매점을 가리킵니다. ');
  // crumbs: 화면 breadcrumb와 같은 항목. lastRound: 이 지역 판매점의 가장 최근 배출 회차(사이트맵 lastmod용)
  // listed: 화면에 카드로 보이는 판매점(구조화 데이터 ItemList)
  // slot: Writer 슬롯(제목·설명을 덮어쓰고, 본문 FAQ가 있으면 FAQPage). summary: 데이터 사실 요약(검사·보고용)
  const page = ({ path, title, description, content, crumbs, shops, listed, slot, summary = null }) => {
    const faq = extractFaq(slot?.body);
    // 원고 제목은 시도 쪽에만 쓴다. 시군구 쪽(crumbs 2단)은 260쪽 모두 H1과 같은 틀의 제목을 쓴다(PM 결정).
    const pageTitle = slot?.title && crumbs.length === 1 ? `${slot.title} - 마이로또맵` : title;
    const pageDescription = slot?.description || description;
    return {
      path,
      summary,
      slotUpdatedAt: slot?.updatedAt || null,
      lastRound: Math.max(0, ...shops.flatMap((s) => (s.wins || []).map((w) => w.round))),
      html: renderLayout({ site, title: pageTitle, description: pageDescription, jsonLd: [
        regionCollectionLd({ siteUrl, path, name: pageTitle.replace(/ - 마이로또맵$/, ''), description: pageDescription, shops: listed }),
        ...(faq.length ? [faqLd(faq)] : []),
        breadcrumbLd(siteUrl, [{ label: '전국 판매점', path: '/shops/' }, ...crumbs]),
      ], canonicalUrl: `${siteUrl}${path}`, currentPath: decodeURI(path), isFixture, content }),
    };
  };
  const pages = [];

  for (const g of groups) {
    const otherSido = groups.filter((o) => o !== g).map((o) => ({ path: o.path, label: `${o.name} ${n(o.shops.length)}곳` }));
    const withPage = g.sigungus.filter((s) => s.path);
    const inline = g.sigungus.filter((s) => !s.path);
    const label = (s) => (s.name ? `${g.name} ${s.name}` : g.name);
    const rows = mergeSigungus(g.name, g.sigungus, regionMerge.merge).map((r) => ({ ...r, name: r.name || g.name }));

    const sidoSlot = slots.get(g.name);
    pages.push(page({
      path: g.path,
      crumbs: [{ label: g.name }],
      shops: g.shops,
      slot: sidoSlot,
      listed: [...(withPage.length ? g.shops.slice(0, SIDO_TOP_SHOPS) : []), ...inline.flatMap((s) => s.shops)],
      title: `${fill(SIDO_TITLE_TEMPLATE, { name: g.name, count: n(g.shops.length), scope })} - 마이로또맵`,
      description: `${g.name} 지역 로또 1·2등 배출 판매점 ${n(g.shops.length)}곳의 상호·주소·배출 회차를 ${scope}으로 정리했습니다. 1등 ${n(g.rank1)}건, 2등 ${n(g.rank2)}건.`,
      content: `
    <div class="shops-page-container content-page themed-page">
      ${breadcrumb([{ label: g.name }])}
      ${regionIntro(`${g.name} 로또 1·2등 배출 판매점`, lead, g, scope)}
      ${writerSection(sidoSlot)}
      ${common}
      <section class="card">
        <h2 class="section-title mb-3">${icon('map')} 시군구별 판매점</h2>
        ${summaryTable(`${g.name} 시군구별 판매점 수와 배출 건수`, rows.map((r) => summaryRow(r.members.length > 1 ? `${escapeHtml(r.name)} <span class="text-sm">(${r.members.map((s) => sigunguLink(s, memberLabel(r.name, s.name))).join(' · ')})</span>` : sigunguLink(r.members[0], r.name), { ...r, shops: r.shops })))}
        ${rows.some((r) => r.members.length > 1) ? '<p class="section-desc mt-3">옛 주소와 새 주소 표기가 섞인 지역은 현재 행정구역 한 줄로 합쳐 보여 줍니다. 괄호 안은 당첨 기록에 적힌 주소 표기별 목록입니다.</p>' : ''}
      </section>
      ${withPage.length ? `<section class="card mt-6">
        <h2 class="section-title mb-3">${icon('store')} ${escapeHtml(g.name)} 1등 배출 상위 ${Math.min(SIDO_TOP_SHOPS, g.shops.length)}곳</h2>
        <p class="section-desc mb-3">정렬: 1등 배출 수 → 2등 배출 수 → 최근 당첨 회차</p>
        ${cardGrid(g.shops.slice(0, SIDO_TOP_SHOPS), { periodText })}
      </section>` : ''}
      ${inline.map((s) => `<section class="card mt-6">
        <h2 class="section-title mb-3">${icon('store')} ${escapeHtml(label(s))} 판매점 ${n(s.shops.length)}곳</h2>
        ${cardGrid(s.shops, { periodText })}
      </section>`).join('')}
      ${linkList('관련 가이드', regionGuides)}
      ${linkList('다른 시도 판매점', otherSido)}
    </div>`,
    }));

    for (const s of withPage) {
      const siblings = withPage.filter((o) => o !== s).map((o) => ({ path: o.path, label: `${o.name} ${n(o.shops.length)}곳` }));
      const short = shortNames.get(s);
      const headline = sigunguHeadline(short, s, period);
      const key = decodeURIComponent(s.path).replace(/^\/shops\/|\/$/g, '');
      const slot = slots.get(key);
      const hub = linkedSlots.get(key);
      // 이 쪽만 다루는 Writer 글이 같은 수치(1등 건수·최근 1등·상위 판매점)를 말하면 데이터 문장에서 그 문장은 뺀다.
      const said = new Set(slot && (slot.paths || []).length <= 1 ? slot.placeholderNames || [] : []);
      const summary = regionSummary({ label: label(s), shops: s.shops, period, drawDate, omit: { count: said.has('1등 건수'), recent: said.has('최근 1등 회차'), top: said.has('상위 판매점 1~3') } });
      const counts = countPhrase(winningShopCount(s.shops), s.shops.length);
      pages.push(page({
        path: s.path,
        crumbs: [{ label: g.name, path: g.path }, { label: s.name }],
        shops: s.shops,
        listed: s.shops,
        slot,
        summary,
        title: `${headline} - 마이로또맵`,
        description: `${short} 로또 명당 찾기: ${label(s)} 판매점 ${counts}의 상호·주소·배출 회차와 길찾기를 ${scope}으로 안내합니다. 1등 ${n(s.rank1)}건, 2등 ${n(s.rank2)}건.`,
        content: `
    <div class="shops-page-container content-page themed-page">
      ${breadcrumb([{ label: g.name, path: g.path }, { label: s.name }])}
      ${regionIntro(headline, `${label(s)} 로또 판매점: ${counts}. 배출 기록 순으로 확인하세요.`, s, scope)}
      ${summary ? `<section class="card mt-6 region-facts" aria-label="${escapeHtml(label(s))} 배출 기록 요약"><p class="leading-relaxed">${escapeHtml(summary.text)}</p></section>` : ''}
      ${writerSection(slot)}
      ${hub ? `<nav class="card mt-6" aria-label="지역 묶음 해설"><p>여러 주소 표기 페이지로 나뉜 이 지역의 기록을 묶어 읽는 해설: <a class="content-link" href="${hub.path}">${escapeHtml(hub.title)}</a></p></nav>` : ''}
      ${sigunguNote}
      <section class="card">
        <h2 class="section-title mb-3">${icon('store')} 판매점 목록</h2>
        <p class="section-desc mb-3">정렬: 1등 배출 수 → 2등 배출 수 → 최근 당첨 회차</p>
        ${cardGrid(s.shops, { periodText })}
      </section>
      ${linkList(`${g.name} 다른 시군구`, [{ path: g.path, label: `${g.name} 전체 ${n(g.shops.length)}곳` }, ...siblings])}
      ${linkList('관련 가이드', regionGuides.slice(0, SIGUNGU_GUIDE_COUNT))}
    </div>`,
      }));
    }
  }
  return pages;
}
