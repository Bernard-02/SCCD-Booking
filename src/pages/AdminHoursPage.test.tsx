/**
 * AdminHoursPage 測試：點日期新增休息日，預設午班到晚班＝全天，公告與受影響訂單一起處理
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import AdminHoursPage from './AdminHoursPage'
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
