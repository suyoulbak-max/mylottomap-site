// Writer 원고(content/guides·regions·about.md) 읽기: 머리말·FAQ, 작업 메모 절 제거, {{집계: …}} 자리표시 치환
// 원고 파일은 Writer 원본을 그대로 복사해 둔다(content/README.md). 변환은 빌드할 때만 한다.
import { computeStats, expectedNumberCount } from '../lotto/stats.js';
import { mergeSigungus, rankShops, winCounts } from './regions.js';

/** 게시하지 않는 작업 메모 절(파일 끝). 이 제목의 ## 절은 다음 ## 제목 전까지 지운다. */
export const MEMO_HEADINGS = ['확인 필요', '출처', '기존 대비 바뀐 점'];
// 소개 원고에서 기존 화면 구성 요소(데이터 범위 표)를 그대로 두라는 자리표시의 치환값. about.js가 이 문단을 표로 바꾼다.
export const KEEP_COMPONENT = 'MYLOTTOMAP_KEEP_COMPONENT';
export const PLACEHOLDER_RE = /\{\{\s*집계\s*:\s*([^}]*?)\s*\}\}/g;
const unquote = (v) => v.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

/**
 * 머리말(--- … ---)과 본문. 머리말은 `key: value` 줄, `paths:` 같은 `- 값` 목록과 `faq:` 아래 `- q: "…"` / `a: "…"` 목록만 읽는다.
 * 반환: { meta: {}, faq: [{ q, a }], body } — body는 작업 메모 절을 뺀 본문
 */
export function parseWriterDoc(raw) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  const meta = {};
  const faq = [];
  let inFaq = false;
  let listKey = null;
  for (const line of m ? m[1].split(/\r?\n/) : []) {
    const item = /^\s*-\s*q:\s*(.*)$/.exec(line);
    const answer = /^\s+a:\s*(.*)$/.exec(line);
    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (inFaq && item) faq.push({ q: unquote(item[1]), a: '' });
    else if (inFaq && answer && faq.length) faq.at(-1).a = unquote(answer[1]);
    else if (listKey && listItem) meta[listKey].push(unquote(listItem[1]));
    else {
      const kv = /^([A-Za-z]\w*):\s*(.*)$/.exec(line);
      if (!kv) continue;
      inFaq = kv[1] === 'faq' && !kv[2].trim();
      // paths: 처럼 값 없이 끝나는 키는 아래 '- 값' 줄들을 목록으로 읽는다.
      listKey = !inFaq && !kv[2].trim() ? kv[1] : null;
      if (listKey) meta[listKey] = [];
      if (!inFaq && kv[2].trim()) meta[kv[1]] = unquote(kv[2]);
    }
  }
  return { meta, faq: faq.filter((x) => x.q && x.a), body: stripMemo(m ? m[2] : raw) };
}

/** 작업 메모 절(확인 필요·출처·기존 대비 바뀐 점)을 뺀 본문 */
export function stripMemo(md) {
  const out = [];
  let skip = false;
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) skip = MEMO_HEADINGS.includes(h[1]);
    if (!skip) out.push(line);
  }
  return out.join('\n').trim();
}

/**
 * 자리표시를 값으로 바꾼다. 값이 없는 자리표시가 남은 문단(목록·표는 그 줄)은 통째로 뺀다.
 * @param {(name: string) => string|undefined} valueOf
 * @param {{ replaced: number, dropped: { where: string, names: string[] }[] }} [report] 집계 기록
 */
export function fillPlaceholders(md, valueOf, where = '', report = null) {
  const fill = (text) => {
    const missing = [];
    const out = text.replace(PLACEHOLDER_RE, (all, name) => {
      const v = valueOf(name);
      if (v == null || v === '') { missing.push(name); return all; }
      if (report) report.replaced++;
      return v;
    });
    if (missing.length && report) report.dropped.push({ where, names: missing });
    return missing.length ? null : out;
  };
  return String(md).split(/\n{2,}/).map((block) => {
    const lines = block.split('\n');
    // 목록·표는 줄 단위, 나머지 문단은 문단 단위로 뺀다.
    if (lines.every((l) => /^\s*([-*]|\d+\.|\|)/.test(l))) return lines.map(fill).filter((l) => l != null).join('\n');
    return fill(block);
  }).filter((b) => b != null && b.trim()).join('\n\n');
}

