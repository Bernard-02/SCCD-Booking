/**
 * BookingDetailsDialog 組件
 * 用於填寫借用資訊（使用原因、班級、負責老師等）
 * 大量設備另選「繳押金時段」與「取件時段」（rental-rules 新規則 3，mass-pickup.sql）：
 *   選項＝系學會值班時段；取件限起租日當天，繳押金限送單後 24 工作時內且不晚於取件（可同一時段＝同時進行）。
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { fetchClosedDates, fetchDutySlots } from '../../services/ordersService'
import {
  addBusinessMs, dutySlotOptions, slotStart, slotLabel, toDateKey, PENDING_LIMIT_MS, type DutySlot
} from '../../utils/timeUtils'

export interface BookingDetailsData {
  reason: string
  className?: string
  teacher?: string
  depositDate?: string  // 大量設備：繳押金日 'YYYY-MM-DD'
  depositSlot?: string  // 'HH:MM-HH:MM'
  pickupSlot?: string   // 取件時段（日期＝起租日）
}

interface BookingDetailsDialogProps {
  isOpen: boolean
  bookingType: 'little' | 'mass-personal' | 'mass-group'
  /** 大量設備單的起租日（＝取件日）；有值才顯示時段選單 */
  pickupDate?: string
  initialData?: BookingDetailsData
  onConfirm: (data: BookingDetailsData) => void
  onCancel: () => void
}

