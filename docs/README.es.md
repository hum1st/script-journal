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
import { runTask, stopTask, readTaskJson, readTaskLog } from "script-journal";

try {
  const state = await runTask({
    cwd: "/path/to/your-app", // opcional, por defecto process.cwd()
    task: "src/tasks/helloTask.mjs", // absoluto o relativo a cwd
    output: "tmp/tasks/hello", // absoluto o relativo a cwd (sin extensión)
    parameters: { name: "world" },
  });
  // state es el JSON de la tarea (status: "done", ...)
} catch (state) {
  // en fallo se lanza el mismo objeto JSON (el error ya está en el archivo)
  console.error(state.error);
}

// Detener a la fuerza una tarea en ejecución por su ruta output (mata el pid del JSON)
await stopTask({ cwd: "/path/to/your-app", output: "tmp/tasks/hello" });

const persisted = readTaskJson({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/hello",
});

// Por defecto tail=true (páginas más recientes). totalLines está acotado por maxLogLines.
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

El proceso padre permanece en silencio: stdout/stderr del hijo solo se escriben en el archivo de log.

## Contrato del módulo de tarea

```js
// src/tasks/helloTask.mjs
export async function run(parameters, ctx) {
  ctx.logger.info("hello started");
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

`pid` se establece mientras el runner está vivo y se limpia (`null`) cuando la tarea termina o se detiene.

## Archivo de log

`<output>.log` — un objeto NDJSON por línea:

```json
{"timestamp":"2026-07-19T01:00:00.000Z","level":"info","message":"hello started"}
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

Antes de escribir un nuevo estado pending, `runTask` lee cualquier `<output>.json` existente y **termina a la fuerza** un `pid` aún vivo (si existe). Así se evitan runners huérfanos al reutilizar el mismo `output`.

En éxito devuelve el estado JSON de la tarea. En fallo, rechaza con ese mismo objeto JSON (el error ya está persistido en `<output>.json`).

### `stopTask({ cwd?, output })`

Detener a la fuerza la tarea de `output`: terminar un `pid` vivo de `<output>.json` y escribir `status: "stopped"`, `success: false`, `pid: null`. Idempotente si el proceso ya terminó. Lanza error si falta el archivo de estado.

### `readTaskJson({ cwd?, output })` / `readTaskLog({ cwd?, output, page?, pageSize?, tail? })`

Las mismas reglas de resolución de `cwd` / `output` que `runTask`.

`readTaskLog` usa por defecto `tail: true` (páginas más recientes). Usa `tail: false` para leer desde el inicio.

## License

MIT
