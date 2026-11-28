// 가이드 상세 (/guides/<slug>/) 렌더러와 가이드 원문(마크다운) 변환
import { renderLayout, breadcrumbLd } from '../shared/layout.js';
import { escapeHtml } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { parseWriterDoc, PLACEHOLDER_RE } from '../shared/writer-content.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 가이드 원고. 기존 형식(publishedAt·updatedAt)과 Writer 형식(datePublished·dateModified·author·faq·url)을 함께 읽는다.
 * Writer 형식의 url은 파일 이름 주소와 같아야 한다(주소가 바뀌지 않게). 작업 메모 절은 빠진다.
 */
export function parseGuide(raw, slug) {
  if (!/^﻿?---\r?\n/.test(raw)) throw new Error(`가이드 머리말 없음: ${slug}`);
  const { meta, faq, body } = parseWriterDoc(raw);
  const guide = { slug, ...meta, publishedAt: meta.publishedAt || meta.datePublished, updatedAt: meta.updatedAt || meta.dateModified, faq, body };
  for (const key of ['title', 'description', 'publishedAt', 'updatedAt']) {
    if (!guide[key]) throw new Error(`가이드 머리말 ${key} 누락: ${slug}`);
  }
  for (const key of ['publishedAt', 'updatedAt']) {
    if (!DATE_RE.test(guide[key])) throw new Error(`가이드 ${key} 형식 오류(YYYY-MM-DD): ${slug}`);
  }
  if (meta.url && meta.url !== `/guides/${slug}/`) throw new Error(`가이드 url(${meta.url})이 파일 이름 주소와 다름: ${slug}`);
  return guide;
}

/**
 * Writer 슬롯 파일(content/regions/*.md, content/about.md). 머리말은 선택.
 * 반환: { title?, description?, updatedAt?, author?, url?, paths?, faq, body, placeholderNames } — 자리표시는 빌드가 채운다.
 * placeholderNames: 본문·FAQ에 쓰인 자리표시 이름(같은 쪽의 데이터 문장과 겹치는지 보는 데 쓴다)
 */
export function parseSlot(raw, name) {
  const { meta, faq, body } = parseWriterDoc(raw);
  const updatedAt = meta.updatedAt || meta.dateModified;
  if (updatedAt && !DATE_RE.test(updatedAt)) throw new Error(`슬롯 수정일 형식 오류(YYYY-MM-DD): ${name}`);
  const placeholderNames = [...[body, ...faq.flatMap((x) => [x.q, x.a])].join('\n').matchAll(PLACEHOLDER_RE)].map((m) => m[1]);
  return { title: meta.title, description: meta.description, updatedAt, author: meta.author, url: meta.url, paths: Array.isArray(meta.paths) ? meta.paths : undefined, faq, body, placeholderNames };
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

/** FAQ 구역 제목. 본문에 이 제목의 ## 구역이 있으면 그 안의 ### 질문과 아래 문단을 FAQ로 읽는다. */
export const FAQ_HEADING = '자주 묻는 질문';
const plain = (md) => md.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1').replace(LIST_RE, '').trim();

/**
 * 본문 '## 자주 묻는 질문' 구역의 질문·답. 화면에 보이는 문장 그대로다(FAQPage 구조화 데이터용).
 * 답이 비어 있는 질문은 넣지 않는다. 구역이 없으면 빈 배열.
 * @returns {{ question: string, answer: string }[]}
 */
export function extractFaq(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${FAQ_HEADING}`);
  if (start < 0) return [];
  const faq = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const q = /^###\s+(.*)$/.exec(line);
    if (q) faq.push({ question: plain(q[1]), answer: [] });
    else if (line.trim() && faq.length) faq.at(-1).answer.push(plain(line));
  }
  return faq.map((x) => ({ question: x.question, answer: x.answer.join(' ') })).filter((x) => x.question && x.answer);
}

export function faqLd(faq) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((x) => ({ '@type': 'Question', name: x.question, acceptedAnswer: { '@type': 'Answer', text: x.answer } })),
  };
}

/**
 * @param {{ path: string, label: string }[]} [regionLinks] 이 글과 연결할 지역 허브(시도 목록). 비면 표시하지 않는다.
 */
export function renderGuideDetailPage({ siteConfig, guide, site = {}, isFixture = false, regionLinks = [] }) {
  const { siteUrl = 'https://mylottomap.com' } = siteConfig;
  const author = guide.author || '마이로또맵';
  const faq = extractFaq(guide.body);
  const content = `
    <article class="content-page themed-page guide-detail-page">
      <nav class="guide-detail-nav" aria-label="가이드 탐색"><a href="/guides/" class="content-link">&larr; 가이드 목록</a></nav>
      <header class="page-intro themed-intro guide-detail-intro">
        <span class="page-intro-icon" aria-hidden="true">${icon('bookmark')}</span>
        <div class="guide-detail-heading">
          <h1>${escapeHtml(guide.title)}</h1>
          <p class="guide-detail-meta"><span><strong>작성</strong> ${escapeHtml(author)}</span><span><strong>작성일</strong> ${escapeHtml(guide.publishedAt)}</span><span><strong>수정일</strong> ${escapeHtml(guide.updatedAt)}</span></p>
        </div>
      </header>
      <div class="card guide-detail-content">
        ${markdownToHtml(guide.body)}
      </div>
      ${regionLinks.length ? `<nav class="card mt-6" aria-label="지역별 1등 배출 판매점"><h2 class="section-title mb-3">${icon('map')} 지역별 1등 배출 판매점</h2><ul class="region-link-list"><li><a class="filter-chip" href="/shops/">전국 판매점</a></li>${regionLinks.map((x) => `<li><a class="filter-chip" href="${x.path}">${escapeHtml(x.label)}</a></li>`).join('')}</ul></nav>` : ''}
    </article>
  `;
  return renderLayout({
    title: `${guide.title} - 마이로또맵 가이드`,
    description: guide.description,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guide.title,
        description: guide.description,
        datePublished: guide.publishedAt,
        dateModified: guide.updatedAt,
        inLanguage: 'ko-KR',
        mainEntityOfPage: `${siteUrl}/guides/${guide.slug}/`,
        image: `${siteUrl}/assets/shared/og-image-20261013.png`,
        author: { '@type': 'Organization', name: author, url: `${siteUrl}/about/` },
        publisher: { '@type': 'Organization', name: '마이로또맵', url: `${siteUrl}/` },
      },
      ...(faq.length ? [faqLd(faq)] : []),
      breadcrumbLd(siteUrl, [{ label: '가이드', path: '/guides/' }, { label: guide.title }]),
    ],
    canonicalUrl: `${siteUrl}/guides/${guide.slug}/`,
    currentPath: `/guides/${guide.slug}/`,
    isFixture,
    site,
    content,
  });
}
