/**
 * BookingDetailsDialog 組件
 * 用於填寫借用資訊（使用原因、班級、負責老師等）
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface BookingDetailsData {
  reason: string
  className?: string
  teacher?: string
}

interface BookingDetailsDialogProps {
  isOpen: boolean
  bookingType: 'little' | 'mass-personal' | 'mass-group'
  initialData?: BookingDetailsData
  onConfirm: (data: BookingDetailsData) => void
  onCancel: () => void
}

const BookingDetailsDialog: React.FC<BookingDetailsDialogProps> = ({
  isOpen,
  bookingType,
  initialData,
  onConfirm,
  onCancel
}) => {
  const [reason, setReason] = useState('')
  const [className, setClassName] = useState('')
  const [teacher, setTeacher] = useState('')

  const isMassBooking = bookingType === 'mass-personal' || bookingType === 'mass-group'

  // 初始化或更新表單資料
  useEffect(() => {
    if (isOpen) {
      setReason(initialData?.reason || '')
      setClassName(initialData?.className || '')
      setTeacher(initialData?.teacher || '')
    }
  }, [isOpen, initialData])

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
    onConfirm({
      reason: reason.trim(),
      className: isMassBooking ? className.trim() : undefined,
      teacher: isMassBooking ? teacher.trim() : undefined
    })
  }

  // 檢查是否可以提交
  const isValid =
    reason.trim() !== '' &&
    (!isMassBooking || (className.trim() !== '' && teacher.trim() !== ''))

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onCancel}
    >
      {/* 對話框容器 */}
      <div
        className="bg-[#151515] border border-[#545454] max-w-md w-full mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 標題區 */}
        <div className="px-6 pt-6">
          <h2 className="font-['Inter',_sans-serif] text-small-title text-white font-medium">
            Booking Details{' '}
            <span className="font-['Noto_Sans_TC',_sans-serif]">借用資訊</span>
          </h2>
        </div>

        {/* 表單區 */}
        <div className="px-6 py-4 space-y-4">
          {/* 使用原因 */}
          <div>
            <label className="block mb-2">
              <span className="font-['Inter',_sans-serif] text-tiny text-[#cccccc]">
                Reason{' '}
              </span>
              <span className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc]">
                使用原因
              </span>
              <span className="text-[#ff8698] ml-1">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-[#2b2b2b] border border-[#545454] text-white text-tiny focus:outline-none focus:border-white resize-none"
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
                  <span className="font-['Inter',_sans-serif] text-tiny text-[#cccccc]">
                    Class{' '}
                  </span>
                  <span className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc]">
                    使用班級
                  </span>
                  <span className="text-[#ff8698] ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2b2b2b] border border-[#545454] text-white text-tiny focus:outline-none focus:border-white"
                  style={{ fontFamily: 'Inter, "Noto Sans TC", sans-serif' }}
                  placeholder="Please fill in the class 請填寫使用班級"
                />
              </div>

              {/* 負責老師 */}
              <div>
                <label className="block mb-2">
                  <span className="font-['Inter',_sans-serif] text-tiny text-[#cccccc]">
                    Teacher{' '}
                  </span>
                  <span className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc]">
                    負責老師（若個人用就填個人）
                  </span>
                  <span className="text-[#ff8698] ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2b2b2b] border border-[#545454] text-white text-tiny focus:outline-none focus:border-white"
                  style={{ fontFamily: 'Inter, "Noto Sans TC", sans-serif' }}
                  placeholder="Please fill in the teacher in charge 請填寫負責老師"
                />
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
            <span className="font-['Inter',_sans-serif] text-tiny">
              Cancel{' '}
              <span className="font-['Noto_Sans_TC',_sans-serif]">取消</span>
            </span>
          </button>

          {/* 確認按鈕 */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`transition-opacity cursor-pointer ${
              isValid
                ? 'text-white hover:opacity-70'
                : 'text-gray-scale3 cursor-not-allowed'
            }`}
          >
            <span className="font-['Inter',_sans-serif] text-tiny">
              Confirm{' '}
              <span className="font-['Noto_Sans_TC',_sans-serif]">確認</span>
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
