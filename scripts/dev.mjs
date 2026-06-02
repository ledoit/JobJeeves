import path from "node:path";
import { spawn } from "node:child_process";
import { assertInRepoRoot, isWindows, ROOT_DIR, run } from "./shared.mjs";

function spawnTagged(name, command, args, cwd, shell = false) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell,
  });

  child.on("error", (error) => {
    console.error(`[${name}] failed to start: ${error.message}`);
  });

  return child;
}

async function main() {
  assertInRepoRoot();

  console.log("[dev] Running setup first...");
  await run("node", [path.join("scripts", "setup.mjs")], { cwd: ROOT_DIR });

  console.log("\n[dev] Starting backend and frontend...");
  const backend = spawnTagged(
    "backend",
    "node",
    [path.join("scripts", "run-backend.mjs")],
    ROOT_DIR,
  );
  const frontend = spawnTagged(
    "frontend",
    "npm",
    ["--prefix", "frontend", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
    ROOT_DIR,
    isWindows,
  );

  const children = [backend, frontend];
  let shuttingDown = false;

  const shutdown = (signal = "SIGTERM") => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    for (const child of children) {
      if (!child.killed) {
        child.kill(signal);
      }
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  backend.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[dev] backend exited with code ${code ?? "unknown"}. Stopping frontend...`);
      shutdown();
      process.exit(code ?? 1);
    }
  });

  frontend.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[dev] frontend exited with code ${code ?? "unknown"}. Stopping backend...`);
      shutdown();
      process.exit(code ?? 1);
    }
  });
}

main().catch((error) => {
  console.error(`\n[dev] Failed: ${error.message}`);
  process.exit(1);
});
