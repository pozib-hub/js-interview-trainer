#!/usr/bin/env node
import { readFileSync, existsSync } from "fs";
import path from "path";

const BASE = "http://localhost:3000";

async function main() {
  console.log("Fetching task list...");
  const res = await fetch(`${BASE}/api/tasks`);
  const data = await res.json();

  const allTasks = [];
  for (const [topic, tasks] of Object.entries(data.topics || {})) {
    for (const t of tasks) {
      allTasks.push({ ...t, taskId: `${topic}/${t.id.split("/").pop()}` });
    }
  }

  console.log(`Found ${allTasks.length} tasks\n`);

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < allTasks.length; i++) {
    const task = allTasks[i];
    const taskId = task.id || task.taskId;

    // Find solution file
    const taskPath = path.join(process.cwd(), "tasks", taskId);
    const solTs = path.join(taskPath, "solution.ts");
    const solJs = path.join(taskPath, "solution.js");

    let solutionCode = null;
    if (existsSync(solTs)) solutionCode = readFileSync(solTs, "utf8");
    else if (existsSync(solJs)) solutionCode = readFileSync(solJs, "utf8");

    if (!solutionCode) {
      console.log(`[${i + 1}/${allTasks.length}] SKIP ${taskId} — no solution file`);
      failed++;
      failures.push({ taskId, reason: "no solution file" });
      continue;
    }

    try {
      const runRes = await fetch(`${BASE}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, code: solutionCode }),
      });
      const result = await runRes.json();

      if (result.passed) {
        passed++;
        if ((i + 1) % 20 === 0) {
          console.log(`[${i + 1}/${allTasks.length}] ✓ ${passed} passed, ${failed} failed`);
        }
      } else {
        failed++;
        const failedNames = (result.assertions || [])
          .filter((a) => !a.passed)
          .map((a) => a.name)
          .join(", ");
        failures.push({ taskId, failedNames, total: result.total, failedCount: result.failed });
        console.log(`[${i + 1}/${allTasks.length}] ✗ ${taskId} — ${result.failed}/${result.total} failed: ${failedNames}`);
      }
    } catch (e) {
      failed++;
      failures.push({ taskId, reason: String(e) });
      console.log(`[${i + 1}/${allTasks.length}] ERROR ${taskId}: ${e}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`TOTAL: ${allTasks.length} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  ${f.taskId}: ${f.reason || `${f.failedCount}/${f.total} — ${f.failedNames}`}`);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
