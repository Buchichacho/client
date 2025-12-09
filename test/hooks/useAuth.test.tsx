import React, { useEffect } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'
import { authService } from '@/services/authService'

// TEST DOUBLE: MOCK of Next.js router
// - We mock next/navigation's useRouter to isolate navigation side-effects
// - The 'pushed' array acts as a FAKE history sink to assert redirects
const pushed: string[] = []
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (url: string) => { pushed.push(url) } }),
}))

function AuthProbe({ onReady }: { onReady: (api: ReturnType<typeof useAuth>) => void }) {
  const api = useAuth()
  useEffect(() => { onReady(api) }, [api, onReady])
  return null
}

beforeEach(() => {
  localStorage.clear()
  pushed.length = 0
  vi.restoreAllMocks()
})

describe('useAuth', () => {
  it('login success stores token, sets auth and redirects', async () => {
    // TEST DOUBLE: STUB authService methods with controlled outcomes
    vi.spyOn(authService, 'login').mockResolvedValue({ token: 'abc' })
    vi.spyOn(authService, 'setToken').mockImplementation(() => {})

    let hook: ReturnType<typeof useAuth> | null = null
    render(<AuthProbe onReady={(h) => { hook = h }} />)

    const creds = { login: 'xiaoooo@sample.mail', password: 'P@ssw0rd' } as any
    await act(async () => { await hook!.login(creds) })

    expect(authService.login).toHaveBeenCalledWith(creds)
    expect(localStorage.getItem('user_display_name')).toBe('xiaoooo@sample.mail')
    expect(pushed.at(-1)).toBe('/')
    expect(hook!.isAuthenticated).toBe(true)
  })

  it('login error translates message and exposes error', async () => {
    // TEST DOUBLE: STUB rejection to simulate failed login
    vi.spyOn(authService, 'login').mockRejectedValue(new Error('Invalid login or password'))

    let hook: ReturnType<typeof useAuth> | null = null
    render(<AuthProbe onReady={(h) => { hook = h }} />)

    const creds = { login: 'u', password: 'x' } as any
    await act(async () => {
      try {
        await hook!.login(creds)
      } catch {}
    })

    await waitFor(() => {
      const err: any = hook!.error
      const text = typeof err === 'string' ? err : (err?.message ?? String(err))
      expect(text).toMatch(/Невірний логін|пароль/i)
    })
    expect(hook!.isAuthenticated).toBe(false)
  })

  it('register success saves token, sends verification and redirects', async () => {
    // TEST DOUBLE: STUB register + sendVerificationCode success paths
    vi.spyOn(authService, 'register').mockResolvedValue({ token: 'zzz' })
    vi.spyOn(authService, 'setToken').mockImplementation(() => {})
    vi.spyOn(authService, 'sendVerificationCode').mockResolvedValue()

    let hook: ReturnType<typeof useAuth> | null = null
    render(<AuthProbe onReady={(h) => { hook = h }} />)

    const req = { firstName: 'A', lastName: 'B', email: 'a@b.c', password: 'p' } as any
    await act(async () => { await hook!.register(req) })

    expect(authService.register).toHaveBeenCalled()
    expect(authService.sendVerificationCode).toHaveBeenCalled()
    expect(pushed.at(-1)).toBe('/auth/verify-email')
    expect(hook!.isAuthenticated).toBe(true)
  })

  it('checkAuth sets isAuthenticated based on service result', async () => {
    // TEST DOUBLE: STUB sequence of results for checkAuth (true, then false)
    vi.spyOn(authService, 'checkAuth').mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    let hook: ReturnType<typeof useAuth> | null = null
    render(<AuthProbe onReady={(h) => { hook = h }} />)

    // Wait for initial effect to set isAuthenticated true
    await act(async () => {})
    expect(hook!.isAuthenticated).toBe(true)

    // Next manual call should use the second mocked value (false)
    await act(async () => { await hook!.checkAuth() })
    expect(hook!.isAuthenticated).toBe(false)
  })

  it('logout calls serverLogout, resets auth and redirects', async () => {
    // TEST DOUBLE: STUB serverLogout to resolve (we assert redirect and state)
    vi.spyOn(authService, 'serverLogout').mockResolvedValue()

    let hook: ReturnType<typeof useAuth> | null = null
    render(<AuthProbe onReady={(h) => { hook = h }} />)

    await act(async () => { hook!.logout() })
    expect(authService.serverLogout).toHaveBeenCalled()
    expect(pushed.at(-1)).toBe('/auth/login')
    expect(hook!.isAuthenticated).toBe(false)
  })

  it('setAuthData sets token and display name', async () => {
    // TEST DOUBLE: STUB setToken to avoid real storage writes beyond our checks
    vi.spyOn(authService, 'setToken').mockImplementation(() => {})

    let hook: ReturnType<typeof useAuth> | null = null
    render(<AuthProbe onReady={(h) => { hook = h }} />)

    // Let initial auth check finish
    await act(async () => {})
    await act(async () => {
      hook!.setAuthData({ token: 't', user: { displayName: 'John' }, isAuthenticated: true })
    })

    expect(localStorage.getItem('user_display_name')).toBe('John')
    expect(hook!.isAuthenticated).toBe(true)
  })
})
