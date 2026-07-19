import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  appendChunkAsLines,
  appendLogLine,
  DEFAULT_MAX_LOG_LINES,
  readTaskLog,
  trimLogFile,
} from "../src/log";

let tmpDir: string;
let logPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "script-journal-log-"));
  logPath = path.join(tmpDir, "test.log");
  fs.writeFileSync(logPath, "", "utf8");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("DEFAULT_MAX_LOG_LINES", () => {
  test("默认值为 10000", () => {
    expect(DEFAULT_MAX_LOG_LINES).toBe(10000);
  });
});

describe("appendLogLine", () => {
  test("写入带 level 与 message 的 NDJSON", () => {
    expect(appendLogLine(logPath, "hello", "info")).toBe(true);
    const line = fs.readFileSync(logPath, "utf8").trim();
    const entry = JSON.parse(line);
    expect(entry).toMatchObject({ level: "info", message: "hello" });
    expect(entry.timestamp).toBeTruthy();
  });

  test("空消息返回 false", () => {
    expect(appendLogLine(logPath, "")).toBe(false);
    expect(fs.readFileSync(logPath, "utf8")).toBe("");
  });

  test("写入失败时返回 false", () => {
    const dirAsFile = path.join(tmpDir, "not-a-file");
    fs.mkdirSync(dirAsFile);
    expect(appendLogLine(dirAsFile, "x", "info")).toBe(false);
  });
});

describe("appendChunkAsLines", () => {
  test("解析 [LEVEL] 前缀并统计写入行数", () => {
    const n = appendChunkAsLines(
      logPath,
      "[INFO] a\n[DEBUG] b\n[WARN] c\n[ERROR] d\nplain\n",
      "info"
    );
    expect(n).toBe(5);
    const entries = fs
      .readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(entries.map((e) => e.level)).toEqual(["info", "debug", "warn", "error", "info"]);
    expect(entries.map((e) => e.message)).toEqual(["a", "b", "c", "d", "plain"]);
  });

  test("跳过空行", () => {
    expect(appendChunkAsLines(logPath, "\n\n[INFO] x\n\n")).toBe(1);
  });
});

describe("trimLogFile", () => {
  test("只保留最新的 maxLogLines 行", () => {
    for (let i = 0; i < 10; i++) {
      appendLogLine(logPath, `line-${i}`, "info");
    }
    const kept = trimLogFile(logPath, 3);
    expect(kept).toBe(3);

    const messages = fs
      .readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l).message);
    expect(messages).toEqual(["line-7", "line-8", "line-9"]);
  });

  test("未超限时不裁剪", () => {
    appendLogLine(logPath, "only");
    expect(trimLogFile(logPath, 5)).toBe(1);
  });

  test("maxLogLines ≤ 0 时返回 0", () => {
    appendLogLine(logPath, "x");
    expect(trimLogFile(logPath, 0)).toBe(0);
    expect(trimLogFile(logPath, -1)).toBe(0);
  });

  test("文件不存在时返回 0", () => {
    expect(trimLogFile(path.join(tmpDir, "missing.log"), 10)).toBe(0);
  });
});

describe("readTaskLog", () => {
  const output = "out/demo";

  beforeEach(() => {
    const file = path.join(tmpDir, `${output}.log`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    for (let i = 0; i < 5; i++) {
      appendLogLine(file, `m-${i}`, "info");
    }
  });

  test("默认 tail=true 并返回最新一页", () => {
    const result = readTaskLog({ cwd: tmpDir, output, pageSize: 2 });
    expect(result.tail).toBe(true);
    expect(result.exists).toBe(true);
    expect(result.totalLines).toBe(5);
    expect(result.entries.map((e) => e.message)).toEqual(["m-4", "m-3"]);
  });

  test("tail=false 时支持正序分页", () => {
    const result = readTaskLog({
      cwd: tmpDir,
      output,
      page: 1,
      pageSize: 2,
      tail: false,
    });
    expect(result.tail).toBe(false);
    expect(result.entries.map((e) => e.message)).toEqual(["m-0", "m-1"]);
    expect(result.hasMore).toBe(true);
  });

  test("日志不存在时 exists 为 false", () => {
    const result = readTaskLog({ cwd: tmpDir, output: "missing/path" });
    expect(result.exists).toBe(false);
    expect(result.entries).toEqual([]);
  });

  test("缺少 output 时抛错", () => {
    expect(() => readTaskLog({ output: "" } as never)).toThrow(/output/);
  });

  test("非 JSON 行回退为普通消息", () => {
    const file = path.join(tmpDir, `${output}.log`);
    fs.writeFileSync(file, "not-json-line\n", "utf8");
    const result = readTaskLog({ cwd: tmpDir, output, pageSize: 10 });
    expect(result.entries).toEqual([{ timestamp: "", level: "info", message: "not-json-line" }]);
  });

  test("部分字段缺失时使用默认值", () => {
    const file = path.join(tmpDir, `${output}.log`);
    fs.writeFileSync(file, '{"message":"only-msg"}\n', "utf8");
    const result = readTaskLog({ cwd: tmpDir, output, pageSize: 10 });
    expect(result.entries).toEqual([{ timestamp: "", level: "info", message: "only-msg" }]);
  });

  test("JSON 非对象时回退为普通消息", () => {
    const file = path.join(tmpDir, `${output}.log`);
    fs.writeFileSync(file, "null\n[]\n", "utf8");
    const result = readTaskLog({ cwd: tmpDir, output, pageSize: 10, tail: false });
    expect(result.entries.map((e) => e.message)).toEqual(["null", "[]"]);
  });

  test("空日志文件 totalPages 为 1", () => {
    const file = path.join(tmpDir, `${output}.log`);
    fs.writeFileSync(file, "", "utf8");
    const result = readTaskLog({ cwd: tmpDir, output });
    expect(result.totalLines).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.entries).toEqual([]);
  });

  test("stat 成功但读取失败时 exists 为 true 且 entries 为空", () => {
    // 用同名目录模拟：stat 成功，readFileSync 抛 EISDIR
    const file = path.join(tmpDir, `${output}.log`);
    fs.rmSync(file, { force: true });
    fs.mkdirSync(file);
    const result = readTaskLog({ cwd: tmpDir, output });
    expect(result.exists).toBe(true);
    expect(result.sizeBytes).toBeGreaterThanOrEqual(0);
    expect(result.entries).toEqual([]);
    expect(result.totalLines).toBe(0);
  });

  test("未传 cwd 时使用 process.cwd()", () => {
    const prev = process.cwd();
    process.chdir(tmpDir);
    try {
      const result = readTaskLog({ output, pageSize: 2 });
      expect(result.exists).toBe(true);
      expect(result.totalLines).toBe(5);
    } finally {
      process.chdir(prev);
    }
  });
});

describe("trimLogFile – 写回失败", () => {
  test("目标不可写时仍返回 kept 行数", () => {
    for (let i = 0; i < 5; i++) {
      appendLogLine(logPath, `line-${i}`, "info");
    }
    fs.chmodSync(logPath, 0o444);
    fs.chmodSync(tmpDir, 0o555);
    try {
      expect(trimLogFile(logPath, 2)).toBe(2);
    } finally {
      fs.chmodSync(tmpDir, 0o755);
      fs.chmodSync(logPath, 0o644);
    }
  });
});
