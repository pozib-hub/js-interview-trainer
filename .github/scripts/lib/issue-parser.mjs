// Parse a GitHub Issue body (free-form, simplified template) into structured
// input for the LLM. Sections are `## <Header>` markdown headers; bodies are
// everything until the next header or EOF. HTML comments are stripped.
//
// The user is NOT required to fill category/difficulty/tags/slug — those are
// determined by the LLM from project context.

const SECTIONS = ["URL источника", "Описание задачи", "Решение (необязательно)", "Дополнительные заметки"];

function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

function extractSection(body, header) {
  const re = new RegExp(`^##\\s+${escapeReg(header)}\\s*$`, "m");
  const m = body.match(re);
  if (!m) return "";
  const start = m.index + m[0].length;
  const rest = body.slice(start);
  const nextHeader = rest.search(/^##\s+/m);
  const sectionBody = nextHeader === -1 ? rest : rest.slice(0, nextHeader);
  return stripHtmlComments(sectionBody).trim();
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} body
 * @param {string} [title]
 * @returns {{
 *   title: string,
 *   sourceUrl: string,
 *   description: string,
 *   userSolution: string,
 *   notes: string,
 *   rawBody: string,
 * }}
 */
export function parseIssueBody(body, title = "") {
  const sourceUrl = extractSection(body, "URL источника");
  const description = extractSection(body, "Описание задачи");
  const userSolution = extractSection(body, "Решение (необязательно)");
  const notes = extractSection(body, "Дополнительные заметки");

  return {
    title: title.replace(/^\[TASK\]\s*/i, "").trim() || title.trim(),
    sourceUrl: sourceUrl.trim(),
    description: description.trim(),
    userSolution: userSolution.trim(),
    notes: notes.trim(),
    rawBody: body,
  };
}

/**
 * Validate the parsed issue has the minimum required data.
 * Returns an array of human-readable error strings (empty = ok).
 */
export function validateParsedIssue(parsed) {
  const errors = [];
  if (!parsed.description && !parsed.sourceUrl) {
    errors.push(
      "Не заполнено «Описание задачи» и не указан URL источника. Укажите хотя бы одно.",
    );
  }
  if (parsed.sourceUrl) {
    try {
      const u = new URL(parsed.sourceUrl);
      if (!u.protocol.startsWith("http")) throw new Error("bad protocol");
    } catch {
      errors.push(`Некорректный URL источника: ${parsed.sourceUrl}`);
    }
  }
  return errors;
}
