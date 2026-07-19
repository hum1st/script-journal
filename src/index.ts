export { runTask } from "./handler";
export {
  appendChunkAsLines,
  appendLogLine,
  DEFAULT_MAX_LOG_LINES,
  readTaskLog,
  trimLogFile,
} from "./log";
export { readTaskJson } from "./status";

export type {
  LogEntry,
  LogLevel,
  OutputLocateOptions,
  ReadLogOptions,
  ReadLogResult,
  RunTaskOptions,
  RunTaskResult,
  TaskContext,
  TaskLogger,
  TaskResult,
  TaskRunFn,
  TaskState,
  TaskStatus,
} from "./types";
