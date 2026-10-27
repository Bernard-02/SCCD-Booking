/**
 * 個人資料頁面
 * 左：分頁選單（訂單／個人資料）；訂單＝圓角卡片 accordion，展開直接看明細（取代原 /order 詳情頁），
 * 右上角為使用說明；姓名改顯示在 Footer 的 Profile icon 旁。
 */

import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'
import ExtendDialog from '../components/profile/ExtendDialog'
import ModifyOrderDialog, { type ModifyLine } from '../components/profile/ModifyOrderDialog'
import EditProfileDialog from '../components/profile/EditProfileDialog'
import OrderDetail, { formatDateRange } from '../components/profile/OrderDetail'
import type { Receipt, OrderStatus } from '../components/profile/OrderDetail'
import OrderReceipt, { downloadReceiptPdf } from '../components/profile/OrderReceipt'
import Collapse from '../components/common/Collapse'
import { navItemCls } from '../components/common/navItem'
import Toast from '../components/common/Toast'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { changePassword, updateMyPhone } from '../services/authService'
import { fetchMyOrders, extendMyOrderPartial, fetchClosedDates, modifyMyOrder } from '../services/ordersService'
import type { OrderRow } from '../services/ordersService'
import { loadItemImages } from '../services/equipmentService'
import { classLabel } from '../utils/gradeUtils'
import { AWAITING_PICKUP_META } from '../components/admin/adminUi'
import { slotLabel, pendingMsRemaining, displayOrderStatus, isOffDay, effectiveReturnDeadline, overduePenalty, overdueBusinessDays, SUSPENSION_OVERDUE_DAYS, isWithinExtendWindow } from '../utils/timeUtils'
import { useSuspension } from '../hooks/useSuspension'
import { useT } from '../stores/langStore'

type ProfileSection = 'history' | 'profile'

/** 修改訂單用：同設備合併（取件後同一設備可能分「已點交」與「待點交」兩列） */
const toModifyLines = (r: Receipt): ModifyLine[] => {
  const map = new Map<string, ModifyLine>()
  for (const i of r.items) {
    const l = map.get(i.id) ?? { id: i.id, name: i.name, deposit: i.deposit, quantity: 0, held: 0 }
    l.quantity += i.quantity
    if (!i.pickupPending) l.held += i.quantity
    map.set(i.id, l)
  }
  return [...map.values()]
}

