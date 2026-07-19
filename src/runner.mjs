/**
 * script-journal runner — 任务子进程执行器
 *
 * 由 handler spawn 调用，不应直接使用。流程：
 *   1. 解析 --task / --output / --cwd
 *   2. 读取 <output>.json 中的 parameters
 *   3. 动态加载任务文件（支持 .mjs / .js / .cjs，ESM 与 CJS）
 *   4. 调用 run(parameters, ctx)
 *   5. 将结果写回 JSON 状态文件
 *
 * 任务模块约定：
 *   export async function run(parameters, ctx) → taskResults
 *   或 module.exports.run / exports.run / module.exports = { run }
 *
 * 退出码：0 成功，1 失败
 * 不向父进程控制台主动打印；stdout/stderr 仅供 handler 采集进日志。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, isAbsolute, resolve } from "path";
import { pathToFileURL } from "url";

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const taskArg = get("--task");
const outputArg = get("--output");
const cwdArg = get("--cwd");

if (!taskArg || !outputArg || !cwdArg) {
  process.stderr.write("script-journal runner: missing --task, --output or --cwd\n");
  process.exit(1);
}

const CWD = resolve(cwdArg);
const taskPath = isAbsolute(taskArg) ? resolve(taskArg) : resolve(CWD, taskArg);
const outputBase = isAbsolute(outputArg) ? resolve(outputArg) : resolve(CWD, outputArg);
const jsonPath = `${outputBase}.json`;

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function readJson() {
  try {
    return JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    ensureDir(jsonPath);
    writeFileSync(jsonPath, JSON.stringify(state, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

/**
 * 从已加载模块中取出 run 函数（兼容 ESM / CJS 多种导出形态）。
 */
function extractRun(mod) {
  if (mod == null) return null;
  if (typeof mod.run === "function") return mod.run;
  if (typeof mod.default === "function") return mod.default;
  if (mod.default && typeof mod.default.run === "function") return mod.default.run;
  return null;
}

async function loadTaskModule(filePath) {
  const url = pathToFileURL(filePath).href;
  return import(`${url}?t=${Date.now()}`);
}

function makeLogger() {
  function write(stream, level, msg) {
    stream.write(`[${level.toUpperCase()}] ${msg}\n`);
  }
  return {
    debug: (msg) => write(process.stdout, "debug", msg),
    info: (msg) => write(process.stdout, "info", msg),
    warn: (msg) => write(process.stderr, "warn", msg),
    error: (msg) => write(process.stderr, "error", msg),
  };
}

function finalize(state, startedAt, patch) {
  const finishedAt = new Date().toISOString();
  Object.assign(state, {
    ...patch,
    finishedAt,
    durationMs: Date.now() - new Date(startedAt).getTime(),
    pid: null,
  });
  writeState(state);
}

async function main() {
  const stored = readJson();
  const parameters = stored.parameters ?? {};
  const startedAt = new Date().toISOString();

  const state = {
    task: taskPath,
    status: "running",
    pid: process.pid,
    startedAt,
    finishedAt: null,
    durationMs: null,
    success: null,
    parameters,
    error: null,
    results: null,
  };
  writeState(state);

  let exiting = false;
  function onStopSignal() {
    if (exiting) return;
    exiting = true;
    finalize(state, startedAt, {
      status: "stopped",
      success: false,
      error: state.error ?? "stopped",
    });
    process.exit(1);
  }
  process.on("SIGTERM", onStopSignal);
  process.on("SIGINT", onStopSignal);

  if (!existsSync(taskPath)) {
    const msg = `Cannot find task file: ${taskPath}`;
    process.stderr.write(`[ERROR] ${msg}\n`);
    finalize(state, startedAt, { status: "error", success: false, error: msg });
    process.exit(1);
  }

  let taskModule;
  try {
    taskModule = await loadTaskModule(taskPath);
  } catch (e) {
    const msg = `Cannot load task file "${taskPath}": ${e.message}`;
    process.stderr.write(`[ERROR] ${msg}\n`);
    finalize(state, startedAt, { status: "error", success: false, error: msg });
    process.exit(1);
  }

  const run = extractRun(taskModule);
  if (typeof run !== "function") {
    const msg = `Task file "${taskPath}" does not export a run() function`;
    process.stderr.write(`[ERROR] ${msg}\n`);
    finalize(state, startedAt, { status: "error", success: false, error: msg });
    process.exit(1);
  }

  const ctx = {
    logger: makeLogger(),
    get results() {
      if (state.results == null) state.results = {};
      return state.results;
    },
    updateResults(patch) {
      state.results = { ...(state.results ?? {}), ...patch };
      writeState(state);
    },
    patchResults(patch = {}) {
      if (state.results == null) state.results = {};
      Object.assign(state.results, patch);
      writeState(state);
      return state.results;
    },
  };

  let taskResults;
  try {
    taskResults = await run(parameters, ctx);
  } catch (e) {
    const msg = e.message ?? String(e);
    process.stderr.write(`[ERROR] task threw: ${msg}\n`);
    finalize(state, startedAt, { status: "error", success: false, error: msg });
    process.exit(1);
  }

  if (exiting) return;

  const success = taskResults?.success ?? true;

  if (taskResults != null) {
    const { success: _ignoredSuccess, error, ...resultPatch } = taskResults;
    void _ignoredSuccess;
    if (state.results == null) state.results = {};
    Object.assign(state.results, resultPatch);
    if (error != null) state.error = error;
  }

  finalize(state, startedAt, {
    status: success ? "done" : "failed",
    success,
  });

  process.exit(success ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`[ERROR] script-journal runner fatal: ${e.message}\n`);
  process.exit(1);
});
