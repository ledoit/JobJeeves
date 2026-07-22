import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const build = spawnSync("npm", ["run", "build"], {
  cwd: join(root, "frontend"),
  stdio: "inherit",
  shell: true,
});
process.exit(build.status ?? 1);
