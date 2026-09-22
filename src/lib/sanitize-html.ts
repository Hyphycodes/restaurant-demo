/**
 * The description's rich text, made safe.
 *
 * Bold, italic, links and lists; nothing more. Anything else — scripts,
 * styles, images, event handlers, unknown tags — is dropped, and a link
 * keeps only an http(s) or mailto href. Deliberately tiny and deliberately
 * an allow-list, so a new HTML feature is off until someone adds it here.
 */

const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'a', 'ul', 'ol', 'li']);
const RENAME: Record<string, string> = { b: 'strong', i: 'em' };

export function sanitizeHtml(input: string): string {
  const out: string[] = [];
  const open: string[] = [];
  const pattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)|(<)/g;
  let match: RegExpExecArray | null;
  let dropDepth = 0;
  while ((match = pattern.exec(input)) !== null) {
    const [whole, rawTag, attrs, text, stray] = match;
    if (stray !== undefined) {
      if (dropDepth === 0) out.push('&lt;');
      continue;
    }
    if (text !== undefined) {
      if (dropDepth === 0) out.push(escapeText(text));
      continue;
    }
    const tag = rawTag!.toLowerCase();
    const closing = whole.startsWith('</');
    if (tag === 'script' || tag === 'style') {
      dropDepth += closing ? -1 : 1;
      if (dropDepth < 0) dropDepth = 0;
      continue;
    }
    if (dropDepth > 0 || !ALLOWED.has(tag)) continue;
    const name = RENAME[tag] ?? tag;
    if (closing) {
      const index = open.lastIndexOf(name);
      if (index === -1) continue;
      while (open.length > index) out.push(`</${open.pop()}>`);
      continue;
    }
    if (name === 'br') {
      out.push('<br>');
      continue;
    }
    if (name === 'a') {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs ?? '');
      const value = (href?.[2] ?? href?.[3] ?? href?.[4] ?? '').trim();
      if (!/^(https?:\/\/|mailto:)/i.test(value)) continue;
      out.push(`<a href="${escapeAttr(value)}" rel="noopener">`);
      open.push('a');
      continue;
    }
    out.push(`<${name}>`);
    open.push(name);
  }
  while (open.length) out.push(`</${open.pop()}>`);
  return out.join('').replace(/<p><\/p>/g, '').trim();
}

/** Plain text from the rich version, for summaries and structured data. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/(li|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeText(value: string): string {
  return value.replace(/&(?!(amp|lt|gt|quot|#39|nbsp);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
