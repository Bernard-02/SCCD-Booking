/**
 * 日期編輯對話框
 * 用於編輯過期訂單的日期
 */

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import Calendar from '../Calendar'
import { formatYmd, toDateKey } from './cartHelpers'
import { useAuth } from '../../contexts/AuthContext'
import { isSeniorOrGraduate } from '../../utils/gradeUtils'
import { minStartDate } from '../../utils/timeUtils'
import { useT } from '../../stores/langStore'

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
  const t = useT()
  const { currentUser } = useAuth()
  // 空間上限：一般生 14 天，大四／碩士放寬 30 天（與 DatePickerBar 同規則）
  const spaceMaxDays = isSeniorOrGraduate(currentUser?.year) ? 30 : 14
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
        className="bg-[#151515] border border-[#545454] rounded-2xl max-w-6xl w-full mx-4 max-h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 標題區 */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-sm text-white">
              <span>{t('Edit Date', '編輯日期')}</span>
            </h2>
            {/* 關閉按鈕 */}
            <button
              onClick={onCancel}
              className="text-white hover:opacity-70 transition-opacity cursor-pointer -mt-1"
              aria-label="Close"
            >
              <span className="material-icons text-lg">close</span>
            </button>
          </div>

          {/* 標籤和原始日期在同一行 */}
          <div className="flex items-center justify-between">
            {/* 左側：標籤 - 類別和租借類型 */}
            <div className="flex items-center gap-3">
              {/* 類別標籤 */}
              {category && (
                <div className="px-3 py-1 bg-gray-scale4 rounded-lg flex items-center justify-center">
                  <span className="font-['Inter',_sans-serif] text-xs text-white whitespace-nowrap">
                    {t(category === 'equipment' ? 'Equipment' : 'Space', category === 'equipment' ? '設備' : '空間')}
                  </span>
                </div>
              )}
              {/* 租借類型標籤 */}
              <div className="px-3 py-1 bg-gray-scale4 rounded-lg flex items-center justify-center">
                <span className="font-['Inter',_sans-serif] text-xs text-white whitespace-nowrap">
                  {bookingType === 'little' && (
                    <>
                      {t('Little', '小量')}
                    </>
                  )}
                  {bookingType === 'mass-personal' && (
                    <>
                      {t('Mass (Personal)', '大量（個人）')}
                    </>
                  )}
                  {bookingType === 'mass-group' && (
                    <>
                      {t('Mass (Group)', '大量（團體）')}
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* 右側：顯示原始日期 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#cccccc]">
                <span>{t('Original Date', '原始時段')}</span>
              </span>
              <span className="text-xs text-white font-['Inter',_sans-serif]">
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
            minSelectableDate={minStartDate(category ?? 'equipment', bookingType)}
            maxDays={category === 'space' ? spaceMaxDays : 30}
            variant="dialog"
            originalStartDate={currentStartDate}
            originalEndDate={currentEndDate}
          />
        </div>

        {/* 選中的日期顯示 - 永遠顯示；中段空間放缺貨警語 */}
        <div className="px-6 pb-4">
          <div className="p-4 bg-[#2b2b2b] border border-[#545454] rounded-lg flex justify-between items-center gap-8">
            <div className="shrink-0">
              <p className="text-xs text-[#cccccc]">{t('New Date', '新的時段')}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#ffff00]">{t('After updating the date, items may become out of stock. We\'ll mark them for you.', '更新日期後，部分設備可能缺貨。我們會自動標記缺貨項目。')}</p>
            </div>
            <div className="shrink-0 text-xl text-white font-['Inter',_sans-serif]">
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
            <span className="text-xs">{t('Cancel', '取消')}</span>
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
            <span className="text-xs">{t('Confirm', '確認')}</span>
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
