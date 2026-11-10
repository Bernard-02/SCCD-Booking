/**
 * OrderActionDialog 測試：退押金時填罰金（可超過押金）、歸還不填罰金、不開放提前取件
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

const open = (o: AdminOrderRow, mode: AdminActionMode, estPenalty = 0, familyDeposit?: number) => {
  const onConfirm = vi.fn()
  render(
    <OrderActionDialog
      order={o} mode={mode} staff={[{ name: '甲', onDuty: true }]} defaultHandler="甲"
      estPenalty={estPenalty} familyDeposit={familyDeposit} onConfirm={onConfirm} onCancel={vi.fn()}
    />
  )
  return onConfirm
}
const confirm = () => fireEvent.click(screen.getByRole('button', { name: '確認' }))
const setPenalty = (n: number) => fireEvent.change(screen.getByRole('spinbutton'), { target: { value: String(n) } })
const returned = (over: Partial<AdminOrderRow> = {}) => order({ status: 'returned', ...over })

afterEach(cleanup)

describe('退押金填罰金', () => {
  it('罰金沒超過押金：扣完退還，沒有差額', () => {
    const onConfirm = open(returned(), 'refund')
    setPenalty(200)
    expect(screen.getByText(/退還/).textContent).toContain('300')
    expect(screen.queryByText(/還要繳/)).toBeNull()
    confirm()
    expect(onConfirm.mock.calls[0].slice(0, 2)).toEqual(['甲', 200])
  })

  it('罰金超過押金：退 0，差額要同學繳', () => {
    open(returned(), 'refund')
    setPenalty(900)
    const text = screen.getByText(/還要繳/).textContent
    expect(text).toContain('NT$ 0')
    expect(text).toContain('400')
  })

  it('整張單的押金：子單的也算進去', () => {
    open(returned(), 'refund', 0, 800)
    setPenalty(900)
    expect(screen.getByText(/還要繳/).textContent).toContain('100')
  })

  it('逾期試算預填，學會可以改', () => {
    const onConfirm = open(returned(), 'refund', 700)
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('700')
    setPenalty(0)
    confirm()
    expect(onConfirm.mock.calls[0][1]).toBe(0)
  })

  it('取消單沒有罰金欄', () => {
    const onConfirm = open(order({ status: 'canceled' }), 'refund')
    expect(screen.queryByRole('spinbutton')).toBeNull()
    confirm()
    expect(onConfirm.mock.calls[0][1]).toBe(0)
  })

  it('收罰款顯示押金抵完還差的', () => {
    open(returned({ penalty_total: 900, penalty_paid: false }), 'penalty')
    expect(screen.getByText(/未繳罰款/).textContent).toContain('400')
  })
})

describe('歸還', () => {
  it('不填罰金，只勾品項', () => {
    const onConfirm = open(order({ status: 'overdue' }), 'return')
    expect(screen.queryByRole('spinbutton')).toBeNull()
    confirm()
    expect(onConfirm.mock.calls[0].slice(0, 3)).toEqual(['甲', 0, [1]])
  })
})

describe('經手人', () => {
  it('學會成員用自己的帳號：不用選，記本人', () => {
    const onConfirm = vi.fn()
    render(
      <OrderActionDialog
        order={order()} mode="return" staff={[]} defaultHandler="" lockedHandler="小美"
        estPenalty={0} onConfirm={onConfirm} onCancel={vi.fn()}
      />
    )
    expect(screen.queryByText('值班經手人')).toBeNull()
    confirm()
    expect(onConfirm.mock.calls[0][0]).toBe('小美')
  })
})

describe('不開放提前取件', () => {
  const massOrder = (over: Partial<AdminOrderRow>) =>
    order({ status: 'pending', pickup_slot: '17:00-19:00', deposit_slot: '12:00-13:00', ...over })

  it('還沒到取件日：不能同時取件，只收押金', () => {
    const onConfirm = open(massOrder({ start_date: '2999-01-01' }), 'paid')
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
    confirm()
    expect(onConfirm.mock.calls[0][4]).toBe(false)
  })

  it('改過的取件日到了就可以取，就算起租日還沒到', () => {
    const today = new Date().toLocaleDateString('sv')
    const onConfirm = open(massOrder({ start_date: '2999-01-01', pickup_date: today }), 'paid')
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(false)
    confirm()
    expect(onConfirm.mock.calls[0][4]).toBe(true)
  })
})
