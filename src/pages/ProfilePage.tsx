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
          {/* 上半部：問候區塊 */}
          <div className="mb-12 flex-shrink-0">
            <p className="font-['Inter',_sans-serif] text-white text-medium-title">
              {greeting} <span className="font-['Noto_Sans_TC',_sans-serif]">{greetingZh}</span>
              <span className="ml-8">{currentUser?.studentId || 'A1234567'}</span>
              <span className="font-['Noto_Sans_TC',_sans-serif] ml-4">{currentUser?.name || '阿志'}</span>
            </p>
          </div>

          {/* 下半部：左右分割佈局 */}
          <div className="flex flex-1 overflow-hidden pb-4">
            {/* 左側：功能選單 */}
            <div className="w-1/6 flex-shrink-0 pr-3">
              <nav className="flex flex-col gap-6">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentSection(item.id)}
                    className={`text-small-title transition-colors cursor-pointer text-left ${
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

// 判斷是否為週末 (Off-day)
const isWeekend = (date: Date): boolean => {
  const day = date.getDay()
  return day === 0 || day === 6 // 0 is Sunday, 6 is Saturday
}

// 計算兩個日期之間的工作時間（毫秒），排除週末
const getBusinessTimeDiff = (start: Date, end: Date): number => {
  if (start >= end) return 0

  let totalMs = 0
  let current = new Date(start)
  const target = new Date(end)

  // 為了效能，若差距過大可以優化，但此處針對短期租借直接迭代
  // 使用小時為單位進行迭代計算會比較準確且簡單
  while (current < target) {
    const day = current.getDay()
    const isOffDay = day === 0 || day === 6

    // 計算到下一個整點或目標時間的差距
    const nextStep = new Date(current)
    nextStep.setHours(current.getHours() + 1, 0, 0, 0)
    if (nextStep > target) nextStep.setTime(target.getTime())

    if (!isOffDay) {
      totalMs += (nextStep.getTime() - current.getTime())
    }

    current = nextStep
  }

  return totalMs
}

// 計算訂單狀態
const calculateOrderStatus = (receipt: Receipt): OrderStatus => {
  // 如果已經有明確的 status，則使用它（後台標記的狀態）
  // 修改：如果是 pending，則繼續檢查是否過期
  if (receipt.status && receipt.status !== 'pending') {
    return receipt.status
  }

  // 針對 Pending 狀態，檢查是否超過 24 小時工作時間
  // 使用 getBusinessTimeDiff 計算從建立到現在經過的工作時間
  const now = new Date()
  const created = new Date(receipt.createdAt)
  const msPassed = getBusinessTimeDiff(created, now)
  const hoursSinceCreated = msPassed / (1000 * 60 * 60)

  if (hoursSinceCreated > 24) {
    return 'canceled'
  }

  // 默認為 pending（等待繳交押金）
  return 'pending'
}

// 租借歷史區塊
const RentalHistorySection: React.FC = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([])
  const [now, setNow] = useState(new Date()) // 用於倒數計時更新
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false)
  const [extendingReceipt, setExtendingReceipt] = useState<Receipt | null>(null)

  useEffect(() => {
    // 從 localStorage 讀取該用戶的收據記錄
    const userReceipts = JSON.parse(
      localStorage.getItem(`booking_receipts_${currentUser?.studentId || 'guest'}`) || '[]'
    ) as Receipt[]

    // 檢查並更新過期的 Pending 訂單
    let hasUpdates = false
    const updatedReceipts = userReceipts.map(receipt => {
      if (!receipt.status || receipt.status === 'pending') {
        const status = calculateOrderStatus(receipt)
        // 如果計算出的新狀態是 'canceled'，則更新訂單
        if (status === 'canceled') {
          hasUpdates = true
          return { ...receipt, status: 'canceled' as OrderStatus }
        }
      }
      return receipt
    })

    if (hasUpdates) {
      localStorage.setItem(
        `booking_receipts_${currentUser?.studentId || 'guest'}`,
        JSON.stringify(updatedReceipts)
      )
    }

    // 按創建時間降序排序（最新的在前）
    updatedReceipts.sort((a: Receipt, b: Receipt) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    setAllReceipts(updatedReceipts)
  }, [currentUser])

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
    }).replace(/\//g, '/')
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
    // 只有 in-progress 和 canceled 狀態才能延期
    if (status !== 'in-progress' && status !== 'canceled') {
      return
    }

    setExtendingReceipt(receipt)
    setIsExtendDialogOpen(true)
  }

  // 確認延期
  const handleConfirmExtend = (extendDays: number) => {
    if (!extendingReceipt) return

    // 計算新的結束日期
    const newEndDate = new Date(extendingReceipt.rentalDates[extendingReceipt.rentalDates.length - 1])
    newEndDate.setDate(newEndDate.getDate() + extendDays)

    // 更新收據的日期
    const updatedReceipts = allReceipts.map(r => {
      if (r.rentalNumber === extendingReceipt.rentalNumber) {
        const updatedDates = [...r.rentalDates]
        // 添加延期的日期
        const lastDate = new Date(updatedDates[updatedDates.length - 1])
        for (let i = 1; i <= extendDays; i++) {
          const extendDate = new Date(lastDate)
          extendDate.setDate(lastDate.getDate() + i)
          updatedDates.push(extendDate.toISOString().split('T')[0])
        }
        return {
          ...r,
          rentalDates: updatedDates,
          hasExtended: true
        }
      }
      return r
    })

    // 保存到 localStorage
    localStorage.setItem(
      `booking_receipts_${currentUser?.studentId || 'guest'}`,
      JSON.stringify(updatedReceipts)
    )

    // 更新狀態
    setAllReceipts(updatedReceipts)
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
      // Pending: 24小時倒數
      const created = new Date(receipt.createdAt)
      const msPassed = getBusinessTimeDiff(created, now)
      const msRemaining = (24 * 60 * 60 * 1000) - msPassed

      if (msRemaining <= 0) return null // 已過期，狀態會變為 canceled

      const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60))
      
      // 如果遇到 Off day 暫停中 (現在是週末)
      const isPaused = isWeekend(now)
      
      return (
        <div className="text-right mt-2">
          <span className="font-['Inter',_sans-serif] text-small-title text-yellow">
            Expires in <span className="font-['Noto_Sans_TC',_sans-serif]">距離繳交押金</span> {hoursRemaining} hrs
            {isPaused && <span className="ml-2 text-gray-scale2">(Paused)</span>}
          </span>
        </div>
      )
    } else if (status === 'in-progress') {
      // In-Progress: 距離歸還日倒數
      // 假設歸還日當天 23:59 到期
      const dates = [...receipt.rentalDates].sort()
      const endDateStr = dates[dates.length - 1]
      const endDate = new Date(endDateStr)
      endDate.setHours(23, 59, 59, 999)

      const msRemaining = getBusinessTimeDiff(now, endDate)
      
      if (msRemaining <= 0) return null // 已逾期

      const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24))
      const hours = Math.floor(msRemaining / (1000 * 60 * 60))
      const minutes = Math.floor(msRemaining / (1000 * 60))

      let timeText = ''
      if (days >= 1) timeText = `${days} day`
      else if (hours >= 1) timeText = `${hours} h`
      else timeText = `${minutes} min`

      // 如果遇到 Off day 暫停中
      const isPaused = isWeekend(now)

      return (
        <div className="text-right mt-2">
          <span className="font-['Inter',_sans-serif] text-small-title text-blue">
            Due in <span className="font-['Noto_Sans_TC',_sans-serif]">距離逾期</span> {timeText}
            {isPaused && <span className="ml-2 text-gray-scale2">(Paused)</span>}
          </span>
        </div>
      )
    }
    return null
  }

  // 渲染收據項目
  const renderReceiptItem = (receipt: Receipt, index: number) => {
    // 使用 receipt.status 或重新計算 (如果是 pending)
    let status = receipt.status || 'pending'
    if (status === 'pending') {
        status = calculateOrderStatus(receipt)
    }
    
    const statusInfo = getStatusInfo(status)
    const bookingType = receipt.items.length > 0 ? receipt.items[0].bookingType : 'little'
    const bookingTypeLabel = getBookingTypeLabel(bookingType)

    return (
      <div
        key={index}
        onClick={() => handleReceiptClick(receipt)}
        className="group py-6 border-b border-gray-scale4 cursor-pointer hover:opacity-70 transition-opacity"
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
                className="px-3 py-1 flex items-center justify-center bg-gray-scale4"
              >
                <span className="font-['Inter',_sans-serif] text-tiny font-medium text-white">
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
              {/* Extend 延期按鈕 - 始終顯示，但只在 in-progress 或 canceled 狀態時可點擊 */}
              <button
                onClick={(e) => {
                  e.stopPropagation() // 防止觸發訂單點擊事件
                  handleExtendClick(receipt, status)
                }}
                disabled={status !== 'in-progress' && status !== 'canceled'}
                className={`px-3 py-1 border group-hover:!opacity-100 transition-colors ${
                  status === 'in-progress' || status === 'canceled'
                    ? 'border-white text-white hover:bg-white hover:text-black cursor-pointer'
                    : 'border-gray-scale3 text-gray-scale3 cursor-not-allowed'
                }`}
              >
                <span className="font-['Inter',_sans-serif] text-tiny font-medium">
                  Extend <span className="font-['Noto_Sans_TC',_sans-serif]">延期</span>
                </span>
              </button>

              {/* 狀態標籤 */}
              <div
                className="px-3 py-1 flex items-center justify-center"
                style={{ backgroundColor: statusInfo.color }}
              >
                <span
                  className="font-['Inter',_sans-serif] text-tiny font-medium"
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

// 個人資料區塊
const ProfileDataSection: React.FC = () => {
  const { currentUser } = useAuth()
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const currentPassword = '20030911' // 預設密碼，實際應從安全來源獲取

  // 密碼顯示圖標
  const PASSWORD_ICONS = {
    VISIBLE: (
      <svg width="18" height="12" viewBox="0 0 409.19 260.49" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="m.31,127.88c1.02-3.69,3.59-6.84,5.95-9.8,28.79-36.09,62.2-67.03,102.37-90.18C135.08,12.66,163.29,2.42,193.99.36c28.12-1.89,55.03,3.64,80.83,14.67,36.97,15.81,68.59,39.44,96.71,67.8,11.68,11.78,22.35,24.59,33.14,37.22,6.13,7.17,5.91,13.07.05,20.48-28.95,36.67-62.57,68.16-103.17,91.65-32.1,18.57-66.35,29.82-103.97,28.15-25.73-1.14-50.01-8.08-73.05-19.39-48.37-23.76-87.09-59.08-120.22-100.99-2.66-3.32-5.21-7.67-4-12.07Zm378.8,2.65c-8.32-9-15.68-17.4-23.51-25.34-26.33-26.72-55.47-49.65-90.16-64.7-17.29-7.5-35.29-12.43-54.27-13.32-29.01-1.37-55.69,6.73-81.1,19.87-28.4,14.68-52.96,34.5-75.32,57.13-8.2,8.3-15.89,17.09-24.21,26.09,8.08,8.73,15.51,17.22,23.43,25.23,26.26,26.6,55.27,49.46,89.84,64.47,17.3,7.51,35.28,12.47,54.25,13.4,29.01,1.42,55.69-6.68,81.13-19.75,24.67-12.68,46.56-29.33,66.49-48.47,11.39-10.94,21.99-22.7,33.44-34.61Z" fill="#a4a4a4"/>
        <path d="m285.48,130.42c-.14,44.62-36.28,80.67-80.82,80.62-44.73-.05-81.05-36.55-80.72-81.12.33-44.71,36.55-80.65,81.01-80.42,44.66.24,80.66,36.41,80.52,80.92Zm-26.93-.23c-.09-29.73-24.15-53.78-53.82-53.81-29.63-.02-53.73,24.02-53.9,53.76-.17,29.67,24.43,54.24,54.06,54.01,29.8-.24,53.75-24.32,53.66-53.96Z" fill="#a4a4a4"/>
      </svg>
    ),
    HIDDEN: (
      <svg width="18" height="12" viewBox="0 0 409.19 274.6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="m308.4,237.8s0,0,0,0l-19.66-19.66s0,0,0,0l-24.06-24.06s0,0,0,0l-19.07-19.07s0,0,0,0l-75.9-75.9s0,0,0,0l-19.09-19.09s0,0,0,0l-22.31-22.31s0,0,0,0l-19.93-19.93s0,0,0,0L74.99,4.39c-5.86-5.86-15.36-5.86-21.21,0-5.86,5.86-5.86,15.35,0,21.21l28.79,28.79C53.7,74.95,28.59,99.8,6.26,127.78c-2.36,2.96-4.93,6.12-5.95,9.8-1.22,4.4,1.34,8.75,4,12.07,33.14,41.91,71.86,77.23,120.22,100.99,23.03,11.31,47.31,18.25,73.05,19.39,29.64,1.31,57.2-5.4,83.25-17.38l17.56,17.56c2.93,2.93,6.77,4.39,10.61,4.39s7.68-1.46,10.61-4.39c5.86-5.86,5.86-15.36,0-21.21l-11.2-11.2Zm-155.37-112.94l66.8,66.8c-4.74,1.39-9.75,2.17-14.95,2.21-29.62.24-54.23-24.34-54.06-54.01.03-5.21.8-10.24,2.2-15Zm45.02,118.22c-18.97-.93-36.96-5.89-54.25-13.4-34.57-15.01-63.58-37.88-89.84-64.47-7.91-8.02-15.35-16.51-23.43-25.23,8.32-9,16.02-17.8,24.21-26.09,14.63-14.8,30.21-28.39,47.18-40.13l30.42,30.42c-5.29,10.69-8.3,22.72-8.4,35.46-.33,44.57,35.99,81.07,80.72,81.12,12.89.01,25.08-3,35.89-8.37l19.62,19.62c-19.69,7.81-40.25,12.15-62.12,11.08Z" fill="#a4a4a4"/>
        <path d="m404.67,129.77c-10.79-12.63-21.46-25.43-33.14-37.22-28.12-28.36-59.74-51.99-96.71-67.8-25.8-11.04-52.71-16.56-80.83-14.67-25.52,1.71-49.32,9.09-71.81,20.28l20.42,20.42c21.64-9.52,44.29-15.03,68.58-13.89,18.98.89,36.98,5.82,54.27,13.32,34.69,15.05,63.83,37.98,90.16,64.7,7.83,7.94,15.19,16.34,23.51,25.34-11.46,11.91-22.05,23.67-33.44,34.61-13.59,13.06-28.1,24.95-43.77,35.22l19.39,19.39c31.94-21.73,59.32-48.66,83.44-79.21,5.85-7.41,6.07-13.31-.05-20.48Z" fill="#a4a4a4"/>
        <path d="m273.74,181.91c7.41-12.18,11.69-26.47,11.74-41.78.14-44.51-35.86-80.68-80.52-80.92-15.45-.08-29.9,4.21-42.2,11.72l19.9,19.9c6.74-3.04,14.2-4.74,22.07-4.74,29.67.02,53.73,24.08,53.82,53.81.02,7.88-1.67,15.36-4.7,22.12l19.89,19.89Z" fill="#a4a4a4"/>
      </svg>
    )
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
    <div className="space-y-8" style={{ width: '80%' }}>
      {/* 帳號狀態區塊 */}
      <div className="account-status-section">
        <div className="font-chinese text-white text-content mb-2">
          您是個守規矩的<span style={{ color: 'var(--color-success)', fontWeight: 600 }}>好寶寶</span>
        </div>
        <div className="font-chinese text-gray-scale2 text-tiny mb-14">
          您非常準時地歸還租借，沒有任何逾期記錄
        </div>
        {/* TODO: 狀態視覺化圓點 */}
      </div>

      {/* 個人資料欄位 */}
      <div className="space-y-6">
        {/* 第一行：姓名和班級 */}
        <div className="grid grid-cols-2 gap-24">
          <div>
            <label className="font-chinese text-gray-scale2 text-tiny block mb-2">姓名</label>
            <p className="font-chinese text-white text-small-title">{currentUser?.name || '阿志'}</p>
          </div>
          <div>
            <label className="font-chinese text-gray-scale2 text-tiny block mb-2">班級</label>
            <p className="font-chinese text-white text-small-title">
              {formatClassName(currentUser?.studentId)}
            </p>
          </div>
        </div>

        {/* 第二行：帳號和密碼 */}
        <div className="grid grid-cols-2 gap-24">
          <div>
            <label className="font-chinese text-gray-scale2 text-tiny block mb-2">帳號</label>
            <p className="font-english text-white text-small-title">{currentUser?.studentId || 'A111144001'}</p>
          </div>
          <div>
            <label className="font-chinese text-gray-scale2 text-tiny block mb-2">密碼</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <span className="font-english text-white text-small-title">
                  {isPasswordVisible ? currentPassword : '••••••••'}
                </span>
                <button
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="text-gray-scale2 hover:text-gray-scale2 cursor-pointer transition-colors"
                >
                  {isPasswordVisible ? PASSWORD_ICONS.HIDDEN : PASSWORD_ICONS.VISIBLE}
                </button>
              </div>
              <button className="page-button">
                <div className="menu-item-wrapper">
                  <span className="menu-text">(Change)</span>
                  <span className="menu-text-hidden">(Change)</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* 第三行：手機號碼和Email */}
        <div className="grid grid-cols-2 gap-24">
          <div>
            <label className="font-chinese text-gray-scale2 text-tiny block mb-2">手機號碼</label>
            <div className="flex items-center gap-3">
              <p className="font-english text-white text-small-title flex-1">
                {currentUser?.phone || '未設定'}
              </p>
              <button className="page-button">
                <div className="menu-item-wrapper">
                  <span className="menu-text">({currentUser?.phone ? 'CHANGE' : 'SET'})</span>
                  <span className="menu-text-hidden">({currentUser?.phone ? 'CHANGE' : 'SET'})</span>
                </div>
              </button>
            </div>
          </div>
          <div>
            <label className="font-english text-gray-scale2 text-tiny block mb-2">Email</label>
            <p className="font-english text-white text-small-title">
              {currentUser?.email || `${currentUser?.studentId}@gm2.usc.edu.tw`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
