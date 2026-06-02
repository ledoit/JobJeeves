import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { assertInRepoRoot, isWindows, resolvePythonLauncher, ROOT_DIR, run, venvPythonPath } from "./shared.mjs";

async function main() {
  assertInRepoRoot();

  console.log("\n[setup] Installing frontend dependencies...");
  await run("npm", ["install", "--prefix", "frontend"], { cwd: ROOT_DIR, shell: isWindows });

  const pythonInVenv = venvPythonPath();
  if (!existsSync(pythonInVenv)) {
    console.log("\n[setup] Creating Python virtual environment in .venv...");
    const launcher = resolvePythonLauncher();
    await run(launcher.command, [...launcher.args, "-m", "venv", ".venv"], { cwd: ROOT_DIR });
  } else {
    console.log("\n[setup] Reusing existing .venv...");
  }

  console.log("\n[setup] Installing backend dependencies...");
  await run(pythonInVenv, ["-m", "pip", "install", "-r", path.join("backend", "requirements.txt")], {
    cwd: ROOT_DIR,
  });

  const envPath = path.join(ROOT_DIR, ".env");
  const envSamplePath = path.join(ROOT_DIR, "env.sample");
  if (!existsSync(envPath)) {
    copyFileSync(envSamplePath, envPath);
    console.log("\n[setup] Created .env from env.sample. Add your API key before running analyses.");
  } else {
    console.log("\n[setup] .env already exists.");
  }

  console.log("\n[setup] Done.");
}

main().catch((error) => {
  console.error(`\n[setup] Failed: ${error.message}`);
  process.exit(1);
});
