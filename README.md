# script-journal

Run a JS script module, write its returned data to a JSON file, and record the execution process to a log file.

**Other languages:** [中文](docs/README.zh.md) | [Deutsch](docs/README.de.md) | [Español](docs/README.es.md) | [Français](docs/README.fr.md) | [日本語](docs/README.ja.md)

## Installation

```bash
npm install script-journal
```

## Usage

```ts
import { runScript } from "script-journal";

const result = await runScript("/path/to/my-task.mjs", {
  root: "/output",
  filePath: "reports/daily", // optional, defaults to "output"
});

// Output files:
//   /output/reports/daily.json  ← script return value
//   /output/reports/daily.log   ← execution log
```

### Script Format

The script must `export default` a function (async or sync). Its return value will be persisted to JSON:

```js
// my-task.mjs
export default async function () {
  const data = await fetchSomething();
  return data;
}
```

CommonJS format is also supported:

```js
// my-task.js
module.exports = async function () {
  return { status: "ok", timestamp: Date.now() };
};
```

## API

### `runScript(scriptFile, options)`

#### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `scriptFile` | `string` | ✅ | Absolute path to the script file to execute |
| `options.root` | `string` | ✅ | Output root directory |
| `options.filePath` | `string` | ❌ | Relative path (without extension), supports subdirectories, defaults to `"output"` |

#### `filePath` Resolution Rules

| `filePath` value | JSON output path | Log output path |
|---|---|---|
| `"output"` (default) | `<root>/output.json` | `<root>/output.log` |
| `"result"` | `<root>/result.json` | `<root>/result.log` |
| `"reports/daily"` | `<root>/reports/daily.json` | `<root>/reports/daily.log` |

#### Return Value `ScriptJournalResult<T>`

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | Whether the script executed successfully (no exception thrown) |
| `data` | `T` | Return value of the script function (only present when `success=true`) |
| `error` | `string` | Error message / stack trace (only present when `success=false`) |
| `startedAt` | `string` | Execution start time (ISO string) |
| `finishedAt` | `string` | Execution end time (ISO string) |
| `durationMs` | `number` | Duration in milliseconds |
| `jsonPath` | `string` | Absolute path of the output JSON file |
| `logPath` | `string` | Absolute path of the output log file |

### File Cleanup

Before each execution, any existing `.json` and `.log` files at the same path are **automatically deleted**, ensuring a clean result every time.

## License

MIT