/** 머리말 FAQ → 본문 끝 「## 자주 묻는 질문」 구역(화면 FAQ와 FAQPage가 같은 원본을 쓴다). 자리표시가 남은 항목은 뺀다. */
export function faqMarkdown(faq, valueOf, where, report) {
  const items = faq.map((x) => ({ q: fillPlaceholders(x.q, valueOf, `${where} FAQ`, report), a: fillPlaceholders(x.a, valueOf, `${where} FAQ`, report) }))
    .filter((x) => x.q && x.a);
  return items.length ? `## 자주 묻는 질문\n\n${items.map((x) => `### ${x.q}\n\n${x.a}`).join('\n\n')}` : '';
}

const n = (v) => Number(v).toLocaleString('ko-KR');
const pct = (a, b) => `${(Math.round((a / b) * 1000) / 10).toFixed(1)}%`;
const METHODS = ['자동', '수동', '반자동'];

/**
 * 자리표시 값. sido를 주면 그 시도 허브용 값(시도 범위), paths까지 주면 그 시군구 페이지들을 합친 범위, 없으면 전국·사이트 값.
 * population: { source, asOf, sido: { 서울: 9274392, … } } (data/population.json). 없으면 인구 대비 값은 undefined
 * 데이터로 정할 수 없는 항목(인구 대비, 총판매액 등)은 undefined → 그 문단을 내지 않는다.
 * @param {object[]} groups groupShopsByRegion() 결과
 * @returns {(name: string) => string|undefined}
 */
