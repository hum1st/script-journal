import { spawn } from "child_process";
import { isPidAlive, terminatePid, DEFAULT_TERMINATE_GRACE_MS } from "../src/process";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitAlive(pid: number, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isPidAlive(pid)) return;
    await sleep(20);
  }
  throw new Error(`pid ${pid} did not become alive`);
}

describe("isPidAlive", () => {
  test("非法 pid 返回 false", () => {
    expect(isPidAlive(0)).toBe(false);
    expect(isPidAlive(-1)).toBe(false);
    expect(isPidAlive(1.5)).toBe(false);
    expect(isPidAlive(Number.NaN)).toBe(false);
  });

  test("当前进程存活", () => {
    expect(isPidAlive(process.pid)).toBe(true);
  });

  test("不存在的 pid 返回 false", () => {
    expect(isPidAlive(2_000_000_001)).toBe(false);
  });

  test("POSIX：kill(0) 抛 EPERM 时视为存活", () => {
    if (process.platform === "win32") return;

    const err = Object.assign(new Error("EPERM"), { code: "EPERM" });
    jest.spyOn(process, "kill").mockImplementation(() => {
      throw err;
    });
    try {
      expect(isPidAlive(12345)).toBe(true);
    } finally {
      jest.restoreAllMocks();
    }
  });

  test("POSIX：kill(0) 抛 ESRCH 时视为已死", () => {
    if (process.platform === "win32") return;

    const err = Object.assign(new Error("ESRCH"), { code: "ESRCH" });
    jest.spyOn(process, "kill").mockImplementation(() => {
      throw err;
    });
    try {
      expect(isPidAlive(12345)).toBe(false);
    } finally {
      jest.restoreAllMocks();
    }
  });
});

describe("terminatePid – 真实进程", () => {
  test("默认 graceMs 常量", () => {
    expect(DEFAULT_TERMINATE_GRACE_MS).toBe(2000);
  });

  test("pid 已死时返回 false", async () => {
    expect(await terminatePid(2_000_000_001)).toBe(false);
  });

  test("SIGTERM 后进程退出", async () => {
    if (process.platform === "win32") return;

    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore",
      windowsHide: true,
    });
    const pid = child.pid!;
    await waitAlive(pid);

    expect(await terminatePid(pid, { graceMs: 500 })).toBe(true);
    await sleep(100);
    expect(isPidAlive(pid)).toBe(false);
  });

  test("忽略 SIGTERM 时升级 SIGKILL", async () => {
    if (process.platform === "win32") return;

    const child = spawn(
      process.execPath,
      ["-e", "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"],
      { stdio: "ignore", windowsHide: true }
    );
    const pid = child.pid!;
    await waitAlive(pid);

    expect(await terminatePid(pid, { graceMs: 150 })).toBe(true);
    await sleep(100);
    expect(isPidAlive(pid)).toBe(false);
  });

  test("Windows：taskkill 能终止真实进程", async () => {
    if (process.platform !== "win32") return;

    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore",
      windowsHide: true,
    });
    const pid = child.pid!;
    await waitAlive(pid);

    expect(await terminatePid(pid)).toBe(true);
    await sleep(200);
    expect(isPidAlive(pid)).toBe(false);
  });
});

