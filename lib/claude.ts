import { spawn } from "node:child_process";

// Anthropic API 키 대신 로컬에 로그인된 Claude Code CLI(`claude -p`)를 헤드리스로 호출해
// 구독 인증을 그대로 사용한다. 수집 스크립트를 실행하는 환경에 `claude` 가 PATH 에 있고
// 로그인되어 있어야 한다.

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const TIMEOUT_MS = 5 * 60_000;

export async function askClaude<T>(prompt: string, schema: object, model = "sonnet"): Promise<T> {
  const args = [
    "-p",
    "--output-format",
    "json",
    "--tools",
    "",
    "--model",
    model,
    "--json-schema",
    JSON.stringify(schema),
    "--no-session-persistence",
    "--strict-mcp-config",
    "--disable-slash-commands",
  ];

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`claude CLI 시간 초과 (${TIMEOUT_MS / 1000}s)`));
    }, TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`claude CLI 실행 실패: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`claude CLI 종료 코드 ${code}: ${err || out}`));
    });
    child.stdin.end(prompt);
  });

  const response = JSON.parse(stdout);
  if (response.is_error) throw new Error(`claude CLI 오류: ${response.result}`);
  if (!response.structured_output) throw new Error(`구조화 출력 없음: ${String(response.result).slice(0, 300)}`);
  return response.structured_output as T;
}
