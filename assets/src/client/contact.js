// 문의 양식 전송(Web3Forms). 스크립트가 없으면 양식이 Web3Forms로 바로 전송되고 그쪽 완료 화면이 뜬다.
const form = document.getElementById('contact-form');
const status = document.getElementById('contact-status');
const button = form?.querySelector('button[type="submit"]');

function show(message, kind) {
  status.textContent = message;
  status.dataset.kind = kind;
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  button.disabled = true;
  show('보내는 중입니다…', 'pending');
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
    form.reset();
    show('문의가 접수되었습니다. 입력하신 이메일로 회신드리겠습니다.', 'success');
  } catch {
    show('보내지 못했습니다. 잠시 후 다시 시도해 주세요. 입력한 내용은 그대로 남아 있습니다.', 'error');
  } finally {
    button.disabled = false;
  }
});
