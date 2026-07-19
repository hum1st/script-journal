#!/usr/bin/env node
// 获取当前未提交变更文件列表

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @returns {string} */
function getRepoRoot() {
  return execSync("git rev-parse --show-toplevel", {
    cwd: path.resolve(__dirname, "../../.."),
    encoding: "utf8",
  }).trim();
}

/**
 * 解析 git status --porcelain 输出
 * @param {string} porcelain
 */
function parsePorcelain(porcelain) {
  /** @type {{ staged: string[], unstaged: string[], untracked: string[] }} */
  const result = { staged: [], unstaged: [], untracked: [] };

  for (const line of porcelain.split("\n").filter(Boolean)) {
    const indexStatus = line[0];
    const workTreeStatus = line[1];
    const rawPath = line.slice(3);
    const filePath = rawPath.includes(" -> ") ? rawPath.split(" -> ").pop() : rawPath;

    if (indexStatus === "?" && workTreeStatus === "?") {
      result.untracked.push(filePath);
      continue;
    }

    if (indexStatus !== " " && indexStatus !== "?") {
      result.staged.push(filePath);
    }
    if (workTreeStatus !== " " && workTreeStatus !== "?") {
      result.unstaged.push(filePath);
    }
  }

  return result;
}

function main() {
  const json = process.argv.includes("--json");
  const repoRoot = getRepoRoot();

  const porcelain = execSync("git status --porcelain", {
    cwd: repoRoot,
    encoding: "utf8",
  });

  const { staged, unstaged, untracked } = parsePorcelain(porcelain);
  const all = [...new Set([...staged, ...unstaged, ...untracked])].sort();

  if (json) {
    console.log(JSON.stringify({ files: all, staged, unstaged, untracked }, null, 2));
    return;
  }

  if (all.length === 0) {
    console.log("(无未提交变更)");
    return;
  }

  for (const file of all) {
    console.log(file);
  }
}

main();
