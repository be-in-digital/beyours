/**
 * Convertit du markdown en Portable Text (blocks Sanity).
 *
 * On supporte le sous-ensemble exact utilisé dans les MDX existants :
 *   - heading h2 / h3
 *   - paragraph
 *   - blockquote
 *   - bullet list (- foo)
 *   - ordered list (1. foo)
 *   - inline marks : strong (**), em (*), code (`), link [text](url)
 *
 * Pas de support pour : headings h1/h4-h6, code blocks ```, images, tables,
 * footnotes. Si on en ajoute aux MDX, il faudra étendre la function.
 */
import remarkParse from "remark-parse";
import { unified } from "unified";

import type {
  Blockquote,
  Code,
  Emphasis,
  Heading,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Strong,
  Text,
} from "mdast";

type PTSpan = {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
};

type PTMarkDef = {
  _type: "link";
  _key: string;
  href: string;
};

type PTBlock = {
  _type: "block";
  _key: string;
  style: "normal" | "h2" | "h3" | "blockquote";
  listItem?: "bullet" | "number";
  level?: number;
  children: PTSpan[];
  markDefs: PTMarkDef[];
};

let keyCounter = 0;
const newKey = () => `k${(++keyCounter).toString(36)}`;

function flattenInline(
  nodes: PhrasingContent[],
  activeMarks: string[],
  markDefs: PTMarkDef[],
): PTSpan[] {
  const spans: PTSpan[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      spans.push({
        _type: "span",
        _key: newKey(),
        text: (node as Text).value,
        marks: [...activeMarks],
      });
    } else if (node.type === "strong") {
      spans.push(
        ...flattenInline(
          (node as Strong).children,
          [...activeMarks, "strong"],
          markDefs,
        ),
      );
    } else if (node.type === "emphasis") {
      spans.push(
        ...flattenInline(
          (node as Emphasis).children,
          [...activeMarks, "em"],
          markDefs,
        ),
      );
    } else if (node.type === "inlineCode") {
      spans.push({
        _type: "span",
        _key: newKey(),
        text: (node as InlineCode).value,
        marks: [...activeMarks, "code"],
      });
    } else if (node.type === "link") {
      const linkNode = node as Link;
      const markDef: PTMarkDef = {
        _type: "link",
        _key: newKey(),
        href: linkNode.url,
      };
      markDefs.push(markDef);
      spans.push(
        ...flattenInline(
          linkNode.children,
          [...activeMarks, markDef._key],
          markDefs,
        ),
      );
    } else if (node.type === "break") {
      spans.push({
        _type: "span",
        _key: newKey(),
        text: "\n",
        marks: [...activeMarks],
      });
    } else {
      // Unhandled inline type — fall back to its concatenated text content.
      const txt = (node as { value?: string }).value ?? "";
      if (txt) {
        spans.push({
          _type: "span",
          _key: newKey(),
          text: txt,
          marks: [...activeMarks],
        });
      }
    }
  }

  return spans;
}

function blockFromParagraph(node: Paragraph, style: PTBlock["style"]): PTBlock {
  const markDefs: PTMarkDef[] = [];
  const children = flattenInline(node.children, [], markDefs);
  return {
    _type: "block",
    _key: newKey(),
    style,
    children,
    markDefs,
  };
}

function blocksFromBlockquote(node: Blockquote): PTBlock[] {
  const out: PTBlock[] = [];
  for (const child of node.children) {
    if (child.type === "paragraph") {
      out.push(blockFromParagraph(child as Paragraph, "blockquote"));
    }
  }
  return out;
}

function blocksFromList(node: List): PTBlock[] {
  const listItem = node.ordered ? "number" : "bullet";
  const out: PTBlock[] = [];
  for (const item of node.children as ListItem[]) {
    for (const child of item.children) {
      if (child.type === "paragraph") {
        const block = blockFromParagraph(child as Paragraph, "normal");
        block.listItem = listItem;
        block.level = 1;
        out.push(block);
      }
    }
  }
  return out;
}

function blocksFromHeading(node: Heading): PTBlock[] {
  if (node.depth === 2) {
    return [blockFromParagraph(node as unknown as Paragraph, "h2")];
  }
  if (node.depth === 3) {
    return [blockFromParagraph(node as unknown as Paragraph, "h3")];
  }
  // Fallback : on ne supporte pas h1/h4+ — on rend en paragraphe.
  return [blockFromParagraph(node as unknown as Paragraph, "normal")];
}

export function markdownToPortableText(markdown: string): PTBlock[] {
  // Reset key counter per document for stable keys.
  keyCounter = 0;
  const tree = unified().use(remarkParse).parse(markdown) as Root;
  const blocks: PTBlock[] = [];
  for (const node of tree.children as RootContent[]) {
    if (node.type === "heading") {
      blocks.push(...blocksFromHeading(node as Heading));
    } else if (node.type === "paragraph") {
      blocks.push(blockFromParagraph(node as Paragraph, "normal"));
    } else if (node.type === "blockquote") {
      blocks.push(...blocksFromBlockquote(node as Blockquote));
    } else if (node.type === "list") {
      blocks.push(...blocksFromList(node as List));
    } else if (node.type === "code") {
      // Code blocks aren't allowed by the schema decorators (only inline code).
      // Render the code as a normal paragraph with the `code` mark.
      const value = (node as Code).value;
      blocks.push({
        _type: "block",
        _key: newKey(),
        style: "normal",
        children: [
          {
            _type: "span",
            _key: newKey(),
            text: value,
            marks: ["code"],
          },
        ],
        markDefs: [],
      });
    }
    // thematicBreak (---) and other types : ignored.
  }
  return blocks;
}
