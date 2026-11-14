/**
 * 延期對話框
 * 用於訂單延期申請：送出的是「申請」，學生到系學會確認、學會通過後才成立（2026-11-14；沒確認就照原歸還日歸還）
 */

import { BTN } from '@/components/common/btn'
import React, { useState, useEffect } from 'react'
import CloseButton from '../common/CloseButton'
import Collapse from '../common/Collapse'
import { createPortal } from 'react-dom'
import { fetchBlackouts, checkExtendItems, type ExtendCheckItem } from '../../services/ordersService'
import { useAuth } from '../../contexts/AuthContext'
import { useT } from '../../stores/langStore'
import { zipLines } from '../../data/siteContent'
import { useSiteContent } from '../../services/contentService'
import { useEnterConfirm } from '../../hooks/useEnterConfirm'

interface ExtendDialogProps {
  isOpen: boolean
  orderNumber: string
  currentEndDate: string // 原歸還日
  onConfirm: (extendDays: number, itemIds: number[]) => void // 全勾＝整單延期；部分勾＝拆子單
  onCancel: () => void
}

const ExtendDialog: React.FC<ExtendDialogProps> = ({
  isOpen,
  orderNumber,
  currentEndDate,
  onConfirm,
  onCancel
}) => {
  const t = useT()
  const content = useSiteContent()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectedDays, setSelectedDays] = useState(0)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  // 規則說明預設收合（accordion，不另開彈窗）
  const [rulesOpen, setRulesOpen] = useState(false)

  // 寒暑假封鎖（情境 11-a）：學生的延長區間不得跨入封鎖期；admin／staff 不受限，不載入（同 Calendar）
  const { currentUser } = useAuth()
  const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'staff'
  const [blackouts, setBlackouts] = useState<{ start: Date; end: Date }[]>([])

  // 部分延期（情境 5＋8）：選定天數後逐品項查撞期，可勾選要延期的品項
  const [extendItems, setExtendItems] = useState<ExtendCheckItem[] | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (isOpen) {
      // 重置選擇狀態
      setSelectedIndex(null)
      setSelectedDays(0)
      setHoveredIndex(null)
      setRulesOpen(false)
      setExtendItems(null)
      setCheckedIds(new Set())
      if (!isPrivileged) {
        fetchBlackouts().then(ranges => {
          setBlackouts(ranges.map(r => {
            const s = new Date(r.start); s.setHours(0, 0, 0, 0)
            const e = new Date(r.end); e.setHours(0, 0, 0, 0)
            return { start: s, end: e }
          }))
        })
      }
    }
  }, [isOpen, isPrivileged])

  // 天數變更 → 逐品項查該天數下有無撞期（可延的預設勾選、撞期的鎖定不可勾）
  useEffect(() => {
    if (!isOpen || selectedDays === 0) {
      setExtendItems(null)
      setCheckedIds(new Set())
      return
    }
    let alive = true
    checkExtendItems(orderNumber, selectedDays).then(items => {
      if (!alive) return
      setExtendItems(items)
      setCheckedIds(new Set((items ?? []).filter(i => i.extendable).map(i => i.id)))
    })
    return () => { alive = false }
  }, [isOpen, selectedDays, orderNumber])

  useEnterConfirm(isOpen, () => handleConfirm(), selectedDays > 0 && checkedIds.size > 0)

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

    // 第3-9個：原歸還日後7天；延長區間 [原歸還日+1, 新歸還日] 跨入封鎖期則灰化不可選
    for (let i = 1; i <= 7; i++) {
      const extendDate = new Date(dueDate)
      extendDate.setDate(dueDate.getDate() + i)
      extendDate.setHours(0, 0, 0, 0)
      const inBlackout = blackouts.some(r => extendDate >= r.start && dueDate < r.end)
      dates.push({
        date: extendDate,
        day: extendDate.getDate(),
        type: 'extend',
        disabled: inBlackout,
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

  // 勾選切換（撞期品項鎖定不可勾）
  const toggleItem = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isPartial =
    extendItems !== null && checkedIds.size > 0 && checkedIds.size < extendItems.length
  const canSend = selectedDays > 0 && checkedIds.size > 0

  // 處理確認
  const handleConfirm = () => {
    if (canSend) {
      onConfirm(selectedDays, [...checkedIds])
    }
  }

  // 獲取日期單元格的樣式類
  const getDateCellClasses = (index: number, isDisabled: boolean) => {
    let classes = 'text-left font-bold font-english tracking-tighter leading-none py-1 text-[3rem] relative'

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
  const getDateColor = (index: number, isDisabled: boolean) => {
    if (index === 0) {
      return 'text-yellow' // 第一個數字（今天）- 黃色
    } else if (index === 1) {
      return 'text-green' // 第二個數字（原歸還日）- 綠色
    } else if (isDisabled) {
      return 'text-gray-mid' // 封鎖期內的延期選項 - 灰色不可選
    } else {
      return 'text-white' // 其他數字（延期選項）- 白色
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onCancel}
    >
      <div
        className="bg-gray-darker border border-gray-mid rounded-2xl max-w-[800px] w-[90%] mx-4 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題和關閉按鈕 */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-mid">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-sm text-white">
              <span>{t('Extend', '延期')}</span>
            </h2>
            <CloseButton onClick={onCancel} label={t('Close', '關閉')} className="-mt-1" />
          </div>

          {/* 訂單號碼 */}
          <div className="text-xs text-gray-light">
            <span>{t('Order', '訂單號碼')}</span>:{' '}
            <span className="font-english text-white">{orderNumber}</span>
          </div>
        </div>

        {/* 內容區 */}
        <div className="px-6 py-6">
          {/* 規則說明：預設收合，點標題展開（開著＝active 不加 hover） */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setRulesOpen(!rulesOpen)}
              aria-expanded={rulesOpen}
              className={`flex items-center gap-1 text-xs text-gray-light ${rulesOpen ? 'cursor-pointer' : BTN}`}
            >
              {t('Extension rules', '延期規則')}
              <span className={`material-symbols-outlined text-md transition-transform duration-300 ${rulesOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
            <Collapse open={rulesOpen}>
            <div className="text-white text-xs pt-3">
              <ol className="space-y-1">
                {/* 文字從 site_content 讀（後台「文字內容」頁可改）；實際天數限制在程式裡 */}
                {zipLines(content('extend.rules')).map(({ en, zh }, i) => (
                  <li key={i} className="flex gap-2 leading-normal">
                    <span className="flex-shrink-0 min-w-4 font-english">{i + 1}.</span>
                    <p>{t(en, zh)}</p>
                  </li>
                ))}
              </ol>
              <p className="text-gray-light mt-2">
                <span>{t(content('extend.example').en, content('extend.example').zh)}</span>
              </p>
            </div>
            </Collapse>
          </div>

          {/* 日期選擇器和狀態提示（置中） */}
          <div className="flex flex-col items-center mb-6">
            {/* 日期選擇器 */}
            <div className="mb-3">
              <div className="flex items-center">
                {dates.map((date, index) => (
                  <div
                    key={index}
                    className={`${getDateCellClasses(index, date.disabled)} ${getDateCellPadding(index)} ${getDateColor(index, date.disabled)}`}
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
              {/* 送出的是申請：到系學會確認、學會通過後才真的延（2026-11-14） */}
              <p className="font-chinese text-white text-xs">
                申請延期 <span className="font-english">{selectedDays}</span> 天，到系學會確認後新的歸還日是{' '}
                <span className="font-english">{formatNewReturnDate(selectedDays)}</span>。
              </p>
            </div>
          </div>

          {/* 品項勾選（部分延期，情境 5＋8）：選定天數後顯示各品項可否延期 */}
          {/* 只有一件就不列勾選（勾掉就沒東西可延）；那一件撞期時仍要顯示原因 */}
          {selectedDays > 0 && extendItems && (extendItems.length > 1 || !extendItems[0].extendable) && (
            <div className="mb-6">
              {extendItems.length > 1 && (
                <p className="text-xs text-gray-light mb-2">
                  <span>{t('Items to extend', '勾選要延期的品項')}</span>
                </p>
              )}
              <div className="flex flex-col gap-2">
                {extendItems.map(item => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 text-xs ${
                      item.extendable ? 'text-white cursor-pointer' : 'text-white opacity-20 cursor-not-allowed'
                    }`}
                  >
                    {extendItems.length > 1 && (
                      <input
                        type="checkbox"
                        className="custom-checkbox flex-shrink-0"
                        checked={checkedIds.has(item.id)}
                        disabled={!item.extendable}
                        onChange={() => toggleItem(item.id)}
                      />
                    )}
                    <span className="font-chinese">{item.name}</span>
                    {!item.extendable && (
                      <span
                        style={{ color: 'var(--color-error)' }}
                      >
                        {t('Booked by someone else during the extension', '延長期間已被預約')}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              {isPartial && (
                <p className="font-chinese text-xs text-gray-light mt-3">
                  部分延期：系學會確認後，勾選品項拆為子單延期，未勾選品項照原歸還日（
                  <span className="font-english">
                    {dueDate.getMonth() + 1} 月 {dueDate.getDate()} 日
                  </span>
                  ）歸還。
                </p>
              )}
            </div>
          )}

          {/* 橫線 */}
          <div className="border-t border-gray-mid my-4"></div>

          {/* 按鈕 */}
          <div className="flex justify-end gap-6">
            {/* 取消按鈕 */}
            <button
              onClick={onCancel}
              className={`text-gray-light ${BTN}`}
            >
              <span className="font-english text-xs">
                {t('Cancel', '取消')}
              </span>
            </button>

            {/* 送出按鈕 */}
            <button
              onClick={handleConfirm}
              disabled={!canSend}
              className={`text-white ${BTN}`}
            >
              <span className="font-english text-xs">
                {t('Send', '送出')}
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
