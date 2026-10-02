/**
 * 後台：修改訂單借用資訊——學生打錯字時由後台代改，學生端不可改。
 * 可改欄位同前台送單時填的（BookingDetailsDialog，rental-rules §9）：
 *   小量＝只有原因；大量-個人／大量-團體＝原因＋班級＋老師，三項必填。
 * 小量單只送 reason，不碰 class_name／teacher。
 * 樣式沿用 OrderActionDialog。
 */

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AdminOrderRow, OrderInfo } from '../../services/ordersService'
import { orderKindMeta } from './adminUi'

interface Props {
  order: AdminOrderRow
  busy: boolean
  onSave: (info: OrderInfo) => void
  onCancel: () => void
}

const field =
  'bg-black border border-gray-scale4 rounded-lg px-3 py-1.5 text-xs text-white focus:border-white outline-none w-full font-chinese'

const OrderInfoDialog: React.FC<Props> = ({ order, busy, onSave, onCancel }) => {
  const isMass = order.booking_type !== 'little'
  const [reason, setReason] = useState(order.reason ?? '')
  const [className, setClassName] = useState(order.class_name ?? '')
  const [teacher, setTeacher] = useState(order.teacher ?? '')

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])

  const canSave =
    !busy && reason.trim() !== '' && (!isMass || (className.trim() !== '' && teacher.trim() !== ''))

  const label = (en: string, zh: string, required: boolean) => (
    <span className="text-xs text-gray-scale2">
      <span className="font-english">{en}</span> <span className="font-chinese">{zh}</span>
      {required && <span className="ml-1" style={{ color: 'var(--color-error2)' }}>*</span>}
    </span>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onCancel}
    >
      <div
        className="bg-[#151515] border border-[#545454] max-w-lg w-full mx-4 rounded-lg"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        <div className="px-6 pt-6">
          <h2 className="font-english text-sm text-white font-normal">
            Booking Info <span className="font-chinese">修改借用資訊</span>
          </h2>
          <p className="font-english text-xs text-gray-scale2 mt-1">
            {order.rental_number} · <span className="font-chinese">{order.students?.name ?? '—'}</span>
            {' '}· {orderKindMeta(order).en}{' '}
            <span className="font-chinese">{orderKindMeta(order).zh}</span>
          </p>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            {label('Reason', '使用原因', true)}
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className={`${field} resize-none`} />
          </label>
          {isMass && (
            <>
              <label className="flex flex-col gap-1.5">
                {label('Class', '使用班級', true)}
                <input type="text" value={className} onChange={e => setClassName(e.target.value)} className={field} />
              </label>
              <label className="flex flex-col gap-1.5">
                {label('Teacher', '負責老師', true)}
                <input type="text" value={teacher} onChange={e => setTeacher(e.target.value)} className={field} />
              </label>
            </>
          )}
        </div>

        <div className="px-6">
          <div className="border-t border-[#545454]"></div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-6">
          <button onClick={onCancel} className="text-gray-scale2 hover:!text-white transition-colors cursor-pointer">
            <span className="font-english text-xs">Cancel <span className="font-chinese">取消</span></span>
          </button>
          <button
            onClick={() =>
              canSave &&
              onSave(
                isMass
                  ? { reason: reason.trim(), class_name: className.trim(), teacher: teacher.trim() }
                  : { reason: reason.trim() }
              )
            }
            disabled={!canSave}
            className={`transition-opacity ${
              canSave ? 'text-white hover:opacity-70 cursor-pointer' : 'text-gray-scale3 cursor-not-allowed'
            }`}
          >
            <span className="font-english text-xs">
              {busy ? <span className="font-chinese">儲存中…</span> : <>Save <span className="font-chinese">儲存</span></>}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default OrderInfoDialog
