import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

export const ROOT_DIR = process.cwd();

export const isWindows = process.platform === "win32";

export function venvPythonPath() {
  return isWindows
    ? path.join(ROOT_DIR, ".venv", "Scripts", "python.exe")
    : path.join(ROOT_DIR, ".venv", "bin", "python");
}

export function resolvePythonLauncher() {
  return isWindows ? { command: "py", args: ["-3"] } : { command: "python3", args: [] };
}

export function run(command, args, options = {}) {
  const { shell = false, ...restOptions } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell,
      ...restOptions,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

export function assertInRepoRoot() {
  const required = ["backend", "frontend", "env.sample"];
  const missing = required.filter((name) => !existsSync(path.join(ROOT_DIR, name)));
  if (missing.length) {
    throw new Error(`Run this command from the JobJeeves repo root. Missing: ${missing.join(", ")}`);
  }
}