const ProfilePage: React.FC = () => {
  const t = useT()
  const [currentSection, setCurrentSection] = useState<ProfileSection>('history')
  const { logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }
  // 菜單項目
  const menuItems = [
    { id: 'history' as ProfileSection, en: 'Orders', zh: '訂單', icon: 'receipt_long' },
    { id: 'profile' as ProfileSection, en: 'Info', zh: '個人資料', icon: 'person' }
  ]

  return (
    <div className="bg-black text-white h-screen flex flex-col overflow-hidden">
      <Header />

      {/* Main Content */}
      <main className="flex-1 pt-20 flex flex-col overflow-hidden">
        <div className="container h-full flex flex-col">
          {/* 左右分割佈局 */}
          <div className="flex flex-1 overflow-hidden pt-4 pb-4">
            {/* 左側：功能選單（佔 3） */}
            <div className="w-[30%] flex-shrink-0 pr-3 flex flex-col items-start">
              {/* 選中的分頁＝白底黑字圓角矩形（同訂單卡片展開時的反白）；inline-flex＝各項同寬、以最長的為準；
                  樣式共用 components/common/navItem.ts */}
              <nav className="inline-flex flex-col gap-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentSection(item.id)}
                    className={navItemCls(currentSection === item.id)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{item.icon}</span>
                    <span>{t(item.en, item.zh)}</span>
                  </button>
                ))}
              </nav>

              {/* 登出：同上方選單樣式，放在側欄底部、緊貼 Footer 的 Profile 頭像上方 */}
              <button onClick={handleLogout} className={`mt-auto ${navItemCls(false)}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
                <span>{t('Log out', '登出')}</span>
              </button>
            </div>

            {/* 右側：內容區域 */}
            <div className="flex-1 pl-12 pr-6 overflow-y-auto">
              <div id="content-area">
                {/* 根據當前選擇的section渲染內容 */}
                {currentSection === 'history' && <RentalHistorySection />}
                {currentSection === 'profile' && <ProfileDataSection />}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

// 工作時計算與訂單狀態判定統一在 utils/timeUtils.ts

// 狀態 chip：由狀態色推出淺底（25% 色＋白）＋深字（40% 色＋黑），黑底卡片與展開的白底都看得清楚
const statusChipStyle = (color: string): React.CSSProperties => ({
  backgroundColor: `color-mix(in srgb, ${color} 25%, white)`,
  color: `color-mix(in srgb, ${color} 40%, black)`
})

// 使用說明（訂單頁右上；PDF 收據另有一份中英並列）
const USER_GUIDE = [
  { en: 'Please bring this receipt to the SA during business hours to pay the deposit and complete your reservation.', zh: '請在系學會營業時間內携帶此收據繳交押金以完成預約程序。' },
  { en: 'Cash payments only. No change given.', zh: '僅接受現金交易，恕不找零。' },
  { en: 'On the return date, please present this receipt at the SA to retrieve your deposit.', zh: '歸還日到期時，憑藉此收據至系學會索取押金。' }
]

// 租借歷史區塊
const RentalHistorySection: React.FC = () => {
  const t = useT()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([])
  const [modifying, setModifying] = useState<Receipt | null>(null) // 修改訂單（情境 3）
  const [now, setNow] = useState(new Date()) // 用於倒數計時更新
  const [closedDates, setClosedDates] = useState<ReadonlySet<string>>(new Set()) // 臨時公休日
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false)
  const [extendingReceipt, setExtendingReceipt] = useState<Receipt | null>(null)
  const [openOrder, setOpenOrder] = useState<string | null>(null) // accordion：一次展開一張
  const [guideOpen, setGuideOpen] = useState(false)
  const [printing, setPrinting] = useState<Receipt | null>(null)  // 正在產生 PDF 的收據
  const receiptRef = useRef<HTMLDivElement>(null)

  // 收據模板渲染到畫面外後再擷取成 PDF
  useEffect(() => {
    if (!printing || !receiptRef.current) return
    downloadReceiptPdf(receiptRef.current, printing.rentalNumber)
      .catch(err => {
        console.error('PDF generation failed:', err)
        alert(t('Couldn’t generate the receipt. Please try again later.', '收據生成失敗，請稍後再試'))
      })
      .finally(() => setPrinting(null))
  }, [printing])

  // 從 Supabase 讀取自己的訂單（RLS 只回本人的），組成畫面用的 Receipt 形狀
  const loadOrders = React.useCallback(async () => {
    try {
      const [orders, images] = await Promise.all([fetchMyOrders(), loadItemImages()])

      const itemImage = (item: OrderRow['order_items'][number]): string => {
        if (item.item_type === 'equipment') {
          return images[item.item_id] || '/Images/Extension Cord.webp'
        }
        if (item.item_type === 'classroom') return images[item.item_id] || `/Images/${item.item_id}.webp`
        return '/Area/A5F Area Booking.svg'
      }

      const receipts: Receipt[] = orders.map(order => ({
        borrowerName: currentUser?.name || '',
        rentalDates: [order.start_date, order.end_date],
        rentalNumber: order.rental_number,
        totalDeposit: order.deposit_total,
        items: order.order_items.map(item => ({
          id: item.item_id,
          name: item.name,
          category: item.item_type as Receipt['items'][number]['category'],
          quantity: item.quantity,
          deposit: item.deposit,
          startDate: order.start_date,
          endDate: order.end_date,
          image: itemImage(item),
          bookingType: order.booking_type,
          changedAt: item.changed_at,
          pickupPending: item.pickup_pending
        })),
        createdAt: order.created_at,
        status: order.status,
        reason: order.reason,
        hasExtended: order.has_extended,
        depositPaidAt: order.deposit_paid_at,
        depositDate: order.deposit_date,
        depositSlot: order.deposit_slot,
        pickupSlot: order.pickup_slot,
        itemsUpdatedAt: order.items_updated_at
      }))

      setAllReceipts(receipts)
    } catch (error) {
      console.error('讀取訂單失敗:', error)
    }
  }, [currentUser])

  useEffect(() => {
    loadOrders()
    fetchClosedDates().then(setClosedDates)
  }, [loadOrders])

  // 從日期列「修改訂單」跳過來（同類型已有未歸還單）：訂單載入後直接開修改視窗，只開一次
  const editTarget = (location.state as { editOrder?: string } | null)?.editOrder
  useEffect(() => {
    if (!editTarget) return
    const r = allReceipts.find(x => x.rentalNumber === editTarget)
    if (!r) return
    setModifying(r)
    navigate(location.pathname, { replace: true, state: null })
  }, [editTarget, allReceipts, navigate, location.pathname])

  // 儲存修改：失敗回傳原因由對話框顯示（視窗保留，內容不丟）
  const handleConfirmModify = async (items: { item_id: string; quantity: number }[]) => {
    if (!modifying) return null
    const res = await modifyMyOrder(modifying.rentalNumber, items)
    if (!res.ok) return res.message ?? '修改失敗，請再試一次'
    setModifying(null)
    await loadOrders()
    return null
  }

  // 每分鐘更新一次時間，觸發倒數計時重繪
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 60000) // 1分鐘更新一次

    return () => clearInterval(timer)
  }, [])

  // 處理延期按鈕點擊
  const handleExtendClick = (receipt: Receipt, status: OrderStatus) => {
    // 只有租借中且未延期過的訂單才能延期；
    // 過期／取消的訂單已失效，延期沒有意義（overdue、returned、pending 同樣不可）
    // 並須在原歸還日前三天（含）內提出
    const endDate = receipt.rentalDates[receipt.rentalDates.length - 1]
    if (status !== 'in-progress' || receipt.hasExtended || !isWithinExtendWindow(endDate)) {
      return
    }

    setExtendingReceipt(receipt)
    setIsExtendDialogOpen(true)
  }

  // 確認延期（RPC：資料庫端驗證僅限租借中、未延期過、1-7 天；
  // 全勾品項＝整單延期，部分勾選＝拆子單部分延期）
  const handleConfirmExtend = async (extendDays: number, itemIds: number[]) => {
    if (!extendingReceipt) return

    const result = await extendMyOrderPartial(extendingReceipt.rentalNumber, extendDays, itemIds)
    if (!result.ok) {
      console.error('延期失敗:', result.message)
      alert(result.message || t('Extension failed. Please try again.', '延期失敗，請再試一次'))
      return
    }

    // 重新讀取訂單（新歸還日與已延期標記以資料庫為準）
    await loadOrders()
    setIsExtendDialogOpen(false)
    setExtendingReceipt(null)
  }

  // 取消延期
  const handleCancelExtend = () => {
    setIsExtendDialogOpen(false)
    setExtendingReceipt(null)
  }

  // 獲取狀態顯示資訊
  const getStatusInfo = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return {
          color: 'var(--color-yellow)',
          en: 'Pending',
          zh: '待銷單'
        }
      case 'in-progress':
        return {
          color: 'var(--color-blue)',
          en: 'In Progress',
          zh: '使用中'
        }
      case 'returned':
        return {
          color: 'var(--color-success)',
          en: 'Returned',
          zh: '已歸還'
        }
      case 'overdue':
        return {
          color: 'var(--color-error2)',
          en: 'Overdue',
          zh: '未完成歸還'
        }
      case 'canceled':
        return {
          color: 'var(--color-gray-scale3)',
          en: 'Canceled',
          zh: '已取消'
        }
    }
  }

  // 獲取訂單種類標籤
  const getBookingTypeLabel = (type?: string) => {
    switch (type) {
      case 'mass-personal':
        return { en: 'Mass - Personal', zh: '大量 - 個人' }
      case 'mass-group':
        return { en: 'Mass - Group', zh: '大量 - 團體' }
      case 'little':
      default:
        return { en: 'Light', zh: '小量' }
    }
  }

  // 渲染倒數計時
  const renderCountdown = (receipt: Receipt, status: OrderStatus) => {
    // 大量設備：已繳押金待取件 → 顯示取件時段；尚未繳 → 倒數下方附預約的繳押金／取件時段
    const pickupText = receipt.pickupSlot ? slotLabel({ date: receipt.rentalDates[0], slot: receipt.pickupSlot }) : ''
    if (status === 'pending' && receipt.depositPaidAt) {
      return (
        <div className="text-right mt-2">
          <span className="font-english text-sm" style={{ color: 'var(--color-cyan-blue)' }}>
            {t('Pickup', '取件')} {pickupText}
          </span>
        </div>
      )
    }
    if (status === 'pending') {
      // Pending: 24 工作時倒數（排除週末與臨時公休日）
      const msRemaining = pendingMsRemaining(receipt.createdAt, now, closedDates)

      if (msRemaining <= 0) return null // 已過期，狀態會變為 canceled

      const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60))

      // 如果遇到公休日暫停中
      const isPaused = isOffDay(now, closedDates)
      
      return (
        <div className="text-right mt-2">
          <span className="font-english text-sm text-yellow">
            {t('Expires in', '距離繳交押金')} {hoursRemaining} hrs
            {isPaused && <span className="ml-2 text-gray-scale2">(Paused)</span>}
          </span>
          {receipt.depositDate && receipt.depositSlot && (
            <div className="font-['Inter','Noto_Sans_TC',_sans-serif] text-xs text-gray-scale2 mt-1">
              繳押金 {slotLabel({ date: receipt.depositDate, slot: receipt.depositSlot })}・取件 {pickupText}
            </div>
          )}
        </div>
      )
    } else if (status === 'in-progress') {
      // In-Progress: 距離有效歸還期限倒數（歸還日 19:00，撞公休順延到下個營業日）
      const dates = [...receipt.rentalDates].sort()
      const endDateStr = dates[dates.length - 1]
      const deadline = effectiveReturnDeadline(endDateStr, closedDates)

      const msRemaining = deadline.getTime() - now.getTime()

      if (msRemaining <= 0) return null // 已逾期

      // 取件後新增、待點交的設備：24 工作時內要來領（起算＝第一次新增），逾時自動取消
      const addedAt = receipt.items.filter(i => i.pickupPending && i.changedAt).map(i => i.changedAt!).sort()[0]
      const addMs = addedAt ? pendingMsRemaining(addedAt, now, closedDates) : 0

      const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24))
      const hours = Math.floor(msRemaining / (1000 * 60 * 60))
      const minutes = Math.floor(msRemaining / (1000 * 60))

      let timeText = ''
      if (days >= 1) timeText = `${days} day`
      else if (hours >= 1) timeText = `${hours} h`
      else timeText = `${minutes} min`

      return (
        <div className="text-right mt-2">
          <span className="font-english text-sm text-blue">
            {t('Due in', '距離逾期')} {timeText}
          </span>
          {addMs > 0 && (
            <div className="font-['Inter','Noto_Sans_TC',_sans-serif] text-xs mt-1" style={{ color: 'var(--color-yellow)' }}>
              新增設備待點交・剩 <span className="font-english">{Math.ceil(addMs / 3_600_000)}</span> hrs
            </div>
          )}
        </div>
      )
    } else if (status === 'overdue') {
      // Overdue: 顯示累計罰款試算（最終金額歸還時由系學會確認）
      const dates = [...receipt.rentalDates].sort()
      const endDateStr = dates[dates.length - 1]
      const penalty = overduePenalty(endDateStr, receipt.totalDeposit, closedDates, now)

      if (penalty <= 0) return null

      return (
        <div className="text-right mt-2">
          <span className="font-english text-sm text-error2">
            {t('Penalty', '累計罰款')} NT$ {penalty.toLocaleString()}
          </span>
        </div>
      )
    }
    return null
  }

  // 渲染收據項目
  const renderReceiptItem = (receipt: Receipt, index: number) => {
    // 顯示狀態：資料庫為準；pending 額外做逾時判定（cron 掃描前的即時顯示）
    // 已預繳押金待取件不走 24 工作時逾時判定（不會被自動取消）
    const awaitingPickup = receipt.status === 'pending' && !!receipt.depositPaidAt
    const status = awaitingPickup ? 'pending' : displayOrderStatus(receipt.status, receipt.createdAt, closedDates, now)

    const statusInfo = awaitingPickup ? AWAITING_PICKUP_META : getStatusInfo(status)
    // 可延期＝租借中、未延期過、且未逾「前三天」期限
    const endDate = receipt.rentalDates[receipt.rentalDates.length - 1]
    const canExtend = status === 'in-progress' && !receipt.hasExtended && isWithinExtendWindow(endDate)
    const bookingType = receipt.items.length > 0 ? receipt.items[0].bookingType : 'little'
    const bookingTypeLabel = getBookingTypeLabel(bookingType)
    // 可修改＝設備單（小量／大量）且待繳押金／已繳待取件／租借中（情境 3：改原單，不另開新單）
    const canModify =
      receipt.items[0]?.category === 'equipment' && bookingType !== 'mass-group' &&
      (status === 'pending' || status === 'in-progress')

    const isOpen = openOrder === receipt.rentalNumber
    const toggle = () => setOpenOrder(isOpen ? null : receipt.rentalNumber)
    // icon 操作鈕：跟著卡片文字色（反白時變黑），不可用＝30% 透明
    const iconBtnCls = 'flex items-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed'

    return (
      <div
        key={index}
        className={`group rounded-2xl border border-[#545454] overflow-hidden ${
          isOpen ? 'bg-white text-black' : 'text-white hover:bg-white hover:text-black'
        }`}
      >
        {/* 摘要列：點擊展開／收合；hover 或展開時整張白底黑字 */}
        <div onClick={toggle} className="flex justify-between gap-6 p-6 cursor-pointer">
          {/* 左：單號 → 種類＋狀態 → 日期與押金 */}
          <div>
            <div className="text-xl">{receipt.rentalNumber}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-3 py-1 rounded-lg bg-gray-scale4 text-white text-xs whitespace-nowrap">
                {t(bookingTypeLabel.en, bookingTypeLabel.zh)}
              </span>
              <span
                className="px-3 py-1 rounded-lg text-xs whitespace-nowrap"
                style={statusChipStyle(statusInfo.color)}
              >
                {t(statusInfo.en, statusInfo.zh)}
              </span>
            </div>
            <div className="flex items-center gap-8 mt-4 text-md">
              <span>{formatDateRange(receipt.rentalDates)}</span>
              <span>NT$ {receipt.totalDeposit.toLocaleString()}</span>
            </div>
          </div>

          {/* 右：下載／延期／修改＋展開 chevron；下方倒數（hover 反白時一律轉黑字） */}
          <div className="flex flex-col items-end justify-between">
            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setPrinting(receipt)}
                disabled={printing !== null}
                aria-label={t('Download receipt', '下載收據')}
                title={t('Download receipt', '下載收據')}
                className={iconBtnCls}
              >
                <span className="material-symbols-outlined">download</span>
              </button>
              {/* 延期：僅租借中、未延期過、且在期限內可點；其餘狀態顯示但停用 */}
              <button
                type="button"
                onClick={() => handleExtendClick(receipt, status)}
                disabled={!canExtend}
                aria-label={t('Extend', '延期')}
                title={t('Extend', '延期')}
                className={iconBtnCls}
              >
                <span className="material-symbols-outlined">more_time</span>
              </button>
              {/* 修改：設備單才顯示（空間單不開放修改） */}
              {receipt.items[0]?.category === 'equipment' && (
                <button
                  type="button"
                  onClick={() => canModify && setModifying(receipt)}
                  disabled={!canModify}
                  aria-label={t('Edit', '修改')}
                  title={t('Edit', '修改')}
                  className={iconBtnCls}
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
              )}
              <button
                type="button"
                onClick={toggle}
                aria-expanded={isOpen}
                aria-label={t('Details', '明細')}
                className="flex items-center cursor-pointer"
              >
                <span className={`material-symbols-outlined transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
            </div>
            <div className={isOpen ? '[&_*]:!text-black' : 'group-hover:[&_*]:!text-black'}>{renderCountdown(receipt, status)}</div>
          </div>
        </div>

        {/* 展開：訂單明細（往下展開動畫） */}
        <Collapse open={isOpen}>
          <div className="mx-6 py-6 border-t border-black/15">
            <OrderDetail receipt={receipt} />
          </div>
        </Collapse>
      </div>
    )
  }

  return (
    <div>
      {/* 使用說明：訂單頁右上的按鈕，點擊開彈窗（同其他確認視窗外觀） */}
      <div className="flex justify-end mb-6">
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="flex items-center gap-2 text-sm text-white cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>menu_book</span>
          {t('User Guide', '使用說明')}
        </button>
      </div>
      <ConfirmDialog
        isOpen={guideOpen}
        title="使用說明"
        titleEn="User Guide"
        closeOnly
        onCancel={() => setGuideOpen(false)}
      >
        <ol className="list-decimal pl-4 space-y-2 text-xs text-white leading-relaxed">
          {USER_GUIDE.map(g => <li key={g.zh}>{t(g.en, g.zh)}</li>)}
        </ol>
      </ConfirmDialog>

      {/* 所有訂單 */}
      {allReceipts.length === 0 ? (
        <p className="text-gray-scale4 text-md">尚無訂單記錄</p>
      ) : (
        <div className="flex flex-col gap-4">
          {allReceipts.map((receipt, index) => renderReceiptItem(receipt, index))}
        </div>
      )}

      {/* PDF 收據模板：只在下載時渲染到畫面外，供 html2canvas 擷取 */}
      {printing && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <OrderReceipt ref={receiptRef} receipt={printing} />
        </div>
      )}

      {/* 修改訂單對話框（情境 3） */}
      {modifying && (
        <ModifyOrderDialog
          rentalNumber={modifying.rentalNumber}
          startDate={modifying.rentalDates[0]}
          endDate={modifying.rentalDates[modifying.rentalDates.length - 1]}
          isMass={modifying.items[0]?.bookingType === 'mass-personal'}
          picked={modifying.status === 'in-progress'}
          depositPaid={modifying.status !== 'pending' || !!modifying.depositPaidAt}
          lines={toModifyLines(modifying)}
          onConfirm={handleConfirmModify}
          onCancel={() => setModifying(null)}
        />
      )}

      {/* 延期對話框 */}
      {extendingReceipt && (
        <ExtendDialog
          isOpen={isExtendDialogOpen}
          orderNumber={extendingReceipt.rentalNumber}
          currentEndDate={extendingReceipt.rentalDates[extendingReceipt.rentalDates.length - 1]}
          onConfirm={handleConfirmExtend}
          onCancel={handleCancelExtend}
        />
      )}
    </div>
  )
}

