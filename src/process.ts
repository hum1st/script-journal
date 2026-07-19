import { execSync } from "child_process";

/** terminatePid 默认等待 SIGTERM 生效的毫秒数 */
export const DEFAULT_TERMINATE_GRACE_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 判断 pid 是否仍存活。
 *
 * - Windows：用 `tasklist`（`process.kill(pid, 0)` 在 EPERM 时不可靠）
 * - POSIX：`process.kill(pid, 0)`；`EPERM` 视为仍存活（无权限但进程存在）
 */
export function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  if (process.platform === "win32") {
    try {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /NH /FO CSV`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
        windowsHide: true,
      });
      // CSV: "image","PID","session","session#","mem"
      return out.includes(`","${pid}","`);
    } catch {
      return false;
    }
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    return code === "EPERM";
  }
}

/**
 * 终止指定进程。
 * - Windows：`taskkill /PID … /T /F`（杀进程树；Windows 无可靠 SIGTERM 优雅退出）
 * - POSIX：SIGTERM → 等待 graceMs → SIGKILL
 * @returns 是否曾对存活进程发出终止信号
 */
export async function terminatePid(
  pid: number,
  options: { graceMs?: number } = {}
): Promise<boolean> {
  if (!isPidAlive(pid)) return false;

  const graceMs = options.graceMs ?? DEFAULT_TERMINATE_GRACE_MS;

  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore", windowsHide: true });
    } catch {
      /* ignore */
    }
    return true;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* ignore */
  }

  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return true;
    await sleep(50);
  }

  if (isPidAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* ignore */
    }
  }
  return true;
}
