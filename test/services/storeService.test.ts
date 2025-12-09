import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/setupTests'
import { storeService } from '@/services/storeService'

const EXT = 'https://api.sellpoint.pp.ua'

beforeEach(() => {
  localStorage.clear()
})

// TEST DOUBLES:
// - FAKE SERVER: MSW for all HTTP interactions
// - STUB RESPONSES: shape variations to exercise normalization paths
describe('storeService', () => {
  it('createStore sends multipart form and returns parsed JSON', async () => {
    localStorage.setItem('auth_token', 'T')
    let receivedToken = ''
    let receivedName = ''
    server.use(
      // FAKE SERVER + STUB JSON
      http.post(`${EXT}/api/Store/CreateStore`, async ({ request }) => {
        receivedToken = request.headers.get('authorization') || ''
        const form = await (request as any).formData()
        receivedName = form.get('Name') as string
        return HttpResponse.json({ success: true, id: 's1', name: receivedName })
      })
    )
    const res = await storeService.createStore({ name: 'My Store', plan: 1 } as any)
    expect(receivedToken).toMatch(/Bearer T/i)
    expect(receivedName).toBe('My Store')
    expect((res as any).id).toBe('s1')
  })

  it('deleteStore passes storeId and returns response', async () => {
    localStorage.setItem('auth_token', 'T')
    let calledUrl = ''
    server.use(
      // FAKE SERVER + STUB JSON
      http.delete(`${EXT}/api/Store/DeleteStore`, async ({ request }) => {
        calledUrl = request.url
        return HttpResponse.json({ success: true })
      })
    )
    const res = await storeService.deleteStore('DEL123')
    expect(calledUrl).toMatch(/storeId=DEL123/) // query param present
    expect((res as any).success).toBe(true)
  })

  it('getRequestByMyId normalizes diverse shapes to array', async () => {
    localStorage.setItem('auth_token', 'T')
    // case 1: direct array
    server.use(
      // FAKE SERVER + STUB array
      http.get(`${EXT}/api/Store/GetRequestByMyId`, async () => HttpResponse.json([{ id: 'r1', name: 'A' }]))
    )
    const arr1 = await storeService.getRequestByMyId()
    expect(Array.isArray(arr1)).toBe(true)
    expect(arr1[0].id).toBe('r1')

    // case 2: object with success + data
    server.use(
      // FAKE SERVER + STUB { success, data }
      http.get(`${EXT}/api/Store/GetRequestByMyId`, async () => HttpResponse.json({ success: true, data: [{ id: 'r2', name: 'B' }] }))
    )
    const arr2 = await storeService.getRequestByMyId()
    expect(arr2[0].id).toBe('r2')

    // case 3: raw single object with id -> map to array length 1
    server.use(
      // FAKE SERVER + STUB single object
      http.get(`${EXT}/api/Store/GetRequestByMyId`, async () => HttpResponse.json({ id: 'r3', name: 'C', plan: 0, userId: 'U', status: 'pending', createdAt: 'now' }))
    )
    const arr3 = await storeService.getRequestByMyId()
    expect(arr3.length).toBe(1)
    expect(arr3[0].id).toBe('r3')
  })

  it('getRequestByMyId returns empty array on Store not found', async () => {
    localStorage.setItem('auth_token', 'T')
    server.use(
      // FAKE SERVER + STUB 404 Store not found (handled as normal)
      http.get(`${EXT}/api/Store/GetRequestByMyId`, async () => new HttpResponse('Store not found', { status: 404 }))
    )
    const arr = await storeService.getRequestByMyId()
    expect(arr).toEqual([])
  })
})
