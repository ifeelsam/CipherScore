'use client'

import React from 'react'

type Lang = 'ts' | 'json' | 'bash'

interface CodeBlockProps {
  code: string
  language?: Lang
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlightTS(src: string) {
  let code = escapeHtml(src)
  // Highlight strings, keywords, literals first
  code = code.replace(/(['"]).*?\1/g, '<span style="color:#22d3ee">$&</span>')
  code = code.replace(/\b(const|let|var|import|from|export|async|await|return|new|class|interface|type|extends)\b/g, '<span style="color:#a78bfa">$1</span>')
  code = code.replace(/\b(true|false|null|undefined)\b/g, '<span style="color:#fca5a5">$1</span>')
  code = code.replace(/\b([0-9]+)\b/g, '<span style="color:#fde68a">$1</span>')
  // Finally, wrap comments so we don't re-highlight injected spans
  code = code.replace(/(\/\/.*$)/gm, '<span style="color:#6b7280">$1</span>')
  return code
}

function highlightJSON(src: string) {
  let code = escapeHtml(src)
  code = code.replace(/(\".*?\")(?=\s*:)/g, '<span style="color:#a78bfa">$1</span>')
  code = code.replace(/:\s*(\".*?\")/g, ': <span style="color:#22d3ee">$1</span>')
  code = code.replace(/:\s*([0-9]+\.?[0-9]*)/g, ': <span style="color:#fde68a">$1</span>')
  code = code.replace(/:\s*(true|false|null)/g, ': <span style="color:#fca5a5">$1</span>')
  return code
}

function highlightBash(src: string) {
  let code = escapeHtml(src)
  code = code.replace(/(^|\s)(curl|export|bun|npm|yarn)(?=\s)/g, '<span style="color:#a78bfa">$2</span>')
  code = code.replace(/\s(-{1,2}[a-zA-Z-]+)/g, ' <span style="color:#fca5a5">$1</span>')
  code = code.replace(/(['"]).*?\1/g, '<span style="color:#22d3ee">$&</span>')
  return code
}

function renderHighlighted(code: string, lang?: Lang) {
  switch (lang) {
    case 'ts':
      return highlightTS(code)
    case 'json':
      return highlightJSON(code)
    case 'bash':
      return highlightBash(code)
    default:
      return escapeHtml(code)
  }
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  return (
    <div
      className="mt-3 overflow-x-auto rounded-2xl p-5 text-base"
      style={{ background: '#0F0F0F', border: '1px solid rgba(255,255,255,0.06)', color: '#EDEDED' }}
    >
      <pre className="whitespace-pre-wrap break-words" style={{ margin: 0 }}>
        <code dangerouslySetInnerHTML={{ __html: renderHighlighted(code, language) }} />
      </pre>
    </div>
  )
} 