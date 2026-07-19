/** 任务运行状态 */
export type TaskStatus = "pending" | "running" | "done" | "failed" | "error";

/** 日志级别 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** 任务 JSON 状态文件结构 */
export interface TaskState {
  /** 任务文件路径（解析后的绝对路径） */
  task: string;
  status: TaskStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  success: boolean | null;
  /** 传给任务模块 run() 的参数 */
  parameters: Record<string, unknown>;
  error: string | null;
  /** 任务自定义数据，可由 patchResults / 返回值写入 */
  results: Record<string, unknown> | null;
}

/** 任务模块 ctx.logger */
export interface TaskLogger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

/**
 * 注入给任务模块 `run(parameters, ctx)` 的上下文。
 */
export interface TaskContext {
  logger: TaskLogger;
  /** 当前 results 对象（与 patchResults 共享引用） */
  readonly results: Record<string, unknown>;
  /** 将 patch 浅合并到 results 并持久化 */
  updateResults(patch: Record<string, unknown>): void;
  /** 增量浅合并到 results 并持久化，返回合并后的 results */
  patchResults(patch?: Record<string, unknown>): Record<string, unknown>;
}

/**
 * 任务模块可选返回值。
 * - undefined / null → 不修改 results，沿用 patchResults 累积的数据
 * - 对象 → 浅合并到 results；`success` 判定成败，`error` 写入 state.error
 */
export interface TaskResult {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

/** 任务模块约定：export async function run(parameters, ctx) */
export type TaskRunFn = (
  parameters: Record<string, unknown>,
  ctx: TaskContext
) => Promise<TaskResult | void | null> | TaskResult | void | null;

/**
 * runTask 的唯一入参。
 */
export interface RunTaskOptions {
  /**
   * 工作目录。相对路径的 `task` / `output` 均相对此目录解析。
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * 任务文件路径（绝对路径，或相对 cwd）。
   * 支持 .mjs / .js / .cjs。
   */
  task: string;

  /**
   * 产出路径（不含扩展名；绝对路径，或相对 cwd）。
   * 将生成 `<output>.json` 与 `<output>.log`。
   */
  output: string;

  /** 传给任务模块 run(parameters, ctx) 的参数 */
  parameters?: Record<string, unknown>;

  /**
   * 日志最多保留行数；超出时从文件头部删除旧行。
   * 传 `0` 或负数表示不裁剪。
   * @default 10000
   */
  maxLogLines?: number;
}

/** runTask 的返回值 */
export interface RunTaskResult {
  exitCode: number;
  logPath: string;
  jsonPath: string;
}

/** 单条 NDJSON 日志 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel | string;
  message: string;
}

/** 读取产出文件时的公共字段 */
export interface OutputLocateOptions {
  /**
   * 工作目录。
   * @default process.cwd()
   */
  cwd?: string;
  /** 产出路径（不含扩展名；绝对路径，或相对 cwd） */
  output: string;
}

/** readTaskLog 的选项 */
export interface ReadLogOptions extends OutputLocateOptions {
  /** 页码，从 1 开始，默认 1 */
  page?: number;
  /** 每页行数，默认 100 */
  pageSize?: number;
  /**
   * true = 从末尾取最新行（适合查看最后几页）。
   * @default true
   */
  tail?: boolean;
}

/** readTaskLog 的返回值 */
export interface ReadLogResult {
  entries: LogEntry[];
  page: number;
  pageSize: number;
  totalLines: number;
  totalPages: number;
  hasMore: boolean;
  tail: boolean;
  filePath: string;
  exists: boolean;
  sizeBytes: number | null;
}
