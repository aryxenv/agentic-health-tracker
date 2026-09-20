import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content, className = "" }) => {
  return (
    <div className={`markdown-body text-white leading-[1.6] ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-[1.6]">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-white/90">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-2.5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-2.5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="leading-[1.6]">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="pl-3 border-l-2 border-[rgba(255,255,255,0.3)] text-white/70 italic my-2">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }: any) => {
            const isInline = !className && typeof children === "string" && !children.includes("\n");
            if (isInline) {
              return (
                <code className="font-mono text-[0.855rem] px-1 py-0.5 rounded-[3px] bg-white/[0.08] text-white border border-[rgba(255,255,255,0.15)]">
                  {children}
                </code>
              );
            }
            return (
              <pre className="font-mono text-[0.855rem] p-3 rounded-[5px] bg-transparent border border-[rgba(255,255,255,0.2)] overflow-x-auto my-2 text-white/90">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-[5px] border border-[rgba(255,255,255,0.2)]">
              <table className="w-full text-left text-[0.855rem] border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-[rgba(255,255,255,0.2)] bg-white/[0.03]">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-[rgba(255,255,255,0.1)]">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-white/[0.03] transition-colors duration-150">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="py-2 px-3 text-white/60 font-medium text-[0.76rem] uppercase tracking-wider whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="py-2 px-3 text-white/90 align-top">
              {children}
            </td>
          ),
          h1: ({ children }) => <h1 className="text-[1.25rem] font-bold text-white my-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-[1.1rem] font-bold text-white my-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[0.98rem] font-bold text-white my-1.5">{children}</h3>,
          hr: () => <hr className="border-t border-[rgba(255,255,255,0.15)] my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
