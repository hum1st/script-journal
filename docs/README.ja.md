# script-journal

JS スクリプトモジュールを実行し、返されたデータを JSON ファイルに、実行ログを log ファイルに書き出します。

**他の言語：** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md)

## インストール

```bash
npm install script-journal
```

## 使い方

```ts
import { runScript } from "script-journal";

const result = await runScript("/path/to/my-task.mjs", {
  root: "/output",
  filePath: "reports/daily", // 省略可、デフォルトは "output"
});

// 出力ファイル：
//   /output/reports/daily.json  ← スクリプトの戻り値
//   /output/reports/daily.log   ← 実行ログ
```

### スクリプトの形式

スクリプトは `default export` として関数（sync または async）をエクスポートする必要があります。戻り値が JSON に保存されます：

```js
// my-task.mjs
export default async function () {
  const data = await fetchSomething();
  return data;
}
```

CommonJS 形式も対応しています：

```js
// my-task.js
module.exports = async function () {
  return { status: "ok", timestamp: Date.now() };
};
```

## API

### `runScript(scriptFile, options)`

#### パラメーター

| パラメーター | 型 | 必須 | 説明 |
|---|---|---|---|
| `scriptFile` | `string` | ✅ | 実行するスクリプトファイルの絶対パス |
| `options.root` | `string` | ✅ | 出力ルートディレクトリ |
| `options.filePath` | `string` | ❌ | 相対パス（拡張子なし）、サブディレクトリも可、デフォルト: `"output"` |

#### 戻り値 `ScriptJournalResult<T>`

| フィールド | 型 | 説明 |
|---|---|---|
| `success` | `boolean` | スクリプトが正常に実行されたか（例外なし） |
| `data` | `T` | スクリプト関数の戻り値（`success=true` のみ） |
| `error` | `string` | エラーメッセージ/スタック（`success=false` のみ） |
| `startedAt` | `string` | 実行開始時刻（ISO 文字列） |
| `finishedAt` | `string` | 実行終了時刻（ISO 文字列） |
| `durationMs` | `number` | 実行時間（ミリ秒） |
| `jsonPath` | `string` | JSON 出力ファイルの絶対パス |
| `logPath` | `string` | log 出力ファイルの絶対パス |

### ファイルのクリーンアップ

実行前に、指定パスの既存 `.json` および `.log` ファイルは**自動的に削除**されるため、毎回クリーンな出力が得られます。

## ライセンス

MIT
