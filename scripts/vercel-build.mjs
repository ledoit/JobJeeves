import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const apiBackend = join(root, "api", "backend");

rmSync(apiBackend, { recursive: true, force: true });
mkdirSync(apiBackend, { recursive: true });
cpSync(join(root, "backend"), apiBackend, { recursive: true });
console.log("copied backend -> api/backend");

const build = spawnSync("npm", ["run", "build"], {
  cwd: join(root, "frontend"),
  stdio: "inherit",
  shell: true,
});
process.exit(build.status ?? 1);
