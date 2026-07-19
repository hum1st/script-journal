import { spawn } from "child_process";
import * as fs from "fs";
import { appendChunkAsLines, appendLogLine, DEFAULT_MAX_LOG_LINES, trimLogFile } from "./log";
import { isPidAlive, terminatePid } from "./process";
import type { RunTaskOptions, TaskState } from "./types";
import { ensureDir, resolveFromCwd, resolveRunnerPath } from "./paths";

function readTaskState(jsonPath: string, fallback: TaskState): TaskState {
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8")) as TaskState;
  } catch {
    return fallback;
  }
}

function writeErrorState(jsonPath: string, state: TaskState, error: string): TaskState {
  const finishedAt = new Date().toISOString();
  const next: TaskState = {
    ...state,
    status: "error",
    finishedAt,
    durationMs: state.startedAt != null ? Date.now() - new Date(state.startedAt).getTime() : null,
    success: false,
    error,
    pid: null,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

/** 若已有状态文件中的 pid 仍存活，则强制终止后再启动新任务 */
async function terminatePrevious(jsonPath: string): Promise<void> {
  let previous: TaskState;
  try {
    previous = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as TaskState;
  } catch {
    return;
  }
  const pid = previous.pid;
  if (typeof pid === "number" && isPidAlive(pid)) {
    await terminatePid(pid);
  }
}

/**
 * 启动一个任务子进程。
 *
 * 1. 若 `<output>.json` 中已有存活 pid，先强制终止
 * 2. 写入初始参数到 `<output>.json`
 * 3. 清空 `<output>.log`
 * 4. spawn runner，将 stdout/stderr 静默写入 NDJSON 日志（不向控制台输出）
 * 5. 日志超过 maxLogLines 时从头部删除旧行
 *
 * 成功时 resolve 为任务 JSON 状态；失败时 reject 该 JSON 对象（错误已写入文件）。
 */
export function runTask(options: RunTaskOptions): Promise<TaskState> {
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

  return (async () => {
    await terminatePrevious(jsonPath);

    ensureDir(jsonPath);
    ensureDir(logPath);

    const initPayload: TaskState = {
      task: taskPath,
      status: "pending",
      pid: null,
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

    return new Promise((resolvePromise, rejectPromise) => {
      let settled = false;

      function settle(ok: boolean, state: TaskState): void {
        if (settled) return;
        settled = true;
        if (ok) resolvePromise(state);
        else rejectPromise(state);
      }

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
        const state = readTaskState(jsonPath, initPayload);
        settle(exitCode === 0, state);
      });

      child.on("error", (err) => {
        if (appendLogLine(logPath, `spawn error: ${err.message}`, "error")) {
          trackAppend(1);
        }
        const current = readTaskState(jsonPath, initPayload);
        settle(false, writeErrorState(jsonPath, current, `spawn error: ${err.message}`));
      });
    });
  })();
}
