# <img src="docs/assets/logo.svg" alt="" height="64" align="center"> FlightDeck

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | Français

[![CI](https://img.shields.io/github/actions/workflow/status/wilsonwang0713/code-by-wilson/ci.yml?style=flat-square&label=CI)](https://github.com/wilsonwang0713/code-by-wilson/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/wilsonwang0713/code-by-wilson?style=flat-square)](https://github.com/wilsonwang0713/code-by-wilson/releases)

**Pilotez chaque session Claude Code, consultez sa transcription enrichie et surveillez la télémétrie, le tout dans une seule interface.**

![FlightDeck : une session Claude Code en direct avec le rail des sessions, la transcription et les panneaux de télémétrie](docs/assets/flightdeck-screenshot.png)

## Fonctionnalités

Nécessite Claude Code installé localement. Ouvrez l'application et chaque session déjà en cours sur votre machine s'y trouve.

- **Toutes les sessions dans un seul rail.** Gérez chaque session en cours depuis un seul rail : regroupées par projet, avec recherche, chacune signalant son état en direct.
- **Piloter, forker ou simplement observer.** Lancez une session dans un terminal intégré, forkez-en une en direct, adoptez-en une démarrée ailleurs, ou observez-la en lecture seule.
- **La transcription complète.** Chaque message, appel d'outil et résultat, reconstruits depuis le disque et rendus proprement.
- **La télémétrie que la CLI cache.** Pression de contexte, dépenses, débit en direct, cycle d'activité, git, tâches, sous-agents et shells en arrière-plan, par session.
- **L'histoire complète.** Une vue de statistiques inter-sessions : un graphique quotidien empilé par modèle, un anneau de répartition par modèle, l'utilisation cumulée avec une projection sur une semaine, une carte de chaleur d'activité par jour de la semaine et heure, et un calendrier de contributions sur un an — le tout exact, jamais estimé.
- **Vos limites de débit en vue.** Les fenêtres de limite de votre compte et les quotas hebdomadaires par modèle, lus directement depuis le disque, sous forme de jauges en arc avec des comptes à rebours de réinitialisation en direct.
- **Clair ou sombre.** Un thème clair complet aux côtés du sombre, ou suivre le système — réglez-le dans Réglages → Apparence.
- **L'îlot du notch (macOS).** Une superposition optionnelle sous le notch : une pastille d'un coup d'œil qui se déploie en une boîte de réception des sessions qui vous attendent — cliquez sur l'une d'elles pour y accéder directement.

## Téléchargement

| Plateforme            | Fichier                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| macOS · Apple Silicon | [`FlightDeck-arm64.dmg`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-arm64.dmg)             |
| macOS · Intel         | [`FlightDeck-x64.dmg`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-x64.dmg)                 |
| Windows · x64         | [`FlightDeck-Setup-x64.exe`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-Setup-x64.exe)     |
| Windows · ARM64       | [`FlightDeck-Setup-arm64.exe`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-Setup-arm64.exe) |

Un clic lance le téléchargement, toujours la dernière version. Vous aurez
besoin de [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
installé localement, pour avoir des sessions à observer et à contrôler.

Sur macOS, ouvrez le `.dmg` et glissez FlightDeck dans Applications. Sur
Windows, exécutez le `.exe` ; si SmartScreen avertit, cliquez sur **Informations
complémentaires → Exécuter quand même**.

Une fois installée, l'application vérifie les nouvelles versions au démarrage et
se met à jour depuis Réglages → À propos.

## Compiler depuis les sources

```
pnpm install
pnpm rebuild:native   # recompile better-sqlite3 + node-pty pour l'ABI d'Electron
pnpm dist             # macOS : écrit le .dmg dans release/
pnpm dist:win         # Windows : écrit le .exe dans release/
```

Une application compilée localement n'est pas signée : sur macOS, le premier
lancement peut nécessiter un clic droit → **Ouvrir**, ou la suppression du
drapeau de quarantaine avec
`xattr -dr com.apple.quarantine /Applications/FlightDeck.app` ; sur Windows,
SmartScreen peut avertir : cliquez sur **Informations complémentaires →
Exécuter quand même**.

## Développement

```
pnpm install
pnpm rebuild:native   # recompile better-sqlite3 + node-pty pour l'ABI d'Electron
pnpm dev              # lance l'application
```

`pnpm test` exécute les tests de lecture du fournisseur sur les fixtures
`.claude` anonymisées dans `tests/fixtures/`. `pnpm typecheck` vérifie les
projets main et renderer.

Les rapports de bogues et les idées sont les bienvenus. [Ouvrez une issue](https://github.com/wilsonwang0713/code-by-wilson/issues/new/choose),
ou consultez [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[MIT](LICENSE) © Yihhsuan Wang. Les avis de tiers et du projet amont sont
conservés dans [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
