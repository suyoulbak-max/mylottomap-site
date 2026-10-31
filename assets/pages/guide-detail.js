// 가이드 상세 (/guides/<slug>/) 렌더러와 가이드 원문(마크다운) 변환
import { renderLayout } from '../shared/layout.js';
import { escapeHtml } from '../shared/format.js';
import { icon } from '../shared/icons.js';

/** 머리말(--- key: value ---)과 본문을 분리한다. */
export function parseGuide(raw, slug) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`가이드 머리말 없음: ${slug}`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const key of ['title', 'description', 'publishedAt', 'updatedAt']) {
    if (!meta[key]) throw new Error(`가이드 머리말 ${key} 누락: ${slug}`);
  }
  for (const key of ['publishedAt', 'updatedAt']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta[key])) throw new Error(`가이드 ${key} 형식 오류(YYYY-MM-DD): ${slug}`);
  }
  return { slug, ...meta, body: m[2] };
}

/** 굵게·링크만 지원하는 줄 안 변환. 입력은 먼저 이스케이프한다. */
function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label, href) => {
      if (!/^(\/|https?:\/\/)/.test(href)) return all;
      const external = href.startsWith('http');
      return `<a href="${href}" class="content-link"${external ? ' rel="noopener" target="_blank"' : ''}>${label}</a>`;
    });
}

const LIST_RE = /^\s*([-*]|\d+\.)\s+/;
const splitRow = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

/** 제목·문단·목록·표·굵게·링크만 지원하는 최소 마크다운 변환기 */
export function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p class="mb-4 leading-relaxed">${inline(para.join(' '))}</p>`);
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }

    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      const cls = level === 2 ? 'text-xl font-bold mt-8 mb-3' : 'text-lg font-bold mt-6 mb-2';
      out.push(`<h${level} class="${cls}">${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (LIST_RE.test(line)) {
      flush();
      const ordered = /^\s*\d/.test(line);
      const items = [];
      for (; i < lines.length && LIST_RE.test(lines[i]); i++) items.push(`<li>${inline(lines[i].replace(LIST_RE, ''))}</li>`);
      i--;
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag} class="${ordered ? '' : 'list-disc '}list-inside space-y-1 mb-4">${items.join('')}</${tag}>`);
      continue;
    }

    const next = lines[i + 1] || '';
    if (line.trim().startsWith('|') && /^\s*\|[\s:|-]*-[\s:|-]*$/.test(next)) {
      flush();
      const head = splitRow(line);
      const rows = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(splitRow(lines[i]));
      i--;
      const th = head.map((c) => `<th scope="col">${inline(c)}</th>`).join('');
      const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
      out.push(`<div class="table-wrap mb-4"><table class="data-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`);
      continue;
    }

    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

export function renderGuideDetailPage({ siteConfig, guide, site = {}, isFixture = false }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const content = `
    <article class="content-page themed-page guide-detail-page">
      <nav class="guide-detail-nav" aria-label="가이드 탐색"><a href="/guides/" class="content-link">&larr; 가이드 목록</a></nav>
      <header class="page-intro themed-intro guide-detail-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('bookmark')}</span>
        <div class="guide-detail-heading">
          <h1>${escapeHtml(guide.title)}</h1>
          <p class="guide-detail-meta"><span><strong>작성일</strong> ${escapeHtml(guide.publishedAt)}</span><span><strong>수정일</strong> ${escapeHtml(guide.updatedAt)}</span></p>
        </div>
      </header>
      <div class="card guide-detail-content">
        ${markdownToHtml(guide.body)}
      </div>
    </article>
  `;
  return renderLayout({
    title: `${guide.title} - 마이로또맵 가이드`,
    description: guide.description,
    canonicalUrl: `${siteUrl}/guides/${guide.slug}/`,
    currentPath: `/guides/${guide.slug}/`,
    isFixture,
    site,
    content,
  });
}
