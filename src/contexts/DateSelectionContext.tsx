/**
 * 日期選擇 Context
 * 設備和空間各自有獨立的日期選擇，24小時過期機制
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { BookingType } from '../types/equipment'

interface DateRange {
  startDate: Date | null
  endDate: Date | null
}

interface DateSelection {
  // 小量模式的日期範圍
  littleDates: DateRange
  // 大量模式的日期範圍（包含 mass-personal 和 mass-group）
  massDates: DateRange
  timestamp: number // 儲存選擇的時間戳
  bookingType: BookingType // 當前選擇的租借類型
}

interface DateSelectionContextType {
  // 設備日期
  equipmentDates: DateSelection
  setEquipmentDates: (startDate: Date | null, endDate: Date | null, bookingType?: BookingType) => void
  clearEquipmentDates: () => void
  // 獲取當前模式的設備日期
  getCurrentEquipmentDates: () => { startDate: Date | null; endDate: Date | null; bookingType: BookingType }
  // 切換設備租借類型（不改變日期）
  switchEquipmentBookingType: (newType: BookingType) => void

  // 空間日期
  spaceDates: DateSelection
  setSpaceDates: (startDate: Date | null, endDate: Date | null, bookingType?: BookingType) => void
  clearSpaceDates: () => void
  // 獲取當前模式的空間日期
  getCurrentSpaceDates: () => { startDate: Date | null; endDate: Date | null; bookingType: BookingType }
  // 切換空間租借類型（不改變日期）
  switchSpaceBookingType: (newType: BookingType) => void

  // 清空所有（送單後使用）
  clearAllDates: () => void
}

const EXPIRY_TIME = 24 * 60 * 60 * 1000 // 24小時（毫秒）
const STORAGE_KEY_EQUIPMENT = 'sccd_equipment_dates'
const STORAGE_KEY_SPACE = 'sccd_space_dates'

const defaultDateSelection: DateSelection = {
  littleDates: { startDate: null, endDate: null },
  massDates: { startDate: null, endDate: null },
  timestamp: 0,
  bookingType: 'little'
}

const DateSelectionContext = createContext<DateSelectionContextType | undefined>(undefined)

// 儲存到 localStorage
const saveToStorage = (key: string, selection: DateSelection) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      littleDates: {
        startDate: selection.littleDates.startDate?.toISOString() || null,
        endDate: selection.littleDates.endDate?.toISOString() || null
      },
      massDates: {
        startDate: selection.massDates.startDate?.toISOString() || null,
        endDate: selection.massDates.endDate?.toISOString() || null
      },
      timestamp: selection.timestamp,
      bookingType: selection.bookingType
    }))
  } catch {
    // localStorage 不可用時忽略
  }
}

// 檢查並調整過期的起租日（小量/個人模式）
const adjustExpiredStartDate = (dateRange: DateRange): DateRange => {
  if (!dateRange.startDate) return dateRange

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(dateRange.startDate)
  startDate.setHours(0, 0, 0, 0)

  // 起租日未過期，保持原樣
  if (startDate >= today) {
    return dateRange
  }

  // 起租日已過期，自動調整為今天
  const endDate = dateRange.endDate ? new Date(dateRange.endDate) : null
  let duration = 0

  if (endDate) {
    endDate.setHours(0, 0, 0, 0)
    duration = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
  }

  const newStart = new Date(today)
  const newEnd = endDate && duration > 0 ? new Date(today) : null

  if (newEnd && duration > 0) {
    newEnd.setDate(newEnd.getDate() + duration)
  }

  return {
    startDate: newStart,
    endDate: newEnd
  }
}

// 檢查並調整大量模式的起租日（應該永遠是今天+3天）
const adjustMassStartDate = (dateRange: DateRange, type: 'equipment' | 'space'): DateRange => {
  if (!dateRange.startDate) return dateRange

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(dateRange.startDate)
  startDate.setHours(0, 0, 0, 0)

  // 計算應該的起租日（設備：今天+3天，空間：今天）
  const expectedStart = new Date(today)
  if (type === 'equipment') {
    expectedStart.setDate(expectedStart.getDate() + 3)
  }
  expectedStart.setHours(0, 0, 0, 0)

  // 起租日符合規則，保持原樣
  if (startDate.getTime() === expectedStart.getTime()) {
    return dateRange
  }

  // 起租日不符合規則，重新調整
  const endDate = dateRange.endDate ? new Date(dateRange.endDate) : null
  let duration = 0

  if (endDate) {
    endDate.setHours(0, 0, 0, 0)
    duration = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
  }

  const newStart = new Date(expectedStart)
  const newEnd = endDate && duration > 0 ? new Date(expectedStart) : null

  if (newEnd && duration > 0) {
    newEnd.setDate(newEnd.getDate() + duration)
  }

  return {
    startDate: newStart,
    endDate: newEnd
  }
}

// 從 localStorage 讀取並檢查是否過期
const loadFromStorage = (key: string, type: 'equipment' | 'space'): DateSelection => {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return defaultDateSelection

    const parsed = JSON.parse(stored)
    const now = Date.now()

    // 檢查是否過期（24小時）
    if (now - parsed.timestamp > EXPIRY_TIME) {
      localStorage.removeItem(key)
      return defaultDateSelection
    }

    // 解析日期
    let littleDates: DateRange = {
      startDate: parsed.littleDates?.startDate ? new Date(parsed.littleDates.startDate) : null,
      endDate: parsed.littleDates?.endDate ? new Date(parsed.littleDates.endDate) : null
    }

    let massDates: DateRange = {
      startDate: parsed.massDates?.startDate ? new Date(parsed.massDates.startDate) : null,
      endDate: parsed.massDates?.endDate ? new Date(parsed.massDates.endDate) : null
    }

    // 小量/個人模式：檢查並調整過期的起租日
    littleDates = adjustExpiredStartDate(littleDates)

    // 大量/團體模式：檢查並調整起租日（應符合今天+3天規則）
    massDates = adjustMassStartDate(massDates, type)

    const result: DateSelection = {
      littleDates,
      massDates,
      timestamp: parsed.timestamp,
      bookingType: parsed.bookingType || 'little'
    }

    // 如果有調整，更新 localStorage
    const littleChanged = littleDates.startDate?.getTime() !== new Date(parsed.littleDates?.startDate || 0).getTime()
    const massChanged = massDates.startDate?.getTime() !== new Date(parsed.massDates?.startDate || 0).getTime()

    if (littleChanged || massChanged) {
      saveToStorage(key, result)
    }

    return result
  } catch {
    return defaultDateSelection
  }
}

export const DateSelectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [equipmentDates, setEquipmentDatesState] = useState<DateSelection>(defaultDateSelection)
  const [spaceDates, setSpaceDatesState] = useState<DateSelection>(defaultDateSelection)

  // 初始化時從 localStorage 載入
  useEffect(() => {
    setEquipmentDatesState(loadFromStorage(STORAGE_KEY_EQUIPMENT, 'equipment'))
    setSpaceDatesState(loadFromStorage(STORAGE_KEY_SPACE, 'space'))
  }, [])

  // 定期檢查過期和起租日調整（每分鐘）
  useEffect(() => {
    const checkExpiryAndAdjust = () => {
      const now = Date.now()

      // 檢查設備日期
      if (equipmentDates.timestamp > 0) {
        if (now - equipmentDates.timestamp > EXPIRY_TIME) {
          // 超過24小時，清空
          setEquipmentDatesState(defaultDateSelection)
          localStorage.removeItem(STORAGE_KEY_EQUIPMENT)
        } else {
          // 未超過24小時，檢查起租日是否需要調整
          const adjustedLittleDates = adjustExpiredStartDate(equipmentDates.littleDates)
          const adjustedMassDates = adjustMassStartDate(equipmentDates.massDates, 'equipment')

          const littleChanged = adjustedLittleDates.startDate?.getTime() !== equipmentDates.littleDates.startDate?.getTime()
          const massChanged = adjustedMassDates.startDate?.getTime() !== equipmentDates.massDates.startDate?.getTime()

          if (littleChanged || massChanged) {
            const updatedSelection: DateSelection = {
              ...equipmentDates,
              littleDates: adjustedLittleDates,
              massDates: adjustedMassDates
            }
            setEquipmentDatesState(updatedSelection)
            saveToStorage(STORAGE_KEY_EQUIPMENT, updatedSelection)
          }
        }
      }

      // 檢查空間日期
      if (spaceDates.timestamp > 0) {
        if (now - spaceDates.timestamp > EXPIRY_TIME) {
          // 超過24小時，清空
          setSpaceDatesState(defaultDateSelection)
          localStorage.removeItem(STORAGE_KEY_SPACE)
        } else {
          // 未超過24小時，檢查起租日是否需要調整
          const adjustedLittleDates = adjustExpiredStartDate(spaceDates.littleDates)
          const adjustedMassDates = adjustMassStartDate(spaceDates.massDates, 'space')

          const littleChanged = adjustedLittleDates.startDate?.getTime() !== spaceDates.littleDates.startDate?.getTime()
          const massChanged = adjustedMassDates.startDate?.getTime() !== spaceDates.massDates.startDate?.getTime()

          if (littleChanged || massChanged) {
            const updatedSelection: DateSelection = {
              ...spaceDates,
              littleDates: adjustedLittleDates,
              massDates: adjustedMassDates
            }
            setSpaceDatesState(updatedSelection)
            saveToStorage(STORAGE_KEY_SPACE, updatedSelection)
          }
        }
      }
    }

    const interval = setInterval(checkExpiryAndAdjust, 60000) // 每分鐘檢查
    return () => clearInterval(interval)
  }, [equipmentDates, spaceDates])

  // 設備日期
  const setEquipmentDates = (startDate: Date | null, endDate: Date | null, bookingType: BookingType = 'little') => {
    // 根據 bookingType 更新對應的日期範圍
    const isLittle = bookingType === 'little'
    const newSelection: DateSelection = {
      littleDates: isLittle
        ? { startDate, endDate }
        : equipmentDates.littleDates, // 保留小量的日期
      massDates: !isLittle
        ? { startDate, endDate }
        : equipmentDates.massDates, // 保留大量的日期
      timestamp: Date.now(),
      bookingType
    }
    setEquipmentDatesState(newSelection)
    saveToStorage(STORAGE_KEY_EQUIPMENT, newSelection)
  }

  const clearEquipmentDates = () => {
    setEquipmentDatesState(defaultDateSelection)
    localStorage.removeItem(STORAGE_KEY_EQUIPMENT)
  }

  // 空間日期
  const setSpaceDates = (startDate: Date | null, endDate: Date | null, bookingType: BookingType = 'little') => {
    // 根據 bookingType 更新對應的日期範圍
    const isLittle = bookingType === 'little'
    const newSelection: DateSelection = {
      littleDates: isLittle
        ? { startDate, endDate }
        : spaceDates.littleDates, // 保留小量的日期
      massDates: !isLittle
        ? { startDate, endDate }
        : spaceDates.massDates, // 保留大量的日期
      timestamp: Date.now(),
      bookingType
    }
    setSpaceDatesState(newSelection)
    saveToStorage(STORAGE_KEY_SPACE, newSelection)
  }

  const clearSpaceDates = () => {
    setSpaceDatesState(defaultDateSelection)
    localStorage.removeItem(STORAGE_KEY_SPACE)
  }

  // 清空所有
  const clearAllDates = () => {
    clearEquipmentDates()
    clearSpaceDates()
  }

  // 獲取當前模式的設備日期
  const getCurrentEquipmentDates = () => {
    const isLittle = equipmentDates.bookingType === 'little'
    const currentDates = isLittle ? equipmentDates.littleDates : equipmentDates.massDates
    return {
      startDate: currentDates.startDate,
      endDate: currentDates.endDate,
      bookingType: equipmentDates.bookingType
    }
  }

  // 獲取當前模式的空間日期
  const getCurrentSpaceDates = () => {
    const isLittle = spaceDates.bookingType === 'little'
    const currentDates = isLittle ? spaceDates.littleDates : spaceDates.massDates
    return {
      startDate: currentDates.startDate,
      endDate: currentDates.endDate,
      bookingType: spaceDates.bookingType
    }
  }

  // 切換設備租借類型（只改變 bookingType，不改變日期）
  const switchEquipmentBookingType = (newType: BookingType) => {
    const newSelection: DateSelection = {
      ...equipmentDates,
      bookingType: newType
    }
    setEquipmentDatesState(newSelection)
    saveToStorage(STORAGE_KEY_EQUIPMENT, newSelection)
  }

  // 切換空間租借類型（只改變 bookingType，不改變日期）
  const switchSpaceBookingType = (newType: BookingType) => {
    const newSelection: DateSelection = {
      ...spaceDates,
      bookingType: newType
    }
    setSpaceDatesState(newSelection)
    saveToStorage(STORAGE_KEY_SPACE, newSelection)
  }

  return (
    <DateSelectionContext.Provider
      value={{
        equipmentDates,
        setEquipmentDates,
        clearEquipmentDates,
        getCurrentEquipmentDates,
        switchEquipmentBookingType,
        spaceDates,
        setSpaceDates,
        clearSpaceDates,
        getCurrentSpaceDates,
        switchSpaceBookingType,
        clearAllDates
      }}
    >
      {children}
    </DateSelectionContext.Provider>
  )
}

export const useDateSelection = () => {
  const context = useContext(DateSelectionContext)
  if (context === undefined) {
    throw new Error('useDateSelection must be used within a DateSelectionProvider')
  }
  return context
}
