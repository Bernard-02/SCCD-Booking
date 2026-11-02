/**
 * 後台：修改訂單借用資訊——學生打錯字時由後台代改，學生端不可改。
 * 可改欄位同前台送單時填的（BookingDetailsDialog，rental-rules §9）：
 *   小量＝只有原因；大量-個人／大量-團體＝原因＋班級＋老師，三項必填。
 *   大量設備且仍待取件（status pending）另可改取件時段；還沒收押金的再加繳押金時段（2026-11-02 加）。
 *   選項同前台：取件＝起租日當天的值班時段；繳押金＝現在起、送單後 24 工作時內、不晚於取件。原本存的時段已過期時仍列在最上面（標「原」），只改原因不用被迫換時段。
 * 小量單只送 reason，不碰 class_name／teacher；沒顯示的時段欄位也不送。
 * 樣式沿用 OrderActionDialog。
 */

import { BTN } from '@/components/common/btn'
import CloseButton from '../common/CloseButton'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AdminOrderRow, OrderInfo } from '../../services/ordersService'
import { fetchClosedDates, fetchDutySlots } from '../../services/ordersService'
import { addBusinessMs, dutySlotOptions, slotLabel, slotStart, PENDING_LIMIT_MS, type DutySlot } from '../../utils/timeUtils'
import { orderKindMeta, Select } from './adminUi'

interface Props {
  order: AdminOrderRow
  busy: boolean
  onSave: (info: OrderInfo) => void
  onCancel: () => void
}

const field =
  'bg-black border border-gray-mid rounded-lg px-3 py-1.5 text-xs text-white focus:border-white outline-none w-full font-chinese'

