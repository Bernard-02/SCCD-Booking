/**
 * 延期對話框
 * 用於訂單延期申請
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ExtendDialogProps {
  isOpen: boolean
  orderNumber: string
  currentEndDate: string // 原歸還日
  onConfirm: (extendDays: number) => void
  onCancel: () => void
}

const ExtendDialog: React.FC<ExtendDialogProps> = ({
  isOpen,
  orderNumber,
  currentEndDate,
  onConfirm,
  onCancel
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectedDays, setSelectedDays] = useState(0)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      // 重置選擇狀態
      setSelectedIndex(null)
      setSelectedDays(0)
      setHoveredIndex(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const today = new Date()
  const dueDate = new Date(currentEndDate)

  // 生成日期數字陣列（今天 + 原歸還日 + 後7天）
  const generateExtendDates = () => {
    const dates = []

    // 第1個：今天
    dates.push({
      date: new Date(today),
      day: today.getDate(),
      type: 'today',
      disabled: true,
      extendDays: 0
    })

    // 第2個：原歸還日
    dates.push({
      date: new Date(dueDate),
      day: dueDate.getDate(),
      type: 'due',
      disabled: true,
      extendDays: 0
    })

    // 第3-9個：原歸還日後7天
    for (let i = 1; i <= 7; i++) {
      const extendDate = new Date(dueDate)
      extendDate.setDate(dueDate.getDate() + i)
      dates.push({
        date: extendDate,
        day: extendDate.getDate(),
        type: 'extend',
        disabled: false,
        extendDays: i
      })
    }

    return dates
  }

  const dates = generateExtendDates()

  // 格式化新的歸還日
  const formatNewReturnDate = (days: number) => {
    if (days === 0) return '--'
    const newDueDate = new Date(dueDate)
    newDueDate.setDate(newDueDate.getDate() + days)
    return `${newDueDate.getMonth() + 1} 月 ${newDueDate.getDate()} 日`
  }

  // 處理日期點擊
  const handleDateClick = (index: number, extendDays: number) => {
    if (dates[index].disabled) return

    // 如果點擊已選擇的日期，取消選擇
    if (selectedIndex === index) {
      setSelectedIndex(null)
      setSelectedDays(0)
    } else {
      setSelectedIndex(index)
      setSelectedDays(extendDays)
    }
  }

  // 處理確認
  const handleConfirm = () => {
    if (selectedDays > 0) {
      onConfirm(selectedDays)
    }
  }

  // 獲取日期單元格的樣式類
  const getDateCellClasses = (index: number, isDisabled: boolean) => {
    let classes = 'text-left font-semibold font-[\'Inter\',_sans-serif] tracking-tighter leading-none py-1 text-[3rem] relative'

    if (!isDisabled) {
      classes += ' cursor-pointer'
    }

    // 綠線樣式
    if (index === 0) {
      classes += ' extend-line-start'
    } else if (index === 1) {
      classes += ' extend-line-end'
    } else if (index === 2) {
      classes += ' extend-line-third'
    }

    // Hover 預覽樣式
    if (!isDisabled && hoveredIndex !== null && selectedIndex === null) {
      if (index === 2 && hoveredIndex >= 2) {
        classes += ' hover-preview'
      } else if (index > 2 && index < hoveredIndex) {
        classes += ' hover-preview-extend'
      } else if (index === hoveredIndex) {
        classes += ' hover-preview-end'
      }
    }

    // 選擇狀態樣式
    if (selectedIndex !== null) {
      if (index === 2 && selectedIndex > 2) {
        classes += ' in-range-extend'
      } else if (index > 2 && index < selectedIndex) {
        classes += ' in-range-extend'
      } else if (index === selectedIndex) {
        classes += ' end-date-extend'
      }
    }

    return classes
  }

  // 獲取日期單元格的padding樣式
  const getDateCellPadding = (index: number) => {
    if (index === 0) {
      return 'pr-4'
    } else if (index === 1) {
      return 'px-4 pl-4 pr-2'
    } else {
      return 'px-2'
    }
  }

  // 獲取日期顏色
  const getDateColor = (index: number) => {
    if (index === 0) {
      return 'text-[#ffff00]' // 第一個數字（今天）- 黃色
    } else if (index === 1) {
      return 'text-[#00FF80]' // 第二個數字（原歸還日）- 綠色
    } else {
      return 'text-white' // 其他數字（延期選項）- 白色
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center fadeIn"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onCancel}
    >
      <div
        className="bg-[#151515] border border-[#545454] rounded-lg max-w-[800px] w-[90%] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題和關閉按鈕 */}
        <div className="px-6 pt-6 pb-4 border-b border-[#545454]">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-small-title text-white">
              <span className="font-['Inter',_sans-serif]">Extend</span>{' '}
              <span className="font-['Noto_Sans_TC',_sans-serif]">延期規則</span>
            </h2>
            <button
              onClick={onCancel}
              className="text-white hover:opacity-70 transition-opacity cursor-pointer -mt-1"
              aria-label="Close"
            >
              <span className="material-icons text-[24px]">close</span>
            </button>
          </div>

          {/* 訂單號碼 */}
          <div className="text-tiny text-gray-scale2">
            <span className="font-['Inter',_sans-serif]">Order</span>{' '}
            <span className="font-['Noto_Sans_TC',_sans-serif]">訂單號碼</span>:{' '}
            <span className="font-['Inter',_sans-serif] text-white">{orderNumber}</span>
          </div>
        </div>

        {/* 內容區 */}
        <div className="px-6 py-6">
          {/* 規則說明 */}
          <div className="mb-6">
            <div className="text-white text-tiny space-y-1">
              <p>
                <span className="font-['Inter',_sans-serif]">1. Extension requests must be submitted at least 3 days before the original return date, and only one request may be made per order.</span>{' '}
                <span className="font-['Noto_Sans_TC',_sans-serif]">延期申請需在原訂單歸還日的前三天提出，且僅可以提出乙次申請。</span>
              </p>
              <p>
                <span className="font-['Inter',_sans-serif]">2. If all spaces/equipment in the order cannot be extended together, the request cannot be submitted.</span>{' '}
                <span className="font-['Noto_Sans_TC',_sans-serif]">若訂單內的所有空間/設備無法同時延期，則無法提出申請。</span>
              </p>
              <p>
                <span className="font-['Inter',_sans-serif]">3. Extension days are counted from the original return date, up to a maximum of 7 days.</span>{' '}
                <span className="font-['Noto_Sans_TC',_sans-serif]">延期天數是原歸還日往後開始計算，可最多延期7天。</span>
              </p>
              <p className="text-gray-scale2 mt-2">
                <span className="font-['Inter',_sans-serif]">e.g. If the original return date is 1/20, you must apply by 1/17 (inclusive). You may extend up to 7 days; extending 7 days changes the new return date to 1/27.</span>{' '}
                <span className="font-['Noto_Sans_TC',_sans-serif]">例：假設訂單的原歸還日是1/20，您需要在1/17（含）之前提出延期申請。您可以自由選擇延期的天數，最多7天。若選擇延期7天，則新的歸還日會更改至1/27日。</span>
              </p>
            </div>
          </div>

          {/* 日期選擇器和狀態提示（置中） */}
          <div className="flex flex-col items-center mb-6">
            {/* 日期選擇器 */}
            <div className="mb-3">
              <div className="flex items-center">
                {dates.map((date, index) => (
                  <div
                    key={index}
                    className={`${getDateCellClasses(index, date.disabled)} ${getDateCellPadding(index)} ${getDateColor(index)}`}
                    style={date.disabled ? { pointerEvents: 'none' } : {}}
                    onClick={() => handleDateClick(index, date.extendDays)}
                    onMouseEnter={() => !date.disabled && setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <div className="date-number-wrapper">
                      <span className="date-number-text">{date.day}</span>
                      <span className="date-number-hidden">{date.day}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 狀態提示 */}
            <div style={{ minHeight: '18px' }}>
              <p className="font-['Noto_Sans_TC',_sans-serif] text-white text-tiny">
                您已延期 <span className="font-['Inter',_sans-serif]">{selectedDays}</span> 天，新的歸還日是{' '}
                <span className="font-['Inter',_sans-serif]">{formatNewReturnDate(selectedDays)}</span>。
              </p>
            </div>
          </div>

          {/* 橫線 */}
          <div className="border-t border-[#545454] my-4"></div>

          {/* 按鈕 */}
          <div className="flex justify-end gap-6">
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

            {/* 送出按鈕 */}
            <button
              onClick={handleConfirm}
              disabled={selectedDays === 0}
              className={`transition-opacity ${
                selectedDays > 0
                  ? 'text-white hover:opacity-70 cursor-pointer'
                  : 'text-gray-scale3 cursor-not-allowed'
              }`}
            >
              <span className="font-['Inter',_sans-serif] text-tiny">
                Send{' '}
                <span className="font-['Noto_Sans_TC',_sans-serif]">送出</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ExtendDialog
