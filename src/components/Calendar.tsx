/**
 * 日曆組件
 * 從 calendar-generator.js 遷移
 */

import React, { useState } from 'react'
import { toDateKey } from './cart/cartHelpers'

interface CalendarProps {
  startDate: Date | null
  endDate: Date | null
  onDateSelect: (startDate: Date | null, endDate: Date | null) => void
  isMobile?: boolean
  minSelectableDate?: Date
  bookingType?: 'personal' | 'group'
  maxDays?: number
  variant?: 'default' | 'dialog'
  originalStartDate?: string
  originalEndDate?: string
}

// 日期區固定顯示的行數；6 是任何月份可能的最大行數，固定成 6 讓 month title 永遠不位移
const MIN_CALENDAR_ROWS = 6

// 用不可見的佔位格補滿到指定行數，讓每個月的日期區高度一致（佔位格高度與真實日期格相同）
const padToRows = (cells: JSX.Element[], rows: number, cellSize: string): JSX.Element[] => {
  const padded = [...cells]
  for (let i = padded.length; i < rows * 7; i++) {
    padded.push(
      <div
        key={`pad-${i}`}
        aria-hidden
        className={`text-left text-white ${cellSize} font-semibold font-['Inter',_sans-serif] tracking-tighter leading-none py-1 min-w-0`}
      >
        <div className="date-number-wrapper">
          <span className="date-number-text invisible">0</span>
        </div>
      </div>
    )
  }
  return padded
}

