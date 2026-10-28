"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPrice } from "@/lib/format";
import type { PricePoint } from "@/lib/quotes";

const RANGES = [
  { label: "1개월", days: 31 },
  { label: "3개월", days: 92 },
  { label: "6개월", days: 183 },
];

export default function PriceChart({ data, currency }: { data: PricePoint[]; currency: string }) {
  const [days, setDays] = useState(92);
  // 기간은 마지막 거래일 기준으로 자른다.
  const last = data.at(-1)?.date;
  const cutoff = last ? new Date(new Date(last).getTime() - days * 86_400_000).toISOString().slice(0, 10) : "";
  const points = data.filter((p) => p.date >= cutoff);

  if (points.length < 2) return <p className="text-sm text-ink-3">차트 데이터가 부족합니다.</p>;

  return (
    <div>
      <div className="mb-3 flex gap-1" role="group" aria-label="기간">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            aria-pressed={days === r.days}
            className={`rounded-md px-2.5 py-1 text-sm ${
              days === r.days ? "bg-accent-soft font-semibold text-accent" : "text-ink-2 hover:text-ink"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="h-64" role="img" aria-label={`종가 추이 ${points[0].date} ~ ${points.at(-1)!.date}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`}
              tick={{ fill: "var(--text-3)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
              minTickGap={32}
            />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => v.toLocaleString("ko-KR")}
              tick={{ fill: "var(--text-3)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ stroke: "var(--text-3)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 13,
              }}
              labelStyle={{ color: "var(--text-2)" }}
              formatter={(v) => [formatPrice(Number(v), currency), "종가"]}
            />
            <Line
              type="linear"
              dataKey="close"
              stroke="var(--series-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
