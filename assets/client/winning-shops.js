function openRoundAnchor() {
  const target = document.getElementById(window.location.hash.slice(1));
  if (!target?.matches('details.winning-round')) return;
  target.open = true;
  target.scrollIntoView({ block: 'start' });
}

window.addEventListener('hashchange', openRoundAnchor);
window.addEventListener('pageshow', () => requestAnimationFrame(openRoundAnchor));
document.querySelector('.winning-chips')?.addEventListener('click', event => {
  if (event.target.closest('a')?.hash === window.location.hash) openRoundAnchor();
});
openRoundAnchor();