// 遮蓋部分內容顯示（Airbnb 式）：手機保留前 4 後 3；Email 保留 local 前 2 + 完整網域
const maskPhone = (p: string): string =>
  p.length < 7 ? p : `${p.slice(0, 4)}${'*'.repeat(p.length - 7)}${p.slice(-3)}`

const maskEmail = (e: string): string => {
  const [local, domain] = e.split('@')
  if (!domain) return e
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(3, local.length - 2))}@${domain}`
}

// 個人資料區塊
const ProfileDataSection: React.FC = () => {
  const t = useT()
  const { currentUser } = useAuth()
  const [phone, setPhone] = useState(currentUser?.phone || '')
  const [editMode, setEditMode] = useState<'password' | 'phone' | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  // 當前最嚴重逾期單的營業日天數（第 1-6 級標籤即時計算，不入庫）
  const [worstOverdueDays, setWorstOverdueDays] = useState(0)

  useEffect(() => {
    Promise.all([fetchMyOrders(), fetchClosedDates()])
      .then(([orders, closed]) => {
        const days = orders
          .filter(order => order.status === 'overdue')
          .map(order => overdueBusinessDays(order.end_date, closed))
        setWorstOverdueDays(days.length ? Math.max(...days) : 0)
      })
      .catch(() => {}) // 讀取失敗維持第 1 級顯示，停權仍由 accountLevel 判定
  }, [])

  // 停權：account_level = 5（useSuspension 即時查，不依賴登入快照）；
  // 或即時算已滿 6 天（cron 每小時掃，補上空窗）
  const suspendedByLevel = useSuspension()
  const isSuspended = suspendedByLevel || worstOverdueDays >= SUSPENSION_OVERDUE_DAYS
  const tier = Math.min(worstOverdueDays + 1, 6) // 第 1 級 = 無逾期

  // 對話框確認 → 寫入 Supabase（密碼：重新驗證後更新；手機：RPC 只改本人 phone）
  const handleEditConfirm = async (value: string, currentPassword?: string) => {
    if (editMode === 'password') {
      const result = await changePassword(currentUser?.email || '', currentPassword || '', value)
      if (!result.ok) {
        return { ok: false, wrongCurrent: result.wrongCurrent }
      }
      setToastMessage(t('Password updated', '密碼已更新'))
    } else if (editMode === 'phone') {
      const result = await updateMyPhone(value)
      if (!result.ok) return { ok: false }
      setPhone(value)
      setToastMessage(t('Phone number updated', '手機號碼已更新'))
    }
    setEditMode(null)
    return { ok: true }
  }


  return (
    <div style={{ width: '80%' }}>
      {/* 帳號狀態區塊（英上中下）：停權＞逾期警示（第 2-6 級）＞正常（第 1 級） */}
      <div className="account-status-section">
        {isSuspended ? (
          <>
            <div className="mb-6">
              <p className="text-white text-md">
                {t(
                  <>Your account is <span style={{ color: 'var(--color-error2)', fontWeight: 600 }}>Suspended</span></>,
                  <>您的帳號<span style={{ color: 'var(--color-error2)', fontWeight: 600 }}>已停權</span></>
                )}
              </p>
            </div>
            <div>
              <p className="text-gray-scale2 text-xs">{t('An order was overdue for 6 business days (incomplete return). You can no longer place bookings — please contact the student association.', '有訂單逾期滿 6 個營業日（未完成清潔歸還），已無法送出預約，請儘速聯絡系學會處理歸還與罰款事宜')}</p>
            </div>
          </>
        ) : worstOverdueDays > 0 ? (
          <>
            <div className="mb-6">
              <p className="text-white text-md">
                {t(
                  <>Account status <span style={{ color: tier >= 6 ? 'var(--color-error2)' : 'var(--color-yellow)', fontWeight: 600 }}>Level {tier}</span></>,
                  <>帳號狀態<span style={{ color: tier >= 6 ? 'var(--color-error2)' : 'var(--color-yellow)', fontWeight: 600 }}>第 {tier} 級</span></>
                )}
              </p>
            </div>
            <div>
              <p className="text-gray-scale2 text-xs">
                {t(
                  `You have an order overdue for ${worstOverdueDays} business day${worstOverdueDays > 1 ? 's' : ''}. At 6 days your account will be suspended — please return it as soon as possible.`,
                  `您有訂單已逾期 ${worstOverdueDays} 個營業日，滿 6 天帳號將停權，請儘速歸還`
                )}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-white text-md">
                {t(
                  <>You're in <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Good Standing</span></>,
                  <>您是個守規矩的<span style={{ color: 'var(--color-success)', fontWeight: 600 }}>好寶寶</span></>
                )}
              </p>
            </div>
            <div>
              <p className="text-gray-scale2 text-xs">{t('You return your rentals right on time, with no overdue records.', '您非常準時地歸還租借，沒有任何逾期記錄')}</p>
            </div>
          </>
        )}
        {/* TODO: 狀態視覺化圓點 */}
      </div>

      {/* 分割線（上下對稱間距） */}
      <div className="border-t border-gray-scale4 my-12"></div>

      {/* 個人資料欄位 */}
      <div className="space-y-10">
        {/* 第一行：姓名和班級 */}
        <div className="grid grid-cols-2 gap-24">
          <div>
            <label className="text-gray-scale2 text-xs block mb-2">{t('Name', '姓名')}</label>
            <p className="font-chinese text-white text-sm">{currentUser?.name || '阿志'}</p>
          </div>
          <div>
            <label className="text-gray-scale2 text-xs block mb-2">{t('Class', '班級')}</label>
            <p className="font-chinese text-white text-sm">
              {/* 班級以學生資料為準（grade＋class_name，同後台會員管理；Google 首次登入由學號給初值） */}
              {classLabel(currentUser?.year, currentUser?.className) || '—'}
            </p>
          </div>
        </div>

        {/* 第二行：帳號和密碼 */}
        <div className="grid grid-cols-2 gap-24">
          <div>
            <label className="text-gray-scale2 text-xs block mb-2">{t('Student ID', '學號')}</label>
            <p className="font-english text-white text-sm">{currentUser?.studentId || 'A111144001'}</p>
          </div>
          {currentUser?.provider === 'google' ? (
            // Google 帳號沒有密碼：顯示登入方式，不能改
            <div>
              <label className="text-gray-scale2 text-xs block mb-2">{t('Sign-in', '登入方式')}</label>
              <p className="font-english text-white text-sm">Google</p>
            </div>
          ) : (
          <div>
            <label className="text-gray-scale2 text-xs block mb-2">{t('Password', '密碼')}</label>
            <div className="flex items-center gap-3">
              {/* 密碼僅存雜湊，無法顯示明文；此處固定遮罩，變更走右側編輯 */}
              <span className="font-english text-white text-sm flex-1">••••••••</span>
              <button
                onClick={() => setEditMode('password')}
                className="text-white hover:text-gray-scale2 cursor-pointer flex items-center"
                aria-label="修改密碼"
                title="修改密碼"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
              </button>
            </div>
          </div>
          )}
        </div>

        {/* 第三行：手機號碼和Email */}
        <div className="grid grid-cols-2 gap-24">
          <div>
            <label className="text-gray-scale2 text-xs block mb-2">{t('Phone', '手機號碼')}</label>
            <div className="flex items-center gap-3">
              <p className="font-english text-white text-sm flex-1">
                {phone ? maskPhone(phone) : '未設定'}
              </p>
              <button
                onClick={() => setEditMode('phone')}
                className="text-white hover:text-gray-scale2 cursor-pointer flex items-center"
                aria-label={phone ? '修改手機號碼' : '設定手機號碼'}
                title={phone ? '修改手機號碼' : '設定手機號碼'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
              </button>
            </div>
          </div>
          <div>
            <label className="text-gray-scale2 text-xs block mb-2">{t('Email', '電子郵件')}</label>
            <p className="font-english text-white text-sm">
              {maskEmail((currentUser?.email || `${currentUser?.studentId}@gm2.usc.edu.tw`).toLowerCase())}
            </p>
          </div>
        </div>
      </div>

      {/* 修改密碼／手機對話框 + 通知 */}
      <EditProfileDialog
        isOpen={editMode !== null}
        mode={editMode ?? 'password'}
        currentPhone={phone}
        onConfirm={handleEditConfirm}
        onCancel={() => setEditMode(null)}
      />
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  )
}

export default ProfilePage
