// 주가·매크로 지표 조회에 공통으로 쓰는 HTTP 도우미.
// 네이버가 연결을 가끔 끊기 때문에(ECONNRESET, TLS 오류) 재시도·동시 요청 제한·직전 값 사용을 한곳에서 처리한다.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export const num = (v: string | number) => (typeof v === "number" ? v : Number(v.replaceAll(",", "")));

async function request(url: string, headers: Record<string, string>) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

export async function getJson(url: string, headers: Record<string, string> = {}) {
  return (await request(url, headers)).json();
}

// 국내 종목·지수 시세. path 예: "stock/005930", "index/KOSPI".
// m.stock.naver.com 이 TLS 단계에서 자주 끊겨서 polling.finance.naver.com 을 먼저 쓰고, 실패하면 넘어간다.
// 두 곳 모두 closePrice·fluctuationsRatio·marketStatus·localTradedAt 등 같은 필드를 준다.
export async function getNaverKr(path: string) {
  try {
    const polled = await getJson(`https://polling.finance.naver.com/api/realtime/domestic/${path}`);
    if (polled?.datas?.[0]) return polled.datas[0];
  } catch {
    // m.stock 으로 넘어간다
  }
  return getJson(`https://m.stock.naver.com/api/${path}/basic`);
}

// Sina 처럼 GBK 로 응답하는 곳용
export async function getGbkText(url: string, headers: Record<string, string> = {}) {
  return new TextDecoder("gbk").decode(await (await request(url, headers)).arrayBuffer());
}

const ATTEMPTS = 3;

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= ATTEMPTS) throw e;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

// 한꺼번에 보내면 연결이 끊기므로 동시에 4개씩만 요청한다.
const CONCURRENCY = 4;
const TTL_MS = 60_000;
const TTL_PARTIAL_MS = 5_000;

// id 목록을 한꺼번에 조회하는 함수를 만든다.
// - 60초 동안 메모리에 캐시하고, 일부가 실패했으면 5초 뒤 다시 시도한다.
// - 조회에 실패한 항목은 직전에 성공한 값을 stale: true 로 표시해 대신 돌려준다.
export function createLiveFetcher<I extends { id: string }, T extends { stale?: boolean }>(
  label: string,
  items: I[],
  fetchOne: (item: I) => Promise<T>,
): () => Promise<Record<string, T | null>> {
  type Result = Record<string, T | null>;
  let cache: { at: number; ttl: number; data: Result } | null = null;
  const lastGood = new Map<string, T>();

  return async () => {
    if (cache && Date.now() - cache.at < cache.ttl) return cache.data;
    const data: Result = {};
    const queue = [...items];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          try {
            const value = await withRetry(() => fetchOne(item));
            lastGood.set(item.id, value);
            data[item.id] = value;
          } catch (e) {
            console.error(`[${label}] ${item.id}:`, e instanceof Error ? (e.cause ?? e.message) : e);
            const prev = lastGood.get(item.id);
            data[item.id] = prev ? { ...prev, stale: true } : null;
          }
        }
      }),
    );
    const failed = Object.values(data).some((v) => v === null || v.stale);
    cache = { at: Date.now(), ttl: failed ? TTL_PARTIAL_MS : TTL_MS, data };
    return data;
  };
}
