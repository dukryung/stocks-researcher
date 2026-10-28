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
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function getText(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
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

export function fetchQuote(company: Company): Promise<Quote> {
  return company.quote.source === "sina" ? fetchSinaQuote(company) : fetchNaverQuote(company);
}

// 페이지를 열 때마다 14번씩 호출하지 않도록 60초 동안 메모리에 캐시한다.
const QUOTE_TTL_MS = 60_000;
let quoteCache: { at: number; data: Record<string, Quote | null> } | null = null;

export async function fetchAllQuotes(): Promise<Record<string, Quote | null>> {
  if (quoteCache && Date.now() - quoteCache.at < QUOTE_TTL_MS) return quoteCache.data;
  const results = await Promise.allSettled(COMPANIES.map(fetchQuote));
  const data: Record<string, Quote | null> = {};
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[quotes] ${COMPANIES[i].id}:`, r.reason);
    data[COMPANIES[i].id] = r.status === "fulfilled" ? r.value : null;
  });
  quoteCache = { at: Date.now(), data };
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