const BookingDetailsDialog: React.FC<BookingDetailsDialogProps> = ({
  isOpen,
  bookingType,
  pickupDate,
  initialData,
  onConfirm,
  onCancel
}) => {
  const [reason, setReason] = useState('')
  const [className, setClassName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [pickupSlot, setPickupSlot] = useState('')
  const [deposit, setDeposit] = useState('') // 'YYYY-MM-DD HH:MM-HH:MM'
  const [duties, setDuties] = useState<DutySlot[] | null>(null)
  const [closedDates, setClosedDates] = useState<ReadonlySet<string>>(new Set())

  const isMassBooking = bookingType === 'mass-personal' || bookingType === 'mass-group'

  // 初始化或更新表單資料
  useEffect(() => {
    if (isOpen) {
      setReason(initialData?.reason || '')
      setClassName(initialData?.className || '')
      setTeacher(initialData?.teacher || '')
      setPickupSlot(initialData?.pickupSlot || '')
      setDeposit(initialData?.depositDate ? `${initialData.depositDate} ${initialData.depositSlot}` : '')
    }
  }, [isOpen, initialData])

  // 大量設備才抓值班時段＋公休日
  useEffect(() => {
    if (!isOpen || !pickupDate) return
    Promise.all([fetchDutySlots(), fetchClosedDates()]).then(([d, c]) => { setDuties(d); setClosedDates(c) })
  }, [isOpen, pickupDate])

  // 時段選項：取件＝起租日當天；繳押金＝現在起 24 工作時內、且不晚於所選取件時段開始
  const now = new Date()
  const pickupKey = pickupDate ? toDateKey(new Date(pickupDate)) : ''
  const pickupDayEnd = new Date(`${pickupKey}T23:59`)
  const pickupOptions = pickupDate && duties
    ? dutySlotOptions(duties, now, pickupDayEnd, closedDates).filter(o => o.date === pickupKey)
    : []
  const depositUntil = new Date(Math.min(
    addBusinessMs(now, PENDING_LIMIT_MS, closedDates).getTime(),
    (pickupSlot ? slotStart(pickupKey, pickupSlot) : pickupDayEnd).getTime()
  ))
  const depositOptions = pickupDate && duties ? dutySlotOptions(duties, now, depositUntil, closedDates) : []
  // 已選的時段不在目前選項內（換了取件時段、或時間已過）→ 視為未選
  const depositValid = depositOptions.some(o => `${o.date} ${o.slot}` === deposit)
  const pickupValid = pickupOptions.some(o => o.slot === pickupSlot)

  // 按 ESC 鍵關閉
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onCancel])

  // 阻止背景滾動
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = () => {
    // 驗證必填欄位
    if (!reason.trim()) {
      alert('請填寫使用原因')
      return
    }

    if (isMassBooking) {
      if (!className.trim()) {
        alert('請填寫使用班級')
        return
      }
      if (!teacher.trim()) {
        alert('請填寫負責老師')
        return
      }
    }

    // 提交資料
    const [depositDate, depositSlot] = deposit.split(' ')
    onConfirm({
      reason: reason.trim(),
      className: isMassBooking ? className.trim() : undefined,
      teacher: isMassBooking ? teacher.trim() : undefined,
      ...(pickupDate ? { depositDate, depositSlot, pickupSlot } : {})
    })
  }

  // 檢查是否可以提交
  const isValid =
    reason.trim() !== '' &&
    (!isMassBooking || (className.trim() !== '' && teacher.trim() !== '')) &&
    (!pickupDate || (pickupValid && depositValid))

  const selectCls =
    "w-full px-3 py-2 bg-[#2b2b2b] border border-[#545454] text-white text-xs focus:outline-none focus:border-white rounded-lg cursor-pointer font-['Inter','Noto_Sans_TC',_sans-serif]"
  const slotHint = (text: string) => (
    <p className="mt-2 text-xs text-[#ff8698] font-['Inter','Noto_Sans_TC',_sans-serif]">{text}</p>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onCancel}
    >
      {/* 對話框容器 */}
      <div
        className="bg-[#151515] border border-[#545454] max-w-md w-full mx-4 flex flex-col rounded-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 標題區 */}
        <div className="px-6 pt-6">
          <h2 className="font-['Inter',_sans-serif] text-sm text-white font-normal">
            Booking Details{' '}
            <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">借用資訊</span>
          </h2>
        </div>

        {/* 表單區（pb 讓橫線與最後一個輸入框保持距離，與 ConfirmDialog 一致） */}
        <div className="px-6 pt-4 pb-4 space-y-4">
          {/* 使用原因 */}
          <div>
            <label className="block mb-2">
              <span className="font-['Inter',_sans-serif] text-xs text-[#cccccc]">
                Reason{' '}
              </span>
              <span className="font-['Inter','Noto_Sans_TC',_sans-serif] text-xs text-[#cccccc]">
                使用原因
              </span>
              <span className="text-[#ff8698] ml-1">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-[#2b2b2b] border border-[#545454] text-white text-xs focus:outline-none focus:border-white resize-none rounded-lg"
              style={{ fontFamily: 'Inter, "Noto Sans TC", sans-serif' }}
              rows={3}
              placeholder="Please fill in the reason for use 請填寫使用原因"
            />
          </div>

          {/* 大量訂單才需要填寫班級和老師 */}
          {isMassBooking && (
            <>
              {/* 使用班級 */}
              <div>
                <label className="block mb-2">
                  <span className="font-['Inter',_sans-serif] text-xs text-[#cccccc]">
                    Class{' '}
                  </span>
                  <span className="font-['Inter','Noto_Sans_TC',_sans-serif] text-xs text-[#cccccc]">
                    使用班級
                  </span>
                  <span className="text-[#ff8698] ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2b2b2b] border border-[#545454] text-white text-xs focus:outline-none focus:border-white rounded-lg"
                  style={{ fontFamily: 'Inter, "Noto Sans TC", sans-serif' }}
                  placeholder="Please fill in the class 請填寫使用班級"
                />
              </div>

              {/* 負責老師 */}
              <div>
                <label className="block mb-2">
                  <span className="font-['Inter',_sans-serif] text-xs text-[#cccccc]">
                    Teacher{' '}
                  </span>
                  <span className="font-['Inter','Noto_Sans_TC',_sans-serif] text-xs text-[#cccccc]">
                    負責老師（若個人用就填個人）
                  </span>
                  <span className="text-[#ff8698] ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2b2b2b] border border-[#545454] text-white text-xs focus:outline-none focus:border-white rounded-lg"
                  style={{ fontFamily: 'Inter, "Noto Sans TC", sans-serif' }}
                  placeholder="Please fill in the teacher in charge 請填寫負責老師"
                />
              </div>
            </>
          )}

          {/* 大量設備：取件時段（起租日）＋繳押金時段（24 工作時內、不晚於取件；同一時段＝同時進行） */}
          {pickupDate && (
            <>
              <div>
                <label className="block mb-2 text-xs text-[#cccccc]">
                  <span className="font-['Inter',_sans-serif]">Pickup </span>
                  <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">取件時段（起租日當天，系學會值班時間）</span>
                  <span className="text-[#ff8698] ml-1">*</span>
                </label>
                <select value={pickupValid ? pickupSlot : ''} onChange={e => setPickupSlot(e.target.value)} className={selectCls}>
                  <option value="" disabled>{duties ? '請選擇' : '載入中…'}</option>
                  {pickupOptions.map(o => <option key={o.slot} value={o.slot}>{slotLabel(o)}</option>)}
                </select>
                {duties && pickupOptions.length === 0 && slotHint('起租日沒有可取件的值班時段，請更改租借日期或洽系學會')}
              </div>
              <div>
                <label className="block mb-2 text-xs text-[#cccccc]">
                  <span className="font-['Inter',_sans-serif]">Deposit </span>
                  <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">繳押金時段（送單後 24 工作時內；可與取件同時）</span>
                  <span className="text-[#ff8698] ml-1">*</span>
                </label>
                <select value={depositValid ? deposit : ''} onChange={e => setDeposit(e.target.value)} className={selectCls}>
                  <option value="" disabled>{duties ? '請選擇' : '載入中…'}</option>
                  {depositOptions.map(o => (
                    <option key={`${o.date} ${o.slot}`} value={`${o.date} ${o.slot}`}>{slotLabel(o)}</option>
                  ))}
                </select>
                {duties && depositOptions.length === 0 && slotHint('24 工作時內沒有可繳押金的值班時段，請洽系學會')}
              </div>
            </>
          )}
        </div>

        {/* 橫線 */}
        <div className="px-6">
          <div className="border-t border-[#545454]"></div>
        </div>

        {/* 按鈕區 */}
        <div className="px-6 py-4 flex justify-end gap-6">
          {/* 取消按鈕 */}
          <button
            onClick={onCancel}
            className="text-[#cccccc] hover:text-white transition-colors cursor-pointer"
          >
            <span className="font-['Inter',_sans-serif] text-xs">
              Cancel{' '}
              <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">取消</span>
            </span>
          </button>

          {/* 確認按鈕 */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`transition-opacity ${
              isValid
                ? 'text-white hover:opacity-70 cursor-pointer'
                : 'text-gray-scale3 cursor-not-allowed'
            }`}
          >
            <span className="font-['Inter',_sans-serif] text-xs">
              Confirm{' '}
              <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">確認</span>
            </span>
          </button>
        </div>
      </div>

      {/* 淡入動畫 */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  )
}

export default BookingDetailsDialog
