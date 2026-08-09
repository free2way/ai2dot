"use client";

import { Check, Copy } from "lucide-react";
import {
  Children,
  isValidElement,
  type ReactNode,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function nodeToText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeToText(node.props.children);
  }
  return "";
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const codeElement = Children.toArray(children).find((child) =>
    isValidElement(child),
  );
  const className = isValidElement<{ className?: string }>(codeElement)
    ? codeElement.props.className
    : undefined;
  const language = className?.match(/language-([\w-]+)/)?.[1] ?? "code";
  const code = nodeToText(children).replace(/\n$/, "");

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language}</span>
        <button onClick={() => void copy()} type="button">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "已复制" : "复制代码"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

export function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children: codeChildren }) => (
          <CodeBlock>{codeChildren}</CodeBlock>
        ),
        a: ({ children: linkChildren, ...props }) => (
          <a {...props} target="_blank" rel="noreferrer noopener">
            {linkChildren}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
