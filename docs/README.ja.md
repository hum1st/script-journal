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
import { runTask, stopTask, readTaskJson, readTaskLog } from "script-journal";

try {
  const state = await runTask({
    cwd: "/path/to/your-app", // 任意、デフォルト process.cwd()
    task: "src/tasks/helloTask.mjs", // 絶対パス、または cwd 相対
    output: "tmp/tasks/hello", // 絶対パス、または cwd 相対（拡張子なし）
    parameters: { name: "world" },
  });
  // state はタスク JSON（status: "done", ...）
} catch (state) {
  // 失敗時は同じ JSON オブジェクトが throw される（エラーは既にファイルへ書き込み済み）
  console.error(state.error);
}

// output パスで実行中タスクを強制停止（JSON の pid を終了）
await stopTask({ cwd: "/path/to/your-app", output: "tmp/tasks/hello" });

const persisted = readTaskJson({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/hello",
});

// デフォルトは tail=true（最新ページ）。totalLines は maxLogLines で上限あり
const log = readTaskLog({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/hello",
  pageSize: 50,
});
```

CommonJS：

```js
const { runTask, stopTask, readTaskJson, readTaskLog } = require("script-journal");
```

親プロセスは無出力：子の stdout/stderr はログファイルにのみ書き込まれます。

## タスクモジュール規約

```js
// src/tasks/helloTask.mjs
export async function run(parameters, ctx) {
  ctx.logger.info("hello started");
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

`pid` は runner が生存している間のみ設定され、タスク終了または停止時に `null` になります。

## ログファイル

`<output>.log` — 1 行につき 1 つの NDJSON：

```json
{"timestamp":"2026-07-19T01:00:00.000Z","level":"info","message":"hello started"}
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

新しい pending 状態を書き込む前に、`runTask` は既存の `<output>.json` を読み、生存中の `pid` があれば**強制終了**します。同じ `output` を再利用する際の孤児プロセスを防ぎます。

成功時はタスク JSON 状態を返す。失敗時は同じ JSON オブジェクトで reject する（エラーは既に `<output>.json` に書き込み済み）。

### `stopTask({ cwd?, output })`

`output` に対応するタスクを強制停止：`<output>.json` の生存 `pid` を終了し、`status: "stopped"`、`success: false`、`pid: null` を書き込む。プロセスが既に終了している場合は冪等。状態ファイルがない場合はエラーを投げる。

### `readTaskJson({ cwd?, output })` / `readTaskLog({ cwd?, output, page?, pageSize?, tail? })`

`cwd` / `output` の解決規則は `runTask` と同じです。

`readTaskLog` のデフォルトは `tail: true`（最新ページ）。先頭から読む場合は `tail: false`。

## License

MIT
