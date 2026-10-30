# stocks-researcher — 모닝 브리핑

관심 기업 14곳의 **MOU·제휴 / 투자·M&A / CEO 발언** 뉴스와 **매크로 이슈**를 매일 아침 08:30에 수집해 한국어로 요약하고,
현재 주가·매크로 지표와 **나의 투자 원칙**을 한 화면에 보여주는 로컬 웹사이트.

- 메인(`/`): 투자 원칙 → 오늘의 매크로 시황 → 14개 기업 주가 → 오늘의 핵심 요약 → 카테고리별 기사·기업별 요약
- `/principles`: 투자 원칙 추가·수정·삭제·순서 변경
- `/briefings`: 지난 브리핑 보관함
- `/company/[id]`: 기업별 주가 차트(1·3·6개월) + 최근 30일 소식

## 구조

```
[launchd 08:30] npm run collect
   ├─ Google News RSS 검색 (기업별 영어·한국어, MOU·투자 키워드 + 경영진 이름)
   ├─ Google News RSS 검색 (매크로: 연준·금리, 물가·고용, 관세·유가, 증시, 환율)
   ├─ 처음 보는 기사만 claude CLI(구독 로그인)로 분류 + 한국어 요약
   ├─ 주가·매크로 지표 스냅샷 + "오늘의 핵심" + "오늘의 매크로 시황" 생성
   └─ Postgres(stocks_researcher) 저장
[launchd 상시] npm start → http://127.0.0.1:3100
```

| 데이터 | 출처 |
|---|---|
| 뉴스 | Google News RSS (키 불필요) |
| 분류·요약 | `claude -p` 헤드리스 호출 — Anthropic API 키 대신 Claude 구독 사용 |
| 주가 (미국·한국), 매크로 지표 | 네이버 증권 공개 API (국내는 polling 호스트 우선) |
| 주가 (CXMT, 상하이) | Sina 금융 |

## 처음 설치

필요한 것: Node 20+, Homebrew Postgres, 로그인된 `claude` CLI.

```bash
npm install
createdb stocks_researcher
cp .env.example .env.local        # DATABASE_URL 확인
npm run db:init                   # 스키마 적용 (여러 번 실행해도 안전)
npm run collect                   # 첫 브리핑 생성 (약 3~5분)
./scripts/launchd/install.sh      # 08:30 자동 수집 + 웹서버 상시 실행 등록
```

이후 브라우저에서 http://127.0.0.1:3100 을 엽니다.

- 지금 바로 다시 수집: `launchctl kickstart gui/$(id -u)/com.stocks-researcher.collect`
- 로그: `logs/collect.log`, `logs/collect.err.log`, `logs/web.log`
- 해제: `./scripts/launchd/uninstall.sh`
- 코드를 바꾼 뒤에는 `./scripts/launchd/install.sh` 를 다시 실행하면 빌드 후 재시작된다.

Mac이 08:30에 잠자기 상태였다면 깨어난 직후 수집이 실행된다. 정확히 9시 전에 받아보고 싶다면
`sudo pmset repeat wakeorpoweron MTWRFSU 08:25:00` 으로 자동 깨우기를 설정할 수 있다.

## 수집 옵션

```bash
npm run collect -- --since-hours=48      # 최근 48시간 기사 대상 (기본: 마지막 브리핑 이후, 최대 72시간)
npm run collect -- --only=nvidia,amd     # 일부 기업만
npm run collect -- --only=macro          # 매크로 시황만
```

같은 날 다시 실행하면 새 기사만 추가로 분류하고 핵심 요약·주가를 갱신한다.

## 기업 추가·수정

`lib/companies.ts` 배열만 고치면 된다. 기업마다 주가 코드, Google News 검색어, CEO 발언 검색용 경영진 이름을 지정한다.
매크로 지표는 `lib/macro.ts` 의 `MACRO_INDICATORS`, 매크로 검색어는 `lib/news.ts` 의 `MACRO_QUERIES` 에서 바꾼다.

## 알려진 한계

- 요약은 **기사 헤드라인 기반**이다. Google News RSS는 본문을 주지 않으므로 세부 내용은 원문 링크에서 확인한다.
- 네이버·Sina 주가 API는 비공식이라 응답 형식이 바뀌면 `lib/quotes.ts`를 고쳐야 한다.
- 원칙 편집에는 인증이 없다. 웹서버를 `127.0.0.1`에만 열어 같은 Mac에서만 접근할 수 있게 했다.
