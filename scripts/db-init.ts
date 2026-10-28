// db/schema.sql 을 적용한다 (npm run db:init). 여러 번 실행해도 안전하다.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "../lib/db";

async function main() {
  const pool = getPool();
  await pool.query(readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8"));
  console.log("스키마 적용 완료");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
