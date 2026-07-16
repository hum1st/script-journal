import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runScript } from "../src/index";

// ─── 测试用脚本 fixture（写入 tmp 文件） ────────────────────────────────────

let tmpDir: string;
let successScript: string;
let errorScript: string;
let syncScript: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "script-journal-test-"));

  // 成功脚本：返回一个对象（使用 CJS 格式，兼容 Jest/ts-jest 环境）
  successScript = path.join(tmpDir, "success.js");
  fs.writeFileSync(
    successScript,
    `module.exports = async function() { return { hello: "world", ts: Date.now() }; };\n`
  );

  // 失败脚本：抛出异常
  errorScript = path.join(tmpDir, "error.js");
  fs.writeFileSync(
    errorScript,
    `module.exports = async function() { throw new Error("intentional failure"); };\n`
  );

  // 同步脚本：同步函数（非 async）
  syncScript = path.join(tmpDir, "sync.js");
  fs.writeFileSync(
    syncScript,
    `module.exports = function() { return 42; };\n`
  );
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── 测试 ────────────────────────────────────────────────────────────────────

describe("runScript – success case", () => {
  let root: string;
  let result: Awaited<ReturnType<typeof runScript>>;

  beforeAll(async () => {
    root = path.join(tmpDir, "out-success");
    result = await runScript(successScript, { root, filePath: "data/result" });
  });

  test("returns success=true", () => {
    expect(result.success).toBe(true);
  });

  test("data matches script return value", () => {
    expect(result.data).toMatchObject({ hello: "world" });
  });

  test("json file is created with correct content", () => {
    expect(fs.existsSync(result.jsonPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(result.jsonPath, "utf8"));
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ hello: "world" });
  });

  test("log file is created and contains expected markers", () => {
    expect(fs.existsSync(result.logPath)).toBe(true);
    const log = fs.readFileSync(result.logPath, "utf8");
    expect(log).toContain("START");
    expect(log).toContain("DONE");
    expect(log).toContain("WROTE");
  });

  test("jsonPath resolves under root/data/result.json", () => {
    expect(result.jsonPath).toBe(path.join(root, "data", "result.json"));
  });

  test("logPath resolves under root/data/result.log", () => {
    expect(result.logPath).toBe(path.join(root, "data", "result.log"));
  });

  test("durationMs is a non-negative number", () => {
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("runScript – error case", () => {
  let root: string;
  let result: Awaited<ReturnType<typeof runScript>>;

  beforeAll(async () => {
    root = path.join(tmpDir, "out-error");
    result = await runScript(errorScript, { root });
  });

  test("returns success=false", () => {
    expect(result.success).toBe(false);
  });

  test("error field contains the thrown message", () => {
    expect(result.error).toContain("intentional failure");
  });

  test("json file records failure", () => {
    const parsed = JSON.parse(fs.readFileSync(result.jsonPath, "utf8"));
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("intentional failure");
  });

  test("log file contains ERROR marker", () => {
    const log = fs.readFileSync(result.logPath, "utf8");
    expect(log).toContain("ERROR");
  });

  test("default filePath produces output.json", () => {
    expect(result.jsonPath).toBe(path.join(root, "output.json"));
  });
});

describe("runScript – sync script", () => {
  let result: Awaited<ReturnType<typeof runScript>>;

  beforeAll(async () => {
    const root = path.join(tmpDir, "out-sync");
    result = await runScript(syncScript, { root, filePath: "sync-result" });
  });

  test("handles synchronous default export function", () => {
    expect(result.success).toBe(true);
    expect(result.data).toBe(42);
  });
});

describe("runScript – old files are cleaned before run", () => {
  test("overwrites stale json and log from previous run", async () => {
    const root = path.join(tmpDir, "out-clean");
    const fp = "clean";

    // 先写入一次
    await runScript(successScript, { root, filePath: fp });

    // 篡改 json 文件内容
    const jsonPath = path.join(root, fp + ".json");
    fs.writeFileSync(jsonPath, '{"stale":true}', "utf8");

    // 再执行一次，应该覆盖
    const result2 = await runScript(successScript, { root, filePath: fp });
    const parsed = JSON.parse(fs.readFileSync(result2.jsonPath, "utf8"));
    expect(parsed.stale).toBeUndefined();
    expect(parsed.success).toBe(true);
  });
});
