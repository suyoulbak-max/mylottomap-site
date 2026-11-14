// 서비스 소개 (/about/) 렌더러
import { renderLayout } from '../shared/layout.js';
import { shopPeriodText } from '../shared/data-status.js';
import { groupShopsByRegion } from '../shared/regions.js';
import { escapeHtml } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { renderOperatorItems } from './contact.js';

export const ABOUT_UPDATED_AT = '2026-10-09';

export function drawsCoverageText(drawsData) {
  const rounds = (drawsData?.draws || []).map((d) => d.round).sort((a, b) => a - b);
  if (!rounds.length) return '검증된 회차 데이터 준비 중';
  return `${rounds[0]}회 ~ ${rounds[rounds.length - 1]}회 중 검증된 ${rounds.length}개 회차`;
}

export function renderAboutPage({ siteConfig, drawsData, shopsData, site = {}, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const groups = groupShopsByRegion(shopsData);
  const shopCount = groups.reduce((sum, group) => sum + group.shops.length, 0);
  const content = `
    <div class="content-page themed-page info-page about-page">
      <div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('map')}</span>
        <div><h1 class="mb-2">마이로또맵 소개</h1>
        <p>전국 로또 명당, 당첨 결과와 내 번호를 한곳에서</p></div>
      </div>

      <section class="card mb-6">
        <h2 class="section-title mb-3">서비스 목적</h2>
        <p class="leading-relaxed">마이로또맵은 로또 6/45 이용자가 공식 출처로 확인한 당첨 결과와 판매점 정보를 쉽게 찾고, 직접 고른 번호를 저장해 추첨 뒤 결과를 확인할 수 있도록 만든 무료 서비스입니다. 회원가입 없이 이용합니다.</p>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">주요 기능</h2>
        <ul class="feature-grid">
          <li>${icon('map')}<a href="/" class="content-link">명당맵</a><p>지역·상호로 판매점을 찾고 확인된 1·2등 배출 이력을 지도와 목록으로 봅니다.</p></li>
          <li>${icon('trophy')}<a href="/results/" class="content-link">당첨 결과</a><p>회차별 당첨 번호, 보너스 번호, 등수별 당첨금과 당첨자 수를 확인합니다.</p></li>
          <li>${icon('chart')}<a href="/stats/" class="content-link">번호 통계</a><p>검증된 회차에서 번호별 출현 횟수, 미출현 기간, 홀짝·합계 분포를 계산합니다.</p></li>
          <li>${icon('spark')}<a href="/generator/" class="content-link">번호 생성</a><p>1~45에서 중복 없이 6개를 무작위로 고르고, 원하면 포함·제외 번호를 지정합니다.</p></li>
          <li>${icon('bookmark')}<a href="/my-numbers/" class="content-link">내 번호</a><p>대상 회차별로 번호를 브라우저에 저장하고 추첨 결과와 비교합니다.</p></li>
          <li>${icon('info')}<a href="/guides/" class="content-link">가이드</a><p>당첨 확률, 통계 읽는 법, 명당 배출 횟수 해석을 설명합니다.</p></li>
        </ul>
        <p class="mt-4 text-sm text-slate-600">번호 생성은 무작위 선택이며 당첨 확률을 높이거나 당첨을 예측하지 않습니다.</p>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">현재 데이터 범위</h2>
        <div class="coverage-summary">
          <div><span>당첨 결과</span><strong>${escapeHtml(drawsCoverageText(drawsData))}</strong></div>
          <div><span>판매점 배출 이력</span><strong>${shopCount ? `${shopCount.toLocaleString('ko-KR')}곳 · ${groups.length}개 시도` : '데이터 준비 중'}</strong><p>${escapeHtml(shopPeriodText(shopsData))}</p></div>
        </div>
        ${groups.length ? `<details class="coverage-regions"><summary>제공 지역 확인</summary><ul class="region-link-list">${groups.map(g => `<li><a class="content-link" href="${g.path}">${escapeHtml(g.name)} <span>${g.shops.length.toLocaleString('ko-KR')}곳</span></a></li>`).join('')}</ul></details>` : ''}
        <p class="mt-2 text-sm text-slate-600">출처, 수집 주기, 검증 절차는 <a href="/data-methodology/" class="content-link">데이터·통계 설명</a>에서 확인할 수 있습니다.</p>
      </section>

      <section class="card">
        <h2 class="section-title mb-3">운영 주체</h2>
        <ul class="list-disc list-inside space-y-1">
          ${renderOperatorItems(siteConfig)}
        </ul>
        <p class="mt-4 text-sm text-slate-600">마이로또맵은 동행복권 및 복권위원회와 관계없는 독립 정보 서비스입니다. 복권을 판매하지 않습니다.</p>
        <p class="mt-2 text-xs text-slate-400">수정일 ${ABOUT_UPDATED_AT}</p>
      </section>
    </div>
  `;
  return renderLayout({
    title: '서비스 소개 - 마이로또맵',
    description: '마이로또맵의 서비스 목적, 명당맵·당첨 결과·번호 통계·번호 생성·내 번호 기능, 현재 데이터 범위와 운영 주체를 소개합니다.',
    canonicalUrl: `${siteUrl}/about/`,
    currentPath: '/about/',
    isFixture,
    site,
    content,
  });
}
