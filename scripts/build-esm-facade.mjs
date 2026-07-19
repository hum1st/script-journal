/**
 * 生成 dist/esm 门面：实现保留在 CJS（可用 __dirname 定位 runner），
 * ESM / CJS 消费者均通过 exports 使用同一套逻辑。
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const esmDir = join(root, "dist", "esm");

mkdirSync(esmDir, { recursive: true });

writeFileSync(join(esmDir, "package.json"), JSON.stringify({ type: "module" }, null, 2) + "\n");

writeFileSync(
  join(esmDir, "index.js"),
  `\
/**
 * ESM 门面 — 再导出 CJS 实现（经 Node CJS interop 提供具名导出）。
 */
export {
  runTask,
  readTaskJson,
  readTaskLog,
  appendLogLine,
  appendChunkAsLines,
  trimLogFile,
  DEFAULT_MAX_LOG_LINES,
} from "../cjs/index.js";
`
);

writeFileSync(
  join(esmDir, "index.d.ts"),
  `export {
  runTask,
  readTaskJson,
  readTaskLog,
  appendLogLine,
  appendChunkAsLines,
  trimLogFile,
  DEFAULT_MAX_LOG_LINES,
} from "../cjs/index";
export type * from "../cjs/index";
`
);

console.log("Wrote dist/esm facade");
