import { COMPANIES, type Company } from "./companies";
import { createLiveFetcher, getGbkText, getJson, getNaverKr, num, withRetry } from "./http";

// 네이버 증권(미국·한국)과 Sina 금융(중국 본토)의 공개 웹 API를 쓴다. 키가 필요 없지만
// 비공식 API라 응답 형식이 바뀌면 여기만 고치면 된다.

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

async function fetchNaverQuote(company: Company): Promise<Quote> {
  const { source, code } = company.quote;
  const d =
    source === "naver_kr"
      ? await getNaverKr(`stock/${code}`)
      : await getJson(`https://api.stock.naver.com/stock/${code}/basic`);
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
  const text = await getGbkText(`https://hq.sinajs.cn/list=${company.quote.code}`, {
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

export const fetchAllQuotes = createLiveFetcher("quotes", COMPANIES, fetchQuote);

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function fetchHistory(company: Company, days = 180): Promise<PricePoint[]> {
  const { source, code } = company.quote;
  if (source === "sina") {
    const rows: { day: string; close: string }[] = await withRetry(() =>
      getJson(
        `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${code}&scale=240&ma=no&datalen=${days}`,
        { Referer: "https://finance.sina.com.cn" },
      ),
    );
    return rows.map((r) => ({ date: r.day, close: num(r.close) }));
  }
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const stamp = (d: Date) => ymd(d).replaceAll("-", "");
  const kind = source === "naver_kr" ? "domestic" : "foreign";
  const rows: { localDate: string; closePrice: number }[] = await withRetry(() =>
    getJson(
      `https://api.stock.naver.com/chart/${kind}/item/${code}/day?startDateTime=${stamp(start)}0000&endDateTime=${stamp(end)}2359`,
    ),
  );
  return rows.map((r) => ({
    date: `${r.localDate.slice(0, 4)}-${r.localDate.slice(4, 6)}-${r.localDate.slice(6, 8)}`,
    close: r.closePrice,
  }));
}
