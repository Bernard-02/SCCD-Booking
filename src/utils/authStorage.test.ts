import { describe, it, expect } from 'vitest'
import { ADMIN_SESSION_MS, isLoginExpired, type LoginData } from './authStorage'

const DAY = 24 * 60 * 60 * 1000
const login = (role: 'student' | 'admin'): LoginData => ({
  student: { role } as LoginData['student'],
  token: '',
  loginTime: 0,
  expiresIn: 30 * DAY,
  rememberMe: true
})

describe('isLoginExpired', () => {
  it('admin 滿 12 小時就過期，不看 expiresIn', () => {
    expect(isLoginExpired(login('admin'), ADMIN_SESSION_MS)).toBe(false)
    expect(isLoginExpired(login('admin'), ADMIN_SESSION_MS + 1)).toBe(true)
  })

  it('學生照 expiresIn', () => {
    expect(isLoginExpired(login('student'), 30 * DAY)).toBe(false)
    expect(isLoginExpired(login('student'), 30 * DAY + 1)).toBe(true)
  })
})
