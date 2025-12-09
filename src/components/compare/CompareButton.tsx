'use client'

import React from 'react'
import { useCompare } from './CompareDrawerProvider'

export default function CompareButton({ productId, className = '' }: { productId: string; className?: string }) {
  const { has, toggle, openCompare, count, max } = useCompare()
  const inCompare = has(productId)

  return (
    <button
      type="button"
      onClick={() => {
        toggle(productId)
        // If first item was added, open the drawer to make it visible
        setTimeout(() => {
          if (!inCompare && count + 1 > 0) openCompare()
        }, 0)
      }}
      className={`inline-flex items-center justify-center rounded-xl border px-3 py-1.5 text-sm ${
        inCompare ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
      } ${className}`}
      aria-pressed={inCompare}
      aria-label={inCompare ? 'Видалити з порівняння' : 'Додати до порівняння'}
      disabled={!inCompare && count >= max}
    >
      {inCompare ? 'У порівнянні' : 'Додати до порівняння'}
    </button>
  )
}