export function placeholderValues({ shopsData, drawsData, groups, regionMerge = { merge: [] }, sido = null, paths = null, population = null }) {
  const period = shopsData?.meta?.period;
  const draws = [...(drawsData?.draws || [])].sort((a, b) => a.round - b.round);
  const dateOf = new Map(draws.map((d) => [d.round, d.date]));
  const sidoGroup = sido ? groups.find((x) => x.name === sido) : null;
  if (sido && !sidoGroup) return () => undefined;
  // 시군구 원고: paths(없으면 url)에 적힌 시군구 페이지들을 한 범위로 합친다(예: 수원시 4개 구).
  const members = sidoGroup && paths ? sidoGroup.sigungus.filter((s) => s.path && paths.includes(decodeURIComponent(s.path))) : null;
  if (members && !members.length) return () => undefined;
  const g = members ? { name: sidoGroup.name, shops: rankShops(members.flatMap((s) => s.shops)), sigungus: members } : sidoGroup;
  const shops = g ? g.shops : groups.flatMap((x) => x.shops);
  const rank1Wins = shops.flatMap((s) => (s.wins || []).filter((w) => w.rank === 1));
  const rank2 = shops.reduce((t, s) => t + winCounts(s).rank2, 0);
  const methodLine = rank1Wins.length
    ? METHODS.map((m) => { const c = rank1Wins.filter((w) => w.method === m).length; return `${m} ${n(c)}건(${pct(c, rank1Wins.length)})`; }).join(', ')
    : undefined;
  const rows = g ? mergeSigungus(g.name, g.sigungus, regionMerge.merge).map((r) => ({ ...r, name: r.name || g.name })) : [];
  const bigRows = rows.filter((r) => r.shops.length >= 10);
  const stats = computeStats(draws);
  const exp = expectedNumberCount(stats.range.count);
  const sum121to160 = stats.sumBuckets.filter((b) => b.min >= 121 && b.max <= 160).reduce((t, b) => t + b.count, 0);
  const last52 = draws.slice(-52).map((d) => d.prizes?.find((p) => p.rank === 2)?.amount).filter((a) => a > 0);
  const asOf = period && dateOf.get(period.toRound);
  const join = (list) => list.join(', ') || undefined;
  const lastRank1 = rank1Wins.reduce((max, w) => Math.max(max, w.round), 0);
  const people = !members && g && population?.sido?.[g.name];
  const guLabel = (s) => (s.name.includes(' ') ? s.name.split(' ').slice(1).join(' ') : `${s.name}(구 표기 없음)`);
  const values = {
    '최근 1등 회차': lastRank1 ? String(lastRank1) : undefined,
    '판매점당 1등 건수': shops.length ? (rank1Wins.length / shops.length).toFixed(2) : undefined,
    '구별 1등 건수': members && members.length > 1 ? [...members].sort((a, b) => b.rank1 - a.rank1).map((s) => `${guLabel(s)} ${n(s.rank1)}건`).join(', ') : undefined,
    // 인구는 Writer 가이드(first-prize-by-population)에 적힌 행정안전부 주민등록 인구. 출처·기준일을 같은 문장에 둔다.
    '인구 10만 명당 1등 건수': people
      ? `${((rank1Wins.length / people) * 100000).toFixed(2)}건(${period ? `${period.fromRound}~${period.toRound}회 ` : ''}판매점 1등 ${n(rank1Wins.length)}건 ÷ 주민등록 인구 ${n(people)}명, ${population.source} ${population.asOf} 기준)` : undefined,
    '집계 기간': period ? `${period.fromRound}~${period.toRound}회${asOf ? `(${asOf} 추첨까지)` : ''}` : undefined,
    '판매점 배출 이력 시작~끝 회차': period ? `${period.fromRound}~${period.toRound}회` : undefined,
    '판매점 수': n(shops.length),
    '1등 건수': n(rank1Wins.length),
    '2등 건수': n(rank2),
    '1등 배출 판매점 수': n(shops.filter((s) => winCounts(s).rank1).length),
    '1등 2회 이상 판매점 수': n(shops.filter((s) => winCounts(s).rank1 >= 2).length),
    '현재 목록 확인 안 됨 판매점 수': n(shops.filter((s) => s.status !== 'open').length),
    '상위 판매점 1~3': join(rankShops(shops).slice(0, 3).filter((s) => winCounts(s).rank1).map((s) => `${s.name}(1등 ${n(winCounts(s).rank1)}건)`)),
    '1등 자동·수동·반자동 비율': methodLine,
    '1등 건수 상위 시군구 1~3': g ? join([...rows].sort((a, b) => b.rank1 - a.rank1).slice(0, 3).filter((r) => r.rank1).map((r) => `${r.name}(1등 ${n(r.rank1)}건)`)) : undefined,
    // 판매점이 적은 곳은 한두 건으로 비율이 크게 흔들리므로 10곳 이상인 지역만 비교한다.
    '판매점당 1등 건수 상위 시군구': g && bigRows.length
      ? `${[...bigRows].sort((a, b) => b.rank1 / b.shops.length - a.rank1 / a.shops.length).slice(0, 3)
        .map((r) => `${r.name}(판매점 ${n(r.shops.length)}곳·1등 ${n(r.rank1)}건, 판매점당 ${(r.rank1 / r.shops.length).toFixed(2)}건)`).join(', ')} (판매점 10곳 이상 지역 기준)` : undefined,
    '1등 0건 시군구': g ? (rows.filter((r) => !r.rank1).map((r) => r.name).join(', ') || '없음') : undefined,
    '확보 회차 1등 당첨 게임 중 자동·수동·반자동 건수와 비율(집계 회차 범위 명시)': !g && period && methodLine
      ? `${period.fromRound}~${period.toRound}회 판매점 1등 ${n(rank1Wins.length)}건 중 ${methodLine}입니다. 인터넷 구매 1등은 구분이 공개되지 않아 넣지 않았습니다(동행복권 당첨 판매점 기록, ${asOf || `${period.toRound}회`} 추첨 기준)` : undefined,
    '판매점 배출 이력 집계 기간의 전국 1등 건수·2등 건수와 그 비율': !g && period && rank1Wins.length
      ? `${period.fromRound}~${period.toRound}회 판매점 기록 1등 ${n(rank1Wins.length)}건, 2등 ${n(rank2)}건으로 2등이 1등의 약 ${(rank2 / rank1Wins.length).toFixed(2)}배입니다` : undefined,
    '현재 분석 회차 수, 기대 출현 횟수, 우연 변동 범위, 범위 밖 번호 개수(확인 시각 포함)': stats.range.count
      ? `${stats.range.from}~${stats.range.to}회 ${n(stats.range.count)}회 기준 번호 하나의 기대 출현 횟수 ${exp.mean.toFixed(1)}회, 우연 변동 범위 약 ${exp.low.toFixed(1)}~${exp.high.toFixed(1)}회, 범위 밖 번호 ${stats.numbers.filter((x) => x.count < exp.low || x.count > exp.high).length}개(${dateOf.get(stats.range.to)} 추첨 결과까지 반영)` : undefined,
    '현재 분석 회차 수와 홀3 : 짝3·합계 121~160 회차 수 및 비율': stats.range.count
      ? `${stats.range.from}~${stats.range.to}회 ${n(stats.range.count)}회 중 홀3 : 짝3은 ${n(stats.oddEven[3].count)}회(${pct(stats.oddEven[3].count, stats.range.count)}), 합계 121~160은 ${n(sum121to160)}회(${pct(sum121to160, stats.range.count)})` : undefined,
    '최근 52회 2등 평균 당첨금': last52.length === 52
      ? `${n(Math.round(last52.reduce((a, b) => a + b, 0) / 52))}원(${draws.at(-52).round}~${draws.at(-1).round}회 평균, 세전)` : undefined,
  };
  return (name) => values[name];
}
