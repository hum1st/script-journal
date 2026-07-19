import * as fs from "fs";
import type { OutputLocateOptions, TaskState } from "./types";
import { resolveOutputFile } from "./paths";

function safeReadText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * 读取任务状态 JSON。
 * 文件不存在或 JSON 无效时返回 null。
 */
export function readTaskJson(options: OutputLocateOptions): TaskState | null {
  if (!options?.output) {
    throw new TypeError("script-journal: output is required");
  }
  const cwd = options.cwd ?? process.cwd();
  const filePath = resolveOutputFile(cwd, options.output, ".json");
  const text = safeReadText(filePath);
  if (text === null) return null;
  try {
    return JSON.parse(text) as TaskState;
  } catch {
    return null;
  }
}
