const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? base + input : input;
  return fetch(url, init);
}
