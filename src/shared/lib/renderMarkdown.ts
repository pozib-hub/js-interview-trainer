/**
 * Минимальный markdown-рендер для условий задач и ответов на вопросы.
 * Поддерживает заголовки, блоки кода, инлайн-код, жирный текст и параграфы.
 *
 * @param md — строка с markdown-разметкой
 * @returns HTML-строка
 */
export function renderMarkdown(md: string): string {
  let html = md;
  // экранируем HTML
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // блоки кода вырезаем в плейсхолдеры, чтобы преобразования ниже
  // (заголовки, жирный) не трогали их содержимое — иначе `# comment`
  // внутри кода превращается в заголовок
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    codeBlocks.push(`<pre><code>${code.replace(/\n$/, "")}</code></pre>`);
    return `<!--CODEBLOCK${codeBlocks.length - 1}-->`;
  });
  // инлайн-код
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // заголовки
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // жирный
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // параграфы / переносы
  html = html
    .split(/\n\n+/)
    .map((block) => (block.startsWith("<") ? block : `<p>${block.replace(/\n/g, "<br>")}</p>`))
    .join("\n");
  // возвращаем блоки кода
  html = html.replace(/<!--CODEBLOCK(\d+)-->/g, (_m, i) => codeBlocks[Number(i)]);
  return html;
}
