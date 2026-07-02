/**
 * 日期編輯對話框
 * 用於編輯過期訂單的日期
 */

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import Calendar from '../Calendar'
import { formatYmd, toDateKey } from './cartHelpers'

interface DateEditDialogProps {
  isOpen: boolean
  currentStartDate: string
  currentEndDate: string
  bookingType: 'little' | 'mass-personal' | 'mass-group'
  category?: 'equipment' | 'space'
  onConfirm: (newStartDate: string, newEndDate: string) => void
  onCancel: () => void
}

const DateEditDialog: React.FC<DateEditDialogProps> = ({
  isOpen,
  currentStartDate,
  currentEndDate,
  bookingType,
  category,
  onConfirm,
  onCancel
}) => {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  if (!isOpen) return null

  const handleDateSelect = (newStart: Date | null, newEnd: Date | null) => {
    setStartDate(newStart)
    setEndDate(newEnd)
  }

  const handleConfirm = () => {
    if (startDate && endDate) {
      onConfirm(toDateKey(startDate), toDateKey(endDate))
    }
  }

  const isConfirmDisabled = !startDate || !endDate

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center py-15"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onCancel}
    >
      <div
        className="bg-[#151515] border border-[#545454] rounded-lg max-w-6xl w-full mx-4 max-h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 標題區 */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-small-title text-white">
              <span className="font-['Inter',_sans-serif]">Edit Date</span>{' '}
              <span className="font-['Noto_Sans_TC',_sans-serif]">編輯日期</span>
            </h2>
            {/* 關閉按鈕 */}
            <button
              onClick={onCancel}
              className="text-white hover:opacity-70 transition-opacity cursor-pointer -mt-1"
              aria-label="Close"
            >
              <span className="material-icons text-[24px]">close</span>
            </button>
          </div>

          {/* 標籤和原始日期在同一行 */}
          <div className="flex items-center justify-between">
            {/* 左側：標籤 - 類別和租借類型 */}
            <div className="flex items-center gap-3">
              {/* 類別標籤 */}
              {category && (
                <div className="px-3 py-1 bg-gray-scale4 rounded-lg flex items-center justify-center">
                  <span className="font-['Inter',_sans-serif] text-tiny text-white whitespace-nowrap">
                    {category === 'equipment' ? 'Equipment' : 'Space'}{' '}
                    <span className="font-['Noto_Sans_TC',_sans-serif]">
                      {category === 'equipment' ? '設備' : '空間'}
                    </span>
                  </span>
                </div>
              )}
              {/* 租借類型標籤 */}
              <div className="px-3 py-1 bg-gray-scale4 rounded-lg flex items-center justify-center">
                <span className="font-['Inter',_sans-serif] text-tiny text-white whitespace-nowrap">
                  {bookingType === 'little' && (
                    <>
                      Little{' '}
                      <span className="font-['Noto_Sans_TC',_sans-serif]">小量</span>
                    </>
                  )}
                  {bookingType === 'mass-personal' && (
                    <>
                      Mass (Personal){' '}
                      <span className="font-['Noto_Sans_TC',_sans-serif]">大量（個人）</span>
                    </>
                  )}
                  {bookingType === 'mass-group' && (
                    <>
                      Mass (Group){' '}
                      <span className="font-['Noto_Sans_TC',_sans-serif]">大量（團體）</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* 右側：顯示原始日期 */}
            <div className="flex items-center gap-2">
              <span className="text-tiny text-[#cccccc]">
                <span className="font-['Inter',_sans-serif]">Original Date</span>{' '}
                <span className="font-['Noto_Sans_TC',_sans-serif]">原始時段</span>
              </span>
              <span className="text-tiny text-white font-['Inter',_sans-serif]">
                {(() => {
                  const formatDate = (dateStr: string) => formatYmd(new Date(dateStr))
                  return `${formatDate(currentStartDate)} - ${formatDate(currentEndDate)}`
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* 日曆區 */}
        <div className="px-8 pb-4">
          <Calendar
            startDate={startDate}
            endDate={endDate}
            onDateSelect={handleDateSelect}
            bookingType={bookingType === 'mass-group' ? 'group' : 'personal'}
            maxDays={30}
            variant="dialog"
            originalStartDate={currentStartDate}
            originalEndDate={currentEndDate}
          />
        </div>

        {/* 選中的日期顯示 - 永遠顯示；中段空間放缺貨警語 */}
        <div className="px-6 pb-4">
          <div className="p-4 bg-[#2b2b2b] border border-[#545454] rounded-lg flex justify-between items-center gap-8">
            <div className="shrink-0">
              <p className="text-tiny text-[#cccccc] font-['Inter',_sans-serif]">
                New Date
              </p>
              <p className="text-tiny text-[#cccccc] font-['Noto_Sans_TC',_sans-serif]">
                新的時段
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-tiny text-[#ffff00] font-['Inter',_sans-serif]">
                After updating the date, items may become out of stock. We'll mark them for you.
              </p>
              <p className="text-tiny text-[#ffff00] font-['Noto_Sans_TC',_sans-serif]">
                更新日期後，部分設備可能缺貨。我們會自動標記缺貨項目。
              </p>
            </div>
            <div className="shrink-0 text-medium-title text-white font-['Inter',_sans-serif]">
              {(() => {
                const startStr = startDate ? formatYmd(startDate) : '----/--/--'
                const endStr = endDate ? formatYmd(endDate) : '----/--/--'
                return `${startStr} - ${endStr}`
              })()}
            </div>
          </div>
        </div>

        {/* 橫線 */}
        <div className="px-6">
          <div className="border-t border-[#545454]"></div>
        </div>

        {/* 按鈕區 */}
        <div className="px-6 py-4 flex justify-end gap-6">
          <button
            onClick={onCancel}
            className="text-[#cccccc] hover:text-white transition-colors cursor-pointer"
          >
            <span className="font-['Inter',_sans-serif] text-tiny">Cancel</span>{' '}
            <span className="font-['Noto_Sans_TC',_sans-serif] text-tiny">取消</span>
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`transition-opacity cursor-pointer ${
              isConfirmDisabled
                ? 'text-gray-scale3 cursor-not-allowed'
                : 'text-white hover:opacity-70'
            }`}
          >
            <span className="font-['Inter',_sans-serif] text-tiny">Confirm</span>{' '}
            <span className="font-['Noto_Sans_TC',_sans-serif] text-tiny">確認</span>
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

export default DateEditDialog
