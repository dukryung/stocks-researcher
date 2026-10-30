// 매일 아침 실행하는 수집 스크립트 (npm run collect).
//   1. 기업별·매크로 Google News 수집 (영어·한국어)
//   2. 처음 보는 기사만 claude CLI 로 분류 + 한국어 요약
//   3. 주가·매크로 지표 스냅샷 + 오늘의 핵심·매크로 시황 요약을 briefings 에 저장
//
// 옵션: --since-hours=N        마지막 브리핑 대신 최근 N시간 기사를 대상으로 한다.
//       --only=nvidia,amd,macro 일부 기업(또는 macro)만 처리한다 (테스트용).

import { askClaude } from "../lib/claude";
import { COMPANIES, COMPANY_BY_ID, type Company } from "../lib/companies";
import { getPool } from "../lib/db";
import {
  MACRO_CATEGORIES,
  MACRO_INDICATORS,
  fetchMacroIndicators,
  formatMacroChange,
  formatMacroValue,
  type MacroSummary,
  type MacroValue,
} from "../lib/macro";
import { fetchCompanyNews, fetchMacroNews, type RawArticle } from "../lib/news";
import { fetchAllQuotes } from "../lib/quotes";
import type { Category } from "../lib/categories";

const CONCURRENCY = 3;
const DEFAULT_LOOKBACK_HOURS = 36;
const MAX_LOOKBACK_HOURS = 72; // 월요일 아침엔 주말 기사까지 포함된다

const pool = getPool();

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function log(...args: unknown[]) {
  console.log(new Date().toISOString(), ...args);
}

async function resolveSince(): Promise<Date> {
  const now = Date.now();
  const hours = arg("since-hours");
  if (hours) return new Date(now - Number(hours) * 3_600_000);
  const { rows } = await pool.query<{ created_at: Date }>(
    "SELECT created_at FROM briefings ORDER BY created_at DESC LIMIT 1",
  );
  const floor = now - MAX_LOOKBACK_HOURS * 3_600_000;
  if (!rows[0]) return new Date(now - DEFAULT_LOOKBACK_HOURS * 3_600_000);
  // 1시간 겹치게 잡는다. 이미 저장된 기사는 url 로 걸러진다.
  return new Date(Math.max(rows[0].created_at.getTime() - 3_600_000, floor));
}

interface Classified {
  items: { i: number; category: Category; importance: number; title_ko: string; summary_ko: string }[];
  company_summary_ko: string;
}

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          i: { type: "integer" },
          category: { type: "string", enum: ["mou", "investment", "ceo", "other", "irrelevant", "duplicate"] },
          importance: { type: "integer", minimum: 1, maximum: 3 },
          title_ko: { type: "string" },
          summary_ko: { type: "string" },
        },
        required: ["i", "category", "importance", "title_ko", "summary_ko"],
      },
    },
    company_summary_ko: { type: "string" },
  },
  required: ["items", "company_summary_ko"],
};

function classifyPrompt(company: Company, articles: RawArticle[]): string {
  const list = articles.map((a, i) => ({
    i,
    title: a.title,
    source: a.source,
    published: a.publishedAt.toISOString(),
  }));
  return `당신은 개인 투자자를 위한 아침 뉴스 브리핑 에디터입니다.
아래는 ${company.nameKo}(${company.ticker}) 관련으로 검색된 최근 기사 헤드라인 목록입니다. 영어 기사도 섞여 있습니다.

각 기사(i)를 다음 중 하나로 분류하세요.
- mou: MOU, 업무협약, 전략적 제휴·파트너십, 공급·구매 계약 체결
- investment: 투자 집행·유치, M&A, 지분 인수·매각, 설비투자(공장·데이터센터 건설), 대규모 자금 조달
- ceo: CEO·경영진의 발언, 인터뷰, 기조연설, 실적 발표 중 코멘트
- other: 위에 해당하지 않지만 이 기업 투자자에게 의미 있는 뉴스 (실적, 신제품, 규제, 소송 등)
- irrelevant: ${company.nameKo}와 직접 관련이 약하거나(단순 언급), 단순 주가 시황·종목 추천·광고성 기사
- duplicate: 목록의 다른 기사와 같은 사건을 다룬 기사. 같은 사건 중 가장 정보가 많은 하나만 원래 카테고리로 두고 나머지는 duplicate

작성 규칙:
- title_ko: 한국어로 간결하게 다시 쓴 제목 (irrelevant/duplicate 는 빈 문자열)
- summary_ko: 헤드라인에서 확인되는 사실만 한국어 1~2문장. 금액·상대방·규모를 살리고, 헤드라인에 없는 내용은 추측하지 마세요. (irrelevant/duplicate 는 빈 문자열)
- importance: 1(참고) ~ 3(주가에 영향을 줄 만한 핵심 소식)
- company_summary_ko: 의미 있는 기사가 있으면 오늘 ${company.nameKo} 소식을 한국어 2문장 이내로 종합. 없으면 빈 문자열.
- 모든 i 에 대해 정확히 하나씩 결과를 반환하세요.

기사 목록(JSON):
${JSON.stringify(list, null, 1)}`;
}

