# script-journal

Führt ein JS-Skriptmodul aus, schreibt die zurückgegebenen Daten in eine JSON-Datei und das Ausführungsprotokoll in eine Log-Datei.

**Andere Sprachen:** [English](../README.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Installation

```bash
npm install script-journal
```

## Verwendung

```ts
import { runScript } from "script-journal";

const result = await runScript("/path/to/my-task.mjs", {
  root: "/output",
  filePath: "reports/daily", // optional, Standard: "output"
});

// Ausgabedateien:
//   /output/reports/daily.json  ← Rückgabewert des Skripts
//   /output/reports/daily.log   ← Ausführungsprotokoll
```

### Skriptformat

Das Skript muss eine Funktion als `default export` bereitstellen (sync oder async). Der Rückgabewert wird als JSON gespeichert:

```js
// my-task.mjs
export default async function () {
  const data = await fetchSomething();
  return data;
}
```

CommonJS-Format wird ebenfalls unterstützt:

```js
// my-task.js
module.exports = async function () {
  return { status: "ok", timestamp: Date.now() };
};
```

## API

### `runScript(scriptFile, options)`

#### Parameter

| Parameter | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `scriptFile` | `string` | ✅ | Absoluter Pfad zur auszuführenden Skriptdatei |
| `options.root` | `string` | ✅ | Ausgabe-Stammverzeichnis |
| `options.filePath` | `string` | ❌ | Relativer Pfad (ohne Erweiterung), Unterverzeichnisse möglich, Standard: `"output"` |

#### Rückgabewert `ScriptJournalResult<T>`

| Feld | Typ | Beschreibung |
|---|---|---|
| `success` | `boolean` | Ob das Skript erfolgreich ausgeführt wurde |
| `data` | `T` | Rückgabewert der Skriptfunktion (nur bei `success=true`) |
| `error` | `string` | Fehlermeldung/Stack (nur bei `success=false`) |
| `startedAt` | `string` | Startzeit (ISO-String) |
| `finishedAt` | `string` | Endzeit (ISO-String) |
| `durationMs` | `number` | Ausführungsdauer in Millisekunden |
| `jsonPath` | `string` | Absoluter Pfad zur JSON-Ausgabedatei |
| `logPath` | `string` | Absoluter Pfad zur Log-Ausgabedatei |

### Datei-Bereinigung

Vor jeder Ausführung werden bestehende `.json`- und `.log`-Dateien am angegebenen Pfad **automatisch gelöscht**, sodass jede Ausführung saubere Ergebnisse liefert.

## Lizenz

MIT
