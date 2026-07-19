# script-journal

タスクモジュールを子プロセスで実行し、JSON 状態を永続化し、NDJSON ログを収集します。ホストアプリはタスクを書くだけ；実行・状態・ログ I/O は本ライブラリが担当します。

**ESM** と **CommonJS** の両方のコンシューマで利用できます。タスクファイルは `.mjs` / `.js` / `.cjs` のいずれかです。

**他の言語：** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md)

## インストール

```bash
npm install script-journal
```

## クイックスタート

```ts
import { runTask, readTaskJson, readTaskLog } from "script-journal";

const { exitCode, jsonPath, logPath } = await runTask({
  cwd: "/path/to/your-app", // 任意、デフォルト process.cwd()
  task: "src/tasks/updateRegistriesTask.mjs", // 絶対パス、または cwd 相対
  output: "tmp/tasks/update-registries", // 絶対パス、または cwd 相対（拡張子なし）
  parameters: { registries: ["foo"] },
});

const state = readTaskJson({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/update-registries",
});

// デフォルトは tail=true（最新ページ）。totalLines は maxLogLines で上限あり
const log = readTaskLog({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/update-registries",
  pageSize: 50,
});
```

CommonJS：

```js
const { runTask, readTaskJson, readTaskLog } = require("script-journal");
```

親プロセスは無出力：子の stdout/stderr はログファイルにのみ書き込まれます。

## タスクモジュール規約

```js
// src/tasks/updateRegistriesTask.mjs
export async function run(parameters, ctx) {
  ctx.logger.info("sync started");
  ctx.patchResults({ total: 0, failed: 0 });

  // ... parameters を使った処理 ...

  ctx.patchResults({ total: 3 });
  return { success: true }; // または { success: false, error: "..." }
}
```

### `ctx`

| フィールド | 説明 |
|---|---|
| `logger.debug/info/warn/error(msg)` | `[LEVEL] msg` を出力；NDJSON ログとして捕捉 |
| `results` | 現在の results（patchResults と共有参照） |
| `updateResults(patch)` | results へ浅いマージして JSON を永続化 |
| `patchResults(patch)` | 同上、かつ results を返す |

### 戻り値

- `undefined` / `null` — `patchResults` で蓄積した results を維持
- オブジェクト — results へ浅いマージ；`success` が done/failed を決定；`error` → `state.error`

終了コード：成功なら `0`、それ以外は `1`。

## ステータス JSON

書き出し先：`<output>.json`

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

## ログファイル

`<output>.log` — 1 行につき 1 つの NDJSON：

```json
{"timestamp":"2026-07-19T01:00:00.000Z","level":"info","message":"sync started"}
```

ログが `maxLogLines`（デフォルト **10000**）を超えると、先頭から古い行を削除し最新行のみ残します。`maxLogLines: 0` でトリムを無効化できます。

## API

### `runTask(options)`

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `cwd` | `string` | ❌ | 作業ディレクトリ、デフォルト `process.cwd()` |
| `task` | `string` | ✅ | タスクファイルパス（絶対、または `cwd` 相対） |
| `output` | `string` | ✅ | 拡張子なしの出力ベースパス（絶対、または `cwd` 相対） |
| `parameters` | `object` | ❌ | `run(parameters, ctx)` に渡す |
| `maxLogLines` | `number` | ❌ | 保持する最大ログ行数。超過分は先頭から削除。デフォルト `10000`。`≤0` で無効 |

戻り値：`{ exitCode, jsonPath, logPath }`。

### `readTaskJson({ cwd?, output })` / `readTaskLog({ cwd?, output, page?, pageSize?, tail? })`

`cwd` / `output` の解決規則は `runTask` と同じです。

`readTaskLog` のデフォルトは `tail: true`（最新ページ）。先頭から読む場合は `tail: false`。

## License

MIT
