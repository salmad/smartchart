/**
 * Markdown Message Renderer for ChatPanel
 * Renders markdown with syntax highlighting for code blocks
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github-dark.css';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export function MarkdownMessage({ content, className = '' }: MarkdownMessageProps) {
  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          // Customize code blocks
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 bg-slate-100 text-purple-700 rounded font-mono text-xs"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code className={`${className} text-xs`} {...props}>
                {children}
              </code>
            );
          },
          // Customize pre blocks (code block container)
          pre: ({ children }) => (
            <pre className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-700 shadow-lg my-3">
              {children}
            </pre>
          ),
          // Customize links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-700 underline decoration-purple-300 hover:decoration-purple-500 transition-colors"
            >
              {children}
            </a>
          ),
          // Customize lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
          ),
          // Customize headings
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 text-slate-900">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-3 mb-2 text-slate-900">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-2 mb-1 text-slate-900">{children}</h3>
          ),
          // Customize paragraphs
          p: ({ children }) => <p className="my-2 leading-relaxed text-slate-700">{children}</p>,
          // Customize blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-purple-300 pl-4 italic text-slate-600 my-3">
              {children}
            </blockquote>
          ),
          // Customize tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 bg-slate-50 text-left text-xs font-semibold text-slate-900 border-b border-slate-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-xs text-slate-700 border-b border-slate-100">
              {children}
            </td>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
