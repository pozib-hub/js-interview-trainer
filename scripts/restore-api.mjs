import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_DIR = path.resolve(__dirname, "../src/app/api");
const API_BACKUP = path.resolve(__dirname, "../src/app/_api_backup");

// Restore API routes after static build
if (process.env.NEXT_PUBLIC_STATIC_MODE === "true" && fs.existsSync(API_BACKUP)) {
  if (fs.existsSync(API_DIR)) fs.rmSync(API_DIR, { recursive: true, force: true });
  fs.renameSync(API_BACKUP, API_DIR);
  console.log("API routes restored from backup");
}
