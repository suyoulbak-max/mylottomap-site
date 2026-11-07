// 문의·오류 제보 (/contact/) 렌더러와 운영자 정보 판별
import { renderLayout } from '../shared/layout.js';
import { escapeHtml } from '../shared/format.js';

export const OPERATOR_PENDING = '운영자 정보 준비 중';

/**
 * site.config.json의 운영자 정보. 형식이 맞지 않는 이메일은 없는 것으로 본다(가짜·잘못된 연락처 공개 방지).
 * ready: 운영자명과 연락처가 모두 있을 때만 true → 개인정보처리방침·약관 색인 허용 기준
 */
export function getOperator(siteConfig = {}) {
  const name = String(siteConfig.operatorName || '').trim();
  const rawEmail = String(siteConfig.contactEmail || '').trim();
  const email = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(rawEmail) ? rawEmail : '';
  // Web3Forms 접근 키(UUID). 공개해도 되는 값이며, 키가 있을 때만 문의 양식을 만든다(수신 메일 주소는 공개하지 않음).
  const rawKey = String(siteConfig.contactFormKey || '').trim();
  const formKey = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawKey) ? rawKey : '';
  return { name, email, formKey, ready: Boolean(name && (email || formKey)) };
}

/** 운영자·문의 항목 HTML. 정보가 없으면 '운영자 정보 준비 중' */
export function renderOperatorItems(siteConfig) {
  const { name, email, formKey } = getOperator(siteConfig);
  const contact = email
    ? `<a href="mailto:${escapeHtml(email)}" class="content-link">${escapeHtml(email)}</a> (<a href="/contact/" class="content-link">문의·오류 제보 안내</a>)`
    : formKey ? '<a href="/contact/" class="content-link">문의·오류 제보 양식</a>'
    : OPERATOR_PENDING;
  return `<li>운영자: ${name ? escapeHtml(name) : OPERATOR_PENDING}</li>
          <li>문의: ${contact}</li>`;
}

// 문의 양식에서 받는 개인정보 처리 안내(동의 문구와 개인정보처리방침이 같은 내용을 쓴다)
export const CONTACT_FORM_PRIVACY = {
  items: '회신 받을 이메일(필수), 문의 내용(필수), 문의 유형, 이름(선택)',
  purpose: '문의 확인과 회신, 오류 제보 확인·반영',
  retention: '문의 처리 완료 후 1년 이내 삭제',
};

function renderContactForm(formKey) {
  return `
      <section class="card mb-6" aria-labelledby="contact-form-title">
        <h2 id="contact-form-title" class="section-title mb-3">문의 보내기</h2>
        <form id="contact-form" class="contact-form" action="https://api.web3forms.com/submit" method="POST">
          <input type="hidden" name="access_key" value="${escapeHtml(formKey)}">
          <input type="hidden" name="subject" value="[마이로또맵] 문의·오류 제보">
          <input type="hidden" name="from_name" value="마이로또맵 문의 양식">
          <input type="checkbox" name="botcheck" class="hidden" style="display: none;" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="form-group">
            <label for="contact-type" class="form-label">문의 유형</label>
            <select id="contact-type" name="문의 유형" class="form-select">
              <option>서비스 문의</option>
              <option>당첨 결과 오류 제보</option>
              <option>판매점 정보 오류 제보</option>
              <option>기타</option>
            </select>
          </div>
          <div class="form-group">
            <label for="contact-name" class="form-label">이름 <span class="form-hint">(선택)</span></label>
            <input id="contact-name" name="name" class="form-input" maxlength="40" autocomplete="name">
          </div>
          <div class="form-group">
            <label for="contact-email" class="form-label">회신 받을 이메일</label>
            <input id="contact-email" type="email" name="email" class="form-input" maxlength="100" autocomplete="email" required aria-describedby="contact-email-hint">
            <p id="contact-email-hint" class="form-hint">답변은 이 주소로 보냅니다.</p>
          </div>
          <div class="form-group">
            <label for="contact-message" class="form-label">내용</label>
            <textarea id="contact-message" name="message" class="form-input contact-message" rows="7" maxlength="2000" required></textarea>
          </div>
          <div class="contact-consent">
            <label class="contact-consent-label"><input type="checkbox" name="개인정보 수집·이용 동의" value="동의함" required> 개인정보 수집·이용에 동의합니다 (필수)</label>
            <ul class="contact-consent-detail">
              <li>항목: ${CONTACT_FORM_PRIVACY.items}</li>
              <li>목적: ${CONTACT_FORM_PRIVACY.purpose}</li>
              <li>보유 기간: ${CONTACT_FORM_PRIVACY.retention}</li>
              <li>전송: 양식 전송 서비스 Web3Forms(미국 서버)를 거쳐 운영자 메일함으로 전달됩니다. 자세한 내용은 <a href="/privacy/#contact-form" class="content-link">개인정보처리방침</a>을 확인하세요.</li>
            </ul>
            <p class="form-hint">동의하지 않으면 문의 양식을 이용할 수 없습니다.</p>
          </div>
          <button type="submit" class="btn btn-primary btn-block">보내기</button>
          <p id="contact-status" class="contact-status" role="status" aria-live="polite"></p>
        </form>
      </section>`;
}

/** 연락 방법(이메일 또는 문의 양식 키)이 없으면 null을 반환한다. 작동하지 않는 문의 페이지를 만들지 않는다. */
export function renderContactPage({ siteConfig, site = {}, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const { email, formKey } = getOperator(siteConfig);
  if (!email && !formKey) return null;

  const content = `
    <div class="max-w-2xl mx-auto">
      <div class="section-header text-center mb-6">
        <h1 class="text-3xl font-black mb-2">문의·오류 제보</h1>
        <p class="text-slate-500">서비스 문의와 당첨 결과·판매점 정보의 오류 제보를 ${formKey ? '아래 양식으로' : '이메일로'} 받습니다.</p>
      </div>
      ${formKey ? renderContactForm(formKey) : `
      <section class="card mb-6">
        <h2 class="section-title mb-3">이메일</h2>
        <p class="text-lg font-bold"><a href="mailto:${escapeHtml(email)}" class="content-link">${escapeHtml(email)}</a></p>
        <p class="text-sm text-slate-500 mt-2">이메일 앱이 열리지 않으면 위 주소를 복사해 보내 주세요.</p>
      </section>`}
      <section class="card">
        <h2 class="section-title mb-3">오류 제보 시 함께 적어 주세요</h2>
        <ul class="list-disc list-inside space-y-1">
          <li>당첨 결과: 회차, 잘못 표시된 항목(번호·추첨일·당첨금·당첨자 수)</li>
          <li>판매점: 판매점 이름, 주소, 잘못된 내용(이전·폐업·위치·당첨 이력)</li>
          <li>확인한 근거: 동행복권 공식 화면 주소 등</li>
        </ul>
        <p class="mt-4 text-sm text-slate-600">제보 내용은 공식 출처와 대조한 뒤 반영합니다. 내 번호와 설정은 이용자 브라우저에만 있어 운영자가 확인하거나 복구할 수 없습니다.</p>
      </section>
    </div>
  `;
  return renderLayout({
    title: '문의·오류 제보 - 마이로또맵',
    description: '마이로또맵 서비스 문의와 로또 당첨 결과·판매점 정보 오류 제보 방법을 안내합니다.',
    canonicalUrl: `${siteUrl}/contact/`,
    currentPath: '/contact/',
    isFixture,
    site,
    content,
    scriptExtra: formKey ? '<script type="module" src="/assets/client/contact.js"></script>' : '',
  });
}
