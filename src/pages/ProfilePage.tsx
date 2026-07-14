/**
 * 個人資料頁面
 * 對應原本的 profile.html
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'
import ExtendDialog from '../components/profile/ExtendDialog'
import EditProfileDialog from '../components/profile/EditProfileDialog'
import Toast from '../components/common/Toast'
import { changePassword, updateMyPhone } from '../services/authService'
import { fetchMyOrders, extendMyOrder, fetchClosedDates } from '../services/ordersService'
import type { OrderRow } from '../services/ordersService'
import { loadEquipmentData } from '../services/equipmentService'
import { pendingMsRemaining, displayOrderStatus, isOffDay, effectiveReturnDeadline, overduePenalty } from '../utils/timeUtils'

type ProfileSection = 'history' | 'profile'

interface ReceiptItem {
  id: string
  name: string
  category: 'equipment' | 'space-block' | 'classroom'
  quantity: number
  deposit: number
  startDate: string
  endDate: string
  image: string
  bookingType?: 'little' | 'mass-personal' | 'mass-group'
}

type OrderStatus = 'pending' | 'in-progress' | 'returned' | 'overdue' | 'canceled'

interface Receipt {
  borrowerName: string
  rentalDates: string[]
  rentalNumber: string
  totalDeposit: number
  items: ReceiptItem[]
  createdAt: string
  status?: OrderStatus // 訂單狀態
  statusUpdatedAt?: string // 狀態更新時間（用於 in-progress 的倒數）
  hasExtended?: boolean // 是否已延期
}

const ProfilePage: React.FC = () => {
  const { currentUser } = useAuth()
  const [currentSection, setCurrentSection] = useState<ProfileSection>('history')
  const [greeting, setGreeting] = useState('')
  const [greetingZh, setGreetingZh] = useState('')

  // 設置問候語（英文 + 中文）
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) {
      setGreeting('Good Morning')
      setGreetingZh('早安!')
    } else if (hour >= 12 && hour < 18) {
      setGreeting('Good Afternoon')
      setGreetingZh('午安!')
    } else {
      setGreeting('Good Evening')
      setGreetingZh('晚安!')
    }
  }, [])

  // 菜單項目
  const menuItems = [
    { id: 'history' as ProfileSection, en: 'Orders', zh: '訂單' },
    { id: 'profile' as ProfileSection, en: 'Info', zh: '個人資料' }
  ]

  return (
    <div className="bg-black text-white h-screen flex flex-col overflow-hidden">
      <Header />

      {/* Main Content */}
      <main className="flex-1 pt-20 flex flex-col overflow-hidden">
        <div className="container h-full flex flex-col">
          {/* 上半部：問候區塊（問候語小、放名字上方；名字靠左） */}
          <div className="mb-12 flex-shrink-0">
            <p className="font-['Inter',_sans-serif] text-white text-small-title mb-2">
              {greeting} <span className="font-['Noto_Sans_TC',_sans-serif]">{greetingZh}</span>
            </p>
            <p className="font-['Inter',_sans-serif] text-white text-medium-title">
              {currentUser?.studentId || 'A1234567'}
              <span className="font-['Noto_Sans_TC',_sans-serif] ml-4">{currentUser?.name || '阿志'}</span>
            </p>
          </div>

          {/* 下半部：左右分割佈局 */}
          <div className="flex flex-1 overflow-hidden pb-4">
            {/* 左側：功能選單（佔 3） */}
            <div className="w-[30%] flex-shrink-0 pr-3">
              <nav className="flex flex-col gap-6">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentSection(item.id)}
                    className={`text-small-title transition-colors cursor-pointer text-left self-start ${
                      currentSection === item.id
                        ? 'text-white font-bold'
                        : 'text-gray-scale2 hover:!text-white'
                    }`}
                  >
                    <span className="font-['Inter',_sans-serif] block">{item.en}</span>
                    <span className="font-['Noto_Sans_TC',_sans-serif] block">{item.zh}</span>
                  </button>
                ))}
              </nav>
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

// 工作時計算與訂單狀態判定統一在 utils/timeUtils.ts（與 OrderPage 共用）

