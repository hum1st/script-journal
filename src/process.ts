import { execSync } from "child_process";

/** terminatePid 默认等待 SIGTERM 生效的毫秒数 */
export const DEFAULT_TERMINATE_GRACE_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 判断 pid 是否仍存活 */
export function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * 终止指定进程。
 * - Windows：`taskkill /T /F`
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
