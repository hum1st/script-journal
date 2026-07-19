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
import { runTask, stopTask, readTaskJson, readTaskLog } from "script-journal";

try {
  const state = await runTask({
    cwd: "/path/to/your-app", // optionnel, défaut process.cwd()
    task: "src/tasks/helloTask.mjs", // absolu ou relatif à cwd
    output: "tmp/tasks/hello", // absolu ou relatif à cwd (sans extension)
    parameters: { name: "world" },
  });
  // state est le JSON de la tâche (status: "done", ...)
} catch (state) {
  // en cas d'échec, le même objet JSON est rejeté (erreur déjà écrite dans le fichier)
  console.error(state.error);
}

// Arrêter de force une tâche en cours via son chemin output (tue le pid du JSON)
await stopTask({ cwd: "/path/to/your-app", output: "tmp/tasks/hello" });

const persisted = readTaskJson({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/hello",
});

// Par défaut tail=true (dernières pages). totalLines est borné par maxLogLines.
const log = readTaskLog({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/hello",
  pageSize: 50,
});
```

CommonJS :

```js
const { runTask, stopTask, readTaskJson, readTaskLog } = require("script-journal");
```

Le processus parent reste silencieux : stdout/stderr de l’enfant sont uniquement écrits dans le fichier de log.

## Contrat du module de tâche

```js
// src/tasks/helloTask.mjs
export async function run(parameters, ctx) {
  ctx.logger.info("hello started");
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

`pid` est défini tant que le runner est vivant, et remis à `null` lorsque la tâche se termine ou est arrêtée.

## Fichier de log

`<output>.log` — un objet NDJSON par ligne :

```json
{"timestamp":"2026-07-19T01:00:00.000Z","level":"info","message":"hello started"}
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

Avant d’écrire un nouvel état pending, `runTask` lit tout `<output>.json` existant et **termine de force** un `pid` encore vivant (s’il existe). Cela évite les runners orphelins lors de la réutilisation du même `output`.

En cas de succès, renvoie l'état JSON de la tâche. En cas d'échec, rejette avec ce même objet JSON (erreur déjà persistée dans `<output>.json`).

### `stopTask({ cwd?, output })`

Arrêter de force la tâche pour `output` : terminer un `pid` vivant depuis `<output>.json`, puis écrire `status: "stopped"`, `success: false`, `pid: null`. Idempotent si le processus est déjà terminé. Lève une erreur si le fichier d’état est absent.

### `readTaskJson({ cwd?, output })` / `readTaskLog({ cwd?, output, page?, pageSize?, tail? })`

Mêmes règles de résolution `cwd` / `output` que `runTask`.

`readTaskLog` utilise par défaut `tail: true` (dernières pages). Mettez `tail: false` pour lire depuis le début.

## License

MIT
