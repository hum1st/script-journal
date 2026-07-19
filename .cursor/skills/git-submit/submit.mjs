#!/usr/bin/env node
// 按 conventional commit 规范提交并推送：升级版本号 → npm i → add → commit → push

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED_TYPES = new Set([
  "feat",
  "fix",
  "refactor",
  "chore",
  "docs",
  "style",
  "test",
  "perf",
]);

/** @returns {string} */
function getRepoRoot() {
  return execSync("git rev-parse --show-toplevel", {
    cwd: path.resolve(__dirname, "../../.."),
    encoding: "utf8",
  }).trim();
}

/** @param {string} cwd @param {string} cmd */
function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

/** @param {string} cwd @param {string} cmd @returns {string} */
function runCapture(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: "utf8" }).trim();
}

/** @param {string} cwd @returns {string | null} */
function getUpstreamRef(cwd) {
  try {
    return runCapture("git rev-parse --abbrev-ref @{upstream}", cwd);
  } catch {
    for (const ref of ["origin/main", "origin/master"]) {
      try {
        runCapture(`git rev-parse ${ref}`, cwd);
        return ref;
      } catch {
        // 尝试下一个候选
      }
    }
    return null;
  }
}

/** @param {string} subject @returns {string | null} */
function parseCommitType(subject) {
  const match = /^(\w+)(?:\(.*\))?!?:\s/.exec(subject);
  return match ? match[1] : null;
}

/**
 * @param {string} cwd
 * @param {string | null} upstream
 * @param {string} currentType
 */
function shouldBumpMinor(cwd, upstream, currentType) {
  if (currentType === "feat") {
    return true;
  }

  if (!upstream) {
    return false;
  }

  let log;
  try {
    log = runCapture(`git log ${upstream}..HEAD --format=%s`, cwd);
  } catch {
    return false;
  }

  if (!log) {
    return false;
  }

  return log.split("\n").some((subject) => parseCommitType(subject) === "feat");
}

/**
 * @param {string} version
 * @param {"minor" | "patch"} bump
 */
function bumpVersion(version, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`无法解析版本号: ${version}`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (bump === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

function parseArgs(argv) {
  /** @type {{ type?: string, message?: string }} */
  const result = {};

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--type" || arg === "-t") {
      result.type = argv[++i];
    } else if (arg === "--message" || arg === "-m") {
      result.message = argv[++i];
    } else if (!result.type) {
      result.type = arg;
    } else if (!result.message) {
      result.message = arg;
    } else {
      throw new Error(`未知参数: ${arg}`);
    }
  }

  return result;
}

function usage() {
  console.error(`用法: node submit.mjs --type <type> --message <描述>
       node submit.mjs <type> <描述>

type: ${[...ALLOWED_TYPES].join(" | ")}
描述: 中文，无句号，祈使语气`);
}

function main() {
  let type;
  let message;

  try {
    ({ type, message } = parseArgs(process.argv));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    usage();
    process.exit(1);
  }

  if (!type || !message) {
    usage();
    process.exit(1);
  }

  if (!ALLOWED_TYPES.has(type)) {
    console.error(`无效的 type: ${type}`);
    console.error(`允许的值: ${[...ALLOWED_TYPES].join(", ")}`);
    process.exit(1);
  }

  const repoRoot = getRepoRoot();
  const packageJsonPath = path.join(repoRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const upstream = getUpstreamRef(repoRoot);
  const bump = shouldBumpMinor(repoRoot, upstream, type) ? "minor" : "patch";
  const nextVersion = bumpVersion(packageJson.version, bump);

  console.log(`📦 版本号: ${packageJson.version} → ${nextVersion} (${bump})`);

  packageJson.version = nextVersion;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  console.log("📥 运行 npm i ...");
  run("npm i", repoRoot);

  console.log("📂 暂存全部变更 ...");
  run("git add -A", repoRoot);

  const commitMessage = `${type}: ${message}`;
  console.log(`💾 提交: ${commitMessage}`);
  run(`git commit -m ${JSON.stringify(commitMessage)}`, repoRoot);

  console.log("🚀 推送到远程 ...");
  run("git push", repoRoot);

  console.log("✅ 完成");
}

main();
