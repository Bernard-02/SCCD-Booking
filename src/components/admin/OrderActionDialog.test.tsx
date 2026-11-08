/**
 * OrderActionDialog 測試：歸還罰款（學會填、可超過押金）與不開放提前取件
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import OrderActionDialog, { type AdminActionMode } from './OrderActionDialog'
import type { AdminOrderRow } from '../../services/ordersService'

vi.mock('../../services/equipmentService', () => ({ useBundles: () => [] }))

const order = (over: Partial<AdminOrderRow> = {}) => ({
  rental_number: '#2026001', status: 'in-progress', deposit_total: 500, start_date: '2026-07-14', end_date: '2026-07-15',
  order_items: [{ id: 1, name: '延長線', quantity: 1 }], students: { name: '王小明', student_id: 'A1' }, ...over
}) as AdminOrderRow

const open = (o: AdminOrderRow, mode: AdminActionMode, estPenalty = 0) => {
  const onConfirm = vi.fn()
  render(
    <OrderActionDialog
      order={o} mode={mode} staff={[{ name: '甲', onDuty: true }]} defaultHandler="甲"
      estPenalty={estPenalty} onConfirm={onConfirm} onCancel={vi.fn()}
    />
  )
  return onConfirm
}
const confirm = () => fireEvent.click(screen.getByRole('button', { name: '確認' }))
const setPenalty = (n: number) => fireEvent.change(screen.getByRole('spinbutton'), { target: { value: String(n) } })

afterEach(cleanup)

describe('歸還罰款', () => {
  it('沒逾期也能填罰款（損壞、遺失），沒超過押金不用問有沒有收', () => {
    const onConfirm = open(order(), 'return')
    setPenalty(200)
    expect(screen.queryByRole('checkbox', { name: /超過押金/ })).toBeNull()
    expect(screen.getByText(/扣罰款後退還/).textContent).toContain('300')
    confirm()
    expect(onConfirm.mock.calls[0].slice(0, 4)).toEqual(['甲', 200, [1], true])
  })

  it('超過押金：退 0，差額沒收到就記欠繳', () => {
    const onConfirm = open(order(), 'return')
    setPenalty(900)
    expect(screen.getByText(/扣罰款後退還/).textContent).toContain('NT$ 0')
    fireEvent.click(screen.getByRole('checkbox', { name: /超過押金/ }))
    confirm()
    expect(onConfirm.mock.calls[0].slice(0, 4)).toEqual(['甲', 900, [1], false])
  })

  it('逾期預填試算，學會可以改', () => {
    open(order({ status: 'overdue' }), 'return', 700)
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('700')
  })
})

describe('不開放提前取件', () => {
  const massOrder = (over: Partial<AdminOrderRow>) =>
    order({ status: 'pending', pickup_slot: '17:00-19:00', deposit_slot: '12:00-13:00', ...over })

  it('還沒到取件日：不能同時取件，只收押金', () => {
    const onConfirm = open(massOrder({ start_date: '2999-01-01' }), 'paid')
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
    confirm()
    expect(onConfirm.mock.calls[0][5]).toBe(false)
  })

  it('改過的取件日到了就可以取，就算起租日還沒到', () => {
    const today = new Date().toLocaleDateString('sv')
    const onConfirm = open(massOrder({ start_date: '2999-01-01', pickup_date: today }), 'paid')
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(false)
    confirm()
    expect(onConfirm.mock.calls[0][5]).toBe(true)
  })
})
