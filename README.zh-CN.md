# <img src="docs/assets/logo.svg" alt="" height="64" align="center"> FlightDeck

[English](README.md) | 简体中文 | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md)

[![CI](https://img.shields.io/github/actions/workflow/status/wilsonwang0713/code-by-wilson/ci.yml?style=flat-square&label=CI)](https://github.com/wilsonwang0713/code-by-wilson/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/wilsonwang0713/code-by-wilson?style=flat-square)](https://github.com/wilsonwang0713/code-by-wilson/releases)

**驾驭每一个 Claude Code 会话，查看其丰富的会话记录，监控遥测数据，尽在一个界面。**

![FlightDeck：一个实时 Claude Code 会话，含会话侧栏、会话记录与遥测面板](docs/assets/flightdeck-screenshot.png)

## 功能

需要本地已安装 Claude Code。打开应用，机器上正在运行的每一个会话都在这里。

- **所有会话在一个侧栏里。** 从一个侧栏管理机器上运行的每一个会话：按项目分组、可搜索，各自标示实时状态。
- **驾驶、分叉，或只是旁观。** 在内嵌终端里启动会话、分叉一个正在运行的会话、接管在别处启动的会话，或以只读方式观察。
- **完整的会话记录。** 每一条消息、工具调用与结果，从磁盘重建并清晰呈现。
- **CLI 藏起来的遥测。** 上下文压力、花费、实时吞吐、占空比、git、任务、子代理与后台 shell，逐会话呈现。
- **完整的全貌。** 跨会话的统计视图——按模型堆叠的每日图表、模型占比环图、带一周预测的累计用量、按星期 × 小时的活跃热力图，以及一整年的贡献日历——全部精确，绝不估算。
- **速率限制一目了然。** 你账户的速率限制窗口与各模型的每周额度，直接从磁盘读取，以弧形仪表呈现并带实时重置倒计时。
- **浅色或深色。** 深色之外还有完整的浅色主题，也可跟随系统——在「设置 → 外观」中设定。
- **灵动岛（macOS）。** 刘海下方的可选浮层：一颗药丸一瞥即知状态，展开后是等你处理的会话收件箱——点一下即可跳转过去。

## 下载

| 平台                  | 文件                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| macOS · Apple Silicon | [`FlightDeck-arm64.dmg`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-arm64.dmg)             |
| macOS · Intel         | [`FlightDeck-x64.dmg`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-x64.dmg)                 |
| Windows · x64         | [`FlightDeck-Setup-x64.exe`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-Setup-x64.exe)     |
| Windows · ARM64       | [`FlightDeck-Setup-arm64.exe`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-Setup-arm64.exe) |

点一下即可开始下载，始终是最新版本。你需要本地已安装
[Claude Code](https://docs.anthropic.com/en/docs/claude-code)，才有可观察和控制的会话。

在 macOS 上，打开 `.dmg` 并将 FlightDeck 拖到「应用程序」。在 Windows 上运行
`.exe`；若 SmartScreen 警告，点击 **更多信息 → 仍要运行**。

安装后，应用会在启动时检查新版本，并可从「设置 → 关于」更新。

## 从源码构建

```
pnpm install
pnpm rebuild:native   # 针对 Electron 的 ABI 重建 better-sqlite3 + node-pty
pnpm dist             # macOS：将 .dmg 写入 release/
pnpm dist:win         # Windows：将 .exe 写入 release/
```

本地构建的应用未签名：在 macOS 上首次启动可能需要右键 → **打开**，或用
`xattr -dr com.apple.quarantine /Applications/FlightDeck.app` 清除隔离标记；在
Windows 上 SmartScreen 可能警告：点击 **更多信息 → 仍要运行**。

## 开发

```
pnpm install
pnpm rebuild:native   # 针对 Electron 的 ABI 重建 better-sqlite3 + node-pty
pnpm dev              # 启动应用
```

`pnpm test` 在 `tests/fixtures/` 中脱敏的 `.claude` fixture 上运行 provider 读取测试。
`pnpm typecheck` 检查 main 与 renderer 项目。

欢迎提交 bug 报告与想法。[提交 issue](https://github.com/wilsonwang0713/code-by-wilson/issues/new/choose)，
或参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE) © Yihhsuan Wang。第三方与上游声明保留在
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
