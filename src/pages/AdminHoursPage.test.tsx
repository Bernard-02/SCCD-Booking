/**
 * AdminHoursPage 測試：點日期新增休息日，預設午班到晚班＝全天，公告與受影響訂單一起處理
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import AdminHoursPage, { canMoveDuty, dutyDiff, moveDuty } from './AdminHoursPage'
import { addClosedDates, announceClosed, notifyClosedAffected } from '../services/adminService'

vi.mock('../services/adminService', () => ({
  listClosedDates: vi.fn().mockResolvedValue([]),
  listBlackouts: vi.fn().mockResolvedValue([]),
  listStaff: vi.fn().mockResolvedValue([]),
  autoImportHolidays: vi.fn().mockResolvedValue(undefined),
  addClosedDates: vi.fn().mockResolvedValue({ ok: true }),
  announceClosed: vi.fn().mockResolvedValue({ ok: true, count: 1 }),
  notifyClosedAffected: vi.fn().mockResolvedValue({ ok: true, count: 0 }),
  CLOSED_KIND_ZH: { activity: '活動', review: '大總評', other: '其他', holiday: '法定假日' }
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('值班拖曳搬人', () => {
  const at = (k: string, i: number) => ({ k, i })

  it('搬到別班的任意位置，不動到原資料', () => {
    const g = { x: [1, 2], y: [3, 4] }
    expect(moveDuty(g, at('x', 0), 'y', 0)).toEqual({ x: [2], y: [1, 3, 4] })
    expect(moveDuty(g, at('x', 0), 'y', 1)).toEqual({ x: [2], y: [3, 1, 4] })
    expect(moveDuty(g, at('x', 0), 'y', 2)).toEqual({ x: [2], y: [3, 4, 1] })
    expect(g).toEqual({ x: [1, 2], y: [3, 4] })
  })

  it('同一班調順序；放回原位不變', () => {
    expect(moveDuty({ x: [1, 2, 3] }, at('x', 0), 'x', 3)).toEqual({ x: [2, 3, 1] })
    expect(moveDuty({ x: [1, 2, 3] }, at('x', 2), 'x', 0)).toEqual({ x: [3, 1, 2] })
    expect(moveDuty({ x: [1, 2, 3] }, at('x', 1), 'x', 1)).toEqual({ x: [1, 2, 3] })
    expect(moveDuty({ x: [1, 2, 3] }, at('x', 1), 'x', 2)).toEqual({ x: [1, 2, 3] })
  })

  it('對方的空列收掉；原本那班空了留一列可選', () => {
    expect(moveDuty({ x: [1, 2], y: [3, 0] }, at('x', 1), 'y', 1)).toEqual({ x: [1], y: [3, 2] })
    expect(moveDuty({ x: [1], y: [0] }, at('x', 0), 'y', 0)).toEqual({ x: [0], y: [1] })
  })

  it('存檔差異：依序改現有列保住順序，多的刪、少的加', () => {
    const rows = [{ id: 10, staffId: 1 }, { id: 11, staffId: 2 }, { id: 12, staffId: 3 }]
    expect(dutyDiff(rows, [1, 2, 3])).toEqual({ reassign: [], remove: [], add: [] })
    expect(dutyDiff(rows, [3, 1, 2])).toEqual({ reassign: [{ id: 10, staffId: 3 }, { id: 11, staffId: 1 }, { id: 12, staffId: 2 }], remove: [], add: [] })
    expect(dutyDiff(rows, [1, 3])).toEqual({ reassign: [{ id: 11, staffId: 3 }], remove: [12], add: [] })
    expect(dutyDiff(rows.slice(0, 1), [1, 5, 6])).toEqual({ reassign: [], remove: [], add: [5, 6] })
  })

  it('同一班可以調順序；對方已有這個人、對方已滿放不下', () => {
    expect(canMoveDuty({ x: [1, 2] }, at('x', 0), 'x')).toBe(true)
    expect(canMoveDuty({ x: [1], y: [1, 2] }, at('x', 0), 'y')).toBe(false)
    expect(canMoveDuty({ x: [6], y: [1, 2, 3, 4, 5] }, at('x', 0), 'y')).toBe(false)
    expect(canMoveDuty({ x: [6], y: [1, 2, 3, 4, 0] }, at('x', 0), 'y')).toBe(true) // 空列不算人
  })
})

describe('新增休息日', () => {
  it('單一天預設全天：寫一列、發公告、處理訂單', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 6, 1, 10, 0) }) // 固定日期：過去的日子不發公告，測試不能看今天是幾號
    render(<AdminHoursPage />)
    await waitFor(() => expect(document.querySelector('[data-date]')).toBeTruthy())
    const day = '2026-07-31' // 週五
    fireEvent.click(document.querySelector(`[data-date="${day}"]`)!)
    await screen.findByText('新增休息日')
    const adds = screen.getAllByRole('button', { name: '新增' }) // 標題列的「新增」下拉也叫這個名字
    fireEvent.click(adds[adds.length - 1])
    await waitFor(() => expect(addClosedDates).toHaveBeenCalledWith([{ day, shift: 'all' }], 'activity', null))
    await waitFor(() => expect(announceClosed).toHaveBeenCalledWith(day, day, 'noon', 'evening', '活動'))
    expect(notifyClosedAffected).toHaveBeenCalledWith([{ day, shift: 'all' }], day, '活動')
  })
})
