import { createElement } from "react";
import PropTypes from "prop-types";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

function DocumentLink({ href, children }) {
  return createElement("a", { href, target: "_blank", rel: "noopener noreferrer" }, children);
}
DocumentLink.propTypes = { href: PropTypes.string, children: PropTypes.node };

// Do not load repository images or tracking pixels while previewing generated text.
function DocumentImage({ src, alt }) {
  return createElement(DocumentLink, { href: src }, alt || "View image");
}
DocumentImage.propTypes = { src: PropTypes.string, alt: PropTypes.string };

const components = { a: DocumentLink, img: DocumentImage };
const plugins = [remarkGfm];

export default function MarkdownDocument({ content }) {
  return createElement(Markdown, { remarkPlugins: plugins, skipHtml: true, components }, content);
}
MarkdownDocument.propTypes = { content: PropTypes.string.isRequired };
