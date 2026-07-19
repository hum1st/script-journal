import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ensureDir, resolveFromCwd, resolveOutputFile, resolveRunnerPath } from "../src/paths";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "script-journal-paths-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveFromCwd", () => {
  test("相对路径拼接到 cwd", () => {
    expect(resolveFromCwd(tmpDir, "a/b")).toBe(path.join(tmpDir, "a", "b"));
  });

  test("绝对路径保持解析后的绝对路径", () => {
    const abs = path.join(tmpDir, "abs-file");
    expect(resolveFromCwd("/other/cwd", abs)).toBe(path.resolve(abs));
  });
});

describe("resolveOutputFile", () => {
  test("在 cwd 下追加扩展名", () => {
    expect(resolveOutputFile(tmpDir, "out/task", ".json")).toBe(
      path.join(tmpDir, "out", "task.json")
    );
    expect(resolveOutputFile(tmpDir, "out/task", ".log")).toBe(
      path.join(tmpDir, "out", "task.log")
    );
  });

  test("支持绝对产出路径", () => {
    const base = path.join(tmpDir, "abs", "task");
    expect(resolveOutputFile("/ignored", base, ".json")).toBe(`${path.resolve(base)}.json`);
  });
});

describe("ensureDir", () => {
  test("为文件路径创建嵌套父目录", () => {
    const file = path.join(tmpDir, "nested", "deep", "file.json");
    ensureDir(file);
    expect(fs.existsSync(path.dirname(file))).toBe(true);
    expect(fs.statSync(path.dirname(file)).isDirectory()).toBe(true);
  });
});

describe("resolveRunnerPath", () => {
  test("能定位到 runner.mjs", () => {
    const runner = resolveRunnerPath();
    expect(fs.existsSync(runner)).toBe(true);
    expect(path.basename(runner)).toBe("runner.mjs");
  });
});
