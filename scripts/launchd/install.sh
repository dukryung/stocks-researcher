#!/bin/bash
# launchd 에 두 작업을 등록한다. 저장소를 옮기면 다시 실행하면 된다.
#   - com.stocks-researcher.collect : 매일 08:30 뉴스 수집·브리핑 생성 (잠자기 중이었다면 깨어난 직후 실행)
#   - com.stocks-researcher.web     : 웹서버 상시 실행 (http://127.0.0.1:3100)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
NPM="$(command -v npm)"
CLAUDE="$(command -v claude || true)"
# launchd 는 로그인 셸 PATH 를 모르므로 node·claude 위치를 명시한다.
PATH_VALUE="$(dirname "$NPM"):${CLAUDE:+$(dirname "$CLAUDE"):}/usr/bin:/bin:/usr/sbin:/sbin"

if [ -z "$CLAUDE" ]; then
  echo "경고: claude CLI 를 찾지 못했습니다. 수집 단계의 요약이 실패합니다." >&2
fi

mkdir -p "$REPO/logs" "$AGENTS"

echo "웹 앱 빌드 중..."
(cd "$REPO" && "$NPM" run build >/dev/null)

render() {
  sed -e "s#__REPO__#$REPO#g" -e "s#__NPM__#$NPM#g" -e "s#__PATH__#$PATH_VALUE#g" \
    "$REPO/scripts/launchd/$1.plist" > "$AGENTS/$1.plist"
  launchctl bootout "gui/$(id -u)/$1" 2>/dev/null || true
  # 기존 작업이 완전히 내려가기 전에 다시 등록하면 "Bootstrap failed: 5" 가 나므로 기다린다.
  for _ in $(seq 1 20); do
    launchctl print "gui/$(id -u)/$1" >/dev/null 2>&1 || break
    sleep 0.5
  done
  launchctl bootstrap "gui/$(id -u)" "$AGENTS/$1.plist"
  echo "등록: $1"
}

render com.stocks-researcher.collect
render com.stocks-researcher.web

echo
echo "완료. 브라우저에서 http://127.0.0.1:3100 을 여세요."
echo "지금 바로 수집하려면: launchctl kickstart gui/$(id -u)/com.stocks-researcher.collect"
echo "로그: $REPO/logs/"
