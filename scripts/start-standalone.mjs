import { spawn } from "node:child_process";
import { cpSync, existsSync, readdirSync } from "node:fs";

const root = ".next/standalone";
if (!existsSync(`${root}/server.js`)) {
  console.error("No standalone build. Run `pnpm build` first.");
  process.exit(1);
}

cpSync(".next/static", `${root}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${root}/public`, { recursive: true });

// Output tracing leaves out the libvips DLLs next to sharp's Windows binary.
const store = "node_modules/.pnpm";
if (process.platform === "win32" && existsSync(`${root}/${store}`)) {
  for (const entry of readdirSync(`${root}/${store}`)) {
    if (entry.startsWith("@img+sharp-") && existsSync(`${store}/${entry}`)) {
      cpSync(`${store}/${entry}`, `${root}/${store}/${entry}`, { recursive: true });
    }
  }
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
