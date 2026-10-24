// 공통 레이아웃 및 상단 메뉴·하단 렌더러
import { escapeHtml } from './format.js';
import { icon } from './icons.js';
import { BRAND_WORDMARK } from './brand.js';

export const NAV_ITEMS = [
  { path: '/', label: '명당맵', shortLabel: '명당맵', icon: 'map' },
  { path: '/results/', label: '당첨 결과', shortLabel: '결과', icon: 'trophy' },
  { path: '/stats/', label: '번호 통계', shortLabel: '통계', icon: 'chart' },
  { path: '/generator/', label: '번호 생성', shortLabel: '생성', icon: 'spark' },
  { path: '/my-numbers/', label: '내 번호', shortLabel: '내 번호', icon: 'bookmark' },
];

export const SETTINGS_ITEM = {
  path: '/settings/',
  label: '설정',
  shortLabel: '설정',
  icon: 'settings',
};

/**
 * 현재 경로가 주어진 메뉴 경로와 일치하는지 판별
 */
function isCurrent(currentPath, itemPath) {
  if (itemPath === '/') {
    return currentPath === '/' || currentPath === '/index.html' || currentPath === '';
  }
  const cleanCurrent = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
  const cleanItem = itemPath.endsWith('/') ? itemPath : `${itemPath}/`;
  return cleanCurrent.startsWith(cleanItem);
}

/**
 * 상단 네비게이션 렌더링
 */
// 홈 헤더 티커(Design.md 20장): 문구 목록 전체를 읽히고 순환은 알리지 않는다. 순환·멈춤은 client/next-draw.js
function renderTicker(items) {
  return `<div class="header-summary header-ticker" data-ticker>
          <ul class="ticker-list" aria-label="로또 소식">${items.map((item, i) => `<li class="ticker-item${i ? '' : ' is-active'}"${item.attrs ? ` ${item.attrs}` : ''} title="${escapeHtml(item.title)}"><span class="ticker-tag tag-${item.tone}">${escapeHtml(item.tag)}</span><span class="ticker-text"${item.textAttrs ? ` ${item.textAttrs}` : ''}>${item.html}</span></li>`).join('')}</ul>
          <button type="button" class="ticker-toggle" aria-pressed="false" aria-label="티커 멈춤" hidden><span class="ticker-icon-pause">${icon('pause')}</span><span class="ticker-icon-play">${icon('play')}</span></button>
        </div>`;
}

export function renderNav(currentPath, { title = '', summary = '', mapPage = false, ticker = [] } = {}) {
  const mainLinks = NAV_ITEMS.map((item) => {
    const active = isCurrent(mapPage ? '/' : currentPath, item.path);
    const activeClass = active ? ' nav-link-active' : '';
    const ariaCurrent = active ? ' aria-current="page"' : '';
    return `
      <a href="${item.path}" class="nav-link${activeClass}"${ariaCurrent}>
        <span class="nav-icon" aria-hidden="true">${icon(item.icon)}</span>
        <span class="nav-label-full">${escapeHtml(item.label)}</span>
        <span class="nav-label-short">${escapeHtml(item.shortLabel)}</span>
      </a>
    `.trim();
  }).join('\n');

  const settingsActive = isCurrent(currentPath, SETTINGS_ITEM.path);
  const settingsClass = settingsActive ? ' nav-settings-active' : '';
  const settingsAria = settingsActive ? ' aria-current="page"' : '';
  const settingsLink = `
    <a href="${SETTINGS_ITEM.path}" class="nav-settings${settingsClass}" title="환경 설정"${settingsAria} aria-label="환경 설정">
      <span class="nav-icon" aria-hidden="true">${icon(SETTINGS_ITEM.icon)}</span>
      <span class="nav-settings-label">${escapeHtml(SETTINGS_ITEM.label)}</span>
    </a>
  `.trim();

  const isHome = currentPath === '/' || mapPage;
  return `
    <header class="site-header">
      ${isHome
        ? `<div class="header-brand brand-home"><strong><a href="/" class="brand-link" aria-label="마이로또맵 홈">${BRAND_WORDMARK}</a></strong>${ticker.length ? renderTicker(ticker) : summary ? `<span class="header-summary">${escapeHtml(summary)}</span>` : ''}</div>`
        : `<div class="header-brand brand-page"><a href="/" class="brand-link" aria-label="마이로또맵 홈">${BRAND_WORDMARK}</a><strong class="header-page-title">${escapeHtml(title.split(' - ')[0])}</strong></div>`}
      ${isHome ? `<button class="header-search" type="button" aria-label="판매점 검색 열기" aria-controls="map-sidebar-content">${icon('search')}</button>` : ''}
      <nav class="nav-container" aria-label="주요 메뉴">
        <div class="nav-pill-group">
          <div class="nav-main-links">
            ${mainLinks}
          </div>
          <div class="nav-settings-wrap">
            ${settingsLink}
          </div>
        </div>
      </nav>
    </header>
  `;
}