describe("terminatePid – mock 分支", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
    jest.resetModules();
  });

  test("SIGTERM 抛错时继续等待并 SIGKILL", async () => {
    if (process.platform === "win32") return;

    const child = spawn(
      process.execPath,
      ["-e", "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"],
      { stdio: "ignore", windowsHide: true }
    );
    const pid = child.pid!;
    await waitAlive(pid);

    const realKill = process.kill.bind(process);
    jest.spyOn(process, "kill").mockImplementation(((
      target: number,
      signal?: NodeJS.Signals | number
    ) => {
      if (target === pid && signal === "SIGTERM") {
        throw new Error("EPERM");
      }
      return realKill(target, signal);
    }) as typeof process.kill);

    try {
      expect(await terminatePid(pid, { graceMs: 150 })).toBe(true);
      await sleep(50);
      expect(isPidAlive(pid)).toBe(false);
    } finally {
      try {
        realKill(pid, "SIGKILL");
      } catch {
        /* ignore */
      }
    }
  });

  test("SIGKILL 抛错时仍返回 true", async () => {
    jest.spyOn(process, "kill").mockImplementation(((
      _target: number,
      signal?: NodeJS.Signals | number
    ) => {
      if (signal === 0 || signal === undefined) return true;
      if (signal === "SIGTERM") return true;
      if (signal === "SIGKILL") throw new Error("ESRCH");
      return true;
    }) as typeof process.kill);

    Object.defineProperty(process, "platform", { value: "linux", configurable: true });

    await expect(terminatePid(999001, { graceMs: 80 })).resolves.toBe(true);
  });

  test("Windows：tasklist 判定存活后调用 taskkill", async () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    jest.resetModules();

    const execSync = jest.fn((cmd: string) => {
      if (String(cmd).startsWith("tasklist")) {
        return `"node.exe","424242","Console","1","1,000 K"\r\n`;
      }
      return Buffer.from("");
    });
    jest.doMock("child_process", () => {
      const actual = jest.requireActual<typeof import("child_process")>("child_process");
      return { ...actual, execSync };
    });

    const { terminatePid: terminatePidWin, isPidAlive: isAliveWin } =
      await import("../src/process");
    expect(isAliveWin(424242)).toBe(true);
    expect(isAliveWin(999999)).toBe(false);
    await expect(terminatePidWin(424242)).resolves.toBe(true);
    expect(execSync).toHaveBeenCalledWith("taskkill /PID 424242 /T /F", {
      stdio: "ignore",
      windowsHide: true,
    });

    jest.dontMock("child_process");
  });

  test("Windows：tasklist 抛错时视为已死", async () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    jest.resetModules();

    const execSync = jest.fn(() => {
      throw new Error("tasklist failed");
    });
    jest.doMock("child_process", () => {
      const actual = jest.requireActual<typeof import("child_process")>("child_process");
      return { ...actual, execSync };
    });

    const { isPidAlive: isAliveWin, terminatePid: terminatePidWin } =
      await import("../src/process");
    expect(isAliveWin(1)).toBe(false);
    await expect(terminatePidWin(1)).resolves.toBe(false);

    jest.dontMock("child_process");
  });

  test("Windows：tasklist 无匹配时不调用 taskkill", async () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    jest.resetModules();

    const execSync = jest.fn((cmd: string) => {
      if (String(cmd).startsWith("tasklist")) {
        return "INFO: No tasks are running which match the specified criteria.\r\n";
      }
      return Buffer.from("");
    });
    jest.doMock("child_process", () => {
      const actual = jest.requireActual<typeof import("child_process")>("child_process");
      return { ...actual, execSync };
    });

    const { terminatePid: terminatePidWin } = await import("../src/process");
    await expect(terminatePidWin(424244)).resolves.toBe(false);
    expect(execSync).not.toHaveBeenCalledWith(
      expect.stringContaining("taskkill"),
      expect.anything()
    );

    jest.dontMock("child_process");
  });

  test("Windows：taskkill 失败时仍返回 true", async () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    jest.resetModules();

    const execSync = jest.fn((cmd: string) => {
      if (String(cmd).startsWith("tasklist")) {
        return `"node.exe","424243","Console","1","1,000 K"\r\n`;
      }
      throw new Error("taskkill failed");
    });
    jest.doMock("child_process", () => {
      const actual = jest.requireActual<typeof import("child_process")>("child_process");
      return { ...actual, execSync };
    });

    const { terminatePid: terminatePidWin } = await import("../src/process");
    await expect(terminatePidWin(424243)).resolves.toBe(true);

    jest.dontMock("child_process");
  });
});
