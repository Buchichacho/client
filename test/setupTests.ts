import '@testing-library/jest-dom'
import 'whatwg-fetch'
import { vi, beforeAll, afterEach, afterAll } from 'vitest'

// TEST DOUBLE: FAKE SERVER (MSW)
// We use MSW to fake network requests in tests. Handlers are provided per-test via server.use(...)
import { setupServer } from 'msw/node'
export const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// TEST DOUBLE: STUB window.scrollTo to avoid errors in JSDOM
Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true })