// 租借歷史區塊
const RentalHistorySection: React.FC = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([])
  const [now, setNow] = useState(new Date()) // 用於倒數計時更新
  const [closedDates, setClosedDates] = useState<ReadonlySet<string>>(new Set()) // 臨時公休日
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false)
  const [extendingReceipt, setExtendingReceipt] = useState<Receipt | null>(null)

  // 從 Supabase 讀取自己的訂單（RLS 只回本人的），組成畫面用的 Receipt 形狀
  const loadOrders = React.useCallback(async () => {
    try {
      const [orders, equipmentData] = await Promise.all([fetchMyOrders(), loadEquipmentData()])

      const itemImage = (item: OrderRow['order_items'][number]): string => {
        if (item.item_type === 'equipment') {
          return equipmentData[item.item_id]?.mainImage || 'Images/Extension Cord.webp'
        }
        if (item.item_type === 'classroom') return `/Images/${item.item_id}.webp`
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
          category: item.item_type,
          quantity: item.quantity,
          deposit: item.deposit,
          startDate: order.start_date,
          endDate: order.end_date,
          image: itemImage(item),
          bookingType: order.booking_type
        })),
        createdAt: order.created_at,
        status: order.status,
        hasExtended: order.has_extended
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

  // 每分鐘更新一次時間，觸發倒數計時重繪
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 60000) // 1分鐘更新一次

    return () => clearInterval(timer)
  }, [])

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  // 格式化日期範圍
  const formatDateRange = (dates: string[]) => {
    if (dates.length === 0) return ''
    const sorted = [...dates].sort()
    return `${formatDate(sorted[0])} - ${formatDate(sorted[sorted.length - 1])}`
  }

  // 點擊收據項目，導航到訂單頁面
  const handleReceiptClick = (receipt: Receipt) => {
    navigate('/order', { state: receipt })
  }

  // 處理延期按鈕點擊
  const handleExtendClick = (receipt: Receipt, status: OrderStatus) => {
    // 只有租借中且未延期過的訂單才能延期；
    // 過期／取消的訂單已失效，延期沒有意義（overdue、returned、pending 同樣不可）
    if (status !== 'in-progress' || receipt.hasExtended) {
      return
    }

    setExtendingReceipt(receipt)
    setIsExtendDialogOpen(true)
  }

  // 確認延期（RPC：資料庫端驗證僅限租借中、未延期過、1-7 天）
  const handleConfirmExtend = async (extendDays: number) => {
    if (!extendingReceipt) return

    const result = await extendMyOrder(extendingReceipt.rentalNumber, extendDays)
    if (!result.ok) {
      console.error('延期失敗:', result.message)
      alert(result.message || '延期失敗，請再試一次')
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
          textColor: 'black',
          en: 'Pending',
          zh: '待銷單'
        }
      case 'in-progress':
        return {
          color: 'var(--color-blue)',
          textColor: 'white',
          en: 'In Progress',
          zh: '使用中'
        }
      case 'returned':
        return {
          color: 'var(--color-success)',
          textColor: 'white',
          en: 'Returned',
          zh: '已歸還'
        }
      case 'overdue':
        return {
          color: 'var(--color-error2)',
          textColor: 'white',
          en: 'Overdue',
          zh: '未完成歸還'
        }
      case 'canceled':
        return {
          color: 'var(--color-gray-scale3)',
          textColor: 'white',
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
    if (status === 'pending') {
      // Pending: 24 工作時倒數（排除週末與臨時公休日）
      const msRemaining = pendingMsRemaining(receipt.createdAt, now, closedDates)

      if (msRemaining <= 0) return null // 已過期，狀態會變為 canceled

      const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60))

      // 如果遇到公休日暫停中
      const isPaused = isOffDay(now, closedDates)
      
      return (
        <div className="text-right mt-2">
          <span className="font-['Inter',_sans-serif] text-small-title text-yellow">
            Expires in <span className="font-['Noto_Sans_TC',_sans-serif]">距離繳交押金</span> {hoursRemaining} hrs
            {isPaused && <span className="ml-2 text-gray-scale2">(Paused)</span>}
          </span>
        </div>
      )
    } else if (status === 'in-progress') {
      // In-Progress: 距離有效歸還期限倒數（歸還日 19:00，撞公休順延到下個營業日）
      const dates = [...receipt.rentalDates].sort()
      const endDateStr = dates[dates.length - 1]
      const deadline = effectiveReturnDeadline(endDateStr, closedDates)

      const msRemaining = deadline.getTime() - now.getTime()

      if (msRemaining <= 0) return null // 已逾期

      const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24))
      const hours = Math.floor(msRemaining / (1000 * 60 * 60))
      const minutes = Math.floor(msRemaining / (1000 * 60))

      let timeText = ''
      if (days >= 1) timeText = `${days} day`
      else if (hours >= 1) timeText = `${hours} h`
      else timeText = `${minutes} min`

      return (
        <div className="text-right mt-2">
          <span className="font-['Inter',_sans-serif] text-small-title text-blue">
            Due in <span className="font-['Noto_Sans_TC',_sans-serif]">距離逾期</span> {timeText}
          </span>
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
          <span className="font-['Inter',_sans-serif] text-small-title text-error2">
            Penalty <span className="font-['Noto_Sans_TC',_sans-serif]">累計罰款</span> NT$ {penalty.toLocaleString()}
          </span>
        </div>
      )
    }
    return null
  }

  // 渲染收據項目
  const renderReceiptItem = (receipt: Receipt, index: number) => {
    // 顯示狀態：資料庫為準；pending 額外做逾時判定（cron 掃描前的即時顯示）
    const status = displayOrderStatus(receipt.status, receipt.createdAt, closedDates, now)
    
    const statusInfo = getStatusInfo(status)
    const bookingType = receipt.items.length > 0 ? receipt.items[0].bookingType : 'little'
    const bookingTypeLabel = getBookingTypeLabel(bookingType)

    return (
      <div
        key={index}
        onClick={() => handleReceiptClick(receipt)}
        className="group py-6 first:pt-0 border-b border-gray-scale4 cursor-pointer hover:opacity-70 transition-opacity"
      >
        <div className="flex justify-between">
          {/* 左側：單號、日期和押金 */}
          <div className="flex-1">
            {/* 單號和訂單種類標籤 */}
            <div className="flex items-center gap-3 mb-2">
              <span className="font-['Inter',_sans-serif] text-medium-title text-white">
                {receipt.rentalNumber}
              </span>
              {/* 訂單種類標籤 */}
              <div
                className="px-3 py-1 flex items-center justify-center bg-gray-scale4 rounded-lg border border-transparent"
              >
                <span className="font-['Inter',_sans-serif] text-tiny whitespace-nowrap text-white">
                  {bookingTypeLabel.en} <span className="font-['Noto_Sans_TC',_sans-serif]">{bookingTypeLabel.zh}</span>
                </span>
              </div>
            </div>
            {/* 日期和押金在同一行，有間距 */}
            <div className="flex items-center gap-8">
              <span className="font-['Inter',_sans-serif] text-content text-white">
                {formatDateRange(receipt.rentalDates)}
              </span>
              <span className="font-['Inter',_sans-serif] text-content text-white">
                NT$ {receipt.totalDeposit.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 右側：延期按鈕、狀態標籤與倒數計時 */}
          <div className="flex flex-col items-end justify-between">
            {/* Extend 按鈕和狀態標籤 */}
            <div className="flex items-center gap-3">
              {/* Extend 延期按鈕 - 始終顯示，但只在租借中（in-progress）且未延期過時可點擊；
                  過期／取消／已歸還的訂單已失效，不可延期 */}
              <button
                onClick={(e) => {
                  e.stopPropagation() // 防止觸發訂單點擊事件
                  handleExtendClick(receipt, status)
                }}
                disabled={status !== 'in-progress' || receipt.hasExtended}
                className={`px-3 py-1 flex items-center justify-center border rounded-lg group-hover:!opacity-100 transition-colors ${
                  status === 'in-progress' && !receipt.hasExtended
                    ? 'border-white text-white hover:bg-white hover:text-black cursor-pointer'
                    : 'border-gray-scale3 text-gray-scale3 cursor-not-allowed'
                }`}
              >
                <span className="font-['Inter',_sans-serif] text-tiny whitespace-nowrap">
                  Extend <span className="font-['Noto_Sans_TC',_sans-serif]">延期</span>
                </span>
              </button>

              {/* 狀態標籤 */}
              <div
                className="px-3 py-1 flex items-center justify-center rounded-lg border border-transparent"
                style={{ backgroundColor: statusInfo.color }}
              >
                <span
                  className="font-['Inter',_sans-serif] text-tiny whitespace-nowrap"
                  style={{ color: statusInfo.textColor }}
                >
                  {statusInfo.en} <span className="font-['Noto_Sans_TC',_sans-serif]">{statusInfo.zh}</span>
                </span>
              </div>
            </div>

            {/* 倒數計時 */}
            {renderCountdown(receipt, status)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 所有訂單 */}
      {allReceipts.length === 0 ? (
        <p className="font-['Noto_Sans_TC',_sans-serif] text-gray-scale4 text-content">尚無訂單記錄</p>
      ) : (
        <div>
          {allReceipts.map((receipt, index) => renderReceiptItem(receipt, index))}
        </div>
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
  const { currentUser } = useAuth()
  const [phone, setPhone] = useState(currentUser?.phone || '')
  const [editMode, setEditMode] = useState<'password' | 'phone' | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 對話框確認 → 寫入 Supabase（密碼：重新驗證後更新；手機：RPC 只改本人 phone）
  const handleEditConfirm = async (value: string, currentPassword?: string) => {
    if (editMode === 'password') {
      const result = await changePassword(currentUser?.email || '', currentPassword || '', value)
      if (!result.ok) {
        return { ok: false, wrongCurrent: result.wrongCurrent }
      }
      setToastMessage('密碼已更新')
    } else if (editMode === 'phone') {
      const result = await updateMyPhone(value)
      if (!result.ok) return { ok: false }
      setPhone(value)
      setToastMessage('手機號碼已更新')
    }
    setEditMode(null)
    return { ok: true }
  }

  // 格式化班級名稱
  const formatClassName = (studentId: string | undefined) => {
    if (!studentId || studentId.length < 7) return '乙班'

    const yearCode = studentId.substring(1, 4) // 111
    const classCode = studentId.substring(4, 7) // 144 或 141

    const admissionYear = parseInt(yearCode)
    const currentYear = new Date().getFullYear() - 1911 // 民國年
    const grade = currentYear - admissionYear + 1

    const className = classCode === '141' ? '甲' : '乙'
    const chineseNumbers = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
    const chineseGrade = chineseNumbers[grade] || grade.toString()

    return `日媒${chineseGrade}${className}`
  }

  return (
    <div style={{ width: '80%' }}>
      {/* 帳號狀態區塊（英上中下；狀態用功能性英文，highlight 維持綠色） */}
      <div className="account-status-section">
        {/* 狀態 */}
        <div className="mb-6">
          <p className="font-['Inter',_sans-serif] text-white text-content">
            You're in <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Good Standing</span>
          </p>
          <p className="font-['Noto_Sans_TC',_sans-serif] text-white text-content">
            您是個守規矩的<span style={{ color: 'var(--color-success)', fontWeight: 600 }}>好寶寶</span>
          </p>
        </div>
        {/* 說明 */}
        <div>
          <p className="font-['Inter',_sans-serif] text-gray-scale2 text-tiny">
            You return your rentals right on time, with no overdue records.
          </p>
          <p className="font-['Noto_Sans_TC',_sans-serif] text-gray-scale2 text-tiny">
            您非常準時地歸還租借，沒有任何逾期記錄
          </p>
        </div>
        {/* TODO: 狀態視覺化圓點 */}
      </div>

      {/* 分割線（上下對稱間距） */}
      <div className="border-t border-gray-scale4 my-12"></div>

      {/* 個人資料欄位 */}
      <div className="space-y-10">
        {/* 第一行：姓名和班級 */}
        <div className="grid grid-cols-2 gap-24">
          <div>
            <label className="text-gray-scale2 text-tiny block mb-2"><span className="font-english">Name</span> <span className="font-chinese">姓名</span></label>
            <p className="font-chinese text-white text-small-title">{currentUser?.name || '阿志'}</p>
          </div>
          <div>
            <label className="text-gray-scale2 text-tiny block mb-2"><span className="font-english">Class</span> <span className="font-chinese">班級</span></label>
            <p className="font-chinese text-white text-small-title">
              {formatClassName(currentUser?.studentId)}
            </p>
          </div>
        </div>

        {/* 第二行：帳號和密碼 */}
        <div className="grid grid-cols-2 gap-24">
          <div>
            <label className="text-gray-scale2 text-tiny block mb-2"><span className="font-english">Student ID</span> <span className="font-chinese">學號</span></label>
            <p className="font-english text-white text-small-title">{currentUser?.studentId || 'A111144001'}</p>
          </div>
          <div>
            <label className="text-gray-scale2 text-tiny block mb-2"><span className="font-english">Password</span> <span className="font-chinese">密碼</span></label>
            <div className="flex items-center gap-3">
              {/* 密碼僅存雜湊，無法顯示明文；此處固定遮罩，變更走右側編輯 */}
              <span className="font-english text-white text-small-title flex-1">••••••••</span>
              <button
                onClick={() => setEditMode('password')}
                className="text-white hover:text-gray-scale2 transition-colors cursor-pointer flex items-center"
                aria-label="修改密碼"
                title="修改密碼"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
              </button>
            </div>
          </div>
        </div>

        {/* 第三行：手機號碼和Email */}
        <div className="grid grid-cols-2 gap-24">
          <div>
            <label className="text-gray-scale2 text-tiny block mb-2"><span className="font-english">Phone</span> <span className="font-chinese">手機號碼</span></label>
            <div className="flex items-center gap-3">
              <p className="font-english text-white text-small-title flex-1">
                {phone ? maskPhone(phone) : '未設定'}
              </p>
              <button
                onClick={() => setEditMode('phone')}
                className="text-white hover:text-gray-scale2 transition-colors cursor-pointer flex items-center"
                aria-label={phone ? '修改手機號碼' : '設定手機號碼'}
                title={phone ? '修改手機號碼' : '設定手機號碼'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
              </button>
            </div>
          </div>
          <div>
            <label className="text-gray-scale2 text-tiny block mb-2"><span className="font-english">Email</span> <span className="font-chinese">電子郵件</span></label>
            <p className="font-english text-white text-small-title">
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
