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
});
