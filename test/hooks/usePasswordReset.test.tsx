import React, { useEffect } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { usePasswordReset } from '@/hooks/usePasswordReset'
import { authService } from '@/services/authService'

// Mock next/navigation router for hooks relying on it
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// TEST DOUBLE: MOCK of Next.js router to satisfy useRouter in hook
// This isolates Next's App Router dependency and lets us test hook logic
function ResetProbe({ onReady }: { onReady: (api: ReturnType<typeof usePasswordReset>) => void }) {
  const api = usePasswordReset()
  useEffect(() => { onReady(api) }, [api, onReady])
  return null
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('usePasswordReset', () => {
  it('sendResetCode success persists resetToken and sets success', async () => {
    // TEST DOUBLE: STUB service to resolve with resetToken
    vi.spyOn(authService, 'sendPasswordResetCode').mockResolvedValue({ success: true, resetToken: 'RT1' })
    let hook: ReturnType<typeof usePasswordReset> | null = null
    render(<ResetProbe onReady={(h) => { hook = h }} />)

    await act(async () => { await hook!.sendResetCode({ login: 'user' } as any) })
    expect(localStorage.getItem('password_reset_token')).toBe('RT1')
    expect(hook!.resetToken).toBe('RT1')
    expect(hook!.success).toMatch(/надіслано/i)
  })

  it('sendResetCode error translates message', async () => {
    // TEST DOUBLE: STUB service to reject with specific error
    vi.spyOn(authService, 'sendPasswordResetCode').mockRejectedValue(new Error('Invalid email'))
    let hook: ReturnType<typeof usePasswordReset> | null = null
    render(<ResetProbe onReady={(h) => { hook = h }} />)
    await act(async () => {
      await expect(hook!.sendResetCode({ login: 'bad' } as any)).rejects.toThrowError()
    })
    expect(hook!.error).toMatch(/Невірний email/i)
  })

  it('verifyResetCode success persists accessCode', async () => {
    // TEST DOUBLE: STUB verification success path
    vi.spyOn(authService, 'verifyPasswordResetCode').mockResolvedValue({ success: true, accessCode: 'AC1' })
    let hook: ReturnType<typeof usePasswordReset> | null = null
    render(<ResetProbe onReady={(h) => { hook = h }} />)

    await act(async () => { await hook!.verifyResetCode({ resetToken: 'RT1', code: '123456' } as any) })
    expect(localStorage.getItem('password_reset_access_code')).toBe('AC1')
    expect(hook!.accessCode).toBe('AC1')
    expect(hook!.success).toMatch(/підтверджено/i)
  })

  it('resetPassword success sets success message', async () => {
    // TEST DOUBLE: STUB resetPassword success
    vi.spyOn(authService, 'resetPassword').mockResolvedValue({ success: true, message: 'ok' })
    let hook: ReturnType<typeof usePasswordReset> | null = null
    render(<ResetProbe onReady={(h) => { hook = h }} />)
    await act(async () => { await hook!.resetPassword({ password: 'new', accessCode: 'AC1' } as any) })
    expect(hook!.success).toMatch(/Пароль успішно змінено/i)
  })

  it('clearAll resets state and localStorage', async () => {
    // TEST DOUBLE: STUB initial success to set token, then call clearAll
    vi.spyOn(authService, 'sendPasswordResetCode').mockResolvedValue({ success: true, resetToken: 'RT2' })
    let hook: ReturnType<typeof usePasswordReset> | null = null
    render(<ResetProbe onReady={(h) => { hook = h }} />)

    await act(async () => { await hook!.sendResetCode({ login: 'x' } as any) })
    expect(hook!.resetToken).toBe('RT2')
    await act(async () => { hook!.clearAll() })
    expect(hook!.resetToken).toBe(null)
    expect(localStorage.getItem('password_reset_token')).toBeNull()
  })

  it('clearTokens only removes tokens but keeps messages cleared', async () => {
    // TEST DOUBLE: STUB to set token, then call clearTokens
    vi.spyOn(authService, 'sendPasswordResetCode').mockResolvedValue({ success: true, resetToken: 'RT3' })
    let hook: ReturnType<typeof usePasswordReset> | null = null
    render(<ResetProbe onReady={(h) => { hook = h }} />)
    await act(async () => { await hook!.sendResetCode({ login: 'x' } as any) })
    await act(async () => { hook!.clearTokens() })
    expect(hook!.resetToken).toBe(null)
    expect(localStorage.getItem('password_reset_token')).toBeNull()
  })
})
