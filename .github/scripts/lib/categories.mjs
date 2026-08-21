// Dynamically discover task categories (topics) by scanning tasks/.
// Replaces the hardcoded ALLOWED_TOPICS list — categories now always match
// the real state of the repository.

import fs from "fs";
import path from "path";

/**
 * @param {string} tasksRoot  absolute path to tasks/
 * @returns {string[]}  sorted list of topic directory names
 */
export function discoverCategories(tasksRoot) {
  const topics = new Set();
  if (!fs.existsSync(tasksRoot)) return [];
  for (const entry of fs.readdirSync(tasksRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    topics.add(entry.name);
  }
  return [...topics].sort();
}

/**
 * Describe a category with its current task count + a couple of example slugs,
 * so the LLM can make an informed choice.
 * @returns {Array<{ name: string, count: number, examples: string[] }>}
 */
export function describeCategories(tasksRoot) {
  const cats = discoverCategories(tasksRoot);
  return cats.map((name) => {
    const dir = path.join(tasksRoot, name);
    let count = 0;
    const examples = [];
    if (fs.existsSync(dir)) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        count++;
        if (examples.length < 3) examples.push(entry.name);
      }
    }
    return { name, count, examples };
  });
}

/**
 * Read short descriptions of existing tasks for each category from their
 * meta.json titles, to give the LLM better grounding for category selection.
 * @returns {Record<string, string[]>}  topic -> array of task titles
 */
export function categorySampleTitles(tasksRoot, perCategory = 4) {
  const result = {};
  for (const cat of discoverCategories(tasksRoot)) {
    const dir = path.join(tasksRoot, cat);
    const titles = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(dir, entry.name, "meta.json"), "utf8"));
        if (meta?.title) titles.push(`${entry.name}: ${meta.title}`);
      } catch {}
      if (titles.length >= perCategory) break;
    }
    result[cat] = titles;
  }
  return result;
}
