/**
 * ShiftDialog 測試：跨天選時段、休息／已借出的格子不能點、清單裡選過的先點好、全選
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ShiftDialog, { type Shift, type SlotState } from './ShiftDialog'

const DAYS = ['2026-11-17', '2026-11-18', '2026-11-19'] // 週二～週四
// 11/18 午班已借出、11/19 晚班休息，其餘可借
const stateOf = (s: Shift, d: string): SlotState =>
  s === 'noon' && d === '2026-11-18' ? 'taken' : s === 'evening' && d === '2026-11-19' ? 'closed' : 'free'

const open = (initial: Record<Shift, string[]> = { noon: [], evening: [] }) => {
  const onConfirm = vi.fn()
  render(<ShiftDialog title="雷切機：選擇時段" titleEn="" days={DAYS} stateOf={stateOf} initial={initial} deposit={1000} onConfirm={onConfirm} onCancel={vi.fn()} />)
  return onConfirm
}
const cells = (name: string | RegExp) => screen.getAllByRole('button', { name })
const confirm = () => fireEvent.click(screen.getByRole('button', { name: '加入清單' }))

afterEach(cleanup)

describe('ShiftDialog', () => {
  it('每天各選不同的班；沒選不能確認', () => {
    const onConfirm = open()
    expect(screen.getByRole('button', { name: '加入清單' })).toHaveProperty('disabled', true)
    fireEvent.click(cells('午班')[0])  // 11/17 午班
    fireEvent.click(cells('晚班')[1])  // 11/18 晚班
    fireEvent.click(cells('晚班')[0])  // 11/17 晚班
    fireEvent.click(cells('晚班')[0])  // 再點一次＝取消
    confirm()
    expect(onConfirm).toHaveBeenCalledWith({ noon: ['2026-11-17'], evening: ['2026-11-18'] })
  })

  it('已借出、休息的格子不能點；全選只選借得到的', () => {
    const onConfirm = open()
    expect(screen.getByRole('button', { name: '午班・已借出' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: '晚班・休息' })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: '全選' }))
    confirm()
    expect(onConfirm).toHaveBeenCalledWith({ noon: ['2026-11-17', '2026-11-19'], evening: ['2026-11-17', '2026-11-18'] })
  })

  it('清單裡選過的先點好，後來被借走的那格不帶', () => {
    const onConfirm = open({ noon: ['2026-11-17', '2026-11-18'], evening: [] })
    confirm()
    expect(onConfirm).toHaveBeenCalledWith({ noon: ['2026-11-17'], evening: [] })
  })
})
