export { runTask } from "./handler";
export { stopTask } from "./stopTask";
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
  TaskContext,
  TaskLogger,
  TaskResult,
  TaskRunFn,
  TaskState,
  TaskStatus,
} from "./types";
