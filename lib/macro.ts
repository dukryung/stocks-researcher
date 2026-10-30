import { createLiveFetcher, getJson, getNaverKr, num } from "./http";

// 매크로 지표 정의. 네이버 증권 공개 API 를 쓴다. 지표를 추가·삭제하려면 이 배열만 고치면 된다.
//   kind 별 응답 형식:
//   - world_index : api.stock.naver.com/index/{code}/basic       (해외 지수)
//   - kr_index    : 국내 지수 (polling.finance.naver.com → m.stock.naver.com 순서로 시도)
//   - marketindex : api.stock.naver.com/marketindex/{code}        (금리·원자재·달러인덱스)
//   - fx          : api.stock.naver.com/marketindex/exchange/{code} (환율, exchangeInfo 안에 값)

export type MacroKind = "world_index" | "kr_index" | "marketindex" | "fx";
// 값 표시 방식: 지수 / 금리(%, 변화는 bp) / 가격(단위 붙임)
export type MacroFormat = "index" | "yield" | "price";

export interface MacroIndicator {
  id: string;
  name: string;
  group: string;
  kind: MacroKind;
  code: string;
  format: MacroFormat;
  unit?: string;
}

export const MACRO_GROUPS = ["미국 증시", "한국 증시", "금리 · 환율", "원자재 · 변동성"] as const;

export const MACRO_INDICATORS: MacroIndicator[] = [
  { id: "sp500", name: "S&P 500", group: "미국 증시", kind: "world_index", code: ".INX", format: "index" },
  { id: "nasdaq", name: "나스닥", group: "미국 증시", kind: "world_index", code: ".IXIC", format: "index" },
  { id: "dow", name: "다우", group: "미국 증시", kind: "world_index", code: ".DJI", format: "index" },
  { id: "sox", name: "반도체(SOX)", group: "미국 증시", kind: "world_index", code: ".SOX", format: "index" },
  { id: "kospi", name: "코스피", group: "한국 증시", kind: "kr_index", code: "KOSPI", format: "index" },
  { id: "kosdaq", name: "코스닥", group: "한국 증시", kind: "kr_index", code: "KOSDAQ", format: "index" },
  { id: "us10y", name: "미국 10년물", group: "금리 · 환율", kind: "marketindex", code: "bond/US10YT=RR", format: "yield" },
  { id: "us2y", name: "미국 2년물", group: "금리 · 환율", kind: "marketindex", code: "bond/US2YT=RR", format: "yield" },
  { id: "usdkrw", name: "원/달러", group: "금리 · 환율", kind: "fx", code: "FX_USDKRW", format: "price", unit: "원" },
  { id: "dxy", name: "달러인덱스", group: "금리 · 환율", kind: "fx", code: ".DXY", format: "index" },
  { id: "wti", name: "WTI", group: "원자재 · 변동성", kind: "marketindex", code: "energy/CLcv1", format: "price", unit: "$" },
  { id: "gold", name: "금", group: "원자재 · 변동성", kind: "marketindex", code: "metals/GCcv1", format: "price", unit: "$" },
  { id: "vix", name: "VIX", group: "원자재 · 변동성", kind: "world_index", code: ".VIX", format: "index" },
];

export interface MacroValue {
  value: number;
  change: number;
  changePct: number;
  marketStatus: string;
  asOf: string;
  stale?: boolean;
}

async function fetchIndicator(ind: MacroIndicator): Promise<MacroValue> {
  switch (ind.kind) {
    case "world_index":
    case "kr_index": {
      const d =
        ind.kind === "kr_index"
          ? await getNaverKr(`index/${ind.code}`)
          : await getJson(`https://api.stock.naver.com/index/${ind.code}/basic`);
      if (d?.closePrice == null) throw new Error(`빈 응답: ${ind.code}`);
      return {
        value: num(d.closePrice),
        change: num(d.compareToPreviousClosePrice),
        changePct: num(d.fluctuationsRatio),
        marketStatus: d.marketStatus,
        asOf: d.localTradedAt,
      };
    }
    case "marketindex":
    case "fx": {
      const url =
        ind.kind === "fx"
          ? `https://api.stock.naver.com/marketindex/exchange/${ind.code}`
          : `https://api.stock.naver.com/marketindex/${ind.code}`;
      const raw = await getJson(url);
      // 원/달러는 exchangeInfo 안에, 달러인덱스·금리·원자재는 최상위에 값이 있다.
      const d = raw.exchangeInfo ?? raw;
      if (d.closePrice == null) throw new Error(`빈 응답: ${url}`);
      const value = num(d.closePrice);
      const changePct = num(d.fluctuationsRatio);
      const change =
        d.fluctuations != null ? num(d.fluctuations) : value - value / (1 + changePct / 100);
      return { value, change, changePct, marketStatus: d.marketStatus, asOf: d.localTradedAt };
    }
  }
}

export const fetchMacroIndicators = createLiveFetcher("macro", MACRO_INDICATORS, fetchIndicator);

// 표시용 ------------------------------------------------------------------

export function formatMacroValue(ind: MacroIndicator, v: MacroValue): string {
  if (ind.format === "yield") return `${v.value.toFixed(3)}%`;
  const digits = ind.id === "usdkrw" ? 1 : 2;
  const n = v.value.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (ind.unit === "$") return `$${n}`;
  if (ind.unit) return `${n}${ind.unit}`;
  return n;
}

// 금리는 bp(0.01%p) 변화로, 나머지는 등락률로 보여준다.
export function formatMacroChange(ind: MacroIndicator, v: MacroValue): string {
  const arrow = v.change > 0 ? "▲" : v.change < 0 ? "▼" : "–";
  if (ind.format === "yield") return `${arrow} ${Math.abs(v.change * 100).toFixed(1)}bp`;
  return `${arrow} ${Math.abs(v.changePct).toFixed(2)}%`;
}

// 매크로 이슈 분류 --------------------------------------------------------------

export const MACRO_CATEGORIES = ["rates", "economy", "fx", "commodities", "policy", "market"] as const;
export type MacroCategory = (typeof MACRO_CATEGORIES)[number];

export const MACRO_CATEGORY_LABEL: Record<MacroCategory, string> = {
  rates: "연준 · 금리",
  economy: "물가 · 경기",
  fx: "환율 · 달러",
  commodities: "원자재",
  policy: "정책 · 무역 · 지정학",
  market: "증시 · 수급",
};

export type MacroMood = "risk_on" | "neutral" | "risk_off";

export const MACRO_MOOD_LABEL: Record<MacroMood, string> = {
  risk_on: "위험 선호",
  neutral: "중립",
  risk_off: "위험 회피",
};

// briefings.macro 에 저장되는 형태
export interface MacroSummary {
  mood: MacroMood;
  mood_reason: string;
  bullets: string[];
  watch: string[];
  // 브리핑 생성 시점 지표 스냅샷 (지난 브리핑 화면에서 사용)
  indicators: Record<string, MacroValue | null>;
}
