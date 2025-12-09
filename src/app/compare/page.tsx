export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import CompareClient from './CompareClient'

export default async function ComparePage({ searchParams }: any) {
  const sp = (await searchParams) ?? {}
  const ids = Array.isArray(sp.ids) ? sp.ids.join(',') : (sp.ids ?? '')
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1500px] px-4 py-6">Loading comparison…</div>}>
      <CompareClient initialIds={ids} />
    </Suspense>
  )
}
