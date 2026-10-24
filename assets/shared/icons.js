// Original My Lotto Map line icons, drawn on a 24px grid; no external assets.
const paths = {
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15m6-12v15"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-4 2h8m-9 0h10"/>',
  chart: '<path d="M4 3v17h17M8 15v-4m5 4V6m5 9V9"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 3v4m-2-2h4"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4Z"/><path d="M9 8h6m-6 4h4"/>',
  settings: '<path d="m10 3-.5 2-2 1L5 5l-2 4 2 1v4l-2 1 2 4 2.5-1 2 1 .5 2h4l.5-2 2-1 2.5 1 2-4-2-1v-4l2-1-2-4-2.5 1-2-1-.5-2Z"/><circle cx="12" cy="12" r="3"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  chevron: '<path d="m6 14 6-6 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  external: '<path d="M14 3h7v7m0-7L10 14m1-9H4v15h15v-7"/>',
  store: '<path d="M4 10v11h16V10M3 10l2-7h14l2 7M3 10q3 4 6 0 3 4 6 0 3 4 6 0M9 21v-7h6v7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  pause: '<path d="M9 5v14m6-14v14"/>',
  play: '<path d="M8 5v14l11-7Z"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
};

export function icon(name) {
  if (!Object.hasOwn(paths, name)) throw new Error(`Unknown icon: ${name}`);
  return `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}

export function mapIllustration() {
  return `<svg class="map-illustration" width="160" height="112" viewBox="0 0 160 112" fill="none" aria-hidden="true" focusable="false"><rect x="4" y="4" width="152" height="104" rx="28" fill="currentColor" opacity=".05"/><path d="m26 40 35-12 38 13 35-12v51l-35 13-38-13-35 12Z" fill="currentColor" opacity=".08"/><g stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m26 40 35-12 38 13 35-12v51l-35 13-38-13-35 12Zm35-12v52m38-39v52" opacity=".35"/><path d="M96 38c0 13-16 27-16 27S64 51 64 38a16 16 0 1 1 32 0Z" fill="var(--bg-card)"/><circle cx="80" cy="38" r="5"/><path d="M48 68h8m53 2h9"/></g></svg>`;
}
