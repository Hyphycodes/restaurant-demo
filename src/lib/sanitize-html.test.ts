import { describe, expect, it } from 'vitest';
import { htmlToText, sanitizeHtml } from './sanitize-html';

describe('sanitizeHtml', () => {
  it('keeps bold, italic, links and lists', () => {
    expect(sanitizeHtml('<p>Bring <b>a friend</b> and <i>paint</i>.</p><ul><li>Canvas</li></ul>')).toBe(
      '<p>Bring <strong>a friend</strong> and <em>paint</em>.</p><ul><li>Canvas</li></ul>',
    );
  });
  it('drops scripts, styles, images and handlers', () => {
    expect(sanitizeHtml('<p onclick="x()">Hi<script>alert(1)</script><img src=x></p><style>p{}</style>')).toBe('<p>Hi</p>');
  });
  it('keeps only safe hrefs', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">bad</a> <a href="https://example.invalid">good</a>')).toBe(
      'bad <a href="https://example.invalid" rel="noopener">good</a>',
    );
  });
  it('closes what was left open and escapes stray text', () => {
    expect(sanitizeHtml('<p><strong>open 1 < 2')).toBe('<p><strong>open 1 &lt; 2</strong></p>');
  });
  it('turns rich text back into plain paragraphs', () => {
    expect(htmlToText('<p>One</p><p>Two &amp; three</p>')).toBe('One\n\nTwo & three');
  });
});
