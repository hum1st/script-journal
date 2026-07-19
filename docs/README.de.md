# script-journal

Führt ein Task-Modul in einem Kindprozess aus, persistiert den JSON-Status und erfasst NDJSON-Logs. Host-Apps schreiben nur Tasks; Ausführung, Status und Log-I/O übernimmt diese Bibliothek.

Funktioniert für **ESM**- und **CommonJS**-Konsumenten. Task-Dateien können `.mjs`, `.js` oder `.cjs` sein.

**Andere Sprachen:** [English](../README.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Installation

```bash
npm install script-journal
```

## Schnellstart

```ts
import { runTask, readTaskJson, readTaskLog } from "script-journal";

const { exitCode, jsonPath, logPath } = await runTask({
  cwd: "/path/to/your-app", // optional, Standard: process.cwd()
  task: "src/tasks/updateRegistriesTask.mjs", // absolut oder relativ zu cwd
  output: "tmp/tasks/update-registries", // absolut oder relativ zu cwd (ohne Erweiterung)
  parameters: { registries: ["foo"] },
});

const state = readTaskJson({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/update-registries",
});

// Standard: tail=true (neueste Seiten). totalLines ist durch maxLogLines begrenzt.
const log = readTaskLog({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/update-registries",
  pageSize: 50,
});
```

CommonJS:

```js
const { runTask, readTaskJson, readTaskLog } = require("script-journal");
```

Der Elternprozess bleibt still: stdout/stderr des Kindes werden nur in die Logdatei geschrieben.

## Task-Modul-Vertrag

```js
// src/tasks/updateRegistriesTask.mjs
export async function run(parameters, ctx) {
  ctx.logger.info("sync started");
  ctx.patchResults({ total: 0, failed: 0 });

  // ... Arbeit mit parameters ...

  ctx.patchResults({ total: 3 });
  return { success: true }; // oder { success: false, error: "..." }
}
```

### `ctx`

| Feld | Beschreibung |
|---|---|
| `logger.debug/info/warn/error(msg)` | Schreibt `[LEVEL] msg`; wird als NDJSON-Log erfasst |
| `results` | Aktuelles results-Objekt (gemeinsame Referenz) |
| `updateResults(patch)` | Flache Zusammenführung in `results` und JSON persistieren |
| `patchResults(patch)` | Gleiche Zusammenführung, gibt `results` zurück |

### Rückgabewert

- `undefined` / `null` — über `patchResults` angesammelte results behalten
- Objekt — flach in `results` zusammengeführt; `success` entscheidet done/failed; `error` → `state.error`

Exit-Code: `0` bei Erfolg, sonst `1`.

## Status-JSON

Geschrieben nach `<output>.json`:

```json
{
  "task": "/abs/path/to/updateRegistriesTask.mjs",
  "status": "pending|running|done|failed|error",
  "startedAt": "ISO|null",
  "finishedAt": "ISO|null",
  "durationMs": 0,
  "success": true,
  "parameters": {},
  "error": null,
  "results": {}
}
```

## Logdatei

`<output>.log` — ein NDJSON-Objekt pro Zeile:

```json
{"timestamp":"2026-07-19T01:00:00.000Z","level":"info","message":"sync started"}
```

Überschreitet das Log `maxLogLines` (Standard **10000**), werden ältere Zeilen am Anfang gelöscht, sodass nur die neuesten bleiben. Mit `maxLogLines: 0` wird das Trimmen deaktiviert.

## API

### `runTask(options)`

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `cwd` | `string` | ❌ | Arbeitsverzeichnis, Standard `process.cwd()` |
| `task` | `string` | ✅ | Task-Dateipfad (absolut oder relativ zu `cwd`) |
| `output` | `string` | ✅ | Ausgabe-Basispfad ohne Erweiterung (absolut oder relativ zu `cwd`) |
| `parameters` | `object` | ❌ | Wird an `run(parameters, ctx)` übergeben |
| `maxLogLines` | `number` | ❌ | Max. behaltene Logzeilen; ältere am Anfang entfernt. Standard `10000`. `≤0` deaktiviert |

Rückgabe: `{ exitCode, jsonPath, logPath }`.

### `readTaskJson({ cwd?, output })` / `readTaskLog({ cwd?, output, page?, pageSize?, tail? })`

Dieselben Auflösungsregeln für `cwd` / `output` wie bei `runTask`.

`readTaskLog` verwendet standardmäßig `tail: true` (neueste Seiten). Mit `tail: false` vom Anfang lesen.

## License

MIT
