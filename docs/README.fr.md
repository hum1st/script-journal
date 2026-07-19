# script-journal

Exécute un module de tâche dans un processus enfant, persiste l’état JSON et capture les logs NDJSON. Les applications hôtes n’écrivent que les tâches ; cette bibliothèque gère l’exécution, l’état et les E/S de logs.

Fonctionne avec les consommateurs **ESM** et **CommonJS**. Les fichiers de tâche peuvent être `.mjs`, `.js` ou `.cjs`.

**Autres langues :** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [日本語](README.ja.md)

## Installation

```bash
npm install script-journal
```

## Démarrage rapide

```ts
import { runTask, readTaskJson, readTaskLog } from "script-journal";

const { exitCode, jsonPath, logPath } = await runTask({
  cwd: "/path/to/your-app", // optionnel, défaut process.cwd()
  task: "src/tasks/updateRegistriesTask.mjs", // absolu ou relatif à cwd
  output: "tmp/tasks/update-registries", // absolu ou relatif à cwd (sans extension)
  parameters: { registries: ["foo"] },
});

const state = readTaskJson({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/update-registries",
});

// Par défaut tail=true (dernières pages). totalLines est borné par maxLogLines.
const log = readTaskLog({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/update-registries",
  pageSize: 50,
});
```

CommonJS :

```js
const { runTask, readTaskJson, readTaskLog } = require("script-journal");
```

Le processus parent reste silencieux : stdout/stderr de l’enfant sont uniquement écrits dans le fichier de log.

## Contrat du module de tâche

```js
// src/tasks/updateRegistriesTask.mjs
export async function run(parameters, ctx) {
  ctx.logger.info("sync started");
  ctx.patchResults({ total: 0, failed: 0 });

  // ... travail avec parameters ...

  ctx.patchResults({ total: 3 });
  return { success: true }; // ou { success: false, error: "..." }
}
```

### `ctx`

| Champ | Description |
|---|---|
| `logger.debug/info/warn/error(msg)` | Écrit `[LEVEL] msg` ; capturé en log NDJSON |
| `results` | Objet results courant (référence partagée) |
| `updateResults(patch)` | Fusion superficielle dans `results` et persistance JSON |
| `patchResults(patch)` | Même fusion, renvoie `results` |

### Valeur de retour

- `undefined` / `null` — conserver les results accumulés via `patchResults`
- objet — fusion superficielle dans `results` ; `success` décide done/failed ; `error` → `state.error`

Code de sortie : `0` en cas de succès, sinon `1`.

## JSON d’état

Écrit dans `<output>.json` :

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

## Fichier de log

`<output>.log` — un objet NDJSON par ligne :

```json
{"timestamp":"2026-07-19T01:00:00.000Z","level":"info","message":"sync started"}
```

Lorsque le log dépasse `maxLogLines` (défaut **10000**), les anciennes lignes sont supprimées en tête pour ne garder que les plus récentes. Passez `maxLogLines: 0` pour désactiver le trim.

## API

### `runTask(options)`

| Champ | Type | Requis | Description |
|---|---|---|---|
| `cwd` | `string` | ❌ | Répertoire de travail, défaut `process.cwd()` |
| `task` | `string` | ✅ | Chemin du fichier de tâche (absolu ou relatif à `cwd`) |
| `output` | `string` | ✅ | Chemin de base de sortie sans extension (absolu ou relatif à `cwd`) |
| `parameters` | `object` | ❌ | Passé à `run(parameters, ctx)` |
| `maxLogLines` | `number` | ❌ | Nombre max de lignes de log conservées ; les plus anciennes sont retirées en tête. Défaut `10000`. `≤0` désactive |

Renvoie `{ exitCode, jsonPath, logPath }`.

### `readTaskJson({ cwd?, output })` / `readTaskLog({ cwd?, output, page?, pageSize?, tail? })`

Mêmes règles de résolution `cwd` / `output` que `runTask`.

`readTaskLog` utilise par défaut `tail: true` (dernières pages). Mettez `tail: false` pour lire depuis le début.

## License

MIT
