import { Pool, types } from "pg";

// DATE 컬럼을 JS Date 로 바꾸면 시간대에 따라 하루가 밀리므로 'YYYY-MM-DD' 문자열 그대로 받는다.
types.setTypeParser(types.builtins.DATE, (v) => v);

declare global {
  var pgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.pgPool) {
    global.pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return global.pgPool;
}
