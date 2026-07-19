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
import { runTask, stopTask, readTaskJson, readTaskLog } from "script-journal";

try {
  const state = await runTask({
    cwd: "/path/to/your-app", // optional, Standard: process.cwd()
    task: "src/tasks/helloTask.mjs", // absolut oder relativ zu cwd
    output: "tmp/tasks/hello", // absolut oder relativ zu cwd (ohne Erweiterung)
    parameters: { name: "world" },
  });
  // state ist der Task-JSON-Status (status: "done", ...)
} catch (state) {
  // bei Fehler wird dasselbe JSON-Objekt geworfen (Fehler bereits in Datei geschrieben)
  console.error(state.error);
}

// Laufenden Task anhand des output-Pfads zwangsweise beenden (pid aus JSON töten)
await stopTask({ cwd: "/path/to/your-app", output: "tmp/tasks/hello" });

const persisted = readTaskJson({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/hello",
});

// Standard: tail=true (neueste Seiten). totalLines ist durch maxLogLines begrenzt.
const log = readTaskLog({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/hello",
  pageSize: 50,
});
```

CommonJS:

```js
const { runTask, stopTask, readTaskJson, readTaskLog } = require("script-journal");
```

Der Elternprozess bleibt still: stdout/stderr des Kindes werden nur in die Logdatei geschrieben.

## Task-Modul-Vertrag

```js
// src/tasks/helloTask.mjs
export async function run(parameters, ctx) {
  ctx.logger.info("hello started");
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
  "task": "/abs/path/to/helloTask.mjs",
  "status": "pending|running|done|failed|error|stopped",
  "pid": 12345,
  "startedAt": "ISO|null",
  "finishedAt": "ISO|null",
  "durationMs": 0,
  "success": true,
  "parameters": {},
  "error": null,
  "results": {}
}
```

`pid` ist gesetzt, solange der Runner läuft, und wird (`null`) gelöscht, wenn die Aufgabe endet oder gestoppt wird.

## Logdatei

`<output>.log` — ein NDJSON-Objekt pro Zeile:

```json
{"timestamp":"2026-07-19T01:00:00.000Z","level":"info","message":"hello started"}
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

Bevor ein neuer pending-Status geschrieben wird, liest `runTask` vorhandenes `<output>.json` und **beendet zwangsweise** eine noch lebende `pid` (falls vorhanden). So entstehen keine verwaisten Runner bei Wiederverwendung desselben `output`.

Gibt bei Erfolg den Task-JSON-Status zurück. Bei Fehler wird mit demselben JSON-Objekt rejected (Fehler bereits in `<output>.json` geschrieben).

### `stopTask({ cwd?, output })`

Task für `output` zwangsweise stoppen: lebende `pid` aus `<output>.json` beenden, dann `status: "stopped"`, `success: false`, `pid: null` schreiben. Idempotent, wenn der Prozess bereits beendet ist. Wirft einen Fehler, wenn die Statusdatei fehlt.

### `readTaskJson({ cwd?, output })` / `readTaskLog({ cwd?, output, page?, pageSize?, tail? })`

Dieselben Auflösungsregeln für `cwd` / `output` wie bei `runTask`.

`readTaskLog` verwendet standardmäßig `tail: true` (neueste Seiten). Mit `tail: false` vom Anfang lesen.

## License

MIT