// 이미 저장된(= 분류를 마친) 기사를 걸러낸다. ownerId 는 기업 id 또는 'macro'.
async function filterUnseen(ownerId: string, fetched: RawArticle[]): Promise<RawArticle[]> {
  if (fetched.length === 0) return [];
  const { rows } = await pool.query<{ url: string }>(
    "SELECT url FROM articles WHERE company_id = $1 AND url = ANY($2)",
    [ownerId, fetched.map((a) => a.url)],
  );
  const seen = new Set(rows.map((r) => r.url));
  return fetched.filter((a) => !seen.has(a.url));
}

interface ClassifiedItem {
  i: number;
  category: string;
  importance: number;
  title_ko: string;
  summary_ko: string;
}

// 분류 결과를 저장하고 브리핑에 노출되는 기사 수를 돌려준다.
async function saveClassified(ownerId: string, fresh: RawArticle[], items: ClassifiedItem[], briefingDate: string) {
  const byIndex = new Map(items.map((it) => [it.i, it]));
  let kept = 0;
  for (const [i, a] of fresh.entries()) {
    const c = byIndex.get(i);
    // Claude 가 빠뜨린 기사는 다음 실행에서 다시 분류되도록 저장하지 않는다.
    if (!c) continue;
    if (c.category !== "irrelevant" && c.category !== "duplicate") kept++;
    await pool.query(
      `INSERT INTO articles (url, company_id, title, source, lang, published_at, category, importance, title_ko, summary_ko, briefing_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (url, company_id) DO NOTHING`,
      [a.url, ownerId, a.title, a.source, a.lang, a.publishedAt, c.category, c.importance, c.title_ko || null, c.summary_ko || null, briefingDate],
    );
  }
  log(`[${ownerId}] 저장 ${byIndex.size}건 (브리핑 노출 ${kept}건)`);
}

async function processCompany(company: Company, since: Date, briefingDate: string): Promise<string | null> {
  const fetched = await fetchCompanyNews(company, since);
  if (fetched.length === 0) {
    log(`[${company.id}] 새 기사 없음`);
    return null;
  }
  const fresh = await filterUnseen(company.id, fetched);
  if (fresh.length === 0) {
    log(`[${company.id}] 수집 ${fetched.length}건 모두 이미 처리됨`);
    return null;
  }

  log(`[${company.id}] 새 기사 ${fresh.length}건 분류 중`);
  const result = await askClaude<Classified>(classifyPrompt(company, fresh), CLASSIFY_SCHEMA);
  await saveClassified(company.id, fresh, result.items, briefingDate);
  return result.company_summary_ko || null;
}

// 매크로 -----------------------------------------------------------------------

const MACRO_ID = "macro";

const MACRO_CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          i: { type: "integer" },
          category: { type: "string", enum: [...MACRO_CATEGORIES, "irrelevant", "duplicate"] },
          importance: { type: "integer", minimum: 1, maximum: 3 },
          title_ko: { type: "string" },
          summary_ko: { type: "string" },
        },
        required: ["i", "category", "importance", "title_ko", "summary_ko"],
      },
    },
  },
  required: ["items"],
};

