import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runTask, readTaskJson, readTaskLog } from "../src/index";
import type { TaskState } from "../src/types";

let tmpRoot: string;
let tasksDir: string;

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "script-journal-"));
  tasksDir = path.join(tmpRoot, "tasks");
  fs.mkdirSync(tasksDir, { recursive: true });

  fs.writeFileSync(
    path.join(tasksDir, "hello.mjs"),
    `\
export async function run(parameters, ctx) {
  ctx.logger.info("hello start");
  ctx.patchResults({ step: 1, echo: parameters.echo ?? null });
  ctx.logger.debug("debug line");
  ctx.patchResults({ step: 2 });
  return { success: true, done: true };
}
`
  );

  fs.writeFileSync(
    path.join(tasksDir, "failSoft.mjs"),
    `\
export async function run(_parameters, ctx) {
  ctx.logger.warn("about to fail soft");
  return { success: false, error: "soft failure", code: 42 };
}
`
  );

  fs.writeFileSync(
    path.join(tasksDir, "throw.mjs"),
    `\
export async function run() {
  throw new Error("boom");
}
`
  );

  fs.writeFileSync(
    path.join(tasksDir, "cjsDemo.cjs"),
    `\
exports.run = async function run(parameters, ctx) {
  ctx.logger.info("cjs ok");
  ctx.patchResults({ from: "cjs", n: parameters.n });
  return { success: true };
};
`
  );

  fs.writeFileSync(
    path.join(tasksDir, "spam.mjs"),
    `\
export async function run(parameters, ctx) {
  const n = Number(parameters.n ?? 0);
  for (let i = 0; i < n; i++) {
    ctx.logger.info("line-" + i);
  }
  return { success: true };
}
`
  );
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("runTask – ESM 任务成功", () => {
  const output = "out/hello";
  let result: TaskState;

  beforeAll(async () => {
    result = await runTask({
      cwd: tmpRoot,
      task: "tasks/hello.mjs",
      output,
      parameters: { echo: "world" },
    });
  });

  test("返回 JSON 状态为 done 且包含 results", () => {
    expect(result).toMatchObject({
      status: "done",
      success: true,
      parameters: { echo: "world" },
      results: { step: 2, echo: "world", done: true },
    });
    expect(result.task).toBe(path.join(tmpRoot, "tasks", "hello.mjs"));
    expect(typeof result.pid).toBe("number");
    expect(result.pid).toBeGreaterThan(0);
    expect(result.startedAt).toBeTruthy();
    expect(result.finishedAt).toBeTruthy();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    const state = readTaskJson({ cwd: tmpRoot, output });
    expect(state).toMatchObject(result);
  });

  test("日志为带级别的 NDJSON", () => {
    const log = readTaskLog({ cwd: tmpRoot, output });
    expect(log.exists).toBe(true);
    expect(log.totalLines).toBeGreaterThan(0);
    const messages = log.entries.map((e) => e.message);
    expect(messages.some((m) => m.includes("hello start"))).toBe(true);
    expect(log.entries.some((e) => e.level === "info")).toBe(true);
    expect(log.entries.some((e) => e.level === "debug")).toBe(true);
  });
});

describe("runTask – 软失败", () => {
  test("reject 任务 JSON，status 为 failed", async () => {
    const output = "out/fail-soft";
    let thrown: unknown;
    try {
      await runTask({
        cwd: tmpRoot,
        task: path.join(tasksDir, "failSoft.mjs"),
        output,
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toMatchObject({
      status: "failed",
      success: false,
      error: "soft failure",
      results: { code: 42 },
    });
    const state = readTaskJson({ cwd: tmpRoot, output });
    expect(state).toMatchObject(thrown as TaskState);
  });
});

describe("runTask – 抛出异常", () => {
  test("reject 任务 JSON，status 为 error", async () => {
    const output = "out/throw";
    let thrown: unknown;
    try {
      await runTask({
        cwd: tmpRoot,
        task: "tasks/throw.mjs",
        output,
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toMatchObject({
      status: "error",
      success: false,
    });
    expect((thrown as TaskState).error).toContain("boom");
    const state = readTaskJson({ cwd: tmpRoot, output });
    expect(state).toMatchObject(thrown as TaskState);
  });
});

describe("runTask – CJS 任务模块", () => {
  test("能加载并执行 .cjs", async () => {
    const output = "out/cjs-demo";
    const result = await runTask({
      cwd: tmpRoot,
      task: "tasks/cjsDemo.cjs",
      output,
      parameters: { n: 7 },
    });
    expect(result.success).toBe(true);
    expect(result.results).toMatchObject({ from: "cjs", n: 7 });
  });
});

describe("runTask – 任务文件不存在", () => {
  test("reject 任务 JSON，status 为 error", async () => {
    const output = "out/missing";
    let thrown: unknown;
    try {
      await runTask({
        cwd: tmpRoot,
        task: "tasks/no-such.mjs",
        output,
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toMatchObject({ status: "error" });
    expect((thrown as TaskState).error).toMatch(/Cannot find task file/);
  });
});

describe("runTask – maxLogLines 集成", () => {
  test("执行过程中裁剪最旧日志行", async () => {
    const output = "out/spam";
    const maxLogLines = 20;
    await runTask({
      cwd: tmpRoot,
      task: "tasks/spam.mjs",
      output,
      parameters: { n: 50 },
      maxLogLines,
    });

    const logPath = path.join(tmpRoot, `${output}.log`);
    const raw = fs.readFileSync(logPath, "utf8");
    const lines = raw.split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBeLessThanOrEqual(maxLogLines);

    const log = readTaskLog({ cwd: tmpRoot, output, pageSize: maxLogLines });
    const messages = log.entries.map((e) => e.message);
    expect(messages.some((m) => m === "line-0")).toBe(false);
    expect(messages.some((m) => m === "line-49")).toBe(true);
  });
});

describe("runTask 参数校验", () => {
  test("缺少 task 时抛错", () => {
    expect(() => runTask({ task: "", output: "x" } as never)).toThrow(/task/);
  });

  test("缺少 output 时抛错", () => {
    expect(() => runTask({ task: "a.mjs", output: "" } as never)).toThrow(/output/);
  });
});

describe("readTaskJson", () => {
  test("缺少 output 时抛错", () => {
    expect(() => readTaskJson({ output: "" } as never)).toThrow(/output/);
    expect(() => readTaskJson(undefined as never)).toThrow(/output/);
  });

  test("状态文件不存在时返回 null", () => {
    expect(readTaskJson({ cwd: tmpRoot, output: "out/no-such-state" })).toBeNull();
  });

  test("JSON 无效时返回 null", () => {
    const output = "out/bad-json";
    const jsonPath = path.join(tmpRoot, `${output}.json`);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, "{not-json", "utf8");
    expect(readTaskJson({ cwd: tmpRoot, output })).toBeNull();
  });

  test("未传 cwd 时使用 process.cwd()", () => {
    const output = "out/cwd-default";
    const absOutput = path.join(tmpRoot, output);
    const prev = process.cwd();
    process.chdir(tmpRoot);
    try {
      fs.mkdirSync(path.dirname(`${absOutput}.json`), { recursive: true });
      fs.writeFileSync(
        `${absOutput}.json`,
        JSON.stringify({ status: "done", success: true }),
        "utf8"
      );
      expect(readTaskJson({ output })).toMatchObject({ status: "done", success: true });
    } finally {
      process.chdir(prev);
    }
  });
});
