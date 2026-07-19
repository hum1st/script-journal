import { spawn } from "child_process";
import * as fs from "fs";
import { appendChunkAsLines, appendLogLine, DEFAULT_MAX_LOG_LINES, trimLogFile } from "./log";
import type { RunTaskOptions, RunTaskResult, TaskState } from "./types";
import { ensureDir, resolveFromCwd, resolveRunnerPath } from "./paths";

/**
 * 启动一个任务子进程。
 *
 * 1. 写入初始参数到 `<output>.json`
 * 2. 清空 `<output>.log`
 * 3. spawn runner，将 stdout/stderr 静默写入 NDJSON 日志（不向控制台输出）
 * 4. 日志超过 maxLogLines 时从头部删除旧行
 */
export function runTask(options: RunTaskOptions): Promise<RunTaskResult> {
  if (!options?.task) {
    throw new TypeError("script-journal: runTask requires options.task");
  }
  if (!options?.output) {
    throw new TypeError("script-journal: runTask requires options.output");
  }

  const cwd = options.cwd ?? process.cwd();
  const taskPath = resolveFromCwd(cwd, options.task);
  const outputBase = resolveFromCwd(cwd, options.output);
  const jsonPath = `${outputBase}.json`;
  const logPath = `${outputBase}.log`;
  const parameters = options.parameters ?? {};
  const maxLogLines = options.maxLogLines ?? DEFAULT_MAX_LOG_LINES;
  const trimEnabled = maxLogLines > 0;
  const runner = resolveRunnerPath();

  ensureDir(jsonPath);
  ensureDir(logPath);

  const initPayload: TaskState = {
    task: taskPath,
    status: "pending",
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    success: null,
    parameters,
    error: null,
    results: null,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(initPayload, null, 2), "utf8");
  fs.writeFileSync(logPath, "", "utf8");

  let lineCount = 0;

  function trackAppend(n: number): void {
    if (n <= 0) return;
    lineCount += n;
    if (trimEnabled && lineCount > maxLogLines) {
      lineCount = trimLogFile(logPath, maxLogLines);
    }
  }

  return new Promise((resolvePromise) => {
    const child = spawn(
      process.execPath,
      [runner, "--task", taskPath, "--output", outputBase, "--cwd", cwd],
      {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      }
    );

    child.stdout?.on("data", (chunk: Buffer) => {
      trackAppend(appendChunkAsLines(logPath, chunk, "info"));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      trackAppend(appendChunkAsLines(logPath, chunk, "error"));
    });

    child.on("close", (code) => {
      const exitCode = code ?? 1;
      if (appendLogLine(logPath, `exit code: ${exitCode}`, exitCode === 0 ? "info" : "error")) {
        trackAppend(1);
      }
      resolvePromise({ exitCode, logPath, jsonPath });
    });

    child.on("error", (err) => {
      if (appendLogLine(logPath, `spawn error: ${err.message}`, "error")) {
        trackAppend(1);
      }
      resolvePromise({ exitCode: 1, logPath, jsonPath });
    });
  });
}
