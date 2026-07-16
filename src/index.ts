import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { createRequire } from "module";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScriptJournalOptions {
  /**
   * 根目录：JSON 文件和 log 文件均输出到此目录下，
   * 按 `filePath` 决定子路径。
   */
  root: string;

  /**
   * 相对路径（不含扩展名），可以是简单文件名，也可以包含子目录。
   * 例如：`"result"` → `<root>/result.json` / `<root>/result.log`
   * 例如：`"reports/daily"` → `<root>/reports/daily.json` / `<root>/reports/daily.log`
   *
   * 默认值：`"output"`
   */
  filePath?: string;
}

export interface ScriptJournalResult<T = unknown> {
  /** 脚本是否成功执行（未抛出异常） */
  success: boolean;
  /** 脚本 default export 函数的返回值（仅 success=true 时有值） */
  data?: T;
  /** 错误信息（仅 success=false 时有值） */
  error?: string;
  /** 执行开始时间（ISO 字符串） */
  startedAt: string;
  /** 执行结束时间（ISO 字符串） */
  finishedAt: string;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 输出的 JSON 文件绝对路径 */
  jsonPath: string;
  /** 输出的 log 文件绝对路径 */
  logPath: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 确保目录存在，不存在则递归创建 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** 删除文件（若存在） */
function removeIfExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/** 将一行日志追加到文件，同时输出到 console */
function writeLine(logPath: string, line: string): void {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  fs.appendFileSync(logPath, stamped + "\n", "utf8");
}

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * 执行指定的 JS/TS 脚本，将其 default export 函数的返回值写入 JSON 文件，
 * 将执行过程写入 log 文件。
 *
 * 执行前会自动删除同名的旧 JSON / log 文件，确保每次结果干净。
 *
 * @param scriptFile  要执行的脚本文件绝对路径（需 default export 一个 async/sync 函数）
 * @param options     输出根目录与路径配置
 *
 * @example
 * ```ts
 * import { runScript } from "script-journal";
 *
 * const result = await runScript("/path/to/my-task.mjs", {
 *   root: "/output",
 *   filePath: "tasks/my-task",
 * });
 * console.log(result.jsonPath); // /output/tasks/my-task.json
 * ```
 */
export async function runScript<T = unknown>(
  scriptFile: string,
  options: ScriptJournalOptions
): Promise<ScriptJournalResult<T>> {
  const { root, filePath = "output" } = options;

  // 解析输出路径
  const absRoot = path.resolve(root);
  const basePath = path.join(absRoot, filePath);
  const jsonPath = basePath + ".json";
  const logPath = basePath + ".log";

  // 确保输出目录存在
  ensureDir(path.dirname(basePath));

  // 删除旧文件
  removeIfExists(jsonPath);
  removeIfExists(logPath);

  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  writeLine(logPath, `START  script=${scriptFile}`);
  writeLine(logPath, `OUTPUT root=${absRoot}  path=${filePath}`);

  let success = false;
  let data: T | undefined;
  let errorMsg: string | undefined;

  try {
    const absScript = path.resolve(scriptFile);
    const ext = path.extname(absScript).toLowerCase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mod: any;

    // Jest 环境（ts-jest / CommonJS）不支持动态 import() ESM 模块；
    // 对 .json / .cjs / .js 文件优先用 require()，其余走 import()。
    const isJest = typeof jest !== "undefined";
    const canRequire = ext === ".js" || ext === ".cjs" || ext === ".json" || ext === "";

    if (isJest || canRequire) {
      // createRequire 接受任何绝对路径；使用 absScript 本身的目录作为基准
      const _require = createRequire(absScript);
      writeLine(logPath, `REQUIRE ${absScript}`);
      // 清除 require 缓存，确保每次执行都重新加载脚本
      delete _require.cache[_require.resolve(absScript)];
      mod = _require(absScript);
    } else {
      const fileUrl = pathToFileURL(absScript).href;
      writeLine(logPath, `IMPORT ${fileUrl}`);
      mod = await import(fileUrl);
    }

    const fn: unknown = mod.default ?? mod;
    if (typeof fn !== "function") {
      throw new TypeError(
        `Script must export a function as default export, got: ${typeof fn}`
      );
    }

    writeLine(logPath, "RUN    calling exported function ...");
    const result = await fn();
    data = result as T;
    success = true;
    writeLine(logPath, "DONE   function returned successfully");
  } catch (err) {
    errorMsg = err instanceof Error ? err.stack ?? err.message : String(err);
    writeLine(logPath, `ERROR  ${errorMsg}`);
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  // 写入 JSON 结果
  const jsonContent = success
    ? { success: true, data, startedAt, finishedAt, durationMs }
    : { success: false, error: errorMsg, startedAt, finishedAt, durationMs };

  fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2), "utf8");
  writeLine(logPath, `WROTE  ${jsonPath}  (${durationMs}ms)`);

  return {
    success,
    data,
    error: errorMsg,
    startedAt,
    finishedAt,
    durationMs,
    jsonPath,
    logPath,
  };
}
