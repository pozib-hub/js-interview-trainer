export function useCounter(intervalMs: number = 1000) {
  let count = 0;
  let actualCount = 0;
  let isHovered = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function start() {
    intervalId = setInterval(() => {
      actualCount += 1;
      if (!isHovered) {
        count = actualCount;
      }
    }, intervalMs);
  }

  function stop() {
    if (intervalId) clearInterval(intervalId);
  }

  function onMouseEnter() {
    isHovered = true;
  }

  function onMouseLeave() {
    isHovered = false;
    count = actualCount;
  }

  return { count, start, stop, onMouseEnter, onMouseLeave };
}

export function App() {
  return { type: "h1", props: {} };
}
