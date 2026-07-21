# <img src="docs/assets/logo.svg" alt="" height="64" align="center"> FlightDeck

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | 日本語 | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md)

[![CI](https://img.shields.io/github/actions/workflow/status/wilsonwang0713/code-by-wilson/ci.yml?style=flat-square&label=CI)](https://github.com/wilsonwang0713/code-by-wilson/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/wilsonwang0713/code-by-wilson?style=flat-square)](https://github.com/wilsonwang0713/code-by-wilson/releases)

**すべての Claude Code セッションを操縦し、リッチな会話ログを閲覧し、テレメトリを監視する。すべてを一つの画面で。**

![FlightDeck：セッションレール、会話ログ、テレメトリパネルを備えたライブ Claude Code セッション](docs/assets/flightdeck-screenshot.png)

## 機能

Claude Code がローカルにインストールされている必要があります。アプリを開けば、マシン上で実行中のすべてのセッションがそこにあります。

- **すべてのセッションを一つのレールに。** マシン上で実行中のすべてのセッションを一つのレールで管理：プロジェクト単位でグループ化、検索可能、それぞれがライブ状態を表示します。
- **操縦、フォーク、あるいは傍観。** 埋め込みターミナルでセッションを起動し、実行中のものをフォークし、別の場所で始めたものを引き継ぎ、あるいは読み取り専用で観察します。
- **完全な会話ログ。** すべてのメッセージ、ツール呼び出し、結果を、ディスクから再構築して明瞭に表示します。
- **CLI が隠すテレメトリ。** コンテキスト圧、コスト、ライブスループット、デューティ比、git、タスク、サブエージェント、バックグラウンドシェルを、セッションごとに表示します。
- **全体像。** セッション横断の統計ビュー——モデル別に積み上げた日次チャート、モデル割合のリング、1 週間の予測付き累計使用量、曜日 × 時間のアクティビティヒートマップ、1 年分のコントリビューションカレンダー——すべて正確で、推定は一切ありません。
- **レート制限を一目で。** アカウントのレート制限ウィンドウとモデル別の週次バケットを、ディスクから直接読み取り、リセットまでのライブカウントダウン付きのアークゲージで表示します。
- **ライトまたはダーク。** ダークに加えて完全なライトテーマ、またはシステムに追従——「設定 → 外観」で設定します。
- **ノッチアイランド（macOS）。** ノッチ下の任意のオーバーレイ：一目で状態がわかるピルが、あなたを待っているセッションの受信箱に展開します——クリックすればそのセッションへ直接ジャンプします。

## ダウンロード

| プラットフォーム      | ファイル                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| macOS · Apple Silicon | [`FlightDeck-arm64.dmg`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-arm64.dmg)             |
| macOS · Intel         | [`FlightDeck-x64.dmg`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-x64.dmg)                 |
| Windows · x64         | [`FlightDeck-Setup-x64.exe`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-Setup-x64.exe)     |
| Windows · ARM64       | [`FlightDeck-Setup-arm64.exe`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-Setup-arm64.exe) |

ワンクリックでダウンロードが始まり、常に最新リリースです。観察・操作できるセッションが必要なので、ローカルに
[Claude Code](https://docs.anthropic.com/en/docs/claude-code) がインストールされている必要があります。

macOS では `.dmg` を開き、FlightDeck を「アプリケーション」へドラッグします。Windows では
`.exe` を実行し、SmartScreen が警告した場合は **詳細情報 → 実行** をクリックします。

インストール後、アプリは起動時に新しいリリースを確認し、「設定 → 概要」から更新できます。

## ソースからビルド

```
pnpm install
pnpm rebuild:native   # Electron の ABI 向けに better-sqlite3 + node-pty を再ビルド
pnpm dist             # macOS：.dmg を release/ に出力
pnpm dist:win         # Windows：.exe を release/ に出力
```

ローカルビルドのアプリは未署名です：macOS では初回起動時に右クリック →
**開く**、または `xattr -dr com.apple.quarantine /Applications/FlightDeck.app`
で隔離フラグを解除する必要があるかもしれません。Windows では SmartScreen が警告する
場合があります：**詳細情報 → 実行** をクリックします。

## 開発

```
pnpm install
pnpm rebuild:native   # Electron の ABI 向けに better-sqlite3 + node-pty を再ビルド
pnpm dev              # アプリを起動
```

`pnpm test` は `tests/fixtures/` 内の匿名化された `.claude` フィクスチャに対して
provider の読み取りテストを実行します。`pnpm typecheck` は main と renderer の
プロジェクトを検査します。

バグ報告やアイデアを歓迎します。[issue を開く](https://github.com/wilsonwang0713/code-by-wilson/issues/new/choose)、
または [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT](LICENSE) © Yihhsuan Wang。サードパーティおよび上流の告知は
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) に保持されています。
