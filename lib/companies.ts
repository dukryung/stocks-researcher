// 추적할 기업 목록. 기업을 추가·삭제하려면 이 배열만 고치면 된다.
//
// quote: 주가 조회 소스
//   - naver_world : 네이버 해외주식 (reutersCode, 예: NVDA.O)
//   - naver_kr    : 네이버 국내주식 (종목코드, 예: 005930)
//   - sina        : Sina 금융 (중국 본토, 예: sh688825)
// newsEn / newsKo: Google News 검색어. 뒤에 MOU·투자·CEO 키워드가 자동으로 붙는다.
// executives: CEO 발언 검색에 쓰는 경영진 이름.

export type QuoteSource = "naver_world" | "naver_kr" | "sina";

export interface Company {
  id: string;
  nameKo: string;
  ticker: string;
  market: string;
  quote: { source: QuoteSource; code: string };
  newsEn: string;
  newsKo: string;
  executives: { en: string; ko: string }[];
}

export const COMPANIES: Company[] = [
  {
    id: "nvidia",
    nameKo: "엔비디아",
    ticker: "NVDA",
    market: "NASDAQ",
    quote: { source: "naver_world", code: "NVDA.O" },
    newsEn: "Nvidia",
    newsKo: "엔비디아",
    executives: [{ en: "Jensen Huang", ko: "젠슨 황" }],
  },
  {
    id: "google",
    nameKo: "구글",
    ticker: "GOOGL",
    market: "NASDAQ",
    quote: { source: "naver_world", code: "GOOGL.O" },
    newsEn: "(Google OR Alphabet)",
    newsKo: "구글",
    executives: [{ en: "Sundar Pichai", ko: "순다르 피차이" }],
  },
  {
    id: "meta",
    nameKo: "메타",
    ticker: "META",
    market: "NASDAQ",
    quote: { source: "naver_world", code: "META.O" },
    newsEn: '"Meta Platforms"',
    newsKo: "메타",
    executives: [{ en: "Mark Zuckerberg", ko: "저커버그" }],
  },
  {
    id: "microsoft",
    nameKo: "마이크로소프트",
    ticker: "MSFT",
    market: "NASDAQ",
    quote: { source: "naver_world", code: "MSFT.O" },
    newsEn: "Microsoft",
    newsKo: "마이크로소프트",
    executives: [{ en: "Satya Nadella", ko: "사티아 나델라" }],
  },
  {
    id: "amazon",
    nameKo: "아마존",
    ticker: "AMZN",
    market: "NASDAQ",
    quote: { source: "naver_world", code: "AMZN.O" },
    newsEn: "Amazon",
    newsKo: "아마존",
    executives: [{ en: "Andy Jassy", ko: "앤디 재시" }],
  },
  {
    id: "spacex",
    nameKo: "스페이스X",
    ticker: "SPCX",
    market: "NASDAQ",
    quote: { source: "naver_world", code: "SPCX.O" },
    newsEn: "SpaceX",
    newsKo: "스페이스X",
    executives: [
      { en: "Elon Musk", ko: "일론 머스크" },
      { en: "Gwynne Shotwell", ko: "그윈 숏웰" },
    ],
  },
  {
    id: "intel",
    nameKo: "인텔",
    ticker: "INTC",
    market: "NASDAQ",
    quote: { source: "naver_world", code: "INTC.O" },
    newsEn: "Intel",
    newsKo: "인텔",
    executives: [{ en: "Lip-Bu Tan", ko: "립부 탄" }],
  },
  {
    id: "broadcom",
    nameKo: "브로드컴",
    ticker: "AVGO",
    market: "NASDAQ",
    quote: { source: "naver_world", code: "AVGO.O" },
    newsEn: "Broadcom",
    newsKo: "브로드컴",
    executives: [{ en: "Hock Tan", ko: "혹 탄" }],
  },
  {
    id: "tesla",
    nameKo: "테슬라",
    ticker: "TSLA",
    market: "NASDAQ",
    quote: { source: "naver_world", code: "TSLA.O" },
    newsEn: "Tesla",
    newsKo: "테슬라",
    executives: [{ en: "Elon Musk", ko: "일론 머스크" }],
  },
  {
    id: "amd",
    nameKo: "AMD",
    ticker: "AMD",
    market: "NASDAQ",
    quote: { source: "naver_world", code: "AMD.O" },
    newsEn: "AMD",
    newsKo: "AMD",
    executives: [{ en: "Lisa Su", ko: "리사 수" }],
  },
  {
    id: "samsung",
    nameKo: "삼성전자",
    ticker: "005930",
    market: "KOSPI",
    quote: { source: "naver_kr", code: "005930" },
    newsEn: '"Samsung Electronics"',
    newsKo: "삼성전자",
    executives: [
      { en: "Jay Y. Lee", ko: "이재용" },
      { en: "Jun Young-hyun", ko: "전영현" },
    ],
  },
  {
    id: "skhynix",
    nameKo: "SK하이닉스",
    ticker: "000660",
    market: "KOSPI",
    quote: { source: "naver_kr", code: "000660" },
    newsEn: '"SK Hynix"',
    newsKo: "SK하이닉스",
    executives: [{ en: "Kwak Noh-jung", ko: "곽노정" }],
  },
  {
    id: "micron",
    nameKo: "마이크론",
    ticker: "MU",
    market: "NASDAQ",
    quote: { source: "naver_world", code: "MU.O" },
    newsEn: "Micron",
    newsKo: "마이크론",
    executives: [{ en: "Sanjay Mehrotra", ko: "산제이 메흐로트라" }],
  },
  {
    id: "cxmt",
    nameKo: "CXMT (창신메모리)",
    ticker: "688825",
    market: "上海 STAR",
    quote: { source: "sina", code: "sh688825" },
    newsEn: '(CXMT OR "ChangXin Memory")',
    newsKo: "(CXMT OR 창신메모리)",
    executives: [],
  },
];

export const COMPANY_BY_ID = new Map(COMPANIES.map((c) => [c.id, c]));
