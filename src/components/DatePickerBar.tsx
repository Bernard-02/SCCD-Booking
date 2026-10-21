/**
 * 時間選擇欄組件
 * Fixed 在 main 內部底部的日期選擇器
 * 支援設備和空間各自獨立的日期選擇
 */

import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Calendar from './Calendar'
import DateEditDialog from './cart/DateEditDialog'
import { readCart, writeCart, formatYmd, toDateKey } from './cart/cartHelpers'
import { minStartDate } from '../utils/timeUtils'
import { useDateSelection } from '../contexts/DateSelectionContext'
import { useAuth } from '../contexts/AuthContext'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { fetchMyOrders } from '../services/ordersService'
import { isSeniorOrGraduate } from '../utils/gradeUtils'
import type { BookingType } from '../types/equipment'
import { useT } from '../stores/langStore'

interface DatePickerBarProps {
  type: 'equipment' | 'space'
}

const DatePickerBar: React.FC<DatePickerBarProps> = ({ type }) => {
  const t = useT()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  // 空間上限：一般生 14 天，大四／碩士放寬 30 天（rental-rules「年級限制」）
  const spaceMaxDays = isSeniorOrGraduate(currentUser?.year) ? 30 : 14
  const [isExpanded, setIsExpanded] = useState(false)
  const [originalDates, setOriginalDates] = useState<{
    startDate: Date | null
    endDate: Date | null
  }>({ startDate: null, endDate: null })
  const [showExistingDates, setShowExistingDates] = useState(false)
  // 已選日期中過期的時段：點擊後直接開啟日期編輯對話框
  const [editingExpired, setEditingExpired] = useState<{
    startDate: string
    endDate: string
    bookingType: BookingType
  } | null>(null)
  // 編輯過期日期後 bump，讓 existingCartDates 重新讀取購物車
  const [cartVersion, setCartVersion] = useState(0)

  const {
    equipmentDates,
    setEquipmentDates,
    clearEquipmentDates,
    getCurrentEquipmentDates,
    switchEquipmentBookingType,
    spaceDates,
    setSpaceDates,
    clearSpaceDates,
    getCurrentSpaceDates,
    switchSpaceBookingType
  } = useDateSelection()

  // 根據 type 選擇對應的日期
  const currentDates = type === 'equipment' ? getCurrentEquipmentDates() : getCurrentSpaceDates()
  const startDate = currentDates.startDate
  const endDate = currentDates.endDate
  const bookingType = currentDates.bookingType
  const isMass = bookingType === 'mass-personal' || bookingType === 'mass-group'

  const minSelectableDate = minStartDate(type, bookingType)

  // 格式化日期顯示
  const formatDate = (date: Date | null): string => {
    if (!date) return '----/--/--'
    return formatYmd(date)
  }

  // 處理日期選擇
  const handleDateSelect = (start: Date | null, end: Date | null) => {
    if (type === 'equipment') {
      setEquipmentDates(start, end, bookingType)
    } else {
      setSpaceDates(start, end, bookingType)
    }

    // 如果選擇了歸還日（完整日期範圍），自動關閉日曆
    if (start && end) {
      setIsExpanded(false)
    }
  }

  // ---- 同類型限一單（rental-rules §5、新規則 7）：選日期／切類型的當下就擋，不用等到購物車或送單 ----
  const isMassType = (bt: BookingType) => bt !== 'little'
  const typeLabel = (bt: BookingType) =>
    !isMassType(bt) ? (type === 'space' ? '個人' : '小量') : (type === 'space' ? '團體' : '大量')
  const what = type === 'space' ? '空間' : '設備'
  const periodText = (s: string, e: string) => `${formatDateFull(s)} – ${formatDateFull(e)}`

  // 未歸還的訂單（待繳押金／租借中／逾期）：同類型要等上一張歸還才能再借。只擋學生（系秘／助教直借不限）；
  // 進頁面查一次，查不到就不擋——送單時 submit_orders 仍會擋
  const [openOrders, setOpenOrders] = useState<
    { rentalNumber: string; startDate: string; endDate: string; isEquip: boolean; isMass: boolean; modifiable: boolean }[]
  >([])
  const isStudent = !!currentUser && (currentUser.role ?? 'student') === 'student'
  useEffect(() => {
    if (!isStudent) { setOpenOrders([]); return }
    let alive = true
    fetchMyOrders()
      .then(rows => {
        if (!alive) return
        setOpenOrders(rows
          .filter(o => o.status === 'pending' || o.status === 'in-progress' || o.status === 'overdue')
          .map(o => ({
            rentalNumber: o.rental_number,
            startDate: o.start_date,
            endDate: o.end_date,
            isEquip: o.order_items.some(i => i.item_type === 'equipment'),
            isMass: o.booking_type !== 'little',
            // 設備單（小量／大量）待繳押金／已繳待取件／租借中 → 可直接改原單加設備（情境 3）
            modifiable: o.order_items.some(i => i.item_type === 'equipment') && o.status !== 'overdue'
          })))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [isStudent])
  const openOrderFor = (bt: BookingType) =>
    openOrders.find(o => o.isEquip === (type === 'equipment') && o.isMass === isMassType(bt))

  const promptOpenOrder = async (o: (typeof openOrders)[number], bt: BookingType) => {
    // 設備單常是忘了還有一張：不用另開新單，直接帶去修改那張
    if (o.modifiable) {
      const edit = await confirm({
        title: '已有一張訂單', titleEn: 'Existing Order',
        message: `您已有一張${typeLabel(bt)}${what}訂單（${o.rentalNumber}，${periodText(o.startDate, o.endDate)}），` +
          `學會規定同類型一次一張。要加設備請直接修改這張訂單。`,
        confirmText: 'Edit Order', confirmTextZh: '修改訂單'
      })
      if (edit) navigate('/profile', { state: { editOrder: o.rentalNumber } })
      return
    }
    const ok = await confirm({
      title: '尚有未歸還的訂單', titleEn: 'Unreturned Order',
      message: `您有一張未歸還的${typeLabel(bt)}${what}訂單（${o.rentalNumber}，${periodText(o.startDate, o.endDate)}），` +
        `學會規定上一張歸還後才能再借同類型，目前無法選擇日期。`,
      confirmText: 'View Orders', confirmTextZh: '查看訂單'
    })
    if (ok) navigate('/profile')
  }

  // 購物車裡同類別的訂單（一次只能一張；舊購物車可能多張，過期的優先——要先 Renew）。
  // match 可再篩租借類型（切類型時只找「另一種」類型）
  const findCartOrder = (match: (bt: BookingType) => boolean = () => true) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const items = readCart().filter(item =>
      (item.category === 'equipment' ? 'equipment' : 'space') === type && match(item.bookingType || 'little')
    )
    if (items.length === 0) return null
    const isExpired = (d: string) => { const s = new Date(d); s.setHours(0, 0, 0, 0); return s < today }
    const pick = items.find(item => isExpired(item.startDate)) ?? items[0]
    return {
      startDate: pick.startDate,
      endDate: pick.endDate,
      bookingType: (pick.bookingType || 'little') as BookingType,
      isExpired: isExpired(pick.startDate)
    }
  }

  // 購物車已有同類別訂單時的提示：過期 → Renew（開日期編輯）；切到另一種類型 → 已達上限（前往購物車）；
  // 同類型另選日期 → 一次一張，提供沿用這張訂單的日期繼續加入
  const promptCartOrder = async (c: NonNullable<ReturnType<typeof findCartOrder>>, newType?: BookingType) => {
    const period = periodText(c.startDate, c.endDate)
    if (c.isExpired) {
      const ok = await confirm({
        title: '訂單需要重新選擇日期', titleEn: 'Renew Required',
        message: `購物車內的${typeLabel(c.bookingType)}${what}訂單（${period}）已過期，需要重新選擇日期（Renew）才能送出。\n` +
          `${what}一次只能有一張訂單，請先處理這張訂單。`,
        confirmText: 'Renew', confirmTextZh: '重新選擇日期'
      })
      if (ok) setEditingExpired({ startDate: c.startDate, endDate: c.endDate, bookingType: c.bookingType })
    } else if (newType) {
      const ok = await confirm({
        title: '已達訂單上限', titleEn: 'Order Limit Reached',
        message: `購物車已有一張${typeLabel(c.bookingType)}${what}訂單（${period}），${what}一次只能有一張訂單，` +
          `無法再新增${typeLabel(newType)}${what}訂單。\n請先送出或清除購物車內的訂單。`,
        confirmText: 'Go to Cart', confirmTextZh: '前往購物車'
      })
      if (ok) navigate('/cart')
    } else {
      const ok = await confirm({
        title: '購物車已有訂單', titleEn: 'Order in Cart',
        message: `購物車已有一張${typeLabel(c.bookingType)}${what}訂單（${period}），${what}一次只能有一張訂單，無法另選日期。\n` +
          `要沿用這張訂單的日期繼續加入嗎？（要換日期請到購物車修改）`,
        confirmText: 'Use These Dates', confirmTextZh: '沿用此日期'
      })
      if (ok) handleSelectExistingDate(c.startDate, c.endDate, c.bookingType)
    }
  }

  // 處理租借類型變更
  const handleBookingTypeChange = (newType: 'little' | 'mass-personal' | 'mass-group') => {
    if (newType !== bookingType) {
      const open = openOrderFor(newType)
      if (open) { void promptOpenOrder(open, newType); return }
      const conflict = findCartOrder(bt => isMassType(bt) !== isMassType(newType))
      if (conflict) { void promptCartOrder(conflict, newType); return }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 檢查是從小量切換到大量
    const switchingFromLittleToMass = bookingType === 'little' && newType !== 'little'

    // 獲取完整的日期狀態
    const fullDates = type === 'equipment' ? equipmentDates : spaceDates
    const switchFunc = type === 'equipment' ? switchEquipmentBookingType : switchSpaceBookingType
    const setDatesFunc = type === 'equipment' ? setEquipmentDates : setSpaceDates

    if (switchingFromLittleToMass) {
      // 從小量/個人切換到大量/團體
      // 檢查大量模式是否已有保存的日期
      const massStartDate = fullDates.massDates.startDate

      if (!massStartDate && startDate) {
        // 大量模式還沒有日期，檢查小量的起租日是否是今天
        const isStartDateToday = startDate.getTime() === today.getTime()

        if (isStartDateToday && type === 'equipment') {
          // 起租日是今天且是設備：自動延期 +3 天
          // 空間不需要延期
          const newStartDate = new Date(startDate.getTime() + (3 * 24 * 60 * 60 * 1000))
          newStartDate.setHours(0, 0, 0, 0)

          let newEndDate = null
          if (endDate) {
            newEndDate = new Date(endDate.getTime() + (3 * 24 * 60 * 60 * 1000))
            newEndDate.setHours(0, 0, 0, 0)
          }

          // 設置大量的日期並切換類型
          setDatesFunc(newStartDate, newEndDate, newType)
        } else {
          // 起租日不是今天 或 是空間：直接切換，不改變日期
          switchFunc(newType)
        }
      } else {
        // 大量模式已有日期，直接切換
        switchFunc(newType)
      }
    } else {
      // 其他情況：直接切換類型，不改變日期
      switchFunc(newType)
    }
  }

  // 處理起租日點擊 - 開啟日曆（開之前先擋：同類型有未歸還單、或購物車已有同類別訂單）
  const handleStartDateClick = () => {
    if (isExpanded) return
    const open = openOrderFor(bookingType)
    if (open) { void promptOpenOrder(open, bookingType); return }
    const cartOrder = findCartOrder()
    if (cartOrder) { void promptCartOrder(cartOrder); return }

    // 展開日曆，並保存當前日期狀態
    const datesToSave = type === 'equipment' ? getCurrentEquipmentDates() : getCurrentSpaceDates()
    setOriginalDates({
      startDate: datesToSave.startDate,
      endDate: datesToSave.endDate
    })
    setIsExpanded(true)
  }

  // 處理 Reset 按鈕
  const handleReset = () => {
    if (type === 'equipment') {
      clearEquipmentDates()
    } else {
      clearSpaceDates()
    }
  }

  // 處理 Cancel 按鈕
  const handleCancel = () => {
    // 還原成打開前的日期
    if (type === 'equipment') {
      setEquipmentDates(originalDates.startDate, originalDates.endDate, bookingType)
    } else {
      setSpaceDates(originalDates.startDate, originalDates.endDate, bookingType)
    }
    setIsExpanded(false)
  }

  // 判斷按鈕狀態
  const hasAnyDate = startDate !== null
  const isResetEnabled = hasAnyDate

  // 計算樣式（簡化條件邏輯）
  const getButtonStyles = (isActive: boolean) => {
    return {
      radio: isActive ? 'border-white' : 'border-gray-scale2 group-hover:border-white',
      dot: 'bg-white',
      text: isActive ? 'text-white' : 'text-gray-scale2 group-hover:!text-white'
    }
  }

  const littleStyles = getButtonStyles(bookingType === 'little')
  const massStyles = getButtonStyles(isMass)

  // 從購物車獲取已選日期（僅未過期的）
  const existingCartDates = useMemo(() => {
    try {
      const cart = readCart()
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // 先計算每個時段的小量設備總數，用於檢查 9 件限制（僅計設備；空間由押金 cap 限量）
      const periodTotals = new Map<string, number>()

      cart.forEach(item => {
        // 檢查是否過期
        const itemStartDate = new Date(item.startDate)
        itemStartDate.setHours(0, 0, 0, 0)
        if (itemStartDate < today) return

        if (item.category === 'equipment' && (item.bookingType || 'little') === 'little') {
          const periodKey = `${item.startDate}_${item.endDate}`
          periodTotals.set(periodKey, (periodTotals.get(periodKey) || 0) + item.quantity)
        }
      })

      // 按 category 過濾並去重（過期時段保留，以 isExpired 標記，點擊改為編輯日期）
      const filteredCart = cart.filter(item => {
        const itemCategory = item.category === 'equipment' ? 'equipment' : 'space'
        return itemCategory === type
      })

      // 按日期分組（去重並計算數量）
      const dateGroups = new Map<string, {
        startDate: string
        endDate: string
        bookingType: BookingType
        itemCount: number
        isDisabled: boolean
        isExpired: boolean
      }>()

      filteredCart.forEach(item => {
        const key = `${item.startDate}_${item.endDate}_${item.bookingType || 'little'}`
        if (!dateGroups.has(key)) {
          const periodKey = `${item.startDate}_${item.endDate}`
          const bookingType = item.bookingType || 'little'
          const periodTotal = periodTotals.get(periodKey) || 0

          const groupStartDate = new Date(item.startDate)
          groupStartDate.setHours(0, 0, 0, 0)
          const isExpired = groupStartDate < today

          // 小量訂單且已達到 9 件限制時禁用（過期時段不禁用，開放點擊編輯日期）
          const isDisabled = !isExpired && type === 'equipment' && bookingType === 'little' && periodTotal >= 9

          dateGroups.set(key, {
            startDate: item.startDate,
            endDate: item.endDate,
            bookingType: bookingType,
            itemCount: 0,
            isDisabled: isDisabled,
            isExpired: isExpired
          })
        }

        const group = dateGroups.get(key)!
        // 計算數量：設備使用 quantity，空間每個 item 算 1
        if (item.category === 'equipment') {
          group.itemCount += item.quantity
        } else {
          group.itemCount += 1
        }
      })

      // 轉換為數組並排序（最近的日期在前）
      return Array.from(dateGroups.values()).sort((a, b) => {
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      })
    } catch {
      return []
    }
  }, [type, cartVersion])

  // 處理選擇已有日期
  const handleSelectExistingDate = (startDate: string, endDate: string, selectedBookingType: BookingType) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)

    if (type === 'equipment') {
      setEquipmentDates(start, end, selectedBookingType)
    } else {
      setSpaceDates(start, end, selectedBookingType)
    }

    // 關閉彈出視窗
    setShowExistingDates(false)
  }

  // 確認編輯過期時段的日期：更新購物車後直接帶入新日期
  const handleConfirmExpiredEdit = (newStartDate: string, newEndDate: string) => {
    if (!editingExpired) return

    const dateKey = `${editingExpired.startDate}_${editingExpired.endDate}`
    const updatedCart = readCart().map(item => {
      const itemCategory = item.category === 'equipment' ? 'equipment' : 'space'
      return `${item.startDate}_${item.endDate}` === dateKey && itemCategory === type
        ? { ...item, startDate: newStartDate, endDate: newEndDate }
        : item
    })
    writeCart(updatedCart)

    handleSelectExistingDate(newStartDate, newEndDate, editingExpired.bookingType)
    setEditingExpired(null)
    setCartVersion(v => v + 1)
  }

  // 格式化日期顯示（完整版本）
  const formatDateFull = (dateString: string): string => {
    return formatYmd(new Date(dateString))
  }

  // 點擊外部關閉彈出視窗
  useEffect(() => {
    if (!showExistingDates) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // 如果點擊的不是彈出視窗或按鈕本身，關閉彈出視窗
      if (!target.closest('.existing-dates-popup') && !target.closest('.existing-dates-btn')) {
        setShowExistingDates(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExistingDates])

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col">
      {/* 日曆區域 - 從 Bar 後面往上展開 */}
      <div
        className="bg-black overflow-hidden transition-all duration-500 ease-in-out relative"
        style={{
          maxHeight: isExpanded ? 'calc(100vh - 5rem - 3.5rem)' : '0',
          height: isExpanded ? 'calc(100vh - 5rem - 3.5rem)' : '0'
        }}
      >
        {/* X 按鈕 - 固定在右上角（header 下方），只在展開時顯示 */}
        {isExpanded && (
          <div className="absolute top-0 left-0 right-0 container flex justify-end pt-28">
            <button
              onClick={handleCancel}
              className="text-xl font-normal text-white hover:opacity-70 transition-opacity cursor-pointer leading-none"
              aria-label="關閉"
            >
              ×
            </button>
          </div>
        )}

        {/* 日曆 - 對齊底部 */}
        <div className="h-full flex flex-col justify-end">
          <div className="container flex gap-6">
            {/* 左側空白區域：20% */}
            <div className="w-[20%] flex-shrink-0"></div>

            {/* 右側內容區域：80% */}
            <div className="w-[80%]">
              <Calendar
                startDate={startDate}
                endDate={endDate}
                onDateSelect={handleDateSelect}
                minSelectableDate={minSelectableDate}
                maxDays={type === 'space' ? spaceMaxDays : 30}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bar 區域 - 固定在底部 */}
      <div className="bg-black container flex gap-6 pt-4 flex-shrink-0">
        {/* 左側空白區域：20% */}
        <div className="w-[20%] flex-shrink-0"></div>

        {/* 右側內容區域：80% */}
        {/* RWD：@container ＋ 右側按鈕在欄寬不足時改上下排列，而非被裁切
            （不能用 overflow-x 捲動——會把 Exist Cart 彈出視窗一起裁掉）；
            flex-wrap 為更窄時的最後防線 */}
        <div className="w-[80%] @container flex flex-wrap items-center justify-between gap-y-2 overflow-visible">
          {/* 左邊群組：租借類型選擇、起租日、歸還日 */}
          <div className="flex flex-wrap items-center gap-6 gap-y-2">
            {/* 第一組：租借類型選擇 */}
            <div className="flex items-center gap-12 flex-shrink-0">
              {/* 租借類型選擇 - 橫向排列 */}
              <div className="flex items-center gap-8 flex-shrink-0">
                <button
                  onClick={() => handleBookingTypeChange('little')}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${littleStyles.radio}`}>
                    {bookingType === 'little' && (
                      <div className={`w-2 h-2 rounded-full ${littleStyles.dot}`}></div>
                    )}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className={`text-xs transition-colors leading-tight ${littleStyles.text}`}>{t(type === 'space' ? 'Personal' : 'Light', type === 'space' ? '個人' : '小量')}</span>
                  </div>
                </button>

                <button
                  onClick={() => handleBookingTypeChange(type === 'space' ? 'mass-group' : 'mass-personal')}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${massStyles.radio}`}>
                    {(isMass) && (
                      <div className={`w-2 h-2 rounded-full ${massStyles.dot}`}></div>
                    )}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className={`text-xs transition-colors leading-tight ${massStyles.text}`}>{t(type === 'space' ? 'Group' : 'Mass', type === 'space' ? '團體' : '大量')}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 第二組：起租日 + 歸還日 */}
            <div className="flex items-center gap-10 flex-shrink-0 ml-6">
              {/* 起租日 - 可點擊開啟日曆 */}
              <div
                className="flex items-center gap-8 flex-shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
                onClick={handleStartDateClick}
              >
              <div className="flex flex-col">
                <span className="text-xs text-gray-scale2 leading-tight">{t('Start Date', '起租日')}</span>
              </div>
              <span className="text-2xl font-['Inter',_sans-serif] font-normal text-white">
                {formatDate(startDate)}
              </span>
            </div>

            {/* 歸還日 */}
            <div className="flex items-center gap-8 flex-shrink-0">
              <div className="flex flex-col">
                <span className="text-xs text-gray-scale2 leading-tight">{t('End Date', '歸還日')}</span>
              </div>
              <span className="text-2xl font-['Inter',_sans-serif] font-normal text-white">
                {formatDate(endDate)}
              </span>
              </div>
            </div>
          </div>

          {/* 右邊群組：操作按鈕 - Reset + Exist Cart */}
          <div className="flex items-center gap-8 flex-shrink-0 relative ml-auto @max-[1040px]:flex-col @max-[1040px]:items-end @max-[1040px]:gap-1">
            <button
              disabled={!isResetEnabled}
              onClick={handleReset}
              className={`text-sm font-['Inter',_sans-serif] font-normal whitespace-nowrap ${
                isResetEnabled
                  ? 'text-white hover:opacity-70 transition-opacity cursor-pointer'
                  : 'text-gray-scale4 cursor-not-allowed'
              }`}
            >
              {t('Reset', '重置')}
            </button>

            {/* Exist Cart 按鈕 */}
            <button
              onClick={() => setShowExistingDates(!showExistingDates)}
              disabled={existingCartDates.length === 0}
              className={`existing-dates-btn text-sm font-['Inter',_sans-serif] font-normal whitespace-nowrap ${
                existingCartDates.length > 0
                  ? 'text-white hover:opacity-70 transition-opacity cursor-pointer'
                  : 'text-gray-scale4 cursor-not-allowed'
              }`}
            >
              {t('Exist Cart', '已選日期')}
            </button>

            {/* 彈出視窗 - 在按鈕上方顯示 */}
            {showExistingDates && existingCartDates.length > 0 && (
              <div className="existing-dates-popup absolute bottom-full right-0 mb-8 bg-gray-scale6 border border-gray-scale4 rounded-lg min-w-[360px] max-h-[400px] overflow-y-auto z-[100]">
                {/* 標題 */}
                <div className="px-4 py-3 border-b border-gray-scale4">
                  <span className="text-sm text-white">{t('Existing Cart Dates', '購物車已選日期')}</span>
                </div>

                {/* 日期列表 - 以分隔線方式呈現 */}
                <div className="flex flex-col">
                  {existingCartDates.map((dateGroup, index) => {
                    const isCurrentSelection =
                      startDate && toDateKey(startDate) === dateGroup.startDate &&
                      endDate && toDateKey(endDate) === dateGroup.endDate &&
                      bookingType === dateGroup.bookingType

                    // 獲取類型文字
                    const getTypeText = () => {
                      if (type === 'space') {
                        return dateGroup.bookingType === 'little' ? t('Personal', '個人') : t('Group', '團體')
                      } else {
                        return dateGroup.bookingType === 'little' ? t('Light', '小量') : t('Mass', '大量')
                      }
                    }
                    const typeText = getTypeText()

                    return (
                      <button
                        key={index}
                        onClick={() => {
                          if (dateGroup.isDisabled) return
                          if (dateGroup.isExpired) {
                            // 過期時段：改為開啟日期編輯對話框
                            setEditingExpired({
                              startDate: dateGroup.startDate,
                              endDate: dateGroup.endDate,
                              bookingType: dateGroup.bookingType
                            })
                            setShowExistingDates(false)
                          } else {
                            handleSelectExistingDate(dateGroup.startDate, dateGroup.endDate, dateGroup.bookingType)
                          }
                        }}
                        disabled={dateGroup.isDisabled}
                        className={`existing-date-item text-left py-3 px-4 transition-all duration-200 ${
                          index !== 0 ? 'border-t border-gray-scale4' : ''
                        } ${dateGroup.isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        style={{
                          backgroundColor: isCurrentSelection ? 'var(--color-gray-scale4)' : 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          if (!dateGroup.isDisabled) {
                            e.currentTarget.style.backgroundColor = isCurrentSelection
                              ? 'var(--color-gray-scale4)'
                              : 'var(--color-gray-scale5)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!dateGroup.isDisabled) {
                            e.currentTarget.style.backgroundColor = isCurrentSelection
                              ? 'var(--color-gray-scale4)'
                              : 'transparent'
                          }
                        }}
                      >
                        {/* 日期範圍 + 數量 */}
                        <div className={`text-xs font-['Inter',_sans-serif] mb-1 ${dateGroup.isDisabled ? 'text-gray-scale3' : 'text-white'}`}>
                          {formatDateFull(dateGroup.startDate)} - {formatDateFull(dateGroup.endDate)} ({dateGroup.itemCount})
                        </div>

                        {/* 類型文字 - 灰色 */}
                        <div className="text-xs font-['Inter',_sans-serif] text-gray-scale2 flex items-center gap-2">
                          {typeText}
                          {dateGroup.isDisabled && (
                            <span className="text-xs text-gray-scale3">
                              (已達上限)
                            </span>
                          )}
                          {dateGroup.isExpired && (
                            <span className="text-xs text-[#ffff00]">
                              <span>{t('Expired', '已過期，點擊重選日期')}</span>
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 過期時段的日期編輯對話框（與購物車共用同一個元件） */}
      {editingExpired && (
        <DateEditDialog
          isOpen
          currentStartDate={editingExpired.startDate}
          currentEndDate={editingExpired.endDate}
          bookingType={editingExpired.bookingType}
          category={type}
          onConfirm={handleConfirmExpiredEdit}
          onCancel={() => setEditingExpired(null)}
        />
      )}

      {/* 類型衝突提示（Renew／已達上限） */}
      <ConfirmDialog />
    </div>
  )
}

export default DatePickerBar
