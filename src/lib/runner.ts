import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { getTask } from "./scanner";
import type { RunResult, TestAssertion } from "./types";

interface VitestAssertion {
  fullName: string;
  status: "passed" | "failed" | "skipped" | "todo";
  errors?: { message: string }[];
}

interface VitestJSON {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: {
    name: string;
    status: "passed" | "failed";
    assertionResults: VitestAssertion[];
  }[];
}

/**
 * Запускает код пользователя против тестов задачи.
 *
 * Стратегия: создаём временную директорию, пишем туда solution.ts
 * (код пользователя) и копируем tests/test.ts, затем запускаем vitest
 * через worker-скрипт, который резолвит vitest из node_modules проекта.
 */
export async function runTaskTests(
  taskId: string,
  userCode: string
): Promise<RunResult> {
  const task = getTask(taskId);
  if (!task) {
    return {
      taskId,
      passed: false,
      total: 0,
      failed: 0,
      assertions: [],
      stdout: "",
      stderr: `Задача "${taskId}" не найдена`,
      durationMs: 0,
    };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "it-run-"));
  const start = Date.now();
  const ext = task.language === "javascript" ? ".js" : ".ts";

  try {
    const solutionPath = path.join(tmpDir, `solution${ext}`);
    const testsDir = path.join(tmpDir, "tests");
    fs.mkdirSync(testsDir, { recursive: true });

    fs.writeFileSync(solutionPath, userCode, "utf8");
    fs.writeFileSync(
      path.join(testsDir, `test${ext}`),
      task.testFile || "",
      "utf8"
    );

    const workerPath = path.join(
      process.cwd(),
      "src",
      "lib",
      "vitest-worker.mts"
    );

    const { stdout, stderr, error, timedOut } = await new Promise<{
      stdout: string;
      stderr: string;
      error: Error | null;
      timedOut: boolean;
    }>((resolve) => {
      execFile(
        process.execPath,
        [
          "--experimental-strip-types",
          "--disable-warning=ExperimentalWarning",
          workerPath,
          tmpDir,
        ],
        {
          cwd: process.cwd(),
          timeout: 20000,
          maxBuffer: 4 << 20,
          env: { ...process.env, NODE_NO_WARNINGS: "1" },
        },
        (err, out, serr) =>
          resolve({
            stdout: out || "",
            stderr: serr || "",
            error: err,
            timedOut: !!err && (err as NodeJS.ErrnoException).code === "ETIMEDOUT",
          })
      );
    });

    if (timedOut) {
      return {
        taskId,
        passed: false,
        total: 0,
        failed: 0,
        assertions: [],
        stdout: "",
        stderr: "Превышен лимит времени исполнения (20с)",
        durationMs: Date.now() - start,
      };
    }

    // Read result.json from file (written by vitest-worker.mts) instead of parsing stdout
    const jsonOutPath = path.join(tmpDir, "result.json");
    let parsed: VitestJSON | null = null;
    try {
      const raw = fs.readFileSync(jsonOutPath, "utf8");
      parsed = JSON.parse(raw) as VitestJSON;
    } catch {
      // result.json not available — fall back to stdout parsing
      const jsonStart = stdout.indexOf("{");
      if (jsonStart >= 0) {
        try {
          parsed = JSON.parse(stdout.slice(jsonStart)) as VitestJSON;
        } catch {
          // JSON не сформировался
        }
      }
    }

    const assertions: TestAssertion[] = [];
    let total = 0;
    let failed = 0;

    if (parsed) {
      for (const tr of parsed.testResults) {
        for (const a of tr.assertionResults) {
          total++;
          const passed = a.status === "passed";
          if (!passed) failed++;
          assertions.push({
            name: a.fullName,
            passed,
            message: passed
              ? undefined
              : a.errors?.[0]?.message?.split("\n")[0],
          });
        }
      }
    }

    const cleanStderr = stderr
      .split("\n")
      .filter(
        (l) =>
          !/ExperimentalWarning/.test(l) &&
          !/Use `node --trace-warnings/.test(l) &&
          !/^\s*\(node:\d+\)\s*$/.test(l)
      )
      .join("\n")
      .trim();

    const errorStderr = error && !timedOut
      ? `Ошибка запуска: ${error.message}`
      : "";

    return {
      taskId,
      passed: failed === 0 && total > 0,
      total,
      failed,
      assertions,
      stdout: "",
      stderr: parsed
        ? cleanStderr || errorStderr
        : cleanStderr || errorStderr || stdout.trim().slice(0, 500),
      durationMs: Date.now() - start,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
