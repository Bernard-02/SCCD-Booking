/**
 * OrderActionDialog 測試：退押金時填罰金（可超過押金）、歸還不填罰金、收押金與取件分開、通過延期申請、Enter 確認
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
  it('還有子單沒還：整單收回、不填罰金', () => {
    const onConfirm = open(order({ status: 'overdue' }), 'return')
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    confirm()
    expect(onConfirm.mock.calls[0].slice(0, 3)).toEqual(['甲', 0, [1]])
  })

  it('最後一張：歸還時一起填罰金、退押金', () => {
    const onConfirm = vi.fn()
    render(
      <OrderActionDialog
        order={order({ status: 'overdue' })} mode="return" staff={[]} defaultHandler="" lockedHandler="甲"
        estPenalty={100} settleOnReturn onConfirm={onConfirm} onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('確認歸還並退押金')).toBeTruthy()
    expect(screen.getByText(/退還/).textContent).toContain('400')
    confirm()
    expect(onConfirm.mock.calls[0].slice(0, 3)).toEqual(['甲', 100, [1]])
  })

  it('部分歸還：至少留一項沒勾才能確認', () => {
    const two = order({ order_items: [{ id: 1, name: '延長線', quantity: 1 }, { id: 2, name: '三腳架', quantity: 1 }] as AdminOrderRow['order_items'] })
    const onConfirm = open(two, 'partial')
    expect((screen.getByRole('button', { name: '確認' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    confirm()
    expect(onConfirm.mock.calls[0][2]).toEqual([1])
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

describe('收押金與取件分開（各記各的經手人）', () => {
  const pending = (over: Partial<AdminOrderRow> = {}) => order({ status: 'pending', ...over })

  it('收押金：只收押金、不取件，小量單也一樣', () => {
    const onConfirm = open(pending(), 'paid')
    expect(screen.queryByRole('checkbox')).toBeNull()
    confirm()
    expect(onConfirm.mock.calls[0][4]).toBe(false)
  })

  it('取件：另外一步', () => {
    const onConfirm = open(pending({ deposit_paid_at: '2026-07-14T04:00:00Z', paid_by: '乙' }), 'pickup')
    confirm()
    expect(onConfirm.mock.calls[0].slice(0, 5)).toEqual(['甲', 0, [1], 0, true])
  })
})

describe('通過延期申請', () => {
  it('顯示申請的天數；部分延期列出要延的品項', () => {
    const two = order({
      order_items: [{ id: 1, name: '延長線', quantity: 1 }, { id: 2, name: '三腳架', quantity: 1 }] as AdminOrderRow['order_items'],
      extend_request: { days: 3, item_ids: [2], all: false, at: '2026-07-10T00:00:00Z' }
    })
    const onConfirm = open(two, 'approve')
    expect(screen.getByText(/同學申請延期/).textContent).toContain('3')
    expect(screen.getByText(/只延這幾項/).textContent).toContain('三腳架')
    confirm()
    expect(onConfirm.mock.calls[0][0]).toBe('甲')
  })
})

describe('Enter＝確認', () => {
  const enter = () => fireEvent.keyDown(window, { key: 'Enter' })

  it('按 Enter 等於按確認', () => {
    const onConfirm = open(order(), 'return')
    enter()
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('不能確認時（部分歸還還沒留一項）Enter 沒作用', () => {
    const two = order({ order_items: [{ id: 1, name: '延長線', quantity: 1 }, { id: 2, name: '三腳架', quantity: 1 }] as AdminOrderRow['order_items'] })
    const onConfirm = open(two, 'partial')
    enter()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('代取消要用點的，Enter 不算', () => {
    const onConfirm = open(order(), 'cancel')
    enter()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
