const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", KRW: "₩", CNY: "¥" };

export function formatPrice(price: number, currency: string): string {
  const digits = currency === "KRW" ? 0 : 2;
  const n = price.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${CURRENCY_SYMBOL[currency] ?? ""}${n}`;
}

export function formatPct(pct: number): string {
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "–";
  return `${arrow} ${Math.abs(pct).toFixed(2)}%`;
}

export function changeClass(pct: number): string {
  return pct > 0 ? "text-up" : pct < 0 ? "text-down" : "text-ink-3";
}

const kstDateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatKst(d: Date | string): string {
  return kstDateTime.format(new Date(d));
}

// 'YYYY-MM-DD' → '10월 28일 (수)'
export function formatBriefingDate(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

// 시세 시각을 현지 기준으로 짧게: '10/27 16:00 (현지)'
export function formatAsOf(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${Number(m[1])}/${Number(m[2])} ${m[3]}:${m[4]}` : iso;
}