async function processMacro(since: Date, briefingDate: string) {
  const fresh = await filterUnseen(MACRO_ID, await fetchMacroNews(since));
  if (fresh.length === 0) {
    log(`[${MACRO_ID}] 새 기사 없음`);
    return;
  }
  log(`[${MACRO_ID}] 새 기사 ${fresh.length}건 분류 중`);
  const list = fresh.map((a, i) => ({ i, title: a.title, source: a.source, published: a.publishedAt.toISOString() }));
  const result = await askClaude<{ items: ClassifiedItem[] }>(
    `당신은 개인 투자자를 위한 아침 매크로 브리핑 에디터입니다.
아래는 금리·물가·환율·원자재·정책·증시 흐름 관련으로 검색된 최근 기사 헤드라인입니다. 영어 기사도 섞여 있습니다.

각 기사(i)를 다음 중 하나로 분류하세요.
- rates: 연준·FOMC·중앙은행 통화정책, 기준금리, 국채 금리
- economy: 물가(CPI·PCE), 고용, GDP·경기 지표, 경기 침체 우려
- fx: 환율, 달러 강세·약세, 외환시장
- commodities: 유가, 금, 구리 등 원자재
- policy: 관세·무역, 재정·규제 정책, 전쟁·제재 등 지정학
- market: 미국·한국 증시 전반의 흐름, 외국인 수급, 변동성
- irrelevant: 개별 기업 단독 뉴스, 종목 추천, 광고성, 시장 전체와 무관한 기사
- duplicate: 목록의 다른 기사와 같은 사건. 가장 정보가 많은 하나만 원래 카테고리로 두고 나머지는 duplicate

작성 규칙:
- title_ko: 한국어로 간결하게 다시 쓴 제목 (irrelevant/duplicate 는 빈 문자열)
- summary_ko: 헤드라인에서 확인되는 사실만 한국어 1~2문장. 수치(금리·지수·%)를 살리고 추측하지 마세요. (irrelevant/duplicate 는 빈 문자열)
- importance: 1(참고) ~ 3(시장 전체 방향에 영향을 줄 핵심 이슈)
- 모든 i 에 대해 정확히 하나씩 결과를 반환하세요.

기사 목록(JSON):
${JSON.stringify(list, null, 1)}`,
    MACRO_CLASSIFY_SCHEMA,
  );
  await saveClassified(MACRO_ID, fresh, result.items, briefingDate);
}

async function buildMacroSummary(
  briefingDate: string,
  indicators: Record<string, MacroValue | null>,
): Promise<MacroSummary> {
  const { rows } = await pool.query<{ category: string; importance: number; title_ko: string; summary_ko: string }>(
    `SELECT category, importance, title_ko, summary_ko FROM articles
     WHERE briefing_date = $1 AND company_id = $2 AND category = ANY($3)
     ORDER BY importance DESC, published_at DESC LIMIT 60`,
    [briefingDate, MACRO_ID, [...MACRO_CATEGORIES]],
  );
  const snapshot = MACRO_INDICATORS.flatMap((ind) => {
    const v = indicators[ind.id];
    return v ? [{ name: ind.name, value: formatMacroValue(ind, v), change: formatMacroChange(ind, v), asOf: v.asOf }] : [];
  });

  const out = await askClaude<Omit<MacroSummary, "indicators">>(
    `당신은 개인 투자자를 위한 아침 매크로 브리핑 에디터입니다.
아래 주요 지표와 오늘 수집된 매크로 뉴스를 바탕으로 "오늘의 매크로 시황"을 한국어로 정리하세요.

- mood: 오늘 시장 분위기. risk_on(위험 선호) / neutral(중립) / risk_off(위험 회피) 중 하나
- mood_reason: 그렇게 판단한 근거 한 문장 (지표 수치를 인용)
- bullets: 핵심 매크로 이슈 3~5개. 각 항목은 한 문장이며 지표 변화와 뉴스를 연결해 설명하세요. (예: 금리 하락의 원인, 환율 변화가 한국 증시에 주는 의미)
- watch: 오늘·이번 주 주목할 일정이나 변수 0~3개. 뉴스에 언급된 것만 쓰고 없으면 빈 배열
- 주어진 내용에 없는 사실이나 매수·매도 권유는 쓰지 마세요.
- 지표의 asOf 는 현지 시각입니다. 미국 지표는 전일 마감 기준, 한국 지표는 장중일 수 있습니다.

주요 지표(JSON):
${JSON.stringify(snapshot, null, 1)}

매크로 뉴스(JSON):
${JSON.stringify(rows, null, 1)}`,
    {
      type: "object",
      properties: {
        mood: { type: "string", enum: ["risk_on", "neutral", "risk_off"] },
        mood_reason: { type: "string" },
        bullets: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
        watch: { type: "array", items: { type: "string" }, maxItems: 3 },
      },
      required: ["mood", "mood_reason", "bullets", "watch"],
    },
  );
  return { ...out, indicators };
}

