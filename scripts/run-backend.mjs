import path from "node:path";
import { existsSync } from "node:fs";
import { assertInRepoRoot, ROOT_DIR, run, venvPythonPath } from "./shared.mjs";

async function main() {
  assertInRepoRoot();
  const pythonInVenv = venvPythonPath();

  if (!existsSync(pythonInVenv)) {
    throw new Error("Missing .venv Python. Run `npm run setup` first.");
  }

  await run(
    pythonInVenv,
    ["-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"],
    { cwd: path.join(ROOT_DIR, "backend") },
  );
}

main().catch((error) => {
  console.error(`\n[backend] Failed: ${error.message}`);
  process.exit(1);
});
