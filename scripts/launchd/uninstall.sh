#!/bin/bash
# install.sh 로 등록한 launchd 작업을 해제한다.
set -uo pipefail

for label in com.stocks-researcher.collect com.stocks-researcher.web; do
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null && echo "해제: $label"
  rm -f "$HOME/Library/LaunchAgents/$label.plist"
done
