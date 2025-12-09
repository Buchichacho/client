'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'compare_product_ids'
const MAX_COMPARE = 4

export function useCompareState() {
  const [ids, setIds] = useState<string[]>([])

  // Load from localStorage once on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const onlyStrings = parsed.filter((x) => typeof x === 'string') as string[]
        setIds(Array.from(new Set(onlyStrings)).slice(0, MAX_COMPARE))
      }
    } catch {}
  }, [])

  // Persist on change
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch {}
  }, [ids])

  const has = useCallback((id: string) => ids.includes(id), [ids])

  const add = useCallback((id: string) => {
    setIds((prev) => {
      if (!id) return prev
      if (prev.includes(id)) return prev
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, id]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setIds((prev) => prev.filter((x) => x !== id))
  }, [])

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, id]
    })
  }, [])

  const clear = useCallback(() => setIds([]), [])

  const count = ids.length

  return useMemo(
    () => ({ ids, count, add, remove, toggle, clear, has, max: MAX_COMPARE }),
    [ids, count, add, remove, toggle, clear, has]
  )
}

export type UseCompareState = ReturnType<typeof useCompareState>
