/**
 * OrderPage 組件
 * 訂單詳情頁面
 */

import React, { useMemo } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'
import { getAreaName, getBlockArea, getBlockImage, sortBlockIds } from '../components/cart/cartHelpers'
import { displayOrderStatus, overduePenalty } from '../utils/timeUtils'
import { fetchClosedDates } from '../services/ordersService'

interface OrderItem {
  id: string
  name: string
  category: string
  deposit: number
  quantity?: number
  image: string
  startDate: string
  endDate: string
  bookingType?: string
}

type OrderStatus = 'pending' | 'in-progress' | 'returned' | 'overdue' | 'canceled'

interface OrderData {
  borrowerName: string
  rentalDates: string[]
  rentalNumber: string
  totalDeposit: number
  items: OrderItem[]
  createdAt: string
  status?: OrderStatus
  statusUpdatedAt?: string
  reason?: string // 借用使用原因
}

interface DateGroup {
  startDate: string
  endDate: string
  equipmentItems: OrderItem[]
  spaceItems: OrderItem[]
}

// 訂單狀態判定統一在 utils/timeUtils.ts（與 ProfilePage 共用，列表／詳情不再各算各的）

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

const OrderPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const receiptRef = React.useRef<HTMLDivElement>(null)

  // 從 location.state 獲取租借資料
  const rentalData = location.state as OrderData | null

  // 臨時公休日（24 工作時判定用）
  const [closedDates, setClosedDates] = React.useState<ReadonlySet<string>>(new Set())
  React.useEffect(() => {
    fetchClosedDates().then(setClosedDates)
  }, [])

  // 如果沒有租借資料，導航回首頁
  React.useEffect(() => {
    if (!rentalData) {
      navigate('/', { replace: true })
    }
  }, [rentalData, navigate])

  if (!rentalData) {
    return null
  }

  // 計算當前訂單狀態（與 ProfilePage 同一套判定，修正列表已取消／詳情仍 pending 的不同步）
  const currentStatus = displayOrderStatus(rentalData.status, rentalData.createdAt, closedDates)
  const statusInfo = getStatusInfo(currentStatus)

  // 逾期累計罰款試算（僅 overdue 顯示）
  const endDateStr = [...rentalData.rentalDates].sort()[rentalData.rentalDates.length - 1]
  const penalty = currentStatus === 'overdue'
    ? overduePenalty(endDateStr, rentalData.totalDeposit, closedDates)
    : 0

  // 按日期分組
  const dateGroups = useMemo(() => {
    const groups: Record<string, DateGroup> = {}

    rentalData.items.forEach(item => {
      const key = `${item.startDate}_${item.endDate}`

      if (!groups[key]) {
        groups[key] = {
          startDate: item.startDate,
          endDate: item.endDate,
          equipmentItems: [],
          spaceItems: []
        }
      }

      if (item.category === 'equipment') {
        groups[key].equipmentItems.push(item)
      } else {
        groups[key].spaceItems.push(item)
      }
    })

    // 按開始日期排序
    return Object.values(groups).sort((a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )
  }, [rentalData.items])

  // 格式化日期顯示
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  // 格式化送單時間（日期 + 時間）
  const formatOrderTime = () => {
    if (!rentalData.createdAt) return ''
    const date = new Date(rentalData.createdAt)
    const dateStr = date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    const timeStr = date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    return `${dateStr} ${timeStr}`
  }

  // 下載收據 PDF
  const handleDownload = async () => {
    if (!receiptRef.current) return

    try {
      // 將隱藏的收據元素轉換為 Canvas
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2, // 約 192 DPI，收據（純文字白底）已足夠清晰
        useCORS: true, // 允許跨域圖片
        backgroundColor: '#ffffff' // 強制白底
      } as any)

      // 計算 PDF 尺寸
      // JPEG（白底不需透明）+ compress：檔案由數十 MB 降到約 1MB
      const imgData = canvas.toDataURL('image/jpeg', 0.9)
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true }) // A4 直向
      const pdfWidth = pdf.internal.pageSize.getWidth()

      // 調整圖片大小以適應 A4 寬度
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight)
      pdf.save(`SCCD_Receipt_${rentalData.rentalNumber}.pdf`)
    } catch (error) {
      console.error('PDF generation failed:', error)
      alert('收據生成失敗，請稍後再試')
    }
  }

  // 格式化預約日期範圍
  const formatBookingDateRange = () => {
    if (rentalData.rentalDates.length === 0) return ''
    const sorted = [...rentalData.rentalDates].sort()
    return `${formatDate(sorted[0])} - ${formatDate(sorted[sorted.length - 1])}`
  }

  // 獲取訂單種類標籤 (用於 PDF)
  const getBookingTypeLabel = (type?: string) => {
    if (type === 'mass-personal' || type === 'mass-group') return 'Mass - 大量'
    if (type === 'little') return 'Light - 小量'
    return 'Light - 小量' // 預設
  }

  return (
    <div className="bg-black text-white h-screen overflow-hidden flex flex-col">
      <Header />

      {/* 主要內容區塊 */}
      <main className="flex-1 pt-20 overflow-hidden flex flex-col">
        {/* 麵包屑 */}
        <div className="container hidden md:block flex-shrink-0">
          <div className="text-left pb-4">
            <nav className="breadcrumb-inline whitespace-nowrap">
              <Link to="/profile" className="breadcrumb-item text-breadcrumb">
                <span className="mr-2">←</span>
                <span>Back</span>
                <span className="font-['Noto_Sans_TC',_sans-serif]"> 返回</span>
              </Link>
            </nav>
          </div>
        </div>

        {/* 主內容容器 */}
        <div className="container flex-1 overflow-hidden flex flex-col">
          {/* 標題和狀態 */}
          <div className="flex-shrink-0 mb-6 flex items-center justify-between">
            <h1 className="font-['Inter',_sans-serif] text-large-title text-white" style={{ fontWeight: 500 }}>
              {rentalData.rentalNumber}
            </h1>
            {/* 狀態標籤（逾期時加累計罰款試算，最終金額歸還時由系學會確認） */}
            <div className="flex items-center gap-4">
              {currentStatus === 'overdue' && penalty > 0 && (
                <span className="font-['Inter',_sans-serif] text-small-title text-error2">
                  Penalty <span className="font-['Noto_Sans_TC',_sans-serif]">累計罰款</span> NT$ {penalty.toLocaleString()}
                </span>
              )}
              <div
                className="px-4 py-2 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: statusInfo.color }}
              >
                <span
                  className="font-['Inter',_sans-serif] text-small-title font-medium"
                  style={{ color: statusInfo.textColor }}
                >
                  {statusInfo.en} <span className="font-['Noto_Sans_TC',_sans-serif]">{statusInfo.zh}</span>
                </span>
              </div>
            </div>
          </div>

          {/* 左右分欄佈局 */}
          <div className="flex-1 flex gap-20 overflow-hidden pr-2">
            {/* 左邊：摘要 (60%) */}
            <div className="w-3/5 flex flex-col overflow-hidden">
              {/* 滾動區域 */}
              <div className="flex-1 overflow-y-auto pr-4">
                {dateGroups.map((group) => {
                  const groupKey = `${group.startDate}_${group.endDate}`

                  return (
                    <div key={groupKey}>
                      {/* Equipment 區塊 */}
                      {group.equipmentItems.length > 0 && (
                        <div className="mb-4">
                          {/* Equipment 標題 */}
                          <div className="w-full grid grid-cols-[1fr_140px_120px] gap-6 items-center py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-['Inter',_sans-serif] text-content text-white" style={{ fontWeight: 500 }}>Equipment</span>
                              <span className="font-['Noto_Sans_TC',_sans-serif] text-content text-white" style={{ fontWeight: 500 }}>設備</span>
                            </div>
                            {/* 總數量 */}
                            <div className="font-['Inter',_sans-serif] text-small-title text-white text-center" style={{ fontWeight: 500 }}>
                              {group.equipmentItems.reduce((sum, item) => sum + (item.quantity || 1), 0)}
                            </div>
                            {/* 總押金 */}
                            <div className="font-['Inter',_sans-serif] text-small-title text-white text-center" style={{ fontWeight: 500 }}>
                              NT$ {Math.min(group.equipmentItems.reduce((sum, item) => sum + (item.deposit * (item.quantity || 1)), 0), 5000).toLocaleString()}
                            </div>
                          </div>

                          {/* Equipment 列表 */}
                          <div className="pr-4">
                            {group.equipmentItems.map((item, index) => (
                              <div
                                key={`${item.id}-${index}`}
                                className="grid grid-cols-[80px_1fr_140px_120px] gap-6 py-3 border-b border-[#7c7c7c] items-center"
                              >
                                {/* 縮圖 */}
                                <div className="w-[80px] h-[80px] flex-shrink-0 overflow-hidden rounded-lg">
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>

                                {/* 名稱 */}
                                <div className="font-['Noto_Sans_TC',_sans-serif] text-small-title text-white">
                                  {item.name}
                                </div>

                                {/* 數量 */}
                                <div className="font-['Inter',_sans-serif] text-small-title text-white text-center">
                                  {item.quantity || 1}
                                </div>

                                {/* 押金 */}
                                <div className="font-['Inter',_sans-serif] text-small-title text-white text-center">
                                  NT$ {(item.deposit * (item.quantity || 1)).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Space 區塊 */}
                      {group.spaceItems.length > 0 && (
                        <div className="mb-4">
                          {/* Space 標題 */}
                          <div className="w-full grid grid-cols-[1fr_140px_120px] gap-6 items-center py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-['Inter',_sans-serif] text-content text-white" style={{ fontWeight: 500 }}>Space</span>
                              <span className="font-['Noto_Sans_TC',_sans-serif] text-content text-white" style={{ fontWeight: 500 }}>空間</span>
                            </div>
                            {/* 總數量 */}
                            <div className="font-['Inter',_sans-serif] text-small-title text-white text-center" style={{ fontWeight: 500 }}>
                              {(() => {
                                // 計算總數量：區塊總數（按編號計算）+ 教室數
                                const blocks = group.spaceItems.filter(item => item.category === 'space-block')
                                const classrooms = group.spaceItems.filter(item => item.category === 'classroom')

                                const totalBlocks = blocks.length
                                const totalClassrooms = classrooms.length

                                return totalBlocks + totalClassrooms
                              })()}
                            </div>
                            {/* 總押金 */}
                            <div className="font-['Inter',_sans-serif] text-small-title text-white text-center" style={{ fontWeight: 500 }}>
                              NT$ {Math.min(group.spaceItems.reduce((sum, item) => sum + item.deposit, 0), 5000).toLocaleString()}
                            </div>
                          </div>

                          {/* Space 列表 */}
                          <div className="pr-4">
                            {(() => {
                              // 分組處理：將 space-block 按區域分組，教室保持獨立
                              const classrooms: OrderItem[] = []
                              const blocksByArea: Record<string, OrderItem[]> = {}

                              group.spaceItems.forEach(item => {
                                if (item.category === 'classroom') {
                                  classrooms.push(item)
                                } else if (item.category === 'space-block') {
                                  const area = getBlockArea(item.id)
                                  if (!blocksByArea[area]) {
                                    blocksByArea[area] = []
                                  }
                                  blocksByArea[area].push(item)
                                }
                              })

                              // 渲染分組後的項目
                              const renderedItems: JSX.Element[] = []

                              // 先渲染分組的 space-block
                              Object.entries(blocksByArea).forEach(([area, blocks]) => {
                                if (blocks.length === 0) return

                                const areaName = getAreaName(blocks[0].id)
                                const displayImage = getBlockImage(blocks[0].id)
                                const blockIds = sortBlockIds(blocks.map(b => b.id))
                                const totalDeposit = blocks.reduce((sum, b) => sum + b.deposit, 0)
                                const groupKey = `${area}_${blockIds.join('_')}`

                                renderedItems.push(
                                  <div
                                    key={groupKey}
                                    className="grid grid-cols-[80px_1fr_140px_120px] gap-6 py-3 border-b border-[#7c7c7c] items-center"
                                  >
                                    {/* 縮圖 */}
                                    <div className="w-[80px] h-[80px] flex-shrink-0 overflow-hidden rounded-lg">
                                      <img
                                        src={displayImage}
                                        alt={areaName}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>

                                    {/* 名稱（區域 + 所有編號） */}
                                    <div className="font-['Noto_Sans_TC',_sans-serif] text-small-title text-white">
                                      {areaName}（{blockIds.join('、')}）
                                    </div>

                                    {/* 數量（區塊數） */}
                                    <div className="font-['Inter',_sans-serif] text-small-title text-white text-center">
                                      {blocks.length}
                                    </div>

                                    {/* 押金（總和） */}
                                    <div className="font-['Inter',_sans-serif] text-small-title text-white text-center">
                                      NT$ {totalDeposit.toLocaleString()}
                                    </div>
                                  </div>
                                )
                              })

                              // 再渲染教室
                              classrooms.forEach((item, idx) => {
                                renderedItems.push(
                                  <div
                                    key={`${item.id}-${idx}`}
                                    className="grid grid-cols-[80px_1fr_140px_120px] gap-6 py-3 border-b border-[#7c7c7c] items-center"
                                  >
                                    {/* 縮圖 */}
                                    <div className="w-[80px] h-[80px] flex-shrink-0 overflow-hidden rounded-lg">
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>

                                    {/* 名稱 */}
                                    <div className="font-['Noto_Sans_TC',_sans-serif] text-small-title text-white">
                                      {item.name}
                                    </div>

                                    {/* 數量 */}
                                    <div className="font-['Inter',_sans-serif] text-small-title text-white text-center">
                                      1
                                    </div>

                                    {/* 押金 */}
                                    <div className="font-['Inter',_sans-serif] text-small-title text-white text-center">
                                      NT$ 5,000
                                    </div>
                                  </div>
                                )
                              })

                              return renderedItems
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 右邊：預約資訊 (40%) */}
            <div className="w-2/5 flex flex-col">
              {/* 預約資訊 */}
              <div className="space-y-6 mb-16 flex-shrink-0">
                {/* Order Time */}
                <div className="grid grid-cols-[140px_1fr] gap-4">
                  <div>
                    <div className="font-['Inter',_sans-serif] text-tiny text-[#cccccc]">Order Time</div>
                    <div className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc]">送單時間</div>
                  </div>
                  <div className="font-['Inter',_sans-serif] text-medium-title text-white text-right">
                    {formatOrderTime()}
                  </div>
                </div>

                {/* Booking Date */}
                <div className="grid grid-cols-[140px_1fr] gap-4">
                  <div>
                    <div className="font-['Inter',_sans-serif] text-tiny text-[#cccccc]">Booking Date</div>
                    <div className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc]">借用日期</div>
                  </div>
                  <div className="font-['Inter',_sans-serif] text-medium-title text-white text-right">
                    {formatBookingDateRange()}
                  </div>
                </div>

                {/* User */}
                <div className="grid grid-cols-[140px_1fr] gap-4">
                  <div>
                    <div className="font-['Inter',_sans-serif] text-tiny text-[#cccccc]">User</div>
                    <div className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc]">借用者</div>
                  </div>
                  <div className="font-['Noto_Sans_TC',_sans-serif] text-medium-title text-white text-right">
                    {rentalData.borrowerName}
                  </div>
                </div>

                {/* Deposit */}
                <div className="grid grid-cols-[140px_1fr] gap-4">
                  <div>
                    <div className="font-['Inter',_sans-serif] text-tiny text-[#cccccc]">Deposit</div>
                    <div className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc]">押金</div>
                  </div>
                  <div className="font-['Inter',_sans-serif] text-medium-title text-white text-right">
                    NT$ {rentalData.totalDeposit.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* User Guide */}
              <div className="grid grid-cols-[140px_1fr] gap-2 mb-4 flex-shrink-0">
                <div>
                  <div className="font-['Inter',_sans-serif] text-tiny text-[#cccccc]">User Guide</div>
                  <div className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc]">使用說明</div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="font-['Inter',_sans-serif] text-tiny text-white leading-relaxed">
                      1. Please bring this receipt to the SA during business hours to pay the deposit and complete your reservation.
                    </p>
                    <p className="font-['Inter',_sans-serif] text-tiny text-white leading-relaxed">
                      2. Cash payments only.
                    </p>
                    <p className="font-['Inter',_sans-serif] text-tiny text-white leading-relaxed">
                      3. On the return date, please present this receipt at the SA to retrieve your deposit.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-white leading-relaxed">
                      1. 請在系學會營業時間內携帶此收據繳交押金以完成預約程序。
                    </p>
                    <p className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-white leading-relaxed">
                      2. 僅接受現金交易。
                    </p>
                    <p className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-white leading-relaxed">
                      3. 歸還日到期時，憑藉此收據至系學會索取押金。
                    </p>
                  </div>
                </div>
              </div>

              {/* Download Button - 靠右下角 */}
              <div className="mt-auto flex justify-end items-end">
                <button
                  onClick={handleDownload}
                  className="w-10 h-10 flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                  title="下載 PDF 收據"
                >
                  <span className="material-symbols-outlined text-white" style={{ fontSize: '32px' }}>download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* A4 收據模板 (用於生成 PDF) */}
      {/* 永遠在 DOM 中，移到螢幕外，供 html2canvas 擷取 */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div
          ref={receiptRef}
          className="w-[210mm] min-h-[297mm] bg-white text-black p-8 box-border flex flex-col"
          style={{ fontFamily: 'Inter, Noto Sans TC, sans-serif' }}
        >
          {/* A. 第一部分：Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">SCCDSA Booking</h1>
              <p className="text-2xl font-bold">實踐媒傳系學會借用系統</p>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold mb-1">Receipt 收據</h2>
              <p className="text-2xl font-bold">{rentalData.rentalNumber}</p>
            </div>
          </div>

          {/* B. 第二部分：Info Section */}
          {/* 第一列：送出時間、使用日期、使用者 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-xs text-black mb-1 font-semibold">Order Time 送出時間</p>
              <p className="text-base font-semibold">{formatOrderTime()}</p>
            </div>
            <div>
              <p className="text-xs text-black mb-1 font-semibold">Booking Date 使用日期</p>
              <p className="text-base font-semibold">{formatBookingDateRange()}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-left w-fit">
                <p className="text-xs text-black mb-1 font-semibold">User 使用者</p>
                <p className="text-base font-bold">{rentalData.borrowerName}</p>
              </div>
            </div>
          </div>
          
          {/* 第二列：訂單種類、使用原因 */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div>
              <p className="text-xs text-black mb-1 font-semibold">Order Type 訂單種類</p>
              <p className="text-base font-semibold">{getBookingTypeLabel(rentalData.items[0]?.bookingType)}</p>
            </div>
            <div>
              <p className="text-xs text-black mb-1 font-semibold">Reason 使用原因</p>
              <p className="text-base font-semibold text-black">{rentalData.reason || '—'}</p>
            </div>
          </div>

          {/* C. 第三部分：Items Table */}
          <div className="flex-1">
            <table className="w-full border-collapse mb-4">
              <thead>
                <tr>
                  <th className="w-[60%] border-b border-[#7c7c7c]">
                    <div className="text-left pt-2 pb-4 font-semibold">Item 項目</div>
                  </th>
                  <th className="w-[20%] border-b border-[#7c7c7c]">
                    <div className="text-left pt-2 pb-4 font-semibold">Qty 數量</div>
                  </th>
                  <th className="w-[20%] border-b border-[#7c7c7c]">
                    <div className="text-left pt-2 pb-4 font-semibold">Deposit 押金</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // 將所有項目扁平化並分類
                  const allItems = rentalData.items
                  const spaceItems = allItems.filter(i => i.category !== 'equipment')
                  const equipmentItems = allItems.filter(i => i.category === 'equipment')
                  
                  const rows = []

                  // 1. Space 空間 (在上)
                  if (spaceItems.length > 0) {
                    rows.push(
                      <tr key="header-space">
                        <td colSpan={3} className="py-2 font-bold pt-4 text-lg">Space 空間</td>
                      </tr>
                    )
                    spaceItems.forEach((item, idx) => {
                      rows.push(
                        <tr key={`space-${idx}`}>
                          <td className="border-b border-[#7c7c7c]">
                            <div className="pt-2 pb-4">{item.name}</div>
                          </td>
                          <td className="border-b border-[#7c7c7c]">
                            <div className="pt-2 pb-4 text-left">{item.quantity || 1}</div>
                          </td>
                          <td className="border-b border-[#7c7c7c]">
                            <div className="pt-2 pb-4 text-left">NT$ {item.deposit.toLocaleString()}</div>
                          </td>
                        </tr>
                      )
                    })
                  }
                  
                  // 2. Equipment 設備
                  if (equipmentItems.length > 0) {
                    rows.push(
                      <tr key="header-equip">
                        <td colSpan={3} className="py-2 font-bold pt-4 text-lg">Equipment 設備</td>
                      </tr>
                    )
                    equipmentItems.forEach((item, idx) => {
                      rows.push(
                        <tr key={`equip-${idx}`}>
                          <td className="border-b border-[#7c7c7c]">
                            <div className="pt-2 pb-4">{item.name}</div>
                          </td>
                          <td className="border-b border-[#7c7c7c]">
                            <div className="pt-2 pb-4 text-left">{item.quantity || 1}</div>
                          </td>
                          <td className="border-b border-[#7c7c7c]">
                            <div className="pt-2 pb-4 text-left">NT$ {(item.deposit * (item.quantity || 1)).toLocaleString()}</div>
                          </td>
                        </tr>
                      )
                    })
                  }
                  return rows
                })()}
              </tbody>
              {/* Total Row - 靠齊 Qty 左邊 */}
              <tfoot>
                <tr>
                  <td className="pt-6"></td>
                  <td className="pt-6 text-left font-semibold">Total 總押金</td>
                  <td className="pt-6 text-left font-normal">NT$ {rentalData.totalDeposit.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* D. 第四部分：Footer */}
          <div className="mt-auto pt-4">
            <div className="flex justify-between items-end">
              <div className="w-[75%]">
                <h3 className="font-bold mb-2 text-sm">User Guide 使用說明</h3>
                <div className="text-xs space-y-1 text-black">
                  <div className="flex gap-2">
                    <span className="flex-shrink-0">1.</span>
                    <span>Please bring this receipt to the SA during business hours to pay the deposit. 請於營業時間內持本收據至系學會繳交押金。</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0">2.</span>
                    <span>Cash payments only. 僅接受現金。</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0">3.</span>
                    <span>On the return date, please present this receipt to retrieve your deposit. 歸還時請出示本收據以退還押金。</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">page 1/1</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrderPage
