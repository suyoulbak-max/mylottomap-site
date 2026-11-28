// 개인정보처리방침 (/privacy/) 렌더러. 실제 처리 내용만 적는다.
import { renderLayout } from '../shared/layout.js';
import { icon } from '../shared/icons.js';
import { getOperator, renderOperatorItems, CONTACT_FORM_PRIVACY } from './contact.js';

export const PRIVACY_UPDATED_AT = '2026-10-12';

export function renderPrivacyPage({ siteConfig, site = {}, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  // 문의 양식은 Web3Forms 키가 설정된 경우에만 존재한다. 방침도 실제 운영과 같게 그린다.
  const hasForm = Boolean(getOperator(siteConfig).formKey);
  const contactFormSection = hasForm ? `
      <section class="card mb-6" id="contact-form">
        <h2 class="section-title mb-3">6. 문의 양식</h2>
        <p class="leading-relaxed"><a href="/contact/" class="content-link">문의·오류 제보</a> 양식을 이용할 때에만 아래 정보를 받습니다. 동의하지 않으면 문의 양식을 이용할 수 없으며, 서비스의 다른 기능은 그대로 이용할 수 있습니다.</p>
        <ul class="list-disc list-inside space-y-1 mt-3">
          <li>수집 항목: ${CONTACT_FORM_PRIVACY.items}</li>
          <li>이용 목적: ${CONTACT_FORM_PRIVACY.purpose}</li>
          <li>보유 기간: ${CONTACT_FORM_PRIVACY.retention}</li>
        </ul>
        <h3 class="font-bold mt-4 mb-2">처리 위탁과 국외 이전</h3>
        <ul class="list-disc list-inside space-y-1">
          <li>Web3Forms(<a href="https://web3forms.com" class="content-link" target="_blank" rel="noopener">web3forms.com</a>): 양식 내용을 운영자 메일함으로 전달합니다. 서버 위치는 미국(US-East)이며, 양식을 보낼 때 인터넷으로 전송됩니다. 제공사는 제출 내용을 저장하지 않고 전달만 하며, 개인 식별 정보가 담긴 서버 기록은 약 2개월마다 삭제한다고 안내합니다.</li>
          <li>Google(Gmail): 전달된 문의를 운영자 메일함에 보관합니다. 위 보유 기간이 지나면 삭제합니다.</li>
        </ul>
      </section>` : '';
  const content = `
    <div class="content-page themed-page info-page policy-page">
      <div class="page-intro themed-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('lock')}</span>
        <div><h1 class="mb-2">개인정보처리방침</h1>
        <p>시행일 ${PRIVACY_UPDATED_AT}</p></div>
      </div>

      <section class="card mb-6">
        <h2 class="section-title mb-3">1. 수집하는 개인정보</h2>
        <p class="leading-relaxed">마이로또맵은 회원가입·로그인 기능이 없으며, ${hasForm ? '이름·연락처는 이용자가 문의 양식을 보낼 때에만 받습니다(6장)' : '이름·연락처를 입력받는 폼이 없습니다'}. 웹사이트를 제공하는 과정에서는 호스팅·전송 서비스에 접속 기록(IP 주소, 브라우저 종류, 접속 시각)이 남을 수 있습니다. 실제 기록 항목·보유기간·처리 사업자는 운영 환경에 따라 달라지며, 현재 이 페이지에서 확정하여 안내할 정보가 마련되지 않았습니다.</p>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">2. 브라우저에만 저장되는 정보</h2>
        <ul class="list-disc list-inside space-y-1">
          <li>내 번호: 대상 회차, 번호 6개, 저장 시각</li>
          <li>설정: 기본 지역, 지도 표시 형태(일반·위성)</li>
        </ul>
        <p class="mt-3 leading-relaxed">위 정보는 이용자 브라우저의 로컬 저장소(localStorage)에만 저장되며 마이로또맵 서버로 전송되지 않습니다. 같은 브라우저에서만 볼 수 있고, <a href="/my-numbers/" class="content-link">내 번호</a> 화면의 삭제 기능이나 브라우저의 사이트 데이터 삭제로 지울 수 있습니다. 운영자는 이 정보를 확인하거나 복구할 수 없습니다.</p>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">3. 위치 정보</h2>
        <p class="leading-relaxed">명당맵의 내 위치 버튼을 누를 때에만 브라우저가 위치 권한을 요청합니다. 허용하면 현재 위치를 지도 중심 이동에 사용하며, 사이트 코드가 정밀 위치를 별도로 저장하거나 마이로또맵 서버로 전송하지 않습니다. 다만 외부 지도 서비스에 해당 영역의 지도를 요청할 수 있습니다. 권한을 거부해도 지역·상호 검색과 판매점 목록을 이용할 수 있습니다. 위치 권한은 브라우저의 사이트 권한 설정에서 철회할 수 있습니다.</p>
      </section>

      <section class="card mb-6">
        <h2 class="section-title mb-3">4. 네이버 지도</h2>
        <p class="leading-relaxed">명당맵은 네이버 클라우드 플랫폼의 Maps 서비스를 불러옵니다. 이용자 브라우저가 지도 제공사에 접속하면서 IP 주소 등 접속 정보와 표시할 지도 영역이 전달될 수 있습니다. 지도 제공사의 처리 내용은 <a href="https://www.ncloud.com/policy/infou" class="content-link" target="_blank" rel="noopener">네이버클라우드 개인정보처리방침</a>을 확인하세요. 판매점의 외부 길찾기 링크를 누르면 네이버 지도 사이트로 이동하며 그 사이트의 방침이 적용됩니다. 지도를 불러오지 못해도 판매점 목록과 주소는 확인할 수 있습니다.</p>
      </section>

      <section class="card mb-6" id="ads">
        <h2 class="section-title mb-3">5. 광고(Google AdSense)와 쿠키</h2>
        <p class="leading-relaxed">마이로또맵은 무료 운영을 위해 Google AdSense로 광고를 게재합니다. 광고는 Google의 심사·승인 후 광고가 표시되는 페이지부터 게재되며, 아래 내용은 광고가 표시되는 페이지에 적용됩니다.</p>
        <ul class="list-disc list-inside space-y-1 mt-3">
          <li>Google 및 서드 파티 공급업체는 쿠키를 사용해 사용자가 이전에 이 웹사이트나 다른 웹사이트를 방문한 기록을 토대로 광고를 게재합니다.</li>
          <li>Google의 광고 쿠키 사용으로 Google과 파트너는 사용자의 마이로또맵 방문 및/또는 인터넷상의 다른 사이트 방문 기록을 토대로 광고를 게재할 수 있습니다.</li>
          <li>이 과정에서 Google과 광고 사업자가 쿠키 등 식별자, 방문한 페이지, 접속 기록(IP 주소, 브라우저 종류, 접속 시각) 같은 정보를 처리할 수 있습니다. 이 정보는 Google과 해당 광고 사업자가 각자의 방침에 따라 처리하며, 마이로또맵은 이를 직접 수집·보관하지 않습니다.</li>
          <li>AdSense 설정에 따라 Google 외의 인증된 제3자 광고 사업자가 광고를 게재할 수 있습니다.</li>
        </ul>
        <h3 class="font-bold mt-4 mb-2">맞춤형 광고·쿠키 거부 방법</h3>
        <ul class="list-disc list-inside space-y-1">
          <li><a href="https://www.google.com/settings/ads" class="content-link" target="_blank" rel="noopener">Google 광고 설정</a>에서 맞춤형 광고를 사용하지 않도록 설정할 수 있습니다.</li>
          <li><a href="https://www.aboutads.info/choices/" class="content-link" target="_blank" rel="noopener">www.aboutads.info</a>에서 서드 파티 공급업체의 맞춤형 광고용 쿠키 사용을 거부할 수 있습니다.</li>
          <li>브라우저 설정에서 쿠키를 차단하거나 삭제할 수 있습니다. 쿠키를 거부해도 마이로또맵의 모든 기능을 그대로 이용할 수 있으며, 이때에도 맞춤형이 아닌 광고는 표시될 수 있습니다.</li>
        </ul>
        <p class="mt-3 leading-relaxed">Google의 데이터 이용 방식은 <a href="https://policies.google.com/technologies/partner-sites?hl=ko" class="content-link" target="_blank" rel="noopener">Google 서비스를 사용하는 사이트의 정보 처리 안내</a>와 <a href="https://policies.google.com/technologies/ads?hl=ko" class="content-link" target="_blank" rel="noopener">Google 광고 정책</a>에서 볼 수 있습니다.</p>
        <p class="mt-3 leading-relaxed">마이로또맵 자체는 쿠키를 설정하지 않으며, 방문 분석 도구를 사용하지 않습니다. 분석 도구를 도입하면 사용하는 서비스와 처리 항목을 이 방침에 먼저 반영하고 시행일을 갱신합니다.</p>
      </section>

${contactFormSection}
      <section class="card">
        <h2 class="section-title mb-3">${hasForm ? 7 : 6}. 운영자와 문의</h2>
        <ul class="list-disc list-inside space-y-1">
          ${renderOperatorItems(siteConfig)}
        </ul>
        <p class="mt-4 text-xs text-slate-400">시행일 ${PRIVACY_UPDATED_AT} · 변경 이력: 2026-10-12 Google AdSense 광고와 쿠키 안내 추가(이전 시행일 2026-10-09)</p>
      </section>
    </div>
  `;
  return renderLayout({
    title: '개인정보처리방침 - 마이로또맵',
    description: '마이로또맵은 회원가입 없이 이용하며 내 번호·설정은 브라우저에만 저장합니다. 위치 정보, 네이버 지도, Google AdSense 광고와 쿠키, 맞춤형 광고 거부 방법을 안내합니다.',
    canonicalUrl: `${siteUrl}/privacy/`,
    currentPath: '/privacy/',
    noindex: !getOperator(siteConfig).ready, // 운영자 정보가 준비되면 자동으로 색인 허용
    isFixture,
    site,
    content,
  });
}
