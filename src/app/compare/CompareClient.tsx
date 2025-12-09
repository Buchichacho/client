'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Header from '@/components/layout/Header'
import SiteFooter from '@/components/layout/SiteFooter'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { useCompare } from '@/components/compare/CompareDrawerProvider'

type AnyRecord = Record<string, any>
type EnrichedProduct = { id: string; product?: AnyRecord | null; imageUrl?: string | null }

export default function CompareClient({ initialIds }: { initialIds?: string }) {
  const { ids: stateIds, add, max } = useCompare()
  const [ids, setIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<EnrichedProduct[]>([])
  const [showDiffOnly, setShowDiffOnly] = useState(false)
  const [featureQuery, setFeatureQuery] = useState('')
  const [highlightKey, setHighlightKey] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const [colWidth, setColWidth] = useState<number>(280)
  const [compact, setCompact] = useState(false)

  // Merge URL ids (from server) with state ids on mount
  useEffect(() => {
    const fromUrl = (initialIds || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    const merged = Array.from(new Set([...fromUrl, ...stateIds])).slice(0, max)
    setIds(merged)
    // also reflect into state (so drawer shows the same selection)
    for (const id of merged) add(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch products + media
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (ids.length === 0) { setItems([]); return }
      setLoading(true)
      try {
        const enriched: EnrichedProduct[] = await Promise.all(
          ids.map(async (id) => {
            try {
              const [pRes, mRes] = await Promise.all([
                fetch(`https://api.sellpoint.pp.ua/api/Product/get-by-id/${id}`, { cache: 'no-store' }),
                fetch(`https://api.sellpoint.pp.ua/api/ProductMedia/by-product-id/${id}`, { cache: 'no-store' }),
              ])
              const product = pRes.ok ? await pRes.json() : null
              let imageUrl: string | null = null
              if (mRes.ok) {
                const media: any[] = await mRes.json()
                const first = (Array.isArray(media) ? media : []).sort((a, b) => (a?.order || 0) - (b?.order || 0))[0]
                imageUrl = first?.files?.compressedUrl || first?.files?.sourceUrl || null
              }
              return { id, product, imageUrl }
            } catch {
              return { id }
            }
          })
        )
        if (!cancelled) setItems(enriched)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [ids])

  // Compute dynamic column width so up to 4 products fill available space nicely
  useEffect(() => {
    const compute = () => {
      if (!scrollerRef.current) return
      const el = scrollerRef.current
      const total = el.clientWidth || 0
      if (!total) return
      const FIRST_COL = 256 // w-64
      const PADDING = 16
      const cols = Math.max(1, Math.min(4, items.length || 1))
      const raw = Math.floor((total - FIRST_COL - PADDING) / cols)
      const clamped = Math.max(220, Math.min(360, raw))
      setColWidth(clamped)
    }
    // Run initially and on resize
    compute()
    let ro: ResizeObserver | null = null
    try {
      ro = new ResizeObserver(() => compute())
      if (scrollerRef.current) ro.observe(scrollerRef.current)
    } catch {}
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('resize', compute)
      if (ro && scrollerRef.current) ro.disconnect()
    }
  }, [items.length])

  // Build spec matrix: base + flattened features
  const matrix = useMemo(() => {
    const rows: { key: string; label: string; group?: string; values: Map<string, string> }[] = []
    const rowMap = new Map<string, number>()
    const ensureRow = (group: string | undefined, label: string, key: string) => {
      const compound = `${group || 'Основне'}::${key}`
      if (!rowMap.has(compound)) {
        rowMap.set(compound, rows.length)
        rows.push({ key: compound, label, group, values: new Map() })
      }
      return rowMap.get(compound)!
    }

    const baseDefs: { label: string; key: string; value: (p: AnyRecord) => string }[] = [
      { label: 'Ціна', key: 'price', value: (p) => String(Math.round(p?.finalPrice ?? p?.discountPrice ?? p?.price ?? 0) || '—') },
      { label: 'Знижка', key: 'discount', value: (p) => p?.hasDiscount ? `${Math.round(p?.discountPercentage ?? 0)}%` : '—' },
      { label: 'Наявність', key: 'availability', value: (p) => {
        const qs = p?.quantityStatus
        if (qs === 3) return 'Немає в наявності'
        if (qs === 2) return 'Закінчується'
        return 'В наявності'
      } },
    ]

    for (const ep of items) {
      const p = ep.product || {}
      const pid = String(p?.id || ep.id)
      for (const def of baseDefs) {
        const idx = ensureRow('Основне', def.label, def.key)
        rows[idx].values.set(pid, def.value(p))
      }
    }

    for (const ep of items) {
      const p = ep.product || {}
      const pid = String(p?.id || ep.id)
      const groups = Array.isArray(p?.features) ? p.features : []
      for (const g of groups) {
        const groupName = typeof g?.category === 'string' ? g.category : 'Характеристики'
        const feats = g?.features && typeof g.features === 'object' ? (g.features as AnyRecord) : {}
        for (const rawKey of Object.keys(feats)) {
          const f = feats[rawKey]
          const label = rawKey
          const display = f && typeof f === 'object' && 'value' in f ? String((f as AnyRecord).value ?? '—') : '—'
          const idx = ensureRow(groupName, label, `${groupName}:${label}`)
          rows[idx].values.set(pid, display)
        }
      }
    }

    const filtered = showDiffOnly
      ? rows.filter((r) => {
          const vals = ids.map((id) => r.values.get(String(id)) ?? '—')
          return vals.some((v, i, arr) => v !== arr[0])
        })
      : rows

    const byGroup = new Map<string, { group: string; items: typeof filtered }>()
    for (const r of filtered) {
      const g = r.group || 'Основне'
      if (!byGroup.has(g)) byGroup.set(g, { group: g, items: [] as any })
      ;(byGroup.get(g)!.items as any).push(r)
    }
    return { groups: Array.from(byGroup.values()) }
  }, [items, showDiffOnly, ids])

  const handleFindFeature = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const q = featureQuery.trim().toLowerCase()
    if (!q) return
    for (const group of matrix.groups) {
      for (const r of group.items) {
        const label = r.label.toLowerCase()
        const grp = (r.group || '').toLowerCase()
        if (label.includes(q) || grp.includes(q)) {
          setHighlightKey(r.key)
          const tr = rowRefs.current.get(r.key)
          const scroller = scrollerRef.current
          if (tr && scroller) {
            const trRect = tr.getBoundingClientRect()
            const scRect = scroller.getBoundingClientRect()
            const current = scroller.scrollTop
            const deltaTop = trRect.top - scRect.top
            const centerOffset = (scroller.clientHeight / 2) - (tr.clientHeight / 2)
            let target = current + deltaTop - centerOffset
            const max = scroller.scrollHeight - scroller.clientHeight
            if (target < 0) target = 0
            if (target > max) target = max
            scroller.scrollTo({ top: target, behavior: 'smooth' })
          }
          setTimeout(() => setHighlightKey(null), 1200)
          return
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-[1500px] px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Порівняння товарів</h1>

        {ids.length < 2 && (
          <div className="mb-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">Додайте принаймні 2 товари для порівняння.</div>
        )}

        {/* Toolbar */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showDiffOnly}
                onChange={(e) => setShowDiffOnly(e.target.checked)}
              />
              Показати відмінності
            </label>
          </div>
          <form onSubmit={handleFindFeature} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Знайти характеристику…"
              value={featureQuery}
              onChange={(e) => setFeatureQuery(e.target.value)}
              className="w-[280px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4563d1]/30 focus:border-[#4563d1]"
            />
            <button type="submit" className="rounded-lg bg-[#4563d1] px-3 py-2 text-sm text-white hover:bg-[#364ea8]">Знайти</button>
          </form>
        </div>

        {/* Table */}
        <div ref={scrollerRef} className="overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm max-h-[70vh]">
          {/* Sticky product header */}
          <table className="w-auto text-sm">
            <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur text-left shadow-[0_1px_0_rgba(0,0,0,0.06)]">
              <tr>
                <th className="sticky left-0 z-30 bg-white/95 px-3 py-3 w-64 font-semibold text-gray-700 text-center relative">
                  <button
                    type="button"
                    aria-label={compact ? 'Розгорнути шапку' : 'Згорнути шапку'}
                    onClick={() => setCompact((v) => !v)}
                    className="absolute left-2 top-2 rounded-md p-1.5 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    {compact ? (
                      <ChevronsUpDown className="h-5 w-5" />
                    ) : (
                      <ChevronsDownUp className="h-5 w-5" />
                    )}
                  </button>
                  Характеристика
                </th>
                {items.map((it, idx) => {
                  const p = it.product
                  const price = Math.round(p?.finalPrice ?? p?.discountPrice ?? p?.price ?? 0)
                  const old = p?.hasDiscount && p?.price && p?.price > (p?.finalPrice ?? p?.discountPrice ?? p?.price)
                  return (
                    <th
                      key={it.id}
                      className={`px-5 py-3 align-top ${idx > 0 ? 'border-l border-gray-200' : ''}`}
                      style={{ width: colWidth, maxWidth: colWidth }}
                    >
                      <div className="flex flex-col items-start gap-2">
                        <div className={`relative w-20 overflow-hidden rounded-md border border-gray-200 bg-gray-50 transition-all duration-300 ${compact ? 'h-0 opacity-0 -translate-y-1' : 'h-20 opacity-100 translate-y-0'}`}>
                          {it.imageUrl ? (
                            <Image src={it.imageUrl} alt={p?.name || ''} fill className="object-contain" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/product/${it.id}`} className={`block font-semibold text-gray-900 leading-snug break-words whitespace-normal transition-all duration-300 ${compact ? 'text-sm' : 'text-base'}`}>
                            {p?.name || 'Товар'}
                          </Link>
                          <div className={`text-gray-700 transition-all duration-300 ${compact ? 'max-h-0 opacity-0 -translate-y-1 overflow-hidden' : 'mt-1 max-h-10 opacity-100 translate-y-0'}`}>
                            <span className={`font-bold text-[#E53935] ${compact ? 'text-lg' : 'text-xl'}`}>{price ? `${price} грн` : '—'}</span>
                            {!compact && old && (
                              <span className="ml-2 text-sm text-gray-400 line-through">{Math.round(p!.price)} грн</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {matrix.groups.map((g) => (
                <React.Fragment key={g.group}>
                  <tr>
                    <td colSpan={items.length + 1} className="bg-gray-100 px-3 py-2 font-semibold text-gray-800 sticky left-0 z-10">{g.group}</td>
                  </tr>
                  {g.items.map((r) => (
                    <tr
                      key={r.key}
                      ref={(el) => { if (el) rowRefs.current.set(r.key, el) }}
                      className={`odd:bg-white even:bg-gray-50`}
                    >
                      <td className={`sticky left-0 z-10 bg-inherit px-4 py-3 text-gray-700 font-medium ${highlightKey === r.key ? 'compare-highlight-cell' : ''}`}>
                        <span className={highlightKey === r.key ? 'compare-highlight-text' : ''} style={{ ['--compareBaseColor' as any]: '#374151' }}>
                          {r.label}
                        </span>
                      </td>
                      {items.map((it, idx) => (
                        <td
                          key={it.id}
                          className={`px-5 py-3 text-gray-800 align-top ${idx > 0 ? 'border-l border-gray-200' : ''} break-words whitespace-normal ${highlightKey === r.key ? 'compare-highlight-cell' : ''}`}
                          style={{ width: colWidth, maxWidth: colWidth }}
                        >
                          <span className={highlightKey === r.key ? 'compare-highlight-text' : ''} style={{ ['--compareBaseColor' as any]: '#1f2937' }}>
                            {r.values.get(String(it.product?.id || it.id)) ?? '—'}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="mt-3 text-sm text-gray-600">Завантаження…</div>
        )}
      </main>
      <SiteFooter />
      {/* Highlight animations for compare feature */}
      <style jsx global>{`
        @keyframes compareGlow {
          0% { box-shadow: 0 0 0 2px rgba(69,99,209,0.95) inset, 0 0 14px rgba(69,99,209,0.55); }
          60% { box-shadow: 0 0 0 2px rgba(69,99,209,0.55) inset, 0 0 8px rgba(69,99,209,0.35); }
          100% { box-shadow: 0 0 0 0 rgba(69,99,209,0) inset, 0 0 0 rgba(69,99,209,0); }
        }
        @keyframes compareText {
          0% { color: #4563d1; text-shadow: 0 0 6px rgba(69,99,209,0.45); }
          60% { color: #4563d1; text-shadow: 0 0 4px rgba(69,99,209,0.3); }
          100% { color: var(--compareBaseColor, inherit); text-shadow: none; }
        }
        .compare-highlight-cell { position: relative; border-radius: 6px; animation: compareGlow 1600ms ease both; }
        .compare-highlight-text { animation: compareText 1100ms ease both; }
      `}</style>
    </div>
  )
}
