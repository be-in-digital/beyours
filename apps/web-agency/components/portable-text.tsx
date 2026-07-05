import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { TypedObject } from "@portabletext/types";

/**
 * Rendu Portable Text — équivaut à mdx-components.tsx mais pour le contenu
 * Sanity (article body des case studies, paragraphes home approach, etc.).
 *
 * Tous les styles correspondent à ceux du design system :
 *   h2/h3 font-display, paragraphes muted-foreground leading-relaxed,
 *   blockquote bordure mint, listes avec tiret mint.
 */
const components: PortableTextComponents = {
  block: {
    h2: ({ children }) => (
      <h2 className="font-display text-foreground mt-16 mb-6 text-3xl leading-tight font-light tracking-tight sm:text-4xl">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-display text-foreground mt-12 mb-4 text-2xl leading-snug font-light">
        {children}
      </h3>
    ),
    normal: ({ children }) => (
      <p className="text-muted-foreground mt-5 text-base leading-relaxed sm:text-lg">
        {children}
      </p>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-primary text-foreground/85 font-display my-10 border-l-2 pl-6 text-xl leading-relaxed italic sm:text-2xl">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="text-muted-foreground mt-5 space-y-3 text-base leading-relaxed sm:text-lg">
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol className="text-muted-foreground mt-5 list-decimal space-y-3 pl-6 text-base leading-relaxed sm:text-lg">
        {children}
      </ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => (
      <li className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-primary mt-3 inline-block h-px w-3 flex-shrink-0"
        />
        <span>{children}</span>
      </li>
    ),
    number: ({ children }) => <li>{children}</li>,
  },
  marks: {
    strong: ({ children }) => (
      <strong className="text-foreground font-medium">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="text-foreground italic">{children}</em>
    ),
    code: ({ children }) => (
      <code className="bg-surface-2 text-foreground rounded px-1.5 py-0.5 font-mono text-[0.9em]">
        {children}
      </code>
    ),
    link: ({ children, value }) => {
      const href = (value as { href?: string } | undefined)?.href ?? "#";
      const isExternal = /^https?:\/\//.test(href);
      return (
        <a
          href={href}
          {...(isExternal
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          className="text-primary hover:text-foreground underline-offset-4 transition-colors hover:underline"
          data-magnetic
        >
          {children}
        </a>
      );
    },
  },
};

export function PortableTextBody({ value }: { value: TypedObject[] }) {
  return <PortableText value={value} components={components} />;
}
