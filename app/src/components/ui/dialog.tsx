'use client'

import * as React from 'react'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
}

export function Dialog({ open, onOpenChange, title, description, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm }: DialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => onOpenChange(false)}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-sm rounded-2xl p-5"
        style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
        {description && <p className="mt-1 text-sm text-white/70">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-full px-4 py-1.5 text-sm font-medium transition hover:-translate-y-[1px]"
            style={{ color: '#00FFFF', border: '1px solid #00FFFF80', background: 'transparent' }}
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </button>
          <button
            className="rounded-full px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:shadow-[0_0_16px_rgba(138,43,226,0.35)] hover:-translate-y-[1px]"
            style={{ background: '#8A2BE2' }}
            onClick={() => { onOpenChange(false); onConfirm?.() }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
} 