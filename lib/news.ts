import { XMLParser } from "fast-xml-parser";
import type { Company } from "./companies";

// Google News RSS 검색. 기업명 + (MOU·투자·제휴 키워드 OR 경영진 이름) 으로 영어·한국어 두 번 검색한다.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const KEYWORDS_EN = ["MOU", "partnership", "agreement", "deal", "invest", "investment", "acquisition", "stake", "CEO"];
const KEYWORDS_KO = ["MOU", "협약", "제휴", "협력", "투자", "인수", "지분", "계약", "CEO", "대표"];

// 한 피드에서 가져올 최대 기사 수 (최신순)
const MAX_PER_FEED = 30;

export interface RawArticle {
  url: string;
  title: string;
  source: string | null;
  publishedAt: Date;
  lang: "en" | "ko";
}

const parser = new XMLParser({ ignoreAttributes: false });

function buildQuery(base: string, keywords: string[], execNames: string[]): string {
  const terms = [...keywords, ...execNames.map((n) => `"${n}"`)];
  return `${base} (${terms.join(" OR ")}) when:3d`;
}

async function fetchFeed(query: string, lang: "en" | "ko", max = MAX_PER_FEED): Promise<RawArticle[]> {
  const locale = lang === "en" ? "hl=en-US&gl=US&ceid=US:en" : "hl=ko&gl=KR&ceid=KR:ko";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${locale}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google News ${res.status}: ${query}`);
  const xml = parser.parse(await res.text());
  const raw = xml?.rss?.channel?.item ?? [];
  const items: Record<string, unknown>[] = Array.isArray(raw) ? raw : [raw];

  return items
    .map((it) => {
      const source = it.source as { "#text"?: string } | string | undefined;
      const sourceName = typeof source === "string" ? source : (source?.["#text"] ?? null);
      let title = String(it.title ?? "");
      // 제목 끝의 " - 출처" 는 source 와 중복이라 떼어낸다.
      if (sourceName && title.endsWith(` - ${sourceName}`)) title = title.slice(0, -(sourceName.length + 3));
      return {
        url: String(it.link),
        title,
        source: sourceName,
        publishedAt: new Date(String(it.pubDate)),
        lang,
      };
    })
    .filter((a) => a.url && a.title && !Number.isNaN(a.publishedAt.getTime()))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, max);
}

function dedupeSince(articles: RawArticle[], since: Date): RawArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (a.publishedAt < since || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

export async function fetchCompanyNews(company: Company, since: Date): Promise<RawArticle[]> {
  const [en, ko] = await Promise.all([
    fetchFeed(buildQuery(company.newsEn, KEYWORDS_EN, company.executives.map((e) => e.en)), "en"),
    fetchFeed(buildQuery(company.newsKo, KEYWORDS_KO, company.executives.map((e) => e.ko)), "ko"),
  ]);
  return dedupeSince([...en, ...ko], since);
}

// 매크로 이슈 검색어. 주제별로 나눠 검색해야 한 주제(예: 증시 시황)가 결과를 독차지하지 않는다.
const MACRO_QUERIES: { q: string; lang: "en" | "ko" }[] = [
  { q: '(Fed OR FOMC OR "Federal Reserve" OR Powell OR "rate cut" OR "rate hike") when:2d', lang: "en" },
  { q: '("Treasury yields" OR "bond market" OR "10-year yield") when:2d', lang: "en" },
  { q: '(CPI OR inflation OR "jobs report" OR payrolls OR GDP OR recession) when:2d', lang: "en" },
  { q: '(tariff OR "trade war" OR sanctions OR "oil prices" OR OPEC OR "dollar index") when:2d', lang: "en" },
  { q: '("Wall Street" OR "S&P 500" OR "stock market" OR "Nasdaq") (stocks OR futures) when:1d', lang: "en" },
  { q: '(연준 OR FOMC OR 파월 OR "미국 금리" OR "국채 금리") when:2d', lang: "ko" },
  { q: "(환율 OR 원달러 OR 한국은행 OR 기준금리 OR 외환) when:2d", lang: "ko" },
  { q: '(코스피 OR 증시 OR "외국인 매도" OR "외국인 순매수") when:1d', lang: "ko" },
  { q: '(물가 OR 고용지표 OR 관세 OR 유가 OR "경기 침체") when:2d', lang: "ko" },
];
const MAX_PER_MACRO_FEED = 15;

export async function fetchMacroNews(since: Date): Promise<RawArticle[]> {
  const feeds = await Promise.allSettled(MACRO_QUERIES.map(({ q, lang }) => fetchFeed(q, lang, MAX_PER_MACRO_FEED)));
  const articles = feeds.flatMap((f, i) => {
    if (f.status === "fulfilled") return f.value;
    console.error(`[macro-news] ${MACRO_QUERIES[i].q}:`, f.reason);
    return [];
  });
  return dedupeSince(articles, since);
}
