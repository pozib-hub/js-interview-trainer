#!/usr/bin/env node
import { spawn } from "child_process";

const next = spawn("npx", ["next", "dev"], {
  stdio: ["inherit", "pipe", "inherit"],
  shell: true,
});

let opened = false;
const PORT_RE = /Local:\s+http:\/\/localhost:(\d+)/;

next.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (opened) return;
  const match = chunk.toString().match(PORT_RE);
  if (match) {
    const port = match[1];
    const url = `http://localhost:${port}`;
    opened = true;
    const opener = spawn("npx", ["open-cli", url], { shell: true, stdio: "ignore" });
    opener.unref();
    console.log(`\n[dev] Opening browser at ${url}\n`);
  }
});

next.on("close", (code) => {
  process.exit(code ?? 0);
});
