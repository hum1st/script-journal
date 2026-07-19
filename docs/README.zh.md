# script-journal

在子进程中执行任务模块，持久化 JSON 状态，并采集 NDJSON 日志。宿主应用只需编写 task；执行、状态与日志交互由本库负责。

**ESM** 与 **CommonJS** 消费者均可使用；任务文件可为 `.mjs` / `.js` / `.cjs`。

**其他语言：** [English](../README.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## 安装

```bash
npm install script-journal
```

## 快速开始

```ts
import { runTask, readTaskJson, readTaskLog } from "script-journal";

try {
  const state = await runTask({
    cwd: "/path/to/your-app", // 可选，默认 process.cwd()
    task: "src/tasks/helloTask.mjs", // 绝对路径，或相对 cwd
    output: "tmp/tasks/hello", // 绝对路径，或相对 cwd（不含扩展名）
    parameters: { name: "world" },
  });
  // state 即为任务 JSON（status: "done", ...）
} catch (state) {
  // 失败时抛出同一份 JSON 对象（错误已写入文件）
  console.error(state.error);
}

const persisted = readTaskJson({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/hello",
});

// 默认 tail=true（查看最后几页）；totalLines 受 maxLogLines 约束
const log = readTaskLog({
  cwd: "/path/to/your-app",
  output: "tmp/tasks/hello",
  pageSize: 50,
});
```

CommonJS：

```js
const { runTask, readTaskJson, readTaskLog } = require("script-journal");
```

父进程保持静默：子进程 stdout/stderr 仅写入日志文件，不打印到控制台。

## 任务模块约定

```js
// src/tasks/helloTask.mjs
export async function run(parameters, ctx) {
  ctx.logger.info("hello started");
  ctx.patchResults({ total: 0, failed: 0 });

  // ... 使用 parameters 执行业务 ...

  ctx.patchResults({ total: 3 });
  return { success: true }; // 或 { success: false, error: "..." }
}
```

### `ctx`

| 字段 | 说明 |
|---|---|
| `logger.debug/info/warn/error(msg)` | 输出 `[LEVEL] msg`，被捕获为 NDJSON 日志 |
| `results` | 当前 results（与 patchResults 共享引用） |
| `updateResults(patch)` | 浅合并到 results 并写回 JSON |
| `patchResults(patch)` | 同上，并返回 results |

### 返回值

- `undefined` / `null` — 保留 `patchResults` 累积的 results
- 对象 — 浅合并进 results；`success` 决定 done/failed；`error` → `state.error`

退出码：成功 `0`，否则 `1`。

## 状态 JSON

路径：`<output>.json`

```json
{
  "task": "/abs/path/to/helloTask.mjs",
  "status": "pending|running|done|failed|error",
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

## 日志文件

`<output>.log` — 每行一条 NDJSON：

```json
{"timestamp":"2026-07-19T01:00:00.000Z","level":"info","message":"hello started"}
```

当日志超过 `maxLogLines`（默认 **10000**）时，从文件头部删除旧行，只保留最新内容。传 `maxLogLines: 0` 可关闭裁剪。

## API

### `runTask(options)`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `cwd` | `string` | ❌ | 工作目录，默认 `process.cwd()` |
| `task` | `string` | ✅ | 任务文件路径（绝对路径，或相对 `cwd`） |
| `output` | `string` | ✅ | 产出路径，不含扩展名（绝对路径，或相对 `cwd`） |
| `parameters` | `object` | ❌ | 传给 `run(parameters, ctx)` |
| `maxLogLines` | `number` | ❌ | 日志最多保留行数，超出从头部删除。默认 `10000`；`≤0` 表示不裁剪 |

成功时返回任务 JSON 状态；失败时以同一份 JSON 对象 reject（错误已写入 `<output>.json`）。

### `readTaskJson({ cwd?, output })` / `readTaskLog({ cwd?, output, page?, pageSize?, tail? })`

`cwd` / `output` 解析规则与 `runTask` 相同。

`readTaskLog` 默认 `tail: true`（最后几页）。需要从头读时设 `tail: false`。

## License

MIT
