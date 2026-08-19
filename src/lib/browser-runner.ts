import type { RunResult, TestAssertion } from "./types";

/**
 * Удаляет TypeScript-синтаксис для выполнения в браузере.
 */
function stripTypes(code: string): string {
  let out = code;
  // Remove all import lines
  out = out.replace(/import\s+[^;]+;?\n?/g, "");
  // Remove `as Type` assertions
  out = out.replace(/\bas\s+(?:any|boolean|number|string|void|null|undefined|never|unknown|object|\w[\w<>\[\]|\s,?]*)\b/g, "");
  // Fix `= undefined` after removing `as`
  out = out.replace(/=\s*undefined\s*;?\s*/g, "= undefined; ");
  // Remove trailing commas
  out = out.replace(/,\s*(\)|\])/g, "$1");
  // Clean up extra spaces
  out = out.replace(/\n\s*\n\s*\n/g, "\n\n");
  return out.trim();
}

/**
 * Извлекает имена экспортов из кода.
 */
function extractExportNames(code: string): string[] {
  const names: string[] = [];
  const regex = /export\s+(?:const|let|function|class)\s+(\w+)/g;
  let m;
  while ((m = regex.exec(code)) !== null) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

/**
 * Запускает тесты пользователя в браузере.
 */
export async function runTestsInBrowser(
  userCode: string,
  testFile: string,
  taskExports?: string[]
): Promise<RunResult> {
  const start = Date.now();

  try {
    const cleanUserCode = stripTypes(userCode);
    const exportNames = taskExports && taskExports.length > 0
      ? taskExports
      : extractExportNames(cleanUserCode);

    // Prepare user code: remove `export` keyword, assign to shared scope
    let userCodeBody = cleanUserCode;
    for (const name of exportNames) {
      userCodeBody = userCodeBody.replace(
        new RegExp(`export\\s+(const|let|function|class)\\s+${name}\\b`, "g"),
        "$1 $name"
      );
    }

    // Prepare test code
    let cleanTest = stripTypes(testFile);
    // Remove imports from solution
    cleanTest = cleanTest.replace(/import\s+[^;]+;?\n?/g, "");

    // Build the sandbox script
    const sandboxScript = buildSandboxScript(userCodeBody, cleanTest, exportNames);

    // Execute in an iframe-like sandbox using a function
    const results = executeSandbox(sandboxScript);

    let total = 0;
    let failed = 0;
    const assertions: TestAssertion[] = [];

    for (const r of results) {
      total++;
      const passed = r.passed === true;
      if (!passed) failed++;
      assertions.push({
        name: r.name,
        passed,
        message: passed ? undefined : r.message,
      });
    }

    return {
      taskId: "",
      passed: failed === 0 && total > 0,
      total,
      failed,
      assertions,
      stdout: "",
      stderr: "",
      durationMs: Date.now() - start,
    };
  } catch (e: unknown) {
    const msg = (e as Error).message || String(e);
    return {
      taskId: "",
      passed: false,
      total: 0,
      failed: 0,
      assertions: [],
      stdout: "",
      stderr: `Ошибка: ${msg}`,
      durationMs: Date.now() - start,
    };
  }
}

function buildSandboxScript(userCode: string, testCode: string, exportNames: string[]): string {
  return `
    (function() {
      var results = [];
      var exports = {};

      // Deep equal helper
      function deepEqual(a, b) {
        if (a === b) return true;
        if (a === null || b === null) return a === b;
        if (typeof a !== typeof b) return false;
        if (typeof a !== 'object') return false;
        var aIsArr = Array.isArray(a);
        var bIsArr = Array.isArray(b);
        if (aIsArr !== bIsArr) return false;
        if (aIsArr) {
          if (a.length !== b.length) return false;
          for (var i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
          }
          return true;
        }
        var aKeys = Object.keys(a);
        var bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return false;
        for (var i = 0; i < aKeys.length; i++) {
          if (!bKeys.includes(aKeys[i])) return false;
          if (!deepEqual(a[aKeys[i]], b[aKeys[i]])) return false;
        }
        return true;
      }

      function serialize(v) {
        try { return JSON.stringify(v); } catch(e) { return String(v); }
      }

      // Expect helper
      function expect(actual) {
        var self = {
          toBe: function(exp) { if (actual !== exp) throw new Error('expected ' + serialize(actual) + ' to be ' + serialize(exp)); return self; },
          toEqual: function(exp) { if (!deepEqual(actual, exp)) throw new Error('expected ' + serialize(actual) + ' to equal ' + serialize(exp)); return self; },
          toBeTruthy: function() { if (!actual) throw new Error('expected truthy'); return self; },
          toBeFalsy: function() { if (actual) throw new Error('expected falsy'); return self; },
          toBeNull: function() { if (actual !== null) throw new Error('expected null, got ' + serialize(actual)); return self; },
          toBeUndefined: function() { if (actual !== undefined) throw new Error('expected undefined'); return self; },
          toBeNaN: function() { if (!Number.isNaN(actual)) throw new Error('expected NaN'); return self; },
          toBeGreaterThan: function(e) { if (actual <= e) throw new Error('expected ' + actual + ' > ' + e); return self; },
          toBeLessThan: function(e) { if (actual >= e) throw new Error('expected ' + actual + ' < ' + e); return self; },
          toContain: function(e) { if (typeof actual !== 'string' || !actual.includes(String(e))) throw new Error('expected to contain'); return self; },
          toHaveLength: function(e) { if (actual == null || actual.length !== e) throw new Error('expected length ' + (actual == null ? 'undefined' : actual.length) + ' to be ' + e); return self; },
          toHaveProperty: function(k) { if (actual == null || actual[k] === undefined) throw new Error('expected to have property ' + k); return self; },
          toThrow: function(pattern) {
            var threw = false, errMsg = '';
            try { if (typeof actual === 'function') actual(); } catch(er) { threw = true; errMsg = er.message || String(er); }
            if (!threw) throw new Error('expected function to throw');
            if (pattern && pattern.test && !pattern.test(errMsg)) throw new Error('expected error to match ' + pattern);
            return self;
          },
          not: {
            toBe: function(exp) { if (actual === exp) throw new Error('expected NOT to be ' + serialize(exp)); return self; },
            toEqual: function(exp) { if (deepEqual(actual, exp)) throw new Error('expected NOT to equal'); return self; },
            toBeTruthy: function() { if (actual) throw new Error('expected NOT truthy'); return self; },
            toBeFalsy: function() { if (!actual) throw new Error('expected NOT falsy'); return self; },
          }
        };
        return self;
      }

      // Test runner
      function test(name, fn) {
        try {
          var res = fn();
          if (res && typeof res.then === 'function') {
            res.then(
              function() { results.push({ name: name, passed: true }); },
              function(e) { results.push({ name: name, passed: false, message: e.message || String(e) }); }
            );
          } else {
            results.push({ name: name, passed: true });
          }
        } catch(e) {
          results.push({ name: name, passed: false, message: e.message || String(e) });
        }
      }

      // Execute user code
      try {
        ${userCode}
        ${exportNames.map(function(n) { return 'exports.' + n + ' = typeof ' + n + ' !== "undefined" ? ' + n + ' : undefined;'; }).join('\n        ')}
      } catch(e) {
        return [{ name: "Оценка кода", passed: false, message: "Ошибка в коде: " + (e.message || String(e)) }];
      }

      // Inject exports as variables for test code
      ${exportNames.map(function(n) { return 'var ' + n + ' = exports.' + n + ';'; }).join('\n      ')}

      // Execute test code
      try {
        ${testCode}
      } catch(e) {
        results.push({ name: "Запуск тестов", passed: false, message: "Ошибка в тестах: " + (e.message || String(e)) });
      }

      return results;
    })()
  `;
}

function executeSandbox(script: string): Array<{ name: string; passed: boolean; message?: string }> {
  try {
    const fn = new Function(script);
    const result = fn();
    if (Array.isArray(result)) {
      return result;
    }
    return [{ name: "Неизвестная ошибка", passed: false, message: "Результат не массив" }];
  } catch (e: unknown) {
    const msg = (e as Error).message || String(e);
    return [{ name: "Ошибка выполнения", passed: false, message: msg }];
  }
}
