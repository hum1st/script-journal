import * as fs from "fs";
import * as path from "path";

/** 确保文件所在目录存在 */
export function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/** 相对 cwd 解析路径；已是绝对路径则原样 resolve */
export function resolveFromCwd(cwd: string, target: string): string {
  return path.isAbsolute(target) ? path.resolve(target) : path.resolve(cwd, target);
}

/** 将 output 解析为带扩展名的绝对路径 */
export function resolveOutputFile(cwd: string, output: string, ext: string): string {
  return `${resolveFromCwd(cwd, output)}${ext}`;
}

/** 解析 runner.mjs 路径（兼容 src 开发 / dist 发布布局） */
export function resolveRunnerPath(): string {
  const candidates = [
    path.join(__dirname, "..", "runner.mjs"), // dist/cjs → dist/runner.mjs
    path.join(__dirname, "runner.mjs"), // src/runner.mjs（ts-jest / 源码）
    path.join(__dirname, "..", "src", "runner.mjs"), // dist/cjs → src/runner.mjs
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`script-journal: cannot find runner.mjs (searched: ${candidates.join(", ")})`);
}
