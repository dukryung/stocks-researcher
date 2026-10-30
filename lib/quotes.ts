import { COMPANIES, type Company } from "./companies";

// 네이버 증권(미국·한국)과 Sina 금융(중국 본토)의 공개 웹 API를 쓴다. 키가 필요 없지만
// 비공식 API라 응답 형식이 바뀌면 여기만 고치면 된다.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export interface Quote {
  price: number;
  change: number;
  changePct: number;
  currency: string;
  // OPEN | CLOSE | PREOPEN ...
  marketStatus: string;
  // ISO 시각 (현지 시각 오프셋 포함)
  asOf: string;
  // 이번 조회가 실패해 직전에 성공한 시세를 대신 보여주는 경우 true
  stale?: boolean;
}

export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

const num = (v: string | number) => (typeof v === "number" ? v : Number(v.replaceAll(",", "")));

async function getJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function getText(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  // Sina 는 GBK 로 응답한다.
  return new TextDecoder("gbk").decode(await res.arrayBuffer());
}

async function fetchNaverQuote(company: Company): Promise<Quote> {
  const { source, code } = company.quote;
  const url =
    source === "naver_kr"
      ? `https://m.stock.naver.com/api/stock/${code}/basic`
      : `https://api.stock.naver.com/stock/${code}/basic`;
  const d = await getJson(url);
  return {
    price: num(d.closePrice),
    change: num(d.compareToPreviousClosePrice),
    changePct: num(d.fluctuationsRatio),
    currency: d.currencyType?.code ?? "KRW",
    marketStatus: d.marketStatus,
    asOf: d.localTradedAt,
  };
}

async function fetchSinaQuote(company: Company): Promise<Quote> {
  const text = await getText(`https://hq.sinajs.cn/list=${company.quote.code}`, {
    Referer: "https://finance.sina.com.cn",
  });
  // var hq_str_sh688825="이름,시가,전일종가,현재가,고가,저가,...,날짜,시각,...";
  const f = text.split('"')[1]?.split(",");
  if (!f || f.length < 32) throw new Error(`Sina 응답 형식 오류: ${text.slice(0, 100)}`);
  const prevClose = num(f[2]);
  const price = num(f[3]) || prevClose; // 장 시작 전에는 현재가가 0
  return {
    price,
    change: price - prevClose,
    changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    currency: "CNY",
    marketStatus: "",
    asOf: `${f[30]}T${f[31]}+08:00`,
  };
}

// 네이버가 동시 요청을 가끔 끊기 때문에(ECONNRESET) 실패하면 잠시 쉬었다가 다시 시도한다.
const QUOTE_ATTEMPTS = 3;

export async function fetchQuote(company: Company): Promise<Quote> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await (company.quote.source === "sina" ? fetchSinaQuote(company) : fetchNaverQuote(company));
    } catch (e) {
      if (attempt >= QUOTE_ATTEMPTS) throw e;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

// 한꺼번에 14개를 보내면 연결이 끊기므로 동시에 4개씩만 요청한다.
const QUOTE_CONCURRENCY = 4;

// 페이지를 열 때마다 14번씩 호출하지 않도록 60초 동안 메모리에 캐시한다.
// 일부가 실패했으면 다음 요청에서 바로 다시 시도하도록 캐시를 짧게 둔다.
const QUOTE_TTL_MS = 60_000;
const QUOTE_TTL_PARTIAL_MS = 5_000;
let quoteCache: { at: number; ttl: number; data: Record<string, Quote | null> } | null = null;
// 기업별 마지막 성공 시세. 조회가 실패하면 이 값을 stale 로 표시해 대신 보여준다.
const lastGood = new Map<string, Quote>();

export async function fetchAllQuotes(): Promise<Record<string, Quote | null>> {
  if (quoteCache && Date.now() - quoteCache.at < quoteCache.ttl) return quoteCache.data;
  const data: Record<string, Quote | null> = {};
  const queue = [...COMPANIES];
  await Promise.all(
    Array.from({ length: QUOTE_CONCURRENCY }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        try {
          const q = await fetchQuote(c);
          lastGood.set(c.id, q);
          data[c.id] = q;
        } catch (e) {
          console.error(`[quotes] ${c.id}:`, e instanceof Error ? (e.cause ?? e.message) : e);
          const prev = lastGood.get(c.id);
          data[c.id] = prev ? { ...prev, stale: true } : null;
        }
      }
    }),
  );
  const failed = Object.values(data).some((q) => q === null || q.stale);
  quoteCache = { at: Date.now(), ttl: failed ? QUOTE_TTL_PARTIAL_MS : QUOTE_TTL_MS, data };
  return data;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function fetchHistory(company: Company, days = 180): Promise<PricePoint[]> {
  const { source, code } = company.quote;
  if (source === "sina") {
    const rows: { day: string; close: string }[] = await getJson(
      `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${code}&scale=240&ma=no&datalen=${days}`,
      { Referer: "https://finance.sina.com.cn" },
    );
    return rows.map((r) => ({ date: r.day, close: num(r.close) }));
  }
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const stamp = (d: Date) => ymd(d).replaceAll("-", "");
  const kind = source === "naver_kr" ? "domestic" : "foreign";
  const rows: { localDate: string; closePrice: number }[] = await getJson(
    `https://api.stock.naver.com/chart/${kind}/item/${code}/day?startDateTime=${stamp(start)}0000&endDateTime=${stamp(end)}2359`,
  );
  return rows.map((r) => ({
    date: `${r.localDate.slice(0, 4)}-${r.localDate.slice(4, 6)}-${r.localDate.slice(6, 8)}`,
    close: r.closePrice,
  }));
}
