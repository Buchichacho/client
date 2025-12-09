'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { X, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCompareState } from '@/hooks/useCompare'

type ProductBrief = {
  id: string
  name: string
  price?: number
  discountPrice?: number
  hasDiscount?: boolean
}

type Enriched = {
  id: string
  product?: ProductBrief
  imageUrl?: string | null
  leafCategoryId?: string | null
  leafCategoryName?: string | null
}

type Ctx = {
  isOpen: boolean
  openCompare: () => void
  closeCompare: () => void
  ids: string[]
  add: (id: string) => void
  remove: (id: string) => void
  toggle: (id: string) => void
  clear: () => void
  has: (id: string) => boolean
  count: number
  max: number
}

const CompareContext = createContext<Ctx | undefined>(undefined)

export function useCompare() {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used within CompareDrawerProvider')
  return ctx
}

export default function CompareDrawerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const state = useCompareState()
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<Enriched[]>([])
  const [allowedLeafId, setAllowedLeafId] = useState<string | null>(null)

  const openCompare = useCallback(() => setIsOpen(true), [])
  const closeCompare = useCallback(() => setIsOpen(false), [])

  // Fetch minimal product info + first media image for drawer thumbnails
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const enriched: Enriched[] = await Promise.all(
          state.ids.map(async (id) => {
            try {
              const [pRes, mRes] = await Promise.all([
                fetch(`https://api.sellpoint.pp.ua/api/Product/get-by-id/${id}`, { cache: 'no-store' }),
                fetch(`https://api.sellpoint.pp.ua/api/ProductMedia/by-product-id/${id}`, { cache: 'no-store' }),
              ])
              const product: any = pRes.ok ? await pRes.json() : null
              let imageUrl: string | null = null
              if (mRes.ok) {
                const media: any[] = await mRes.json()
                const first = (Array.isArray(media) ? media : []).sort((a, b) => (a?.order || 0) - (b?.order || 0))[0]
                imageUrl = first?.files?.compressedUrl || first?.files?.sourceUrl || null
              }
              // Leaf category id and name
              // Use the FIRST element of categoryPath as the deepest (leaf) category per API contract
              const leafCategoryId: string | null = Array.isArray(product?.categoryPath) && product.categoryPath.length > 0
                ? String(product.categoryPath[0])
                : null
              let leafCategoryName: string | null = null
              if (leafCategoryId) {
                try {
                  const cRes = await fetch(`/api/categories/${encodeURIComponent(leafCategoryId)}`, { cache: 'no-store' })
                  if (cRes.ok) {
                    const c = await cRes.json()
                    leafCategoryName = typeof c?.name === 'string' ? c.name : null
                  }
                } catch {}
              }
              return { id, product: product || undefined, imageUrl, leafCategoryId, leafCategoryName }
            } catch {
              return { id }
            }
          })
        )
        if (!cancelled) setItems(enriched)
      } catch {
        if (!cancelled) setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.ids])

  // Track allowed leaf category based on first item
  useEffect(() => {
    const first = items.find((it) => it.product)
    const leaf = first?.leafCategoryId || null
    setAllowedLeafId(leaf)
  }, [items])

  // Lock scroll behavior identical to CartDrawerProvider
  useEffect(() => {
    if (typeof document === 'undefined') return
    const body = document.body
    const prevPosition = body.style.position
    const prevTop = body.style.top
    const prevLeft = body.style.left
    const prevRight = body.style.right
    const prevWidth = body.style.width
    const scrollY = window.scrollY
    if (isOpen) {
      body.classList.add('lock-scroll')
      body.style.top = `-${scrollY}px`
    } else {
      body.classList.remove('lock-scroll')
      body.style.position = prevPosition
      body.style.top = ''
      body.style.left = prevLeft
      body.style.right = prevRight
      body.style.width = prevWidth
      window.scrollTo(0, scrollY)
    }
    return () => {
      body.classList.remove('lock-scroll')
      body.style.position = prevPosition
      body.style.top = ''
      body.style.left = prevLeft
      body.style.right = prevRight
      body.style.width = prevWidth
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCompare()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeCompare])

  // Helper to fetch leaf category id of a product by id
  const fetchLeafCategoryId = useCallback(async (productId: string): Promise<string | null> => {
    try {
      const res = await fetch(`https://api.sellpoint.pp.ua/api/Product/get-by-id/${productId}`, { cache: 'no-store' })
      if (!res.ok) return null
      const p: any = await res.json()
      const path: any[] = Array.isArray(p?.categoryPath) ? p.categoryPath : []
      // Per API, the FIRST element is the leaf-most category id
      return path.length > 0 ? String(path[0]) : null
    } catch {
      return null
    }
  }, [])

  // Enforced add/toggle respecting category constraint
  const addEnforced = useCallback(async (id: string) => {
    if (state.has(id)) return
    const leaf = await fetchLeafCategoryId(id)
    if (!allowedLeafId || !leaf || leaf === allowedLeafId) {
      state.add(id)
      if (!allowedLeafId && leaf) setAllowedLeafId(leaf)
    } else {
      // ignore addition from other categories
    }
  }, [state, allowedLeafId, fetchLeafCategoryId])

  const toggleEnforced = useCallback(async (id: string) => {
    if (state.has(id)) {
      state.toggle(id)
      return
    }
    await addEnforced(id)
  }, [state, addEnforced])

  const clearAll = useCallback(() => {
    state.clear()
    setAllowedLeafId(null)
  }, [state])

  const ctx = useMemo<Ctx>(() => ({
    isOpen,
    openCompare,
    closeCompare,
    ids: state.ids,
    add: (id: string) => { void addEnforced(id) },
    remove: (id: string) => { state.remove(id) },
    toggle: (id: string) => { void toggleEnforced(id) },
    clear: clearAll,
    has: state.has,
    count: state.count,
    max: state.max,
  }), [isOpen, openCompare, closeCompare, state, addEnforced, toggleEnforced, clearAll])

  return (
    <CompareContext.Provider value={ctx}>
      {children}

      {/* Overlay (match CartDrawerProvider) */}
      <div
        aria-hidden
        onClick={closeCompare}
        className={`fixed inset-0 z-[90] bg-gray-700/30 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer (match CartDrawerProvider) */}
      <aside
        role="dialog"
        aria-modal="true"
        className={`fixed right-0 top-0 z-[95] h-full w-[400px] max-w-[92vw] bg-white shadow-2xl rounded-l-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center p-3">
          <h2 className="text-[18px] font-bold text-gray-900">Порівняння</h2>
          <button
            aria-label="Закрити"
            onClick={closeCompare}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Empty state */}
        {state.count === 0 ? (
          <div className="flex h-[calc(100%-52px)] flex-col items-center bg-gray-100 justify-center px-6 text-center text-gray-700">
            <div className="text-[16px] text-gray-700">Додайте товари для порівняння</div>
          </div>
        ) : (
          <div className="flex h-[calc(100%-52px)] flex-col bg-gray-100">
            <div className="mt-2 flex-1 overflow-y-auto px-3 pb-3">
              {items.map((it) => (
                <div key={it.id} className="mb-2 rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                      {it.imageUrl ? (
                        <Image src={it.imageUrl} alt={it.product?.name || ''} fill className="object-contain" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <Link href={`/product/${it.id}`} className="line-clamp-2 text-sm font-medium text-gray-900 hover:underline">
                          {it.product?.name || 'Товар'}
                        </Link>
                        <button
                          onClick={() => state.remove(it.id)}
                          className="ml-auto rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                          aria-label="Видалити з порівняння"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {it.leafCategoryId && (
                        <div className="mt-1 text-xs text-gray-600">
                          Категорія:{' '}
                          <Link href={`/category/${it.leafCategoryId}`} className="text-[#4563d1] hover:underline">
                            {it.leafCategoryName || 'Категорія'}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-white p-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between px-1 text-sm text-gray-700">
                <span>Обрано: {state.count}/{state.max}</span>
                  <button onClick={clearAll} className="text-sm text-gray-600 hover:underline">Очистити</button>
              </div>
              <button
                onClick={() => { closeCompare(); router.push(`/compare?ids=${encodeURIComponent(state.ids.join(','))}`) }}
                className="mt-2 w-full rounded-xl bg-[#4563d1] py-2.5 text-sm text-white hover:bg-[#364ea8] disabled:opacity-50"
                disabled={state.count < 2}
              >
                Порівняти всі
              </button>
            </div>
          </div>
        )}
      </aside>
    </CompareContext.Provider>
  )
}
