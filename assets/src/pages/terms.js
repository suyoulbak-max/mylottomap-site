// 이용약관 (/terms/) 렌더러
import { renderLayout } from '../shared/layout.js';
import { icon } from '../shared/icons.js';
import { getOperator, renderOperatorItems } from './contact.js';

export const TERMS_UPDATED_AT = '2026-10-08';

export function renderTermsPage({ siteConfig, site = {}, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const content = `
    <div class="content-page themed-page info-page policy-page">
      <div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('info')}</span>
        <div><h1 class="mb-2">이용약관</h1>
        <p>시행일 ${TERMS_UPDATED_AT}</p></div>
      </div>

      <section class="card mb-6">
        <h2 class="section-title mb-3">제1조 서비스 내용</h2>
        <p class="leading-relaxed">마이로또맵(이하 "서비스")은 로또 6/45 당첨 결과, 번호 통계, 판매점 정보, 무작위 번호 생성, 브라우저 저장 번호의 당첨 확인 기능을 무료로 제공하는 정보 서비스입니다. 서비스는 복권을 판매하거나 구매를 대행하지 않으며, 동행복권 및 복권위원회와 관계가 없습니다. 회원가입 없이 이용할 수 있습니다.</p>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">제2조 데이터의 정확성과 책임 범위</h2>
        <ul class="list-disc list-inside space-y-1">
          <li>당첨 결과와 판매점 정보는 동행복권 공식 화면과 공공데이터포털 자료를 확인해 제공하며, 출처와 확인 시각을 함께 표시합니다.</li>
          <li>업데이트 지연, 원본 자료의 변경·오류, 판매점 이전·폐업 등으로 실제와 다를 수 있습니다. 당첨 여부와 당첨금 지급은 반드시 동행복권 공식 결과와 복권 실물로 확인하세요.</li>
          <li>서비스는 표시 정보의 오류를 알게 되면 확인 후 수정하며, 서비스 정보만을 근거로 한 판단이나 손해에 대해서는 관련 법령이 허용하는 범위에서 책임을 지지 않습니다.</li>
          <li>내 번호와 설정은 이용자 브라우저에만 저장되므로, 브라우저 데이터 삭제·기기 변경 등으로 사라진 정보는 복구할 수 없습니다.</li>
        </ul>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">제3조 당첨 보장·예측이 아님</h2>
        <p class="leading-relaxed">번호 생성은 1~45에서 무작위로 고르는 기능이며 당첨 확률을 높이거나 당첨 번호를 예측하지 않습니다. 번호 통계와 판매점 배출 횟수는 과거 기록을 정리한 것으로 미래 결과를 알려 주지 않습니다. 서비스는 어떠한 경우에도 당첨을 보장하지 않습니다.</p>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">제4조 건전한 이용</h2>
        <p class="leading-relaxed">복권은 여가의 범위에서 감당할 수 있는 금액으로 구매하세요. 서비스는 과도한 구매나 사행심을 부추기는 안내를 하지 않으며, 이용자는 서비스 정보를 사행 행위를 조장하는 목적으로 이용하거나 서비스 운영을 방해하는 자동화 접근을 해서는 안 됩니다. 만 19세 미만은 복권을 구매할 수 없습니다.</p>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">제5조 외부 링크</h2>
        <p class="leading-relaxed">서비스에는 동행복권, 공공데이터포털, 네이버 지도 등 외부 사이트 링크가 있습니다. 외부 사이트의 내용과 개인정보 처리는 해당 사이트의 약관과 방침을 따르며, 서비스는 외부 사이트를 관리하지 않습니다.</p>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">제6조 약관의 변경</h2>
        <p class="leading-relaxed">약관을 변경하면 이 페이지에 변경 내용과 시행일을 표시합니다. 개인정보 처리에 관한 사항은 <a href="/privacy/" class="content-link">개인정보처리방침</a>을 따릅니다.</p>
      </section>

      <section class="card">
        <h2 class="section-title mb-3">운영자와 문의</h2>
        <ul class="list-disc list-inside space-y-1">
          ${renderOperatorItems(siteConfig)}
        </ul>
        <p class="mt-4 text-xs text-slate-400">시행일 ${TERMS_UPDATED_AT}</p>
      </section>
    </div>
  `;
  return renderLayout({
    title: '이용약관 - 마이로또맵',
    description: '마이로또맵 이용약관입니다. 서비스 내용, 데이터 정확성과 책임 범위, 당첨 보장·예측이 아니라는 점, 건전한 이용과 외부 링크를 안내합니다.',
    canonicalUrl: `${siteUrl}/terms/`,
    currentPath: '/terms/',
    noindex: !getOperator(siteConfig).ready, // 운영자 정보가 준비되면 자동으로 색인 허용
    isFixture,
    site,
    content,
  });
}
