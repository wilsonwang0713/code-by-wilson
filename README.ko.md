# <img src="docs/assets/logo.svg" alt="" height="64" align="center"> FlightDeck

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | 한국어 | [Español](README.es.md) | [Français](README.fr.md)

[![CI](https://img.shields.io/github/actions/workflow/status/wilsonwang0713/code-by-wilson/ci.yml?style=flat-square&label=CI)](https://github.com/wilsonwang0713/code-by-wilson/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/wilsonwang0713/code-by-wilson?style=flat-square)](https://github.com/wilsonwang0713/code-by-wilson/releases)

**모든 Claude Code 세션을 조종하고, 풍부한 대화 기록을 보고, 텔레메트리를 모니터링하세요. 하나의 화면에서.**

![FlightDeck: 세션 레일, 대화 기록, 텔레메트리 패널이 있는 라이브 Claude Code 세션](docs/assets/flightdeck-screenshot.png)

## 기능

Claude Code가 로컬에 설치되어 있어야 합니다. 앱을 열면 머신에서 실행 중인 모든 세션이 그곳에 있습니다.

- **모든 세션을 하나의 레일에.** 머신에서 실행 중인 모든 세션을 하나의 레일에서 관리합니다: 프로젝트별 그룹화, 검색 가능, 각각 라이브 상태를 표시합니다.
- **조종하거나, 포크하거나, 그냥 지켜보거나.** 내장 터미널에서 세션을 시작하고, 실행 중인 세션을 포크하고, 다른 곳에서 시작한 세션을 인계받거나, 읽기 전용으로 관찰합니다.
- **완전한 대화 기록.** 모든 메시지, 도구 호출, 결과를 디스크에서 재구성하여 깔끔하게 렌더링합니다.
- **CLI가 숨기는 텔레메트리.** 컨텍스트 압력, 지출, 실시간 처리량, 듀티 사이클, git, 작업, 서브에이전트, 백그라운드 셸을 세션별로 표시합니다.
- **전체 이야기.** 세션 전반의 통계 뷰 — 모델별로 쌓은 일별 차트, 모델 점유율 링, 1주일 예측이 포함된 누적 사용량, 요일 × 시간 활동 히트맵, 1년치 기여 캘린더 — 모두 정확하며, 추정은 없습니다.
- **레이트 리밋을 한눈에.** 계정의 레이트 리밋 창과 모델별 주간 버킷을 디스크에서 직접 읽어, 실시간 리셋 카운트다운이 있는 아크 게이지로 표시합니다.
- **라이트 또는 다크.** 다크에 더해 완전한 라이트 테마, 또는 시스템 따라가기 — 「설정 → 외관」에서 설정합니다.
- **노치 아일랜드 (macOS).** 노치 아래의 선택적 오버레이: 한눈에 상태를 보여주는 알약이, 당신을 기다리는 세션의 받은편지함으로 펼쳐집니다 — 클릭하면 해당 세션으로 바로 이동합니다.

## 다운로드

| 플랫폼                | 파일                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| macOS · Apple Silicon | [`FlightDeck-arm64.dmg`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-arm64.dmg)             |
| macOS · Intel         | [`FlightDeck-x64.dmg`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-x64.dmg)                 |
| Windows · x64         | [`FlightDeck-Setup-x64.exe`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-Setup-x64.exe)     |
| Windows · ARM64       | [`FlightDeck-Setup-arm64.exe`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-Setup-arm64.exe) |

클릭 한 번으로 다운로드가 시작되며, 항상 최신 릴리스입니다. 관찰하고 제어할 세션이 필요하므로,
로컬에 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)가 설치되어 있어야 합니다.

macOS에서는 `.dmg`를 열고 FlightDeck을 「응용 프로그램」으로 드래그합니다. Windows에서는
`.exe`를 실행하고, SmartScreen이 경고하면 **추가 정보 → 실행**을 클릭합니다.

설치 후, 앱은 시작 시 새 릴리스를 확인하며 「설정 → 정보」에서 업데이트할 수 있습니다.

## 소스에서 빌드

```
pnpm install
pnpm rebuild:native   # Electron ABI에 맞춰 better-sqlite3 + node-pty 재빌드
pnpm dist             # macOS: .dmg를 release/에 출력
pnpm dist:win         # Windows: .exe를 release/에 출력
```

로컬에서 빌드한 앱은 서명되지 않았습니다: macOS에서는 첫 실행 시 우클릭 →
**열기**가 필요하거나, `xattr -dr com.apple.quarantine /Applications/FlightDeck.app`
로 격리 플래그를 제거해야 할 수 있습니다. Windows에서는 SmartScreen이 경고할 수
있습니다: **추가 정보 → 실행**을 클릭합니다.

## 개발

```
pnpm install
pnpm rebuild:native   # Electron ABI에 맞춰 better-sqlite3 + node-pty 재빌드
pnpm dev              # 앱 실행
```

`pnpm test`는 `tests/fixtures/`의 익명화된 `.claude` 픽스처에 대해 provider 읽기
테스트를 실행합니다. `pnpm typecheck`는 main과 renderer 프로젝트를 검사합니다.

버그 리포트와 아이디어를 환영합니다. [이슈 열기](https://github.com/wilsonwang0713/code-by-wilson/issues/new/choose),
또는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

## 라이선스

[MIT](LICENSE) © Yihhsuan Wang. 서드파티 및 업스트림 고지는
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 보존되어 있습니다.
