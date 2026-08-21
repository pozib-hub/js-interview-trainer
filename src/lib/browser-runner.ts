import type { RunResult, TestAssertion } from "./types";

interface SandboxResult {
  name: string;
  passed: boolean;
  message?: string;
}

/**
 * Запускает тесты пользователя в браузере.
 *
 * Реализует подмножество Vitest API, достаточное для задач проекта:
 * test/it/describe/beforeEach/afterEach, expect с основными матчерами
 * (включая .resolves/.rejects), vi.fn/vi.spyOn, vi.useFakeTimers и т.п.
 */
export async function runTestsInBrowser(
  userCode: string,
  testFile: string,
  taskExports?: string[]
): Promise<RunResult> {
  const start = Date.now();

  try {
    const cleanUserCode = await stripTypes(userCode);
    // Merge meta.json exports with auto-detected exports from code
    const metaExports = taskExports && taskExports.length > 0 ? taskExports : [];
    const codeExports = extractExportNames(cleanUserCode);
    const exportNames = dedupe(uniq([...metaExports, ...codeExports]));

    let userCodeBody = stripModuleSyntax(cleanUserCode);

    let cleanTest = stripModuleSyntax(await stripTypes(testFile));

    const sandboxScript = buildSandboxScript(userCodeBody, cleanTest, exportNames);
    const results = await executeSandbox(sandboxScript);

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

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function dedupe(arr: string[]): string[] {
  return uniq(arr.filter(Boolean));
}

/**
 * Удаляет TypeScript-синтаксис для выполнения в браузере.
 *
 * Использует компилятор TypeScript (динамический импорт → code-split),
 * что надёжнее regex. Фолбэк на regex при недоступности TS.
 */
async function stripTypes(code: string): Promise<string> {
  try {
    const ts = await import("typescript");
    const result = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        isolatedModules: true,
        verbatimModuleSyntax: false,
      },
    });
    return result.outputText.trim();
  } catch {
    return stripTypesRegex(code);
  }
}

function stripTypesRegex(code: string): string {
  let out = code;
  out = out.replace(/import\s+[^;]+;?\n?/g, "");
  out = out.replace(
    /\bas\s+(?:any|boolean|number|string|void|null|undefined|never|unknown|object|\w[\w<>\[\]|\s,?]*)\b/g,
    ""
  );
  out = out.replace(/=\s*undefined\s*;?\s*/g, "= undefined; ");
  out = out.replace(/,\s*(\)|\])/g, "$1");
  out = out.replace(/\n\s*\n\s*\n/g, "\n\n");
  return out.trim();
}

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
 * Удаляет ESM-синтаксис (import/export), чтобы код выполнялся внутри Function.
 */
function stripModuleSyntax(code: string): string {
  let out = code;
  out = out.replace(/import\s+[^;]*;?\n?/g, "");
  out = out.replace(/export\s+default\s+/g, "");
  out = out.replace(/export\s+(const|let|var|function|class|async\s+function)\s+/g, "$1 ");
  out = out.replace(/export\s*\{[^}]*\}\s*;?\n?/g, "");
  out = out.replace(/export\s+/g, "");
  return out.trim();
}

