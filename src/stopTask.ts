import * as fs from "fs";
import { isPidAlive, terminatePid } from "./process";
import { ensureDir, resolveOutputFile } from "./paths";
import type { OutputLocateOptions, TaskState } from "./types";

function readState(jsonPath: string): TaskState | null {
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8")) as TaskState;
  } catch {
    return null;
  }
}

/**
 * 强制停止 `<output>` 对应的任务进程（若仍存活），并将状态写为 `stopped`。
 *
 * 幂等：进程已退出时仍收敛 JSON 为 `stopped` / `pid: null`。
 * 无状态文件时抛错。
 */
export async function stopTask(options: OutputLocateOptions): Promise<TaskState> {
  if (!options?.output) {
    throw new TypeError("script-journal: stopTask requires options.output");
  }

  const cwd = options.cwd ?? process.cwd();
  const jsonPath = resolveOutputFile(cwd, options.output, ".json");
  const current = readState(jsonPath);

  if (current == null) {
    throw new Error(`script-journal: no task state at ${jsonPath}`);
  }

  const pid = current.pid;
  if (typeof pid === "number" && isPidAlive(pid)) {
    await terminatePid(pid);
  }

  const finishedAt = new Date().toISOString();
  const next: TaskState = {
    ...current,
    status: "stopped",
    pid: null,
    finishedAt,
    durationMs:
      current.startedAt != null ? Date.now() - new Date(current.startedAt).getTime() : null,
    success: false,
    error: current.error ?? "stopped",
  };

  ensureDir(jsonPath);
  fs.writeFileSync(jsonPath, JSON.stringify(next, null, 2), "utf8");
  return next;
}
