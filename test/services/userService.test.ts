import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/setupTests'
import { userService } from '@/services/userService'

const EXT = 'https://api.sellpoint.pp.ua'

beforeEach(() => {
  localStorage.clear()
})

// TEST DOUBLES:
// - FAKE SERVER: MSW
// - STUB RESPONSES: JSON success and text error
describe('userService', () => {
  it('getCurrentUser returns parsed object', async () => {
    localStorage.setItem('auth_token', 'T')
    server.use(
      // FAKE SERVER + STUB JSON
      http.get(`${EXT}/api/User/GetUserByMyId`, async () => HttpResponse.json({ id: 'U1', email: 'u@x.y' }))
    )
    const u = await userService.getCurrentUser()
    expect(u.id).toBe('U1')
    expect(u.email).toBe('u@x.y')
  })

  it('getUserById hits endpoint with query param and handles error text fallback', async () => {
    localStorage.setItem('auth_token', 'T')
    server.use(
      // FAKE SERVER + STUB 404 with text -> fallback message
      http.get(`${EXT}/api/User/GetUserById`, async () => new HttpResponse('Not Found', { status: 404 }))
    )
    await expect(userService.getUserById('NOPE')).rejects.toThrow(/Not Found|404/i)
  })
})
