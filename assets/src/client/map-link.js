// 「명당맵에서 보기」 버튼(data-map-shop="판매점ID") → 홈 지도에서 그 판매점 열기.
// 판매점마다 /?shop= 주소를 HTML 링크로 두면 크롤러가 홈 변형 주소 약 2만 개를 따라가므로, 주소는 누를 때 만든다.
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-map-shop]');
  if (button) window.location.href = `/?shop=${encodeURIComponent(button.dataset.mapShop)}`;
});
