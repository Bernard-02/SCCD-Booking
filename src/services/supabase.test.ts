/**
 * fetchAllRows：分段抓到不足一段為止（Supabase 一次最多 1000 筆）
 */

import { describe, it, expect } from 'vitest'
import { fetchAllRows } from './supabase'

// 假資料表：n 筆，依 range 切
const table = (n: number) => {
  const rows = Array.from({ length: n }, (_, i) => i)
  const calls: [number, number][] = []
  const page = (from: number, to: number) => {
    calls.push([from, to])
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
  }
  return { page, calls }
}

describe('fetchAllRows', () => {
  it('超過 1000 筆分段抓齊', async () => {
    const { page, calls } = table(2500)
    const rows = await fetchAllRows(page)
    expect(rows).toHaveLength(2500)
    expect(rows[2499]).toBe(2499)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('剛好 1000 筆多問一次空段就停', async () => {
    const { page, calls } = table(1000)
    expect(await fetchAllRows(page)).toHaveLength(1000)
    expect(calls).toHaveLength(2)
  })

  it('錯誤往外丟', async () => {
    await expect(fetchAllRows(() => Promise.resolve({ data: null, error: new Error('boom') }))).rejects.toThrow('boom')
  })
})
