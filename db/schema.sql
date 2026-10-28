-- 여러 번 실행해도 안전하다 (npm run db:init).

CREATE TABLE IF NOT EXISTS principles (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 수집한 모든 기사. (url, company_id) 가 중복 방지 키라 이미 본 기사는 다음 날 다시 분류하지 않는다.
-- 한 기사가 두 기업에 걸치면(예: 엔비디아의 메타 투자) 기업별로 한 행씩 저장된다.
CREATE TABLE IF NOT EXISTS articles (
  id            SERIAL PRIMARY KEY,
  url           TEXT NOT NULL,
  company_id    TEXT NOT NULL,
  title         TEXT NOT NULL,
  source        TEXT,
  lang          TEXT NOT NULL,
  published_at  TIMESTAMPTZ NOT NULL,
  -- mou | investment | ceo | other | irrelevant | duplicate
  category      TEXT NOT NULL,
  importance    SMALLINT NOT NULL DEFAULT 1,
  title_ko      TEXT,
  summary_ko    TEXT,
  briefing_date DATE NOT NULL,
  collected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (url, company_id)
);
CREATE INDEX IF NOT EXISTS articles_briefing_idx ON articles (briefing_date, company_id);
CREATE INDEX IF NOT EXISTS articles_company_idx ON articles (company_id, published_at DESC);

CREATE TABLE IF NOT EXISTS briefings (
  date              DATE PRIMARY KEY,
  -- 오늘의 핵심 (전체 요약 몇 줄)
  headline_ko       TEXT NOT NULL,
  -- { [company_id]: "기업별 한두 문장 요약" }
  company_summaries JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { [company_id]: { price, changePct, currency, asOf } } — 브리핑 시점 주가
  prices            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
