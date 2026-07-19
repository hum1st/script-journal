# script-journal

Run a task module in a child process, persist JSON status, and capture NDJSON logs. Host apps only author tasks; this library owns execution, status, and log I/O.

Works from both **ESM** and **CommonJS** consumers. Task files may be `.mjs`, `.js`, or `.cjs`.

**Other languages:** [中文](docs/README.zh.md) | [Deutsch](docs/README.de.md) | [Español](docs/README.es.md) | [Français](docs/README.fr.md) | [日本語](docs/README.ja.md)

## Installation

```bash
npm install script-journal
```

## Quick start

```ts
import { runTask, readTaskJson, readTaskLog } from "script-journal";

const { exitCode, jsonPath, logPath } = await runTask({
  cwd: "/path/to/your-app", // optional, default process.cwd()
  task: "src/tasks/updateRegistriesTask.mjs", // absolute or relative to cwd
  output: "tmp/tasks/update-registries", // absolute or relative to cwd (no extension)
  parameters: { registries: ["foo"] },
});

const state = readTaskJson({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/update-registries",
});

// Defaults to tail=true (latest pages). totalLines is bounded by maxLogLines.
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

Parent process stays silent: child stdout/stderr are captured into the log file only.

## Task module contract

```js
// src/tasks/updateRegistriesTask.mjs
export async function run(parameters, ctx) {
  ctx.logger.info("sync started");
  ctx.patchResults({ total: 0, failed: 0 });

  // ... work using parameters ...

  ctx.patchResults({ total: 3 });
  return { success: true }; // or { success: false, error: "..." }
}
```

### `ctx`

| Field | Description |
|---|---|
| `logger.debug/info/warn/error(msg)` | Writes `[LEVEL] msg`; captured into NDJSON log |
| `results` | Current results object (shared reference) |
| `updateResults(patch)` | Shallow-merge into `results` and persist JSON |
| `patchResults(patch)` | Same merge, returns `results` |

### Return value

- `undefined` / `null` — keep results accumulated via `patchResults`
- object — shallow-merged into `results`; `success` decides done/failed; `error` → `state.error`

Exit code: `0` if success, else `1`.

## Status JSON

Written to `<output>.json`:

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

## Log file

`<output>.log` — one NDJSON object per line:

```json
{"timestamp":"2026-07-19T01:00:00.000Z","level":"info","message":"sync started"}
```

When the log exceeds `maxLogLines` (default **10000**), older lines are deleted from the head so only the newest lines remain. Pass `maxLogLines: 0` to disable trimming.

## API

### `runTask(options)`

| Field | Type | Required | Description |
|---|---|---|---|
| `cwd` | `string` | ❌ | Working directory, default `process.cwd()` |
| `task` | `string` | ✅ | Task file path (absolute or relative to `cwd`) |
| `output` | `string` | ✅ | Output base path without extension (absolute or relative to `cwd`) |
| `parameters` | `object` | ❌ | Passed to `run(parameters, ctx)` |
| `maxLogLines` | `number` | ❌ | Max retained log lines; older lines dropped from head. Default `10000`. `≤0` disables |

Returns `{ exitCode, jsonPath, logPath }`.

### `readTaskJson({ cwd?, output })` / `readTaskLog({ cwd?, output, page?, pageSize?, tail? })`

Same `cwd` / `output` resolution rules as `runTask`.

`readTaskLog` defaults to `tail: true` (latest pages). Set `tail: false` to read from the start.

## License

MIT
