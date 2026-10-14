import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownDocument from "../src/components/MarkdownDocument.js";

const render = (content) => renderToStaticMarkup(createElement(MarkdownDocument, { content }));

test("README preview renders headings, lists, emphasis, code, and GFM tables", () => {
  const html = render('# My project\n\n**Useful** and `simple`.\n\n- First step\n- Next step\n\n```bash\npip install demo\n```\n\n| Name | Status |\n| --- | --- |\n| CLI | Ready |\n\n- [x] Shipped\n\n> A note\n');
  for (const expected of ['<h1>My project</h1>', '<strong>Useful</strong>', '<code>simple</code>', '<li>First step</li>', '<pre><code class="language-bash">', '<table>', '<th>Name</th>', 'type="checkbox"', '<blockquote>']) {
    assert.ok(html.includes(expected), `Missing ${expected}`);
  }
});

test("generated Markdown cannot execute raw HTML or unsafe links", () => {
  const html = render('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[unsafe](javascript:alert%281%29)\n\n[docs](https://example.com/docs)');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('onerror'));
  assert.ok(html.includes('href="https://example.com/docs"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});

test("preview images become links without loading external content", () => {
  const html = render('![Architecture](https://example.com/tracking.png)');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('href="https://example.com/tracking.png"'));
  assert.ok(html.includes('Architecture'));
});
