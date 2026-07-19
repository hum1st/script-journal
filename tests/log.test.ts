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
});
