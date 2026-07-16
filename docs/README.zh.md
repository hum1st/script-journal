# script-journal

执行一个 JS 脚本模块，将其返回的数据写入 JSON 文件，将执行过程写入 log 文件。

**其他语言：** [English](../README.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## 安装

```bash
npm install script-journal
```

## 使用

```ts
import { runScript } from "script-journal";

const result = await runScript("/path/to/my-task.mjs", {
  root: "/output",
  filePath: "reports/daily", // 可选，默认 "output"
});

// 输出文件：
//   /output/reports/daily.json  ← 脚本返回值
//   /output/reports/daily.log   ← 执行过程日志
```

### 脚本格式

脚本需 `export default` 一个函数（支持 async/sync），函数的返回值将被持久化到 JSON：

```js
// my-task.mjs
export default async function () {
  const data = await fetchSomething();
  return data;
}
```

CommonJS 格式同样支持：

```js
// my-task.js
module.exports = async function () {
  return { status: "ok", timestamp: Date.now() };
};
```

## API

### `runScript(scriptFile, options)`

#### 参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `scriptFile` | `string` | ✅ | 要执行的脚本文件绝对路径 |
| `options.root` | `string` | ✅ | 输出根目录 |
| `options.filePath` | `string` | ❌ | 相对路径（不含扩展名），支持子目录，默认 `"output"` |

#### `filePath` 路径解析规则

| `filePath` 值 | JSON 输出路径 | log 输出路径 |
|---|---|---|
| `"output"`（默认） | `<root>/output.json` | `<root>/output.log` |
| `"result"` | `<root>/result.json` | `<root>/result.log` |
| `"reports/daily"` | `<root>/reports/daily.json` | `<root>/reports/daily.log` |

#### 返回值 `ScriptJournalResult<T>`

| 字段 | 类型 | 说明 |
|---|---|---|
| `success` | `boolean` | 脚本是否成功执行（未抛出异常） |
| `data` | `T` | 脚本函数的返回值（仅 `success=true` 时有值） |
| `error` | `string` | 错误信息/堆栈（仅 `success=false` 时有值） |
| `startedAt` | `string` | 执行开始时间（ISO 字符串） |
| `finishedAt` | `string` | 执行结束时间（ISO 字符串） |
| `durationMs` | `number` | 耗时（毫秒） |
| `jsonPath` | `string` | 输出的 JSON 文件绝对路径 |
| `logPath` | `string` | 输出的 log 文件绝对路径 |

### 文件清理

每次执行前，同路径下已有的 `.json` 和 `.log` 文件会被**自动删除**，确保每次结果干净。

## 许可证

MIT
