import { getPool } from "./db";
import type { VisibleCategory } from "./categories";
import { MACRO_CATEGORIES, type MacroCategory, type MacroSummary } from "./macro";

export interface Principle {
  id: number;
  title: string;
  body: string;
  position: number;
}

export interface Article {
  id: number;
  url: string;
  company_id: string;
  title: string;
  title_ko: string | null;
  summary_ko: string | null;
  source: string | null;
  lang: string;
  category: VisibleCategory;
  importance: number;
  published_at: Date;
}

export interface Briefing {
  date: string;
  headline_ko: string;
  company_summaries: Record<string, string>;
  macro: MacroSummary | null;
  created_at: Date;
}

export interface MacroArticle {
  id: number;
  url: string;
  title: string;
  title_ko: string | null;
  summary_ko: string | null;
  source: string | null;
  lang: string;
  category: MacroCategory;
  importance: number;
  published_at: Date;
}

const VISIBLE = "category IN ('mou','investment','ceo','other')";

export async function getPrinciples(): Promise<Principle[]> {
  const { rows } = await getPool().query<Principle>(
    "SELECT id, title, body, position FROM principles ORDER BY position, id",
  );
  return rows;
}

export async function getBriefing(date?: string): Promise<Briefing | null> {
  const { rows } = await getPool().query<Briefing>(
    date
      ? "SELECT date, headline_ko, company_summaries, macro, created_at FROM briefings WHERE date = $1"
      : "SELECT date, headline_ko, company_summaries, macro, created_at FROM briefings ORDER BY date DESC LIMIT 1",
    date ? [date] : [],
  );
  return rows[0] ?? null;
}

export async function getBriefingArticles(date: string): Promise<Article[]> {
  const { rows } = await getPool().query<Article>(
    `SELECT id, url, company_id, title, title_ko, summary_ko, source, lang, category, importance, published_at
     FROM articles WHERE briefing_date = $1 AND ${VISIBLE}
     ORDER BY importance DESC, published_at DESC`,
    [date],
  );
  return rows;
}

export async function getMacroArticles(date: string, limit = 8): Promise<MacroArticle[]> {
  const { rows } = await getPool().query<MacroArticle>(
    `SELECT id, url, title, title_ko, summary_ko, source, lang, category, importance, published_at
     FROM articles WHERE briefing_date = $1 AND company_id = 'macro' AND category = ANY($2)
     ORDER BY importance DESC, published_at DESC LIMIT $3`,
    [date, [...MACRO_CATEGORIES], limit],
  );
  return rows;
}

export async function listBriefings(limit = 60) {
  const { rows } = await getPool().query<{ date: string; headline_ko: string; article_count: number }>(
    `SELECT b.date, b.headline_ko,
            (SELECT count(*)::int FROM articles a WHERE a.briefing_date = b.date AND a.${VISIBLE}) AS article_count
     FROM briefings b ORDER BY b.date DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function getCompanyArticles(companyId: string, days = 30): Promise<Article[]> {
  const { rows } = await getPool().query<Article>(
    `SELECT id, url, company_id, title, title_ko, summary_ko, source, lang, category, importance, published_at
     FROM articles
     WHERE company_id = $1 AND ${VISIBLE} AND published_at > now() - make_interval(days => $2)
     ORDER BY published_at DESC`,
    [companyId, days],
  );
  return rows;
}