const Calendar: React.FC<CalendarProps> = ({
  startDate,
  endDate,
  onDateSelect,
  isMobile = false,
  minSelectableDate,
  bookingType = 'personal',
  maxDays = 30,
  variant = 'default',
  originalStartDate,
  originalEndDate
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 計算有效的最小可選日期
  const getMinAllowedDate = () => {
    const base = minSelectableDate ? new Date(minSelectableDate) : new Date(today)
    base.setHours(0, 0, 0, 0)

    // 大量模式：最小可選日期是今天+3天
    if (!minSelectableDate && bookingType === 'group') {
      base.setDate(base.getDate() + 3)
    }
    return base
  }

  const minAllowedDate = getMinAllowedDate()

  // 比較兩個日期是否相同
  const isSameDay = (date1: Date | null, date2: Date | null): boolean => {
    if (!date1 || !date2) return false
    return date1.getTime() === date2.getTime()
  }

  // 處理日期點擊
  const handleDateClick = (clickedDate: Date) => {
    if (startDate && endDate) {
      // 已經有完整範圍，重新開始選擇起租日
      onDateSelect(clickedDate, null)
    } else if (!startDate) {
      // 沒有起租日，設置起租日
      onDateSelect(clickedDate, null)
    } else if (startDate && clickedDate >= startDate) {
      // 檢查日期範圍是否超過最大天數限制
      const daysDifference = Math.ceil((clickedDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysDifference <= maxDays) {
        // 有起租日且範圍在最大天數內，設置歸還日
        onDateSelect(startDate, clickedDate)
      }
      // 超過最大天數，不執行任何動作
    } else {
      // 如果選擇的日期早於起租日，重新設置起租日
      onDateSelect(clickedDate, null)
    }
  }

  // 生成月曆
  const generateMonthCalendar = (displayDate: Date) => {
    const cellSize = variant === 'dialog' ? 'text-[3rem]' : 'text-[3.5rem]'
    const month = displayDate.getMonth()
    const year = displayDate.getFullYear()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const firstDayOfWeek = firstDay.getDay() // 0=Sunday
    const daysInMonth = lastDay.getDate()

    const startDateOfCalendar = new Date(firstDay)
    startDateOfCalendar.setDate(startDateOfCalendar.getDate() - firstDayOfWeek)

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const monthNamesChinese = [
      '一月', '二月', '三月', '四月', '五月', '六月',
      '七月', '八月', '九月', '十月', '十一月', '十二月'
    ]

    const totalNeededCells = firstDayOfWeek + daysInMonth
    const rowsNeeded = Math.ceil(totalNeededCells / 7)

    const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

    // 生成星期標題行
    const weekdayCells: JSX.Element[] = []
    weekdays.forEach((day, index) => {
      weekdayCells.push(
        <div
          key={`weekday-${index}`}
          className={`text-left text-white ${cellSize} font-semibold font-['Inter',_sans-serif] tracking-tighter leading-none py-1 min-w-0`}
        >
          {day}
        </div>
      )
    })

    // 生成日期格子
    const dateCells: JSX.Element[] = []
    let currentDateIterator = new Date(startDateOfCalendar)

    // 生成所需數量的日期格子（rowsNeeded週 x 7天）
    for (let i = 0; i < rowsNeeded * 7; i++) {
      const dayNumber = currentDateIterator.getDate()
      const isCurrentMonth = currentDateIterator.getMonth() === month

      if (isCurrentMonth) {
          const currentDateOnly = new Date(currentDateIterator)
          currentDateOnly.setHours(0, 0, 0, 0)

          // 檢查是否為過期日期範圍和有效日期範圍（在 dialog variant 且有原始日期時）
          let isExpiredRange = false
          let isValidRange = false
          if (variant === 'dialog' && originalStartDate && originalEndDate) {
            const origStart = new Date(originalStartDate)
            origStart.setHours(0, 0, 0, 0)
            const origEnd = new Date(originalEndDate)
            origEnd.setHours(0, 0, 0, 0)

            // 如果日期在原始範圍內，且早於今天，則為過期範圍（黃色）
            if (currentDateOnly >= origStart && currentDateOnly <= origEnd && currentDateOnly < today) {
              isExpiredRange = true
            }
            // 如果日期在原始範圍內，且從今天開始，且用戶還沒選擇新日期，則為有效範圍（綠色）
            else if (!startDate && currentDateOnly >= origStart && currentDateOnly <= origEnd && currentDateOnly >= today) {
              isValidRange = true
            }
          }

          // 使用 minAllowedDate 判斷是否為過去/不可選日期
          const isPastDate = currentDateOnly < minAllowedDate

          // 檢查是否超過最大天數範圍
          let isOutOfRange = false
          if (startDate && !endDate) {
            // 使用 startDate 計算範圍
            const baseDate = startDate
            const daysDifference = Math.ceil((currentDateOnly.getTime() - baseDate!.getTime()) / (1000 * 60 * 60 * 24))
            isOutOfRange = daysDifference > maxDays
          }

          const isToday = currentDateOnly.getTime() === today.getTime()

          const isStartDate = startDate && isSameDay(currentDateOnly, startDate)
          const isEndDate = endDate && isSameDay(currentDateOnly, endDate)
          const isSameDaySelected = startDate && endDate && isSameDay(startDate, endDate) && isSameDay(currentDateOnly, startDate)
          const isInRange = startDate && endDate && currentDateOnly > startDate && currentDateOnly < endDate

          // 檢查是否在 hover 預覽範圍內
          const isInHoverRange = startDate && !endDate && hoveredDate &&
            currentDateOnly >= startDate && currentDateOnly <= hoveredDate &&
            hoveredDate >= startDate

          let dateClasses = `text-left text-white ${cellSize} font-semibold font-['Inter',_sans-serif] tracking-tighter leading-none py-1 min-w-0`

          if (isExpiredRange) {
            // 過期範圍：黃色，不可選擇
            dateClasses += ' expired-date'
          } else if (isPastDate || isOutOfRange) {
            dateClasses += ' text-gray-500'
          } else {
            dateClasses += ' cursor-pointer'
            // 有效範圍（綠色標記）
            if (isValidRange) {
              dateClasses += ' valid-range'
            }
            if (isToday) dateClasses += ' today'
            if (isSameDaySelected) dateClasses += ' same-day-selected'
            else if (isStartDate) {
              dateClasses += ' start-date'
              if (!endDate || (startDate && isSameDay(startDate, endDate))) {
                dateClasses += ' only-start'
              }
              // 如果在 hover 預覽範圍內，添加 hover-preview class
              if (isInHoverRange) dateClasses += ' hover-preview'
            } else if (isEndDate) dateClasses += ' end-date'
            else if (isInRange) dateClasses += ' in-range'
            else if (isInHoverRange) dateClasses += ' hover-preview'
          }

          dateCells.push(
            <div
              key={`date-${i}`}
              className={dateClasses}
              data-date={toDateKey(currentDateOnly)}
              onClick={() => !isPastDate && !isOutOfRange && !isExpiredRange && handleDateClick(currentDateOnly)}
              onMouseEnter={() => !isPastDate && !isOutOfRange && !isExpiredRange && setHoveredDate(currentDateOnly)}
              onMouseLeave={() => setHoveredDate(null)}
            >
              <div className="date-number-wrapper">
                <span className="date-number-text">{dayNumber}</span>
                <span className="date-number-hidden">{dayNumber}</span>
              </div>
            </div>
          )
        } else {
          // 其他月份的日期：空白
          dateCells.push(
            <div
              key={`empty-${i}`}
              className={`text-left text-white ${cellSize} font-semibold font-['Inter',_sans-serif] tracking-tighter leading-none py-1 min-w-0`}
            />
          )
        }

        currentDateIterator.setDate(currentDateIterator.getDate() + 1)
    }

    return {
      title: `${year} ${monthNames[month]} ${monthNamesChinese[month]}`,
      weekdayCells,
      dateCells,
      rowsNeeded
    }
  }

  // 導航按鈕狀態
  const canGoPrev = () => {
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    return (
      currentDate.getFullYear() > currentYear ||
      (currentDate.getFullYear() === currentYear && currentDate.getMonth() > currentMonth)
    )
  }

  const canGoNext = () => {
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    return (
      currentDate.getFullYear() < currentYear ||
      (currentDate.getFullYear() === currentYear && currentDate.getMonth() < currentMonth + 1)
    )
  }

  const handlePrevMonth = () => {
    if (canGoPrev()) {
      const newDate = new Date(currentDate)
      newDate.setMonth(newDate.getMonth() - 1)
      setCurrentDate(newDate)
    }
  }

  const handleNextMonth = () => {
    if (canGoNext()) {
      const newDate = new Date(currentDate)
      newDate.setMonth(newDate.getMonth() + 1)
      setCurrentDate(newDate)
    }
  }

  // 桌面版：雙月顯示
  if (!isMobile) {
    const firstMonth = generateMonthCalendar(currentDate)
    const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    const secondMonth = generateMonthCalendar(nextMonthDate)

    // 兩個月取較大行數，且至少 MIN_CALENDAR_ROWS 行，讓日期區高度恆定、month title 不位移
    const cellSize = variant === 'dialog' ? 'text-[3rem]' : 'text-[3.5rem]'
    const displayRows = Math.max(firstMonth.rowsNeeded, secondMonth.rowsNeeded, MIN_CALENDAR_ROWS)
    const firstCells = padToRows(firstMonth.dateCells, displayRows, cellSize)
    const secondCells = padToRows(secondMonth.dateCells, displayRows, cellSize)

    const prevButtonClasses = `nav-arrow prev text-white text-[2rem] select-none ${
      canGoPrev() ? 'cursor-pointer opacity-100' : 'opacity-30 cursor-not-allowed'
    }`
    const nextButtonClasses = `nav-arrow next text-white text-[2rem] select-none ${
      canGoNext() ? 'cursor-pointer opacity-100' : 'opacity-30 cursor-not-allowed'
    }`

    const monthTitleSize = variant === 'dialog' ? 'text-content' : 'text-[2rem]'
    const calendarPadding = variant === 'dialog' ? 'pb-4' : 'pb-8'

    return (
      <div className="w-full">
        <div className="flex gap-12">
          {/* 左側月份 */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className={`flex justify-between items-center ${calendarPadding}`}>
              <div className="flex items-center gap-4">
                <button
                  className={prevButtonClasses}
                  onClick={handlePrevMonth}
                  disabled={!canGoPrev()}
                >
                  &lt;
                </button>
                <button
                  className={nextButtonClasses}
                  onClick={handleNextMonth}
                  disabled={!canGoNext()}
                >
                  &gt;
                </button>
              </div>
              <div className={`text-white ${monthTitleSize} font-normal font-['Inter',_sans-serif] pr-6`}>
                {firstMonth.title}
              </div>
            </div>
            {/* 星期字母行 */}
            <div className="grid grid-cols-7 w-full">
              {firstMonth.weekdayCells}
            </div>
            {/* 日期數字行 */}
            <div className={`grid grid-cols-7 w-full`} style={{ gridTemplateRows: `repeat(${displayRows}, 1fr)` }}>
              {firstCells}
            </div>
          </div>

          {/* 右側月份 */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className={`flex justify-between items-center ${calendarPadding}`}>
              <div className="flex items-center gap-4">
                {/* 隱藏的按鈕占位符以保持高度一致 */}
                <button
                  className={prevButtonClasses}
                  style={{ visibility: 'hidden' }}
                  disabled
                >
                  &lt;
                </button>
                <button
                  className={nextButtonClasses}
                  style={{ visibility: 'hidden' }}
                  disabled
                >
                  &gt;
                </button>
              </div>
              <div className={`text-white ${monthTitleSize} font-normal font-['Inter',_sans-serif] pr-6`}>
                {secondMonth.title}
              </div>
            </div>
            {/* 星期字母行 */}
            <div className="grid grid-cols-7 w-full">
              {secondMonth.weekdayCells}
            </div>
            {/* 日期數字行 */}
            <div className={`grid grid-cols-7 w-full`} style={{ gridTemplateRows: `repeat(${displayRows}, 1fr)` }}>
              {secondCells}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 手機版：單月顯示
  const monthCalendar = generateMonthCalendar(currentDate)
  const mobileCellSize = variant === 'dialog' ? 'text-[3rem]' : 'text-[3.5rem]'
  const mobileRows = Math.max(monthCalendar.rowsNeeded, MIN_CALENDAR_ROWS)
  const mobileCells = padToRows(monthCalendar.dateCells, mobileRows, mobileCellSize)

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <button
          className={`text-white text-xl ${canGoPrev() ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
          onClick={handlePrevMonth}
          disabled={!canGoPrev()}
        >
          &lt;
        </button>
        <div className="text-white text-lg font-['Inter',_sans-serif]">
          {monthCalendar.title}
        </div>
        <button
          className={`text-white text-xl ${canGoNext() ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
          onClick={handleNextMonth}
          disabled={!canGoNext()}
        >
          &gt;
        </button>
      </div>
      {/* 星期字母行 */}
      <div className="grid grid-cols-7 gap-1">
        {monthCalendar.weekdayCells}
      </div>
      {/* 日期數字行 */}
      <div className={`grid grid-cols-7 gap-1`} style={{ gridTemplateRows: `repeat(${mobileRows}, 1fr)` }}>
        {mobileCells}
      </div>
    </div>
  )
}

export default Calendar