const OrderInfoDialog: React.FC<Props> = ({ order, busy, onSave, onCancel }) => {
  const isMass = order.booking_type !== 'little'
  const [reason, setReason] = useState(order.reason ?? '')
  const [className, setClassName] = useState(order.class_name ?? '')
  const [teacher, setTeacher] = useState(order.teacher ?? '')

  // 大量設備預選時段：待取件才有意義；繳押金時段只在還沒收押金時
  const hasPickup = order.status === 'pending' && !!order.pickup_slot
  const hasDeposit = hasPickup && !order.deposit_paid_at
  const [pickupSlot, setPickupSlot] = useState(order.pickup_slot ?? '')
  const [deposit, setDeposit] = useState(order.deposit_date && order.deposit_slot ? `${order.deposit_date} ${order.deposit_slot}` : '')
  const [duties, setDuties] = useState<DutySlot[] | null>(null)
  const [closedDates, setClosedDates] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    if (!hasPickup) return
    Promise.all([fetchDutySlots(), fetchClosedDates()]).then(([d, c]) => { setDuties(d); setClosedDates(c) })
  }, [hasPickup])

  const now = new Date()
  const dayEnd = new Date(`${order.start_date}T23:59`)
  const pickupOptions = duties ? dutySlotOptions(duties, new Date(`${order.start_date}T00:00`), dayEnd, closedDates) : []
  const depositUntil = new Date(Math.min(
    addBusinessMs(new Date(order.created_at), PENDING_LIMIT_MS, closedDates).getTime(),
    (pickupSlot ? slotStart(order.start_date, pickupSlot) : dayEnd).getTime()
  ))
  const depositOptions = duties ? dutySlotOptions(duties, now, depositUntil, closedDates) : []
  // 原本存的時段不在選項內（時間已過）→ 仍列在最上面標「原」
  const withOriginal = <T extends { value: string; label: string }>(opts: T[], orig: string, label: string) =>
    orig && !opts.some(o => o.value === orig) ? [{ value: orig, label: `${label}（原）` } as T, ...opts] : opts
  const pickupSelect = withOriginal(
    pickupOptions.map(o => ({ value: o.slot, label: slotLabel(o) })),
    order.pickup_slot ?? '',
    order.pickup_slot ? slotLabel({ date: order.start_date, slot: order.pickup_slot }) : ''
  )
  const depositSelect = withOriginal(
    depositOptions.map(o => ({ value: `${o.date} ${o.slot}`, label: slotLabel(o) })),
    order.deposit_date && order.deposit_slot ? `${order.deposit_date} ${order.deposit_slot}` : '',
    order.deposit_date && order.deposit_slot ? slotLabel({ date: order.deposit_date, slot: order.deposit_slot }) : ''
  )

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])

  const canSave =
    !busy && reason.trim() !== '' && (!isMass || (className.trim() !== '' && teacher.trim() !== '')) &&
    (!hasPickup || pickupSelect.some(o => o.value === pickupSlot)) &&
    (!hasDeposit || depositSelect.some(o => o.value === deposit))

  const label = (zh: string, required: boolean) => (
    <span className="text-xs text-gray-light">
      {zh}
      {required && <span className="ml-1" style={{ color: 'var(--color-error)' }}>*</span>}
    </span>
  )

  const save = () => {
    if (!canSave) return
    const info: OrderInfo = isMass
      ? { reason: reason.trim(), class_name: className.trim(), teacher: teacher.trim() }
      : { reason: reason.trim() }
    if (hasPickup) info.pickup_slot = pickupSlot
    if (hasDeposit) { const [d, s] = deposit.split(' '); info.deposit_date = d; info.deposit_slot = s }
    onSave(info)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onCancel}
    >
      <div
        className="relative bg-gray-darker border border-gray-mid max-w-lg w-full mx-4 rounded-2xl"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        <CloseButton onClick={onCancel} className="absolute top-6 right-6" />
        <div className="px-6 pt-6 pr-14">
          <h2 className="text-sm text-white font-normal">修改借用資訊</h2>
          <p className="font-english text-xs text-gray-light mt-1">
            {order.rental_number} · <span className="font-chinese">{order.students?.name ?? '—'}</span>
            {' '}· <span className="font-chinese">{orderKindMeta(order).zh}</span>
          </p>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            {label('使用原因', true)}
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className={`${field} resize-none`} />
          </label>
          {isMass && (
            <>
              <label className="flex flex-col gap-1.5">
                {label('使用班級', true)}
                <input type="text" value={className} onChange={e => setClassName(e.target.value)} className={field} />
              </label>
              <label className="flex flex-col gap-1.5">
                {label('負責老師', true)}
                <input type="text" value={teacher} onChange={e => setTeacher(e.target.value)} className={field} />
              </label>
            </>
          )}
          {hasPickup && (
            <div className="flex flex-col gap-1.5">
              {label('取件時段（起租日當天的值班時段）', true)}
              <Select
                value={pickupSlot}
                onChange={setPickupSlot}
                placeholder={duties ? '請選擇' : '載入中…'}
                options={pickupSelect}
                className="w-full"
                aria-label="取件時段"
              />
              {duties && pickupOptions.length === 0 && (
                <span className="text-2xs font-chinese" style={{ color: 'var(--color-error)' }}>起租日沒有值班時段（公休或未排班）</span>
              )}
            </div>
          )}
          {hasDeposit && (
            <div className="flex flex-col gap-1.5">
              {label('繳押金時段（送單後 24 工作時內、不晚於取件）', true)}
              <Select
                value={deposit}
                onChange={setDeposit}
                placeholder={duties ? '請選擇' : '載入中…'}
                options={depositSelect}
                className="w-full"
                aria-label="繳押金時段"
              />
              {duties && depositOptions.length === 0 && (
                <span className="text-2xs font-chinese" style={{ color: 'var(--color-error)' }}>現在到期限內沒有可繳押金的值班時段</span>
              )}
            </div>
          )}
        </div>

        <div className="px-6">
          <div className="border-t border-gray-mid"></div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-6">
          <button onClick={onCancel} className={`text-gray-light ${BTN}`}>
            <span className="text-xs">取消</span>
          </button>
          <button onClick={save} disabled={!canSave} className={`text-white ${BTN}`}>
            <span className="text-xs">{busy ? '儲存中…' : '儲存'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default OrderInfoDialog