async function buildHeadline(briefingDate: string): Promise<string> {
  const { rows } = await pool.query<{ company_id: string; category: string; importance: number; title_ko: string; summary_ko: string }>(
    `SELECT company_id, category, importance, title_ko, summary_ko FROM articles
     WHERE briefing_date = $1 AND category IN ('mou','investment','ceo','other')
     ORDER BY importance DESC, published_at DESC LIMIT 80`,
    [briefingDate],
  );
  if (rows.length === 0) return "추적 중인 기업에서 새로 확인된 MOU·투자·CEO 발언 소식이 없습니다.";

  const items = rows.map((r) => ({
    company: COMPANY_BY_ID.get(r.company_id)?.nameKo ?? r.company_id,
    category: r.category,
    importance: r.importance,
    title: r.title_ko,
    summary: r.summary_ko,
  }));
  const out = await askClaude<{ bullets: string[] }>(
    `당신은 개인 투자자를 위한 아침 브리핑 에디터입니다. 아래는 오늘 수집·요약된 빅테크·반도체 기업 뉴스입니다.
투자자가 아침에 30초 안에 읽을 "오늘의 핵심"을 3~5개 항목으로 한국어로 작성하세요.
- 각 항목은 한 문장. 기업명을 앞에 쓰고, 금액·상대방 등 구체적 사실을 살리세요.
- MOU·투자·CEO 발언을 우선하고, 여러 기업에 걸친 흐름(예: AI 인프라 투자 경쟁)이 보이면 묶어서 쓰세요.
- 주어진 내용에 없는 사실이나 투자 권유는 쓰지 마세요.

뉴스(JSON):
${JSON.stringify(items, null, 1)}`,
    {
      type: "object",
      properties: { bullets: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 } },
      required: ["bullets"],
    },
  );
  return out.bullets.join("\n");
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await worker(item);
    }),
  );
}

async function main() {
  const briefingDate = todayKst();
  const since = await resolveSince();
  const only = arg("only")?.split(",");
  const targets = only ? COMPANIES.filter((c) => only.includes(c.id)) : COMPANIES;
  const withMacro = !only || only.includes(MACRO_ID);
  log(
    `브리핑 ${briefingDate} 수집 시작 — ${since.toISOString()} 이후 기사, 대상 ${targets.length}개 기업${withMacro ? " + 매크로" : ""}`,
  );

  const summaries: Record<string, string> = {};
  const failures: string[] = [];
  // 매크로 기사 분류는 기업 처리와 동시에 진행한다.
  const macroTask = withMacro
    ? processMacro(since, briefingDate).catch((e) => {
        failures.push(MACRO_ID);
        console.error(`[${MACRO_ID}] 실패:`, e instanceof Error ? e.message : e);
      })
    : Promise.resolve();
  await runPool(targets, async (company) => {
    try {
      const summary = await processCompany(company, since, briefingDate);
      if (summary) summaries[company.id] = summary;
    } catch (e) {
      failures.push(company.id);
      console.error(`[${company.id}] 실패:`, e instanceof Error ? e.message : e);
    }
  });
  await macroTask;

  const [quotes, indicators] = await Promise.all([fetchAllQuotes(), fetchMacroIndicators()]);
  const headline = await buildHeadline(briefingDate);
  let macro: MacroSummary | null = null;
  if (withMacro) {
    try {
      macro = await buildMacroSummary(briefingDate, indicators);
    } catch (e) {
      failures.push(`${MACRO_ID}-summary`);
      console.error(`[${MACRO_ID}] 시황 요약 실패:`, e instanceof Error ? e.message : e);
    }
  }

  // 같은 날 다시 실행하면 새 소식이 있는 기업 요약만 덮어쓰고 주가·핵심 요약·매크로 시황은 갱신한다.
  // 매크로 시황 생성에 실패하면 기존 값을 유지한다.
  await pool.query(
    `INSERT INTO briefings (date, headline_ko, company_summaries, prices, macro, created_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (date) DO UPDATE SET
       headline_ko = EXCLUDED.headline_ko,
       company_summaries = briefings.company_summaries || EXCLUDED.company_summaries,
       prices = EXCLUDED.prices,
       macro = COALESCE(EXCLUDED.macro, briefings.macro),
       created_at = now()`,
    [briefingDate, headline, summaries, quotes, macro],
  );

  log(`브리핑 ${briefingDate} 저장 완료${failures.length ? ` (실패: ${failures.join(", ")})` : ""}`);
  await pool.end();
  const attempted = targets.length + (withMacro ? 1 : 0);
  if (failures.length >= attempted) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
