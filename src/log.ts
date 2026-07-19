import * as fs from "fs";
import type { LogEntry, LogLevel, ReadLogOptions, ReadLogResult } from "./types";
import { resolveOutputFile } from "./paths";

/** runTask 默认日志保留行数 */
export const DEFAULT_MAX_LOG_LINES = 10000;

const LEVEL_PREFIX_RE = /^\[(DEBUG|INFO|WARN|ERROR)\] /i;
const VALID_LEVELS = new Set<string>(["debug", "info", "warn", "error"]);

/**
 * 将日志文件裁剪为最后 maxLogLines 行。
 * @returns 裁剪后的行数
 */
export function trimLogFile(logPath: string, maxLogLines: number): number {
  if (maxLogLines <= 0) return 0;
  let text: string;
  try {
    text = fs.readFileSync(logPath, "utf8");
  } catch {
    return 0;
  }

  const lines = text.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  if (lines.length <= maxLogLines) {
    return lines.length;
  }

  const kept = lines.slice(-maxLogLines);
  try {
    fs.writeFileSync(logPath, kept.length > 0 ? kept.join("\n") + "\n" : "", "utf8");
  } catch {
    /* ignore */
  }
  return kept.length;
}

/**
 * 将一行文本包装成 NDJSON 日志条目并追加写入 log 文件。
 * @returns 是否成功写入一行
 */
export function appendLogLine(
  logPath: string,
  message: string,
  level: LogLevel | string = "info"
): boolean {
  if (!message) return false;
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
  });
  try {
    fs.appendFileSync(logPath, entry + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * 将 chunk 按行拆分写入 log。
 * 若行以 `[LEVEL] ` 开头则提取结构化级别并剥离前缀。
 * @returns 实际追加的行数
 */
export function appendChunkAsLines(
  logPath: string,
  chunk: Buffer | string,
  defaultLevel: LogLevel = "info"
): number {
  const text = chunk.toString();
  let written = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trimEnd();
    if (!trimmed) continue;
    const match = trimmed.match(LEVEL_PREFIX_RE);
    let ok: boolean;
    if (match) {
      const level = match[1].toLowerCase();
      const message = trimmed.slice(match[0].length);
      ok = appendLogLine(logPath, message, VALID_LEVELS.has(level) ? level : defaultLevel);
    } else {
      ok = appendLogLine(logPath, trimmed, defaultLevel);
    }
    if (ok) written += 1;
  }
  return written;
}

function safeReadText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * 分页读取任务日志（NDJSON：每行 `{ timestamp, level, message }`）。
 * 默认从末尾取页（tail=true），配合 maxLogLines 后文件行数有上界。
 */
export function readTaskLog(options: ReadLogOptions): ReadLogResult {
  if (!options?.output) {
    throw new TypeError("script-journal: output is required");
  }

  const cwd = options.cwd ?? process.cwd();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, options.pageSize ?? 100);
  const tail = options.tail ?? true;

  const filePath = resolveOutputFile(cwd, options.output, ".log");

  const empty = (extra: Partial<ReadLogResult> = {}): ReadLogResult => ({
    entries: [],
    page,
    pageSize,
    totalLines: 0,
    totalPages: 0,
    hasMore: false,
    tail,
    filePath,
    exists: false,
    sizeBytes: null,
    ...extra,
  });

  let sizeBytes: number;
  try {
    sizeBytes = fs.statSync(filePath).size;
  } catch {
    return empty({ exists: false, sizeBytes: null });
  }

  const text = safeReadText(filePath);
  if (text === null) return empty({ exists: true, sizeBytes });

  const rawLines = text.split("\n");
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  const allEntries: LogEntry[] = rawLines.map((raw) => {
    try {
      const obj = JSON.parse(raw) as Partial<LogEntry>;
      if (obj && typeof obj === "object") {
        return {
          timestamp: obj.timestamp ?? "",
          level: obj.level ?? "info",
          message: obj.message ?? raw,
        };
      }
    } catch {
      /* fallback */
    }
    return { timestamp: "", level: "info", message: raw };
  });

  const totalLines = allEntries.length;
  const totalPages = totalLines === 0 ? 1 : Math.ceil(totalLines / pageSize);

  let entries: LogEntry[];
  if (tail) {
    const end = totalLines - (page - 1) * pageSize;
    const start = Math.max(0, end - pageSize);
    entries = allEntries.slice(start, end).reverse();
  } else {
    const start = (page - 1) * pageSize;
    entries = allEntries.slice(start, start + pageSize);
  }

  const hasMore = tail ? (page - 1) * pageSize + entries.length < totalLines : page < totalPages;

  return {
    entries,
    page,
    pageSize,
    totalLines,
    totalPages,
    hasMore,
    tail,
    filePath,
    exists: true,
    sizeBytes,
  };
}
