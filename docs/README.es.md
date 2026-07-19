# script-journal

Ejecuta un módulo de tarea en un proceso hijo, persiste el estado JSON y captura logs NDJSON. Las apps anfitrionas solo escriben tareas; esta biblioteca se encarga de la ejecución, el estado y la E/S de logs.

Funciona con consumidores **ESM** y **CommonJS**. Los archivos de tarea pueden ser `.mjs`, `.js` o `.cjs`.

**Otros idiomas:** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Instalación

```bash
npm install script-journal
```

## Inicio rápido

```ts
import { runTask, readTaskJson, readTaskLog } from "script-journal";

const { exitCode, jsonPath, logPath } = await runTask({
  cwd: "/path/to/your-app", // opcional, por defecto process.cwd()
  task: "src/tasks/updateRegistriesTask.mjs", // absoluto o relativo a cwd
  output: "tmp/tasks/update-registries", // absoluto o relativo a cwd (sin extensión)
  parameters: { registries: ["foo"] },
});

const state = readTaskJson({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/update-registries",
});

// Por defecto tail=true (páginas más recientes). totalLines está acotado por maxLogLines.
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

El proceso padre permanece en silencio: stdout/stderr del hijo solo se escriben en el archivo de log.

## Contrato del módulo de tarea

```js
// src/tasks/updateRegistriesTask.mjs
export async function run(parameters, ctx) {
  ctx.logger.info("sync started");
  ctx.patchResults({ total: 0, failed: 0 });

  // ... trabajo con parameters ...

  ctx.patchResults({ total: 3 });
  return { success: true }; // o { success: false, error: "..." }
}
```

### `ctx`

| Campo | Descripción |
|---|---|
| `logger.debug/info/warn/error(msg)` | Escribe `[LEVEL] msg`; se captura como log NDJSON |
| `results` | Objeto results actual (referencia compartida) |
| `updateResults(patch)` | Fusión superficial en `results` y persistencia JSON |
| `patchResults(patch)` | Misma fusión, devuelve `results` |

### Valor de retorno

- `undefined` / `null` — conservar results acumulados vía `patchResults`
- objeto — fusión superficial en `results`; `success` decide done/failed; `error` → `state.error`

Código de salida: `0` si éxito, si no `1`.

## JSON de estado

Escrito en `<output>.json`:

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

## Archivo de log

`<output>.log` — un objeto NDJSON por línea:

```json
{"timestamp":"2026-07-19T01:00:00.000Z","level":"info","message":"sync started"}
```

Cuando el log supera `maxLogLines` (por defecto **10000**), se eliminan líneas antiguas del inicio y solo quedan las más recientes. Pasa `maxLogLines: 0` para desactivar el recorte.

## API

### `runTask(options)`

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `cwd` | `string` | ❌ | Directorio de trabajo, por defecto `process.cwd()` |
| `task` | `string` | ✅ | Ruta del archivo de tarea (absoluta o relativa a `cwd`) |
| `output` | `string` | ✅ | Ruta base de salida sin extensión (absoluta o relativa a `cwd`) |
| `parameters` | `object` | ❌ | Se pasa a `run(parameters, ctx)` |
| `maxLogLines` | `number` | ❌ | Máx. líneas de log retenidas; las antiguas se eliminan del inicio. Por defecto `10000`. `≤0` desactiva |

Devuelve `{ exitCode, jsonPath, logPath }`.

### `readTaskJson({ cwd?, output })` / `readTaskLog({ cwd?, output, page?, pageSize?, tail? })`

Las mismas reglas de resolución de `cwd` / `output` que `runTask`.

`readTaskLog` usa por defecto `tail: true` (páginas más recientes). Usa `tail: false` para leer desde el inicio.

## License

MIT