function buildSandboxScript(userCode: string, testCode: string, exportNames: string[]): string {
  const script = `(function() {
      var results = [];
      var exports = {};
      var beforeEachHooks = [];
      var afterEachHooks = [];
      var currentDescribe = "";

      // ===== Fake timers =====
      var fakeTimersActive = false;
      var timerQueue = []; // { time, fn, id, interval }
      var timerNow = 0;
      var timerNextId = 1;
      var activeTimers = {}; // id -> queue entry
      var realSetTimeout = globalThis.setTimeout.bind(globalThis);
      var realClearTimeout = globalThis.clearTimeout.bind(globalThis);
      var realSetInterval = globalThis.setInterval.bind(globalThis);
      var realClearInterval = globalThis.clearInterval.bind(globalThis);

      function scheduleTimer(fn, delay, interval) {
        var id = timerNextId++;
        var entry = { time: timerNow + (delay || 0), fn: fn, id: id, interval: interval };
        timerQueue.push(entry);
        activeTimers[id] = entry;
        return id;
      }

      function clearTimer(id) {
        var entry = activeTimers[id];
        if (!entry) return;
        delete activeTimers[id];
        var idx = timerQueue.indexOf(entry);
        if (idx >= 0) timerQueue.splice(idx, 1);
      }

      function installFakeTimers() {
        fakeTimersActive = true;
        globalThis.setTimeout = function(fn, delay) { return scheduleTimer(fn, delay, 0); };
        globalThis.clearTimeout = function(id) { clearTimer(id); };
        globalThis.setInterval = function(fn, delay) { return scheduleTimer(fn, delay, delay); };
        globalThis.clearInterval = function(id) { clearTimer(id); };
      }
      function uninstallFakeTimers() {
        fakeTimersActive = false;
        globalThis.setTimeout = realSetTimeout;
        globalThis.clearTimeout = realClearTimeout;
        globalThis.setInterval = realSetInterval;
        globalThis.clearInterval = realClearInterval;
        timerQueue = [];
        activeTimers = {};
        timerNow = 0;
      }

      function runDueTimers() {
        // Run all timers due at current time, repeatedly until none left
        var guard = 0;
        while (timerQueue.length > 0 && guard < 100000) {
          guard++;
          timerQueue.sort(function(a, b) { return a.time - b.time; });
          var next = timerQueue[0];
          if (next.time > timerNow) break;
          timerQueue.shift();
          delete activeTimers[next.id];
          next.fn();
          if (next.interval) {
            // reschedule interval
            var entry = { time: next.time + next.interval, fn: next.fn, id: next.id, interval: next.interval };
            timerQueue.push(entry);
            activeTimers[next.id] = entry;
          }
        }
      }

      function getMinTimerTime() {
        var min = Infinity;
        for (var i = 0; i < timerQueue.length; i++) {
          if (timerQueue[i].time < min) min = timerQueue[i].time;
        }
        return min;
      }

      // ===== vi mock =====
      function MockFunction(impl, original, target) {
        var calls = [];
        var results = [];
        var instances = [];
        var implStack = impl ? [impl] : [];
        var returnValueVal;
        var hasReturnValue = false;
        var resolveVal;
        var hasResolveVal = false;
        var rejectVal;
        var hasRejectVal = false;

        function mockFn() {
          var args = Array.prototype.slice.call(arguments);
          calls.push(args);
          var thisArg = this;
          instances.push(thisArg);
          var currentImpl;
          if (implStack.length > 1) {
            currentImpl = implStack.shift();
          } else if (implStack.length === 1) {
            currentImpl = implStack[0];
          } else {
            currentImpl = undefined;
          }
          try {
            var result;
            if (currentImpl) {
              result = currentImpl.apply(thisArg, args);
            } else if (original) {
              result = original.apply(thisArg, args);
            } else if (hasReturnValue) {
              result = returnValueVal;
            } else if (hasResolveVal) {
              result = Promise.resolve(resolveVal);
            } else if (hasRejectVal) {
              result = Promise.reject(rejectVal);
            } else {
              result = undefined;
            }
            results.push({ type: 'return', value: result });
            return result;
          } catch (e) {
            results.push({ type: 'throw', value: e });
            throw e;
          }
        }
        mockFn.mock = {
          calls: calls,
          results: results,
          instances: instances,
        };
        mockFn.getMockName = function() { return 'vi.fn'; };
        mockFn.mockName = function(n) { return mockFn; };
        mockFn.mockImplementation = function(fn) { implStack = [fn]; return mockFn; };
        mockFn.mockImplementationOnce = function(fn) { implStack.unshift(fn); return mockFn; };
        mockFn.mockReturnValue = function(val) { hasReturnValue = true; returnValueVal = val; implStack = []; return mockFn; };
        mockFn.mockReturnValueOnce = function(val) {
          implStack.unshift(function() { return val; });
          return mockFn;
        };
        mockFn.mockResolvedValue = function(val) { hasResolveVal = true; resolveVal = val; implStack = []; return mockFn; };
        mockFn.mockResolvedValueOnce = function(val) {
          implStack.unshift(function() { return Promise.resolve(val); });
          return mockFn;
        };
        mockFn.mockRejectedValue = function(val) { hasRejectVal = true; rejectVal = val; implStack = []; return mockFn; };
        mockFn.mockRejectedValueOnce = function(val) {
          implStack.unshift(function() { return Promise.reject(val); });
          return mockFn;
        };
        mockFn.mockReset = function() { calls.length = 0; results.length = 0; instances.length = 0; implStack = []; hasReturnValue = false; hasResolveVal = false; hasRejectVal = false; return mockFn; };
        mockFn.mockClear = function() { calls.length = 0; results.length = 0; instances.length = 0; return mockFn; };
        mockFn.mockRestore = function() {
          mockFn.mockClear();
          if (target && original) {
            target[keyName] = original;
          }
          return mockFn;
        };
        return mockFn;
      }

      var vi = {
        fn: function(impl) { return MockFunction(impl, undefined, undefined); },
        spyOn: function(obj, methodName) {
          var original = obj[methodName];
          var mock = MockFunction(undefined, original, obj);
          obj[methodName] = mock;
          mock.mockRestore = function() { obj[methodName] = original; mock.mockClear(); return mock; };
          return mock;
        },
        useFakeTimers: function() { installFakeTimers(); return vi; },
        useRealTimers: function() { uninstallFakeTimers(); return vi; },
        advanceTimersByTime: function(ms) {
          timerNow += ms;
          runDueTimers();
          return vi;
        },
        advanceTimersByTimeAsync: async function(ms) {
          timerNow += ms;
          runDueTimers();
          await new Promise(function(r) { realSetTimeout(r, 0); });
          var guard = 0;
          while (timerQueue.length > 0 && getMinTimerTime() <= timerNow && guard < 1000) {
            guard++;
            runDueTimers();
            await new Promise(function(r) { realSetTimeout(r, 0); });
          }
          return vi;
        },
        runAllTimers: function() {
          var guard = 0;
          while (timerQueue.length > 0 && guard < 100000) {
            guard++;
            timerQueue.sort(function(a, b) { return a.time - b.time; });
            var next = timerQueue.shift();
            if (next.time > timerNow) timerNow = next.time;
            delete activeTimers[next.id];
            next.fn();
            if (next.interval) {
              var entry = { time: next.time + next.interval, fn: next.fn, id: next.id, interval: next.interval };
              timerQueue.push(entry);
              activeTimers[next.id] = entry;
            }
          }
          return vi;
        },
        clearAllTimers: function() { timerQueue = []; activeTimers = {}; return vi; },
        mocked: function(v) { return v; },
        stubGlobal: function(prop, value) { globalThis[prop] = value; return { restore: function() {} }; },
      };

      // ===== expect =====
      function serialize(v) {
        try {
          if (typeof v === 'function') return String(v).slice(0, 100);
          return JSON.stringify(v, function(_k, val) {
            if (typeof val === 'function') return '[Function]';
            if (typeof val === 'undefined') return '[Undefined]';
            if (val === null) return null;
            return val;
          });
        } catch (e) { return String(v); }
      }

      function deepEqual(a, b) {
        if (a === b) return true;
        if (a === null || b === null) return a === b;
        if (typeof a !== typeof b) return false;
        if (typeof a !== 'object') return false;
        if (a instanceof Error || b instanceof Error) {
          return a instanceof Error && b instanceof Error && a.message === b.message;
        }
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
        for (var j = 0; j < aKeys.length; j++) {
          var k = aKeys[j];
          if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
          if (!deepEqual(a[k], b[k])) return false;
        }
        return true;
      }

      function isMock(fn) {
        return typeof fn === 'function' && fn.mock && Array.isArray(fn.mock.calls);
      }

      function makeMatchers(actual, isNot, isPromise) {
        function wrap(fn) {
          return function() {
            var args = Array.prototype.slice.call(arguments);
            var applyCheck = function(val) {
              var res = fn(val, args);
              if (isNot ? res : !res) {
                throw new Error(fn.errMsg ? fn.errMsg(val, args) : 'assertion failed');
              }
            };
            if (isPromise) {
              return actual.then(applyCheck, function(e) {
                if (!isNot) throw e;
                // rejected but we expected resolve-based assertion
                throw new Error('promise rejected before matcher');
              });
            } else {
              applyCheck(actual);
            }
          };
        }

        var matchers = {
          toBe: wrap(function(val, a) { return val === a[0]; }),
          toEqual: wrap(function(val, a) { return deepEqual(val, a[0]); }),
          toStrictEqual: wrap(function(val, a) { return deepEqual(val, a[0]); }),
          toBeTruthy: wrap(function(val) { return !!val; }),
          toBeFalsy: wrap(function(val) { return !val; }),
          toBeNull: wrap(function(val) { return val === null; }),
          toBeUndefined: wrap(function(val) { return val === undefined; }),
          toBeDefined: wrap(function(val) { return val !== undefined; }),
          toBeNaN: wrap(function(val) { return Number.isNaN(val); }),
          toBeGreaterThan: wrap(function(val, a) { return val > a[0]; }),
          toBeGreaterThanOrEqual: wrap(function(val, a) { return val >= a[0]; }),
          toBeLessThan: wrap(function(val, a) { return val < a[0]; }),
          toBeLessThanOrEqual: wrap(function(val, a) { return val <= a[0]; }),
          toContain: wrap(function(val, a) {
            if (val == null) return false;
            if (typeof val === 'string') return val.includes(String(a[0]));
            if (Array.isArray(val)) return val.some(function(x) { return deepEqual(x, a[0]); });
            if (typeof val === 'object') return Object.prototype.hasOwnProperty.call(val, a[0]);
            return false;
          }),
          toContainEqual: wrap(function(val, a) {
            if (val == null) return false;
            if (Array.isArray(val)) return val.some(function(x) { return deepEqual(x, a[0]); });
            if (typeof val === 'object') return Object.prototype.hasOwnProperty.call(val, a[0]);
            return false;
          }),
          toHaveLength: wrap(function(val, a) { return val != null && val.length === a[0]; }),
          toHaveProperty: wrap(function(val, a) {
            if (val == null) return false;
            var parts = Array.isArray(a[0]) ? a[0] : String(a[0]).split('.');
            var cur = val;
            for (var i = 0; i < parts.length; i++) {
              if (cur == null || typeof cur !== 'object') return false;
              cur = cur[parts[i]];
            }
            if (a.length > 1) return deepEqual(cur, a[1]);
            return cur !== undefined;
          }),
          toMatch: wrap(function(val, a) {
            if (val == null) return false;
            var pat = a[0];
            if (pat instanceof RegExp) return pat.test(String(val));
            return String(val).includes(String(pat));
          }),
          toMatchObject: wrap(function(val, a) { return deepEqual(val, a[0]); }),
          toBeInstanceOf: wrap(function(val, a) { return val instanceof a[0]; }),
          toHaveBeenCalled: wrap(function(val) { return isMock(val) && val.mock.calls.length > 0; }),
          toHaveBeenCalledTimes: wrap(function(val, a) { return isMock(val) && val.mock.calls.length === a[0]; }),
          toHaveBeenCalledWith: wrap(function(val, a) {
            if (!isMock(val)) return false;
            return val.mock.calls.some(function(call) {
              if (call.length !== a.length) return false;
              for (var i = 0; i < a.length; i++) {
                if (!deepEqual(call[i], a[i])) return false;
              }
              return true;
            });
          }),
          toHaveReturned: wrap(function(val) { return isMock(val) && val.mock.results.length > 0; }),
          toHaveReturnedTimes: wrap(function(val, a) { return isMock(val) && val.mock.results.filter(function(r){return r.type==='return';}).length === a[0]; }),
          toHaveReturnedWith: wrap(function(val, a) {
            if (!isMock(val)) return false;
            return val.mock.results.some(function(r) { return r.type === 'return' && deepEqual(r.value, a[0]); });
          }),
          toHaveLastReturnedWith: wrap(function(val, a) {
            if (!isMock(val) || val.mock.results.length === 0) return false;
            var last = val.mock.results[val.mock.results.length - 1];
            return last.type === 'return' && deepEqual(last.value, a[0]);
          }),
          toHaveNthReturnedWith: wrap(function(val, a) {
            if (!isMock(val)) return false;
            var r = val.mock.results[a[0] - 1];
            return r && r.type === 'return' && deepEqual(r.value, a[1]);
          }),
          toThrow: wrap(function(val, a) {
            var threw = false, errMsg = '';
            if (typeof val !== 'function') {
              throw new Error('expected a function to throw');
            }
            try { val(); } catch (er) { threw = true; errMsg = er.message || String(er); }
            if (!threw) return false;
            if (a && a[0] !== undefined) {
              var pat = a[0];
              if (pat instanceof RegExp) return pat.test(errMsg);
              if (typeof pat === 'string') return errMsg.includes(pat);
              if (pat && pat.message) return errMsg.includes(pat.message);
            }
            return true;
          }),
        };

        var names = Object.keys(matchers);
        var proxy = {};
        for (var i = 0; i < names.length; i++) {
          (function(name) {
            proxy[name] = matchers[name];
          })(names[i]);
        }
        proxy.not = {};
        for (var j = 0; j < names.length; j++) {
          (function(name) {
            proxy.not[name] = matchers[name].__origIsNot ? matchers[name] : makeNotMatcher(name, actual);
          })(names[j]);
        }
        function makeNotMatcher(name, val) {
          return function() {
            var args = Array.prototype.slice.call(arguments);
            var matcherFn = matchers[name];
            // rebuild the matcher in not-mode
            var applyCheck = function(v) {
              var res;
              // call the underlying check directly
              switch (name) {
                case 'toBe': res = v === args[0]; break;
                case 'toEqual': case 'toStrictEqual': case 'toMatchObject': res = deepEqual(v, args[0]); break;
                case 'toBeTruthy': res = !!v; break;
                case 'toBeFalsy': res = !v; break;
                case 'toBeNull': res = v === null; break;
                case 'toBeUndefined': res = v === undefined; break;
                case 'toBeDefined': res = v !== undefined; break;
                case 'toBeNaN': res = Number.isNaN(v); break;
                case 'toBeGreaterThan': res = v > args[0]; break;
                case 'toBeGreaterThanOrEqual': res = v >= args[0]; break;
                case 'toBeLessThan': res = v < args[0]; break;
                case 'toBeLessThanOrEqual': res = v <= args[0]; break;
                case 'toContain': res = (typeof v === 'string') ? v.includes(String(args[0])) : (Array.isArray(v) ? v.some(function(x){return deepEqual(x,args[0]);}) : (v && Object.prototype.hasOwnProperty.call(v, args[0]))); break;
                case 'toHaveLength': res = v != null && v.length === args[0]; break;
                case 'toHaveProperty': {
                  if (v == null) res = false;
                  else {
                    var parts = Array.isArray(args[0]) ? args[0] : String(args[0]).split('.');
                    var cur = v;
                    for (var k = 0; k < parts.length; k++) { if (cur == null || typeof cur !== 'object') { cur = undefined; break; } cur = cur[parts[k]]; }
                    res = args.length > 1 ? deepEqual(cur, args[1]) : cur !== undefined;
                  }
                  break;
                }
                case 'toMatch': res = v != null && (args[0] instanceof RegExp ? args[0].test(String(v)) : String(v).includes(String(args[0]))); break;
                case 'toBeInstanceOf': res = v instanceof args[0]; break;
                case 'toHaveBeenCalled': res = isMock(v) && v.mock.calls.length > 0; break;
                case 'toHaveBeenCalledTimes': res = isMock(v) && v.mock.calls.length === args[0]; break;
                case 'toHaveBeenCalledWith': {
                  if (!isMock(v)) res = false;
                  else res = v.mock.calls.some(function(call){ if (call.length !== args.length) return false; for (var ii=0; ii<args.length; ii++){ if (!deepEqual(call[ii], args[ii])) return false; } return true; });
                  break;
                }
                default: res = false;
              }
              if (res) throw new Error('expected NOT ' + name);
            };
            applyCheck(val);
          };
        }

        if (isPromise) {
          proxy.resolves = makePromiseMatchers(actual, false);
          proxy.rejects = makePromiseMatchers(actual, true);
        }
        return proxy;
      }

      function makePromiseMatchers(promise, expectReject) {
        var names = ['toBe','toEqual','toStrictEqual','toBeTruthy','toBeFalsy','toBeNull','toBeUndefined','toBeNaN','toBeGreaterThan','toBeLessThan','toContain','toHaveLength','toThrow','toBeInstanceOf','toMatch'];
        var proxy = {};
        for (var i = 0; i < names.length; i++) {
          (function(name) {
            proxy[name] = function() {
              var args = Array.prototype.slice.call(arguments);
              return promise.then(
                function(val) {
                  if (expectReject) throw new Error('expected promise to reject but it resolved with ' + serialize(val));
                  // run matcher on resolved value
                  runMatcherOnValue(name, val, args, false);
                },
                function(err) {
                  if (!expectReject) throw err;
                  var errVal = err instanceof Error ? err : (err && err.message ? err.message : err);
                  var asFn = function() { throw err; };
                  runMatcherOnValue(name, errVal, args, false, asFn);
                }
              );
            };
          })(names[i]);
        }
        return proxy;
      }

      function runMatcherOnValue(name, val, args, isNot, asFn) {
        var res;
        switch (name) {
          case 'toBe': res = val === args[0]; break;
          case 'toEqual': case 'toStrictEqual': case 'toMatchObject': res = deepEqual(val, args[0]); break;
          case 'toBeTruthy': res = !!val; break;
          case 'toBeFalsy': res = !val; break;
          case 'toBeNull': res = val === null; break;
          case 'toBeUndefined': res = val === undefined; break;
          case 'toBeNaN': res = Number.isNaN(val); break;
          case 'toBeGreaterThan': res = val > args[0]; break;
          case 'toBeLessThan': res = val < args[0]; break;
          case 'toContain': res = val != null && (typeof val === 'string' ? val.includes(String(args[0])) : (Array.isArray(val) ? val.some(function(x){return deepEqual(x,args[0]);}) : Object.prototype.hasOwnProperty.call(val, args[0]))); break;
          case 'toHaveLength': res = val != null && val.length === args[0]; break;
          case 'toBeInstanceOf': res = val instanceof args[0]; break;
          case 'toMatch': res = val != null && (args[0] instanceof RegExp ? args[0].test(String(val)) : String(val).includes(String(args[0]))); break;
          case 'toThrow': {
            var threw = false, errMsg = '';
            try { if (asFn) asFn(); else if (typeof val === 'function') val(); } catch (er) { threw = true; errMsg = er && er.message ? er.message : String(er); }
            res = threw;
            if (res && args[0] !== undefined) {
              var p = args[0];
              if (p instanceof RegExp) res = p.test(errMsg);
              else if (typeof p === 'string') res = errMsg.includes(p);
              else if (p && p.message) res = errMsg.includes(p.message);
            }
            break;
          }
          default: res = false;
        }
        if (!res) throw new Error('matcher ' + name + ' failed for ' + serialize(val));
      }

      function expect(actual) {
        var isPromise = actual && typeof actual.then === 'function';
        return makeMatchers(actual, false, isPromise);
      }

      // ===== test registry =====
      var testQueue = [];

      function test(name, fn) {
        testQueue.push({ name: currentDescribe ? (currentDescribe + ' ' + name) : name, fn: fn });
      }
      function it(name, fn) { test(name, fn); }
      function describe(name, fn) {
        var prev = currentDescribe;
        currentDescribe = prev ? prev + ' ' + name : name;
        try { fn(); } finally { currentDescribe = prev; }
      }
      function beforeEach(fn) { beforeEachHooks.push(fn); }
      function afterEach(fn) { afterEachHooks.push(fn); }
      function beforeAll(fn) { /* best-effort: run immediately */ try { fn(); } catch(e){} }
      function afterAll(fn) { /* no-op */ }

      // ===== execute user code (in isolated IIFE to prevent hoisting collisions) =====
      try {
        (function() {
          /*__USER_CODE__*/
          /*__EXPORTS_ASSIGN__*/
        })();
      } catch(e) {
        return Promise.resolve([{ name: "Оценка кода", passed: false, message: "Ошибка в коде: " + (e.message || String(e)) }]);
      }

      /*__EXPORTS_INJECT__*/

      // ===== execute test registration =====
      try {
        /*__TEST_CODE__*/
      } catch(e) {
        return Promise.resolve([{ name: "Запуск тестов", passed: false, message: "Ошибка в тестах: " + (e.message || String(e)) }]);
      }

      // ===== run tests sequentially, awaiting async =====
      function runHooks(hooks) {
        return hooks.reduce(function(p, hook) {
          return p.then(function() { var r = hook(); return r && r.then ? r : Promise.resolve(); });
        }, Promise.resolve());
      }

      return testQueue.reduce(function(chain, t) {
        return chain.then(function() {
          return runHooks(beforeEachHooks).then(function() {
            var r;
            try { r = t.fn(); } catch (e) {
              return runHooks(afterEachHooks).then(function() {
                results.push({ name: t.name, passed: false, message: e.message || String(e) });
              });
            }
            var p = (r && typeof r.then === 'function') ? r : Promise.resolve();
            return p.then(function() {
              return runHooks(afterEachHooks).then(function() {
                results.push({ name: t.name, passed: true });
              });
            }, function(e) {
              return runHooks(afterEachHooks).then(function() {
                results.push({ name: t.name, passed: false, message: (e && e.message) ? e.message : String(e) });
              });
            });
          });
        });
      }, Promise.resolve()).then(function() { return results; });
    })()
  `;

  // Names reserved by the sandbox API — must not be overwritten by user exports
  const RESERVED = new Set([
    "test", "it", "expect", "describe", "vi", "beforeEach", "afterEach",
    "beforeAll", "afterAll",
  ]);
  const safeExports = exportNames.filter((n) => !RESERVED.has(n));

  const exportsAssign = safeExports
    .map(function (n) {
      return "exports." + n + ' = typeof ' + n + ' !== "undefined" ? ' + n + " : undefined;";
    })
    .join("\n        ");
  const exportsInject = safeExports
    .map(function (n) {
      return "var " + n + " = exports." + n + ";";
    })
    .join("\n      ");

  return script
    .replace("/*__USER_CODE__*/", userCode)
    .replace("/*__EXPORTS_ASSIGN__*/", exportsAssign)
    .replace("/*__EXPORTS_INJECT__*/", exportsInject)
    .replace("/*__TEST_CODE__*/", testCode);
}

async function executeSandbox(script: string): Promise<SandboxResult[]> {
  try {
    const fn = new Function("return " + script) as () => Promise<unknown>;
    const result = await fn();
    if (Array.isArray(result)) {
      return result as SandboxResult[];
    }
    return [{ name: "Неизвестная ошибка", passed: false, message: "Результат не массив" }];
  } catch (e: unknown) {
    const msg = (e as Error).message || String(e);
    return [{ name: "Ошибка выполнения", passed: false, message: msg }];
  }
}
