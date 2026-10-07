import { memo, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { cn, copyText } from '@/lib/utils'
import { IconCopy } from '@/components/icons'
import { SuccessCheck } from '@/components/success-check'

/** 代码块：右上角带复制按钮 */
function CodeBlock({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const pre = e.currentTarget.parentElement?.querySelector('code')
    const text = pre?.textContent ?? ''
    if (await copyText(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="group/code relative">
      <pre className={className} {...props}>
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        title="复制代码"
        className={cn(
          'absolute right-2 top-2 rounded-[6px] border border-border/70 bg-background/80 p-1.5 text-muted-foreground',
          'opacity-0 transition-opacity group-hover/code:opacity-100 hover:text-foreground',
          '[@media(hover:none)]:opacity-100',
        )}
      >
        {copied ? (
          <SuccessCheck className="text-primary" size={14} />
        ) : (
          <IconCopy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}

const components: Components = {
  pre: ({ children, ...props }) => <CodeBlock {...props}>{children}</CodeBlock>,
  a: ({ children, ...props }) => (
    <a target="_blank" rel="noreferrer noopener" {...props}>
      {children}
    </a>
  ),
}

/**
 * Markdown 渲染（GFM + 代码高亮）。
 * 流式输出时每帧都会重渲染，所以用 memo 并把内容作为唯一依赖。
 */
export const Markdown = memo(function Markdown({
  content,
  className,
  streaming,
}: {
  content: string
  className?: string
  streaming?: boolean
}) {
  return (
    <div className={cn('md-body', streaming && 'stream-cursor', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
