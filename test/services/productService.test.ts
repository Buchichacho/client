import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/setupTests'
import { productService } from '@/services/productService'

const EXT = 'https://api.sellpoint.pp.ua'

beforeEach(() => {
  localStorage.clear()
})

// TEST DOUBLES IN THIS FILE:
// - FAKE SERVER: MSW intercepts most HTTP calls and returns canned responses
// - STUB: In addMedia test we override global.fetch to capture FormData (fine-grained assertion)
describe('productService', () => {
  it('getAll returns array of products (happy path)', async () => {
    localStorage.setItem('auth_token', 'T')
    const data = [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }]
    // FAKE SERVER + STUB JSON response
    server.use(
      http.post(`${EXT}/api/Product/get-all`, async () => HttpResponse.json(data))
    )
    const res = await productService.getAll() as any[]
    expect(Array.isArray(res)).toBe(true)
    expect(res.map(p => p.id)).toEqual(['p1','p2'])
  })

  it('getById 404 throws with message', async () => {
    localStorage.setItem('auth_token', 'T')
    // FAKE SERVER + STUB 404 with text body
    server.use(
      http.get(`${EXT}/api/Product/get-by-id/p404`, async () => new HttpResponse('Not Found', { status: 404 }))
    )
    await expect(productService.getById('p404')).rejects.toThrow(/Not Found|404/i)
  })

  it('create returns normalized product from nested response shapes', async () => {
    localStorage.setItem('auth_token', 'T')
    const payload = { name: 'New' } as any
    // FAKE SERVER + STUB JSON under data
    server.use(
      http.post(`${EXT}/api/Product`, async () => HttpResponse.json({ data: { id: 'p100', name: 'New' } }))
    )
    const created = await productService.create(payload)
    expect(created.id).toBe('p100')
    expect(created.name).toBe('New')
  })

  it('addMedia sends files as FormData with type per file and auth header', async () => {
    localStorage.setItem('auth_token', 'T')
    const files = [
      new File([new Uint8Array([1,2,3])], 'pic.jpg', { type: 'image/jpeg' }),
      new File([new Uint8Array([4,5])], 'clip.mp4', { type: 'video/mp4' }),
    ]

    const originalFetch = global.fetch
    let captured: { url:string; auth:string|null; form:FormData } | null = null
    // TEST DOUBLE: STUB fetch to capture multipart body and headers
    // @ts-ignore
    global.fetch = async (url: string, init: any) => {
      if (url.includes('/api/ProductMedia/many')) {
        captured = { url, auth: init.headers?.Authorization || init.headers?.authorization || null, form: init.body }
        return new Response('OK', { status: 200 })
      }
      return originalFetch(url, init)
    }

    const res = await productService.addMedia('PX', files)
    expect(res).toEqual({ success: true })
    expect(captured).not.toBeNull()
    expect(captured!.auth).toMatch(/Bearer T/i)
    expect(captured!.url).toMatch(/productId=PX/)
    const types: string[] = []
    const names: string[] = []
    // Extract appended entries
    ;(captured!.form as any).forEach?.((value: any, key: string) => {
      if (key === 'type') types.push(String(value))
      if (key === 'files' && value?.name) names.push(value.name)
    })
    expect(types).toEqual(['0','1'])
    expect(names).toEqual(['pic.jpg','clip.mp4'])
    global.fetch = originalFetch
  })

  it('create handles multiple alternative nesting keys', async () => {
    localStorage.setItem('auth_token', 'T')
    const payload = { name: 'X' } as any

  // FAKE SERVER + STUB: product
    server.use(http.post(`${EXT}/api/Product`, async () => HttpResponse.json({ product: { id: 'pA', name: 'A' } })))
    const r1 = await productService.create(payload)
    expect(r1.id).toBe('pA')

  // FAKE SERVER + STUB: result
    server.use(http.post(`${EXT}/api/Product`, async () => HttpResponse.json({ result: { id: 'pB', name: 'B' } })))
    const r2 = await productService.create(payload)
    expect(r2.id).toBe('pB')

  // FAKE SERVER + STUB: item
    server.use(http.post(`${EXT}/api/Product`, async () => HttpResponse.json({ item: { id: 'pC', name: 'C' } })))
    const r3 = await productService.create(payload)
    expect(r3.id).toBe('pC')

  // FAKE SERVER + STUB: deep nested random key
    server.use(http.post(`${EXT}/api/Product`, async () => HttpResponse.json({ something: { id: 'pD', name: 'D' } })))
    const r4 = await productService.create(payload)
    expect(r4.id).toBe('pD')
  })

  it('addMedia with empty files array returns success without network PUT', async () => {
    localStorage.setItem('auth_token', 'T')
    let called = false
    server.use(http.put(`${EXT}/api/ProductMedia/many`, async () => { called = true; return HttpResponse.text('OK') }))
    const res = await productService.addMedia('PX', [])
    expect(res).toEqual({ success: true })
    expect(called).toBe(false)
  })
})
