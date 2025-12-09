import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import logger from '@/lib/logger'

afterEach(() => {
  vi.unstubAllEnvs?.()
  vi.restoreAllMocks()
})

// TEST DOUBLES:
// - STUB ENV: vi.stubEnv to simulate NODE_ENV / DISABLE_SERVER_LOGS
// - MOCK/SPY: console.log/warn/error to assert logging behavior
describe('logger', () => {
  it('logs in non-production when not disabled', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('DISABLE_SERVER_LOGS', '')

    const cLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const cWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cErr = vi.spyOn(console, 'error').mockImplementation(() => {})

    logger.info('i1')
    logger.warn('w1')
    logger.error('e1')

    expect(cLog).toHaveBeenCalledWith('i1')
    expect(cWarn).toHaveBeenCalledWith('w1')
    expect(cErr).toHaveBeenCalledWith('e1')
  })

  it('does not log when NODE_ENV=production', () => {
    vi.stubEnv('NODE_ENV', 'production')

    const cLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const cWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cErr = vi.spyOn(console, 'error').mockImplementation(() => {})

    logger.info('i2')
    logger.warn('w2')
    logger.error('e2')

    expect(cLog).not.toHaveBeenCalled()
    expect(cWarn).not.toHaveBeenCalled()
    expect(cErr).not.toHaveBeenCalled()
  })

  it('does not log when DISABLE_SERVER_LOGS=true', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('DISABLE_SERVER_LOGS', 'true')

    const cLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const cWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cErr = vi.spyOn(console, 'error').mockImplementation(() => {})

    logger.info('i3')
    logger.warn('w3')
    logger.error('e3')

    expect(cLog).not.toHaveBeenCalled()
    expect(cWarn).not.toHaveBeenCalled()
    expect(cErr).not.toHaveBeenCalled()
  })
})
