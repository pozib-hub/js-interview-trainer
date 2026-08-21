#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_DIR = path.resolve(__dirname, "../src/app/api");
const API_BACKUP = path.resolve(__dirname, "../src/app/_api_backup");

const env = {
  ...process.env,
  NEXT_PUBLIC_STATIC_MODE: "true",
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || "/js-interview-trainer",
};

function moveApiAway() {
  if (!fs.existsSync(API_DIR)) return;
  if (fs.existsSync(API_BACKUP)) fs.rmSync(API_BACKUP, { recursive: true, force: true });
  fs.renameSync(API_DIR, API_BACKUP);
  console.log("[build:static] API routes temporarily moved for static export");
}

function restoreApi() {
  if (!fs.existsSync(API_BACKUP)) return;
  if (fs.existsSync(API_DIR)) fs.rmSync(API_DIR, { recursive: true, force: true });
  fs.renameSync(API_BACKUP, API_DIR);
  console.log("[build:static] API routes restored");
}

// Step 1: Build tasks.json
console.log("[build:static] Building tasks.json...");
const tasksResult = spawnSync("node", ["scripts/build-tasks.mjs"], {
  cwd: path.resolve(__dirname, ".."),
  env,
  stdio: "inherit",
});
if (tasksResult.status !== 0) {
  console.error("[build:static] build-tasks failed");
  process.exit(tasksResult.status ?? 1);
}

// Step 2: Move API routes away (Next.js export doesn't support API routes)
moveApiAway();

// Step 3: next build — always restore API afterwards, even on failure
let buildCode = 0;
try {
  const buildResult = spawnSync("npx", ["next", "build"], {
    cwd: path.resolve(__dirname, ".."),
    env,
    stdio: "inherit",
    shell: true,
  });
  buildCode = buildResult.status ?? 1;
} finally {
  restoreApi();
}

if (buildCode !== 0) {
  console.error(`[build:static] next build failed (exit ${buildCode})`);
  process.exit(buildCode);
}

console.log("[build:static] Done");
