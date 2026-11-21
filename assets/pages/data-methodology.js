// 데이터·통계 설명 (/data-methodology/) 렌더러
import { renderLayout } from '../shared/layout.js';
import { escapeHtml, formatDateTimeKst } from '../shared/format.js';
import { shopPeriodText } from '../shared/data-status.js';
import { drawsCoverageText } from './about.js';
import { internetWinsText } from '../shared/regions.js';
import { icon } from '../shared/icons.js';

export const METHODOLOGY_UPDATED_AT = '2026-10-09';

export function renderDataMethodologyPage({ siteConfig, drawsData, shopsData, site = {}, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const shops = shopsData?.shops || [];
  const withCoord = shops.filter((s) => s.lat != null && s.lng != null).length;
  const checked = drawsData?.meta?.checkedAt ? formatDateTimeKst(drawsData.meta.checkedAt) : '데이터 준비 중';
  const shopsStatus = shops.length
    ? `공개 판매점 ${shops.length}곳 중 좌표 확인 ${withCoord}곳, 좌표 미확보 ${shops.length - withCoord}곳`
    : '공개된 판매점 데이터 준비 중';

  const content = `
    <div class="content-page themed-page info-page methodology-page">
      <div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('chart')}</span>
        <div><h1 class="mb-2">데이터·통계 설명</h1>
        <p>마이로또맵이 보여 주는 당첨 결과·통계·판매점 정보의 출처와 처리 방식입니다.</p></div>
      </div>

      <section class="card mb-6">
        <h2 class="section-title mb-3">출처</h2>
        <div class="table-wrap">
          <table class="data-table source-table" role="table">
            <caption class="sr-only">정보별 출처와 현재 확인 상태</caption>
            <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">정보</th><th scope="col" role="columnheader">출처</th><th scope="col" role="columnheader">현재 상태</th></tr></thead>
            <tbody role="rowgroup">
              <tr role="row"><td role="cell"><span class="mobile-label">정보</span>회차별 당첨 번호·보너스·등수별 당첨금·당첨자 수</td><td role="cell"><span class="mobile-label">출처</span><a href="https://www.dhlottery.co.kr/lt645/result" class="content-link" rel="noopener" target="_blank">동행복권 공식 추첨 결과 화면</a></td><td role="cell"><span class="mobile-label">현재 상태</span>${escapeHtml(drawsCoverageText(drawsData))}, 마지막 확인 ${escapeHtml(checked)} (한국 시간)</td></tr>
              <tr role="row"><td role="cell"><span class="mobile-label">정보</span>판매점 상호·주소·1·2등 배출 이력</td><td role="cell"><span class="mobile-label">출처</span><a href="https://www.dhlottery.co.kr/wnprchsplcsrch/home" class="content-link" rel="noopener" target="_blank">동행복권 공식 당첨 판매점</a></td><td role="cell"><span class="mobile-label">현재 상태</span>${escapeHtml(shopPeriodText(shopsData))} · 마지막 확인 ${escapeHtml(shopsData?.meta?.checkedAt ? formatDateTimeKst(shopsData.meta.checkedAt) : '미확보')} (한국 시간)</td></tr>
              <tr role="row"><td role="cell"><span class="mobile-label">정보</span>판매점 주소 대조·영업 상태 판별 자료</td><td role="cell"><span class="mobile-label">출처</span><a href="https://www.data.go.kr/data/15086355/fileData.do" class="content-link" rel="noopener" target="_blank">공공데이터포털 복권판매점 목록</a></td><td role="cell"><span class="mobile-label">현재 상태</span>${escapeHtml(shopsStatus)}. 목록 일치 여부는 현장 영업 확인을 대신하지 않습니다.</td></tr>
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-sm text-slate-600">마이로또맵은 동행복권의 공식 API를 사용하지 않습니다. 공식 결과 화면에 표시되는 값을 확인해 가져오며, 표시하는 모든 결과에는 출처와 확인 시각을 기록합니다.</p>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">수집 주기와 업데이트</h2>
        <ul class="list-disc list-inside space-y-1">
          <li>당첨 결과는 추첨 후 공식 자료를 확인하고 검증을 통과한 데이터만 반영합니다. 화면의 마지막 확인 시각을 기준으로 읽어 주세요.</li>
          <li>추첨 결과가 발표되지 않은 회차는 만들지 않고 결과 대기로 표시합니다.</li>
          <li>가져오기나 검증에 실패하면 마지막 정상 데이터를 그대로 두고 화면에 업데이트 지연을 표시합니다.</li>
          <li>판매점 목록은 공공데이터포털 자료의 갱신 주기(연 단위)에 맞춰 반영합니다.</li>
        </ul>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">검증 절차</h2>
        <ol class="verification-steps">
          <li>번호가 1~45 범위인지, 본번호 6개가 서로 다른지, 보너스 번호가 본번호와 겹치지 않는지 검사합니다.</li>
          <li>회차 번호 중복과 추첨일 형식(연도-월-일)을 검사합니다.</li>
          <li>당첨금·당첨자 수는 확인되지 않은 값(미확보)과 실제 0을 구분해 저장합니다.</li>
          <li>이미 저장된 회차와 값이 다르면 덮어쓰지 않고 중단해 원인을 확인합니다.</li>
          <li>모든 검사를 통과한 경우에만 공개 데이터를 교체합니다.</li>
        </ol>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">집계 기간과 통계의 한계</h2>
        <ul class="list-disc list-inside space-y-1">
          <li>당첨 결과·번호 통계·내 번호 당첨 확인은 같은 검증 데이터를 사용합니다. 현재 범위: ${escapeHtml(drawsCoverageText(drawsData))}.</li>
          <li><a href="/stats/" class="content-link">번호 통계</a>는 화면에 표시된 분석 회차 수만큼의 기록으로 계산합니다. 회차 수가 적으면 번호별 차이가 우연에 크게 좌우됩니다.</li>
          <li>매 회차 추첨은 이전 결과와 독립이므로, 과거에 자주 나왔거나 오래 나오지 않은 번호가 다음 회차에 더 잘 나온다는 근거는 없습니다.</li>
          <li>판매점 배출 이력 집계 기간: ${escapeHtml(shopPeriodText(shopsData))}.</li>
        </ul>
      </section>

      <section id="shop-count-methodology" class="card mb-6">
        <h2 class="section-title mb-3">배출 횟수를 당첨률로 해석하지 않는 이유</h2>
        <p class="leading-relaxed">판매점의 1·2등 배출 횟수는 그 판매점에서 팔린 복권 수에 크게 좌우됩니다. 판매량이 많으면 같은 확률에서도 당첨이 더 많이 나옵니다. 마이로또맵은 판매점별 판매량 자료를 가지고 있지 않으므로 배출 횟수를 판매점의 당첨 확률·당첨률로 바꾸어 표시하지 않으며, 특정 판매점에서 사면 당첨 가능성이 높아진다고 안내하지 않습니다. 자세한 내용은 <a href="/guides/shop-win-count/" class="content-link">명당 배출 횟수를 해석할 때 알아둘 점</a>을 참고하세요.</p>
        ${internetWinsText(shopsData?.meta) ? `<p class="leading-relaxed mt-3">${escapeHtml(internetWinsText(shopsData.meta))}</p>` : ''}
      </section>

      <section class="card">
        <h2 class="section-title mb-3">판매점 좌표</h2>
        <p class="leading-relaxed mb-2">지도 핀은 출처와 확인 시각이 기록된 좌표가 있는 판매점에만 표시합니다. 현재: ${escapeHtml(shopsStatus)}.</p>
        <p class="leading-relaxed">지도 서비스의 주소 검색 결과는 이용 조건상 저장해 다시 쓸 수 없어 좌표 출처로 사용하지 않습니다. ${withCoord
          ? '좌표가 없는 판매점은 지도 핀 없이 주소와 외부 길찾기 링크로 제공합니다.'
          : '저장·공개가 허용된 좌표 자료를 아직 확보하지 못했으며, 확보 전에는 판매점을 지도 핀 없이 주소와 외부 길찾기 링크로 제공합니다.'}</p>
        <p class="mt-4 text-xs text-slate-400">수정일 ${METHODOLOGY_UPDATED_AT}</p>
      </section>
    </div>
  `;
  return renderLayout({
    title: '데이터·통계 설명 - 마이로또맵',
    description: '마이로또맵 당첨 결과와 판매점 정보의 출처(동행복권·공공데이터포털), 주 1~2회 수집 주기, 검증 절차, 통계와 배출 횟수의 한계, 좌표 현황을 설명합니다.',
    canonicalUrl: `${siteUrl}/data-methodology/`,
    currentPath: '/data-methodology/',
    isFixture,
    site,
    content,
  });
}
