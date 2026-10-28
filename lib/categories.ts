export type Category = "mou" | "investment" | "ceo" | "other" | "irrelevant" | "duplicate";

// 브리핑에 노출하는 카테고리와 표시 순서
export const VISIBLE_CATEGORIES = ["mou", "investment", "ceo", "other"] as const;
export type VisibleCategory = (typeof VISIBLE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<VisibleCategory, string> = {
  mou: "MOU · 제휴",
  investment: "투자 · M&A",
  ceo: "CEO 발언",
  other: "기타 주요 소식",
};
