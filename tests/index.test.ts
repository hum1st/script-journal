import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runTask, readTaskJson, readTaskLog } from "../src/index";

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
  let result: Awaited<ReturnType<typeof runTask>>;

  beforeAll(async () => {
    result = await runTask({
      cwd: tmpRoot,
      task: "tasks/hello.mjs",
      output,
      parameters: { echo: "world" },
    });
  });

  test("退出码为 0", () => {
    expect(result.exitCode).toBe(0);
  });

  test("JSON 状态为 done 且包含 results", () => {
    const state = readTaskJson({ cwd: tmpRoot, output });
    expect(state).toMatchObject({
      status: "done",
      success: true,
      parameters: { echo: "world" },
      results: { step: 2, echo: "world", done: true },
    });
    expect(state?.task).toBe(path.join(tmpRoot, "tasks", "hello.mjs"));
    expect(state?.startedAt).toBeTruthy();
    expect(state?.finishedAt).toBeTruthy();
    expect(state?.durationMs).toBeGreaterThanOrEqual(0);
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

  test("产出路径解析在 cwd 下", () => {
    expect(result.jsonPath).toBe(path.join(tmpRoot, "out", "hello.json"));
    expect(result.logPath).toBe(path.join(tmpRoot, "out", "hello.log"));
  });
});

describe("runTask – 软失败", () => {
  test("status 为 failed 且退出码为 1", async () => {
    const output = "out/fail-soft";
    const { exitCode } = await runTask({
      cwd: tmpRoot,
      task: path.join(tasksDir, "failSoft.mjs"),
      output,
    });
    expect(exitCode).toBe(1);
    const state = readTaskJson({ cwd: tmpRoot, output });
    expect(state?.status).toBe("failed");
    expect(state?.success).toBe(false);
    expect(state?.error).toBe("soft failure");
    expect(state?.results).toMatchObject({ code: 42 });
  });
});

describe("runTask – 抛出异常", () => {
  test("status 为 error", async () => {
    const output = "out/throw";
    const { exitCode } = await runTask({
      cwd: tmpRoot,
      task: "tasks/throw.mjs",
      output,
    });
    expect(exitCode).toBe(1);
    const state = readTaskJson({ cwd: tmpRoot, output });
    expect(state?.status).toBe("error");
    expect(state?.success).toBe(false);
    expect(state?.error).toContain("boom");
  });
});

describe("runTask – CJS 任务模块", () => {
  test("能加载并执行 .cjs", async () => {
    const output = "out/cjs-demo";
    const { exitCode } = await runTask({
      cwd: tmpRoot,
      task: "tasks/cjsDemo.cjs",
      output,
      parameters: { n: 7 },
    });
    expect(exitCode).toBe(0);
    const state = readTaskJson({ cwd: tmpRoot, output });
    expect(state?.results).toMatchObject({ from: "cjs", n: 7 });
  });
});

describe("runTask – 任务文件不存在", () => {
  test("status 为 error", async () => {
    const output = "out/missing";
    const { exitCode } = await runTask({
      cwd: tmpRoot,
      task: "tasks/no-such.mjs",
      output,
    });
    expect(exitCode).toBe(1);
    const state = readTaskJson({ cwd: tmpRoot, output });
    expect(state?.status).toBe("error");
    expect(state?.error).toMatch(/Cannot find task file/);
  });
});

describe("runTask – maxLogLines 集成", () => {
  test("执行过程中裁剪最旧日志行", async () => {
    const output = "out/spam";
    const maxLogLines = 20;
    const { logPath } = await runTask({
      cwd: tmpRoot,
      task: "tasks/spam.mjs",
      output,
      parameters: { n: 50 },
      maxLogLines,
    });

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
