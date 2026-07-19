import { EventEmitter } from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { TaskState } from "../src/types";

jest.mock("child_process", () => {
  const actual = jest.requireActual<typeof import("child_process")>("child_process");
  return {
    ...actual,
    spawn: jest.fn(),
  };
});

import { spawn } from "child_process";
import { runTask } from "../src/handler";

const spawnMock = spawn as jest.MockedFunction<typeof spawn>;

describe("runTask – spawn 失败", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "script-journal-spawn-"));
    spawnMock.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test("子进程 error 事件时写入 JSON 并抛出该状态", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);

    const pending = runTask({
      cwd: tmpRoot,
      task: "tasks/any.mjs",
      output: "out/spawn-fail",
    });

    // runTask 先 await 清场，再 spawn；等监听挂上后再触发 error
    await new Promise((r) => setImmediate(r));
    child.emit("error", new Error("ENOENT"));

    let thrown: unknown;
    try {
      await pending;
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toMatchObject({
      status: "error",
      pid: null,
      success: false,
      error: "spawn error: ENOENT",
    });

    const jsonPath = path.join(tmpRoot, "out", "spawn-fail.json");
    const logPath = path.join(tmpRoot, "out", "spawn-fail.log");
    const state = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as TaskState;
    expect(state).toMatchObject(thrown as TaskState);
    expect(fs.readFileSync(logPath, "utf8")).toContain("spawn error: ENOENT");
  });

  test("close 时 JSON 损坏则回退到 initPayload", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);

    const pending = runTask({
      cwd: tmpRoot,
      task: "tasks/any.mjs",
      output: "out/corrupt-close",
    }).then(
      (s) => ({ ok: true as const, s }),
      (s) => ({ ok: false as const, s })
    );

    await new Promise((r) => setImmediate(r));
    const jsonPath = path.join(tmpRoot, "out", "corrupt-close.json");
    fs.writeFileSync(jsonPath, "{not-json", "utf8");
    child.emit("close", 1);

    const settled = await pending;
    expect(settled.ok).toBe(false);
    expect(settled.s).toMatchObject({
      status: "pending",
      pid: null,
      task: expect.stringContaining("any.mjs"),
    });
  });

  test("采集 stdout/stderr，maxLogLines=0 不裁剪，error 时保留 startedAt", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);

    const pending = runTask({
      cwd: tmpRoot,
      task: "tasks/any.mjs",
      output: "out/stream-branches",
      maxLogLines: 0,
    }).then(
      (s) => ({ ok: true as const, s }),
      (s) => ({ ok: false as const, s })
    );

    await new Promise((r) => setImmediate(r));

    child.stdout.emit("data", Buffer.from(""));
    child.stdout.emit("data", Buffer.from("[INFO] hello\n"));
    child.stderr.emit("data", Buffer.from("[ERROR] boom\n"));

    const jsonPath = path.join(tmpRoot, "out", "stream-branches.json");
    const current = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as TaskState;
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({ ...current, startedAt: "2026-01-01T00:00:00.000Z" }),
      "utf8"
    );

    child.emit("error", new Error("fail"));
    const settled = await pending;
    expect(settled.ok).toBe(false);
    expect(settled.s.startedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(settled.s.durationMs).toBeGreaterThanOrEqual(0);

    const logPath = path.join(tmpRoot, "out", "stream-branches.log");
    const logText = fs.readFileSync(logPath, "utf8");
    expect(logText).toContain("hello");
    expect(logText).toContain("boom");
  });

  test("close 码为 null 时按 1 处理，且重复 settle 无效", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);

    const pending = runTask({
      cwd: tmpRoot,
      task: "tasks/any.mjs",
      output: "out/null-code",
    }).then(
      (s) => ({ ok: true as const, s }),
      (s) => ({ ok: false as const, s })
    );

    await new Promise((r) => setImmediate(r));
    child.emit("close", null);
    child.emit("close", 0);
    child.emit("error", new Error("late"));

    const settled = await pending;
    expect(settled.ok).toBe(false);
  });
});
