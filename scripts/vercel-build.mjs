import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const publicDir = join(root, "public");

rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });

const build = spawnSync("npm", ["run", "build"], {
  cwd: join(root, "frontend"),
  stdio: "inherit",
  shell: true,
});
if ((build.status ?? 1) !== 0) process.exit(build.status ?? 1);

cpSync(join(root, "frontend", "dist"), publicDir, { recursive: true });
console.log("copied frontend/dist -> public/");
