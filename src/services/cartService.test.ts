/**
 * cartService 測試：帳號那份與本機那份誰蓋誰（弄反會吃掉學生的購物車）
 */

import { describe, it, expect, vi } from 'vitest'
import { syncAction } from './cartService'

vi.mock('./supabase', () => ({ supabase: {} }))

describe('syncAction', () => {
  it('帳號較新：蓋掉本機（另一台裝置改過）', () => {
    expect(syncAction(100, 200, true)).toBe('apply')
    expect(syncAction(0, 200, true)).toBe('apply') // 本機從沒同步過，以帳號為準
  })

  it('本機較新：推上去（上次推失敗、或推之前就關掉分頁）', () => {
    expect(syncAction(300, 200, true)).toBe('push')
    expect(syncAction(300, null, false)).toBe('push') // 清空購物車也要推
  })

  it('帳號還沒有：本機有東西才推（第一次啟用時把舊購物車帶上去）', () => {
    expect(syncAction(0, null, true)).toBe('push')
    expect(syncAction(0, null, false)).toBe('none')
  })

  it('一樣新：不動', () => {
    expect(syncAction(200, 200, true)).toBe('none')
  })
})
