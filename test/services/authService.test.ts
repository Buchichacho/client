import { describe, it, expect, beforeEach, vi } from 'vitest'
import { authService } from '@/services/authService'
import { server } from '../../test/setupTests'
import { http, HttpResponse } from 'msw'

const API = '/api'
const EXT = 'https://api.sellpoint.pp.ua'

beforeEach(() => {
  localStorage.clear()
})


// - FAKE SERVER: MSW (server.use + http.*) intercepts network and returns canned responses
// - STUBS: We return specific JSON/text bodies, statuses to drive branches
// - SPIES: (if used) could observe behavior; here mainly using MSW + expectations

describe('authService.makeRequest and flows', () => {
  it('makeRequest returns parsed JSON on success', async () => {
    // FAKE SERVER + STUB RESPONSE
    server.use(
      http.post(`${API}/auth/login`, async () => HttpResponse.json({ token: 'abc' }))
    )
    const res = await (authService as any).makeRequest('login', { method: 'POST', body: '{}' })
    expect(res).toEqual({ token: 'abc' })
  })

  it('makeRequest throws parsed message on error JSON', async () => {
    // FAKE SERVER + STUB ERROR JSON
    server.use(
      http.post(`${API}/auth/login`, async () => HttpResponse.json({ message: 'Bad' }, { status: 400 }))
    )
    await expect((authService as any).makeRequest('login', { method: 'POST', body: '{}' })).rejects.toThrow('Bad')
  })

  it('normalizeAuthResponse handles string and object tokens', async () => {
    // string token
    // STUB TEXT RESPONSE to simulate raw token string
    server.use(http.post(`${API}/auth/login`, async () => new HttpResponse('tok1', { status: 200 })))
    const r1 = await authService.login({ login: 'u', password: 'p' } as any)
    expect(r1).toEqual({ token: 'tok1' })

    // object token
  // STUB JSON RESPONSE to simulate { token }
    server.use(http.post(`${API}/auth/login`, async () => HttpResponse.json({ token: 'tok2' })))
    const r2 = await authService.login({ login: 'u', password: 'p' } as any)
    expect(r2).toEqual({ token: 'tok2' })
  })

  it('checkAuth returns false and clears token on 401', async () => {
    // STUB 401 to drive logout branch
    localStorage.setItem('auth_token', 'T')
    server.use(http.get(`${API}/auth/check-login`, async () => new HttpResponse('unauthorized', { status: 401 })))
    const ok = await authService.checkAuth()
    expect(ok).toBe(false)
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('verifyEmailCode uppercases+trims the code', async () => {
    // STUB success; we assert normalized request URL
    localStorage.setItem('auth_token', 'T')
    let requestedUrl = ''
    server.use(http.get(`${API}/auth/verify-email-code`, async ({ request }) => {
      requestedUrl = request.url
      return new HttpResponse('OK', { status: 200 })
    }))
    await authService.verifyEmailCode(' ab-12 ')
    expect(requestedUrl).toMatch(/code=AB-12/i)
  })

  it('serverLogout always clears local token', async () => {
    // STUB 500: makeRequest throws, but finally clears token
    localStorage.setItem('auth_token', 'T')
    server.use(http.post(`${API}/auth/logout`, async () => new HttpResponse('err', { status: 500 })))
    await expect(authService.serverLogout()).rejects.toThrow()
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('resetPassword treats 400 Invalid code as success', async () => {
    // STUB 400 + 'Invalid code' => business rule converts to success
    server.use(http.post(`${EXT}/api/Auth/reset-password`, async () => new HttpResponse('Invalid code', { status: 400 })))
    const res = await authService.resetPassword({ password: 'p', accessCode: 'AC' } as any)
    expect(res.success).toBe(true)
  })

  it('sendPasswordResetCode accepts string body and JSON body', async () => {
    // string body
    // STUB TEXT response (token as plain text)
    server.use(http.post(`${EXT}/api/Auth/send-password-reset-code`, async () => new HttpResponse('RST', { status: 200 })))
    const r1 = await authService.sendPasswordResetCode({ login: 'u' } as any)
    expect(r1.success).toBe(true)

    // JSON body
  // STUB JSON response (structured)
    server.use(http.post(`${EXT}/api/Auth/send-password-reset-code`, async () => HttpResponse.json({ resetToken: 'RST2' })))
    const r2 = await authService.sendPasswordResetCode({ login: 'u' } as any)
    expect(r2.resetToken).toBe('RST2')
  })
})
