# <img src="docs/assets/logo.svg" alt="" height="64" align="center"> FlightDeck

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Español | [Français](README.fr.md)

[![CI](https://img.shields.io/github/actions/workflow/status/wilsonwang0713/code-by-wilson/ci.yml?style=flat-square&label=CI)](https://github.com/wilsonwang0713/code-by-wilson/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/wilsonwang0713/code-by-wilson?style=flat-square)](https://github.com/wilsonwang0713/code-by-wilson/releases)

**Pilota cada sesión de Claude Code, consulta su transcripción enriquecida y monitoriza la telemetría, todo en una sola interfaz.**

![FlightDeck: una sesión de Claude Code en vivo con el panel lateral de sesiones, la transcripción y los paneles de telemetría](docs/assets/flightdeck-screenshot.png)

## Funciones

Requiere tener Claude Code instalado localmente. Abre la app y cada sesión que ya se está ejecutando en tu máquina aparece ahí.

- **Todas las sesiones en un solo panel lateral.** Gestiona cada sesión en ejecución desde un único panel: agrupadas por proyecto, con búsqueda, y cada una indicando su estado en vivo.
- **Pilota, bifurca o solo observa.** Lanza una sesión en una terminal integrada, bifurca una en vivo, adopta una que iniciaste en otro lugar u obsérvala en modo de solo lectura.
- **La transcripción completa.** Cada mensaje, llamada a herramienta y resultado, reconstruidos desde el disco y renderizados con claridad.
- **La telemetría que la CLI oculta.** Presión de contexto, gasto, rendimiento en vivo, ciclo de trabajo, git, tareas, subagentes y shells en segundo plano, por sesión.
- **La historia completa.** Una vista de estadísticas entre sesiones: un gráfico diario apilado por modelo, un anillo de reparto por modelo, uso acumulado con una proyección de una semana, un mapa de calor de actividad por día de la semana y hora, y un calendario de contribuciones de un año — todo exacto, nunca estimado.
- **Tus límites de uso a la vista.** Las ventanas de límite de tu cuenta y los cupos semanales por modelo, leídos directamente del disco, como medidores en arco con cuentas atrás de reinicio en vivo.
- **Claro u oscuro.** Un tema claro completo junto al oscuro, o seguir al sistema — ajústalo en Ajustes → Apariencia.
- **La isla del notch (macOS).** Una superposición opcional bajo el notch: una píldora de un vistazo que se expande en una bandeja con las sesiones que te esperan — haz clic en una para saltar directamente a ella.

## Descarga

| Plataforma            | Archivo                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| macOS · Apple Silicon | [`FlightDeck-arm64.dmg`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-arm64.dmg)             |
| macOS · Intel         | [`FlightDeck-x64.dmg`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-x64.dmg)                 |
| Windows · x64         | [`FlightDeck-Setup-x64.exe`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-Setup-x64.exe)     |
| Windows · ARM64       | [`FlightDeck-Setup-arm64.exe`](https://github.com/wilsonwang0713/code-by-wilson/releases/latest/download/FlightDeck-Setup-arm64.exe) |

Un clic inicia la descarga, siempre la última versión. Necesitarás tener
[Claude Code](https://docs.anthropic.com/en/docs/claude-code) instalado
localmente para tener sesiones que observar y controlar.

En macOS, abre el `.dmg` y arrastra FlightDeck a Aplicaciones. En Windows,
ejecuta el `.exe`; si SmartScreen avisa, haz clic en **Más información →
Ejecutar de todas formas**.

Una vez instalada, la app busca nuevas versiones al iniciarse y se actualiza
desde Ajustes → Acerca de.

## Compilar desde el código fuente

```
pnpm install
pnpm rebuild:native   # recompila better-sqlite3 + node-pty para el ABI de Electron
pnpm dist             # macOS: escribe el .dmg en release/
pnpm dist:win         # Windows: escribe el .exe en release/
```

Una app compilada localmente no está firmada: en macOS el primer arranque
puede requerir clic derecho → **Abrir**, o eliminar la marca de cuarentena con
`xattr -dr com.apple.quarantine /Applications/FlightDeck.app`; en Windows,
SmartScreen puede avisar: haz clic en **Más información → Ejecutar de todas formas**.

## Desarrollo

```
pnpm install
pnpm rebuild:native   # recompila better-sqlite3 + node-pty para el ABI de Electron
pnpm dev              # inicia la app
```

`pnpm test` ejecuta las pruebas de lectura del proveedor sobre las fixtures
`.claude` anonimizadas en `tests/fixtures/`. `pnpm typecheck` comprueba los
proyectos main y renderer.

Los informes de errores y las ideas son bienvenidos. [Abre una incidencia](https://github.com/wilsonwang0713/code-by-wilson/issues/new/choose),
o consulta [CONTRIBUTING.md](CONTRIBUTING.md).

## Licencia

[MIT](LICENSE) © Yihhsuan Wang. Los avisos de terceros y del proyecto original
se conservan en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