/**
 * 하단 푸터 렌더링
 */
export function renderFooter({ contactEmail = '', contactPage = false } = {}) {
  return `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <strong>${BRAND_WORDMARK}</strong> <span class="footer-brand-en">(My Lotto Map)</span>
        </div>
        <p class="footer-desc">전국 로또 명당, 당첨 결과와 내 번호를 한곳에서</p>
        <nav class="footer-links" aria-label="서비스 안내">
          <a href="/about/">서비스 소개</a>
          <a href="/data-methodology/">데이터·통계 설명</a>
          <a href="/guides/">가이드</a>
          <a href="/privacy/">개인정보처리방침</a>
          <a href="/terms/">이용약관</a>
          ${contactPage || contactEmail.trim() ? '<a href="/contact/">문의</a>' : ''}
        </nav>
        <p class="footer-notice">본 서비스는 동행복권 공식 데이터를 기반으로 제공하며, 특정 번호의 당첨을 보장하지 않습니다.</p>
        <p class="footer-copy">&copy; ${new Date().getFullYear()} 마이로또맵. 모든 권리 보유.</p>
      </div>
    </footer>
  `;
}

/**
 * 전체 HTML 페이지 레이아웃 래퍼
 * @param {object} options
 * @param {string} options.title - 페이지 타이틀
 * @param {string} options.description - 메타 디스크립션
 * @param {string} options.canonicalUrl - 캐노니컬 URL (없으면 생략, 예: 404)
 * @param {string} options.currentPath - 현재 경로
 * @param {boolean} [options.noindex] - noindex 여부
 * @param {boolean} [options.isFixture] - 예시 데이터 빌드 여부
 * @param {string} options.content - 메인 본문 HTML
 * @param {string} [options.headExtra] - 추가 헤드 태그
 * @param {string} [options.scriptExtra] - 추가 스크립트 태그
 */
export function renderLayout({
  title,
  description,
  canonicalUrl,
  currentPath,
  noindex = false,
  isFixture = false,
  content,
  headExtra = '',
  scriptExtra = '',
  site = {},
  navSummary = '',
  navTicker = [],
  mapPage = false,
}) {
  const shouldNoindex = noindex || isFixture;
  const robotsMeta = shouldNoindex ? '\n    <meta name="robots" content="noindex">' : '';
  const fixtureBanner = isFixture
    ? '<div class="fixture-banner" role="alert"><span class="fixture-badge">개발용 예시 데이터 — 실제 기록 아님</span></div>'
    : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/assets/shared/brand-symbol.svg" type="image/svg+xml">
  <link rel="icon" type="image/png" sizes="96x96" href="/assets/shared/favicon-96.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/shared/apple-touch-icon.png">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="마이로또맵">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${canonicalUrl ? `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(new URL('/assets/shared/og-image-20261013.png', canonicalUrl).href)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1730">
  <meta property="og:image:height" content="909">
  <meta property="og:image:alt" content="마이로또맵 - 전국 로또 1·2등 배출 판매점 지도">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">` : ''}${robotsMeta}
  ${site.adsenseAccount ? `<meta name="google-adsense-account" content="${escapeHtml(site.adsenseAccount)}">
  ` : ''}${site.naverSiteVerification ? `<meta name="naver-site-verification" content="${escapeHtml(site.naverSiteVerification)}">
  ` : ''}<link rel="preload" href="/assets/shared/fonts/PretendardVariable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/shared/styles.css">${headExtra ? '\n  ' + headExtra : ''}
</head>
<body class="page-${currentPath === '/' ? 'home' : currentPath.replace(/^\/|\/$/g, '').replace(/\//g, '-')}${mapPage ? ' page-home page-map-explorer' : ''}">
  ${fixtureBanner}
  <a href="#main-content" class="skip-to-content">본문으로 건너뛰기</a>
  ${renderNav(currentPath, { title, summary: navSummary, ticker: navTicker, mapPage })}
  <main id="main-content" class="main-content">
    ${content}
  </main>
  ${renderFooter(site)}
  ${scriptExtra}
</body>
</html>`;
}
