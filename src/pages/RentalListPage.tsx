/**
 * 租借清單頁面（購物車）
 * 從 rental-list.html 遷移
 */

import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import type { CartItem } from '../types/equipment'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'
import CartList from '../components/cart/CartList'
import { useCart } from '../hooks/useCart'
import { useAuth } from '../contexts/AuthContext'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useCartValidation } from '../hooks/useCartValidation'
import { useOrderSubmission } from '../hooks/useOrderSubmission'
import { readCart, writeCart, formatYmd } from '../components/cart/cartHelpers'

interface BookingDetailsData {
  reason: string
  className?: string
  teacher?: string
}

const STORAGE_KEY = 'sccd_booking_details'

// 解析 groupKey（格式："equipment_<start>_<end>" 或 "space_<start>_<end>"）
// 日期僅含連字號不含底線，故第一個底線後即為 start，最後一個底線後即為 end
const parseGroupKey = (key: string): { category: string; startDate: string; endDate: string } | null => {
  const match = key.match(/^(equipment|space)_(.+)_(.+)$/)
  if (!match) return null
  return { category: match[1], startDate: match[2], endDate: match[3] }
}

const RentalListPage = () => {
  const location = useLocation()
  const { currentUser } = useAuth()
  const {
    cart,
    updateEquipmentQuantity,
    clearCart,
    getOriginalQuantity,
    getCartQuantity
  } = useCart()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [previousPage, setPreviousPage] = useState<'equipment' | 'space' | null>(null)
  const [depositBreakdownExpanded, setDepositBreakdownExpanded] = useState(false)
  // Toast 狀態
  const [showToast, setShowToast] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [deletedItems, setDeletedItems] = useState<CartItem[]>([])
  const [undoTimeout, setUndoTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [toastMessage, setToastMessage] = useState('已刪除選中的訂單')
  // Booking Details 狀態
  const [bookingDetails, setBookingDetails] = useState<Record<string, BookingDetailsData>>({})
  // 選中的訂單組
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())

  // 從 localStorage 載入 booking details
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setBookingDetails(JSON.parse(saved))
      }
    } catch (error) {
      console.error('Failed to load booking details:', error)
    }
  }, [])

  // 處理 Booking Details 變更
  const handleBookingDetailsChange = (groupKey: string, data: BookingDetailsData) => {
    const updated = {
      ...bookingDetails,
      [groupKey]: data
    }
    setBookingDetails(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // 彙整四種購物車驗證規則
  const {
    cartValidation,
    expiredOrdersValidation,
    stockAvailabilityValidation,
    bookingDetailsValidation
  } = useCartValidation({ cart, bookingDetails, getOriginalQuantity, getCartQuantity })

  // 計算不同類型的項目數量
  // 設備：累加所有設備的數量 (A設備3個 + B設備2個 = 5)
  const equipmentItems = cart
    .filter(item => item.category === 'equipment')
    .reduce((sum, item) => sum + item.quantity, 0)
  // 編號區：每個區塊算1個
  const spaceBlockItems = cart.filter(item => item.category === 'space-block').length
  // 教室：每間教室算1個
  const classroomItems = cart.filter(item => item.category === 'classroom').length
  const totalUniqueItems = equipmentItems + spaceBlockItems + classroomItems

  // 計算總押金（只計算選中的訂單組,排除過期訂單）
  const totalDeposit = (() => {
    // 如果沒有選中任何組，返回 0
    if (selectedGroups.size === 0) {
      return 0
    }

    const dateGroups: Record<string, { equipment: number; space: number }> = {}

    cart.forEach(item => {
      const key = `${item.startDate}_${item.endDate}`
      if (!dateGroups[key]) {
        dateGroups[key] = { equipment: 0, space: 0 }
      }

      if (item.category === 'equipment') {
        dateGroups[key].equipment += item.deposit * item.quantity
      } else if (item.category === 'space-block' || item.category === 'classroom') {
        dateGroups[key].space += item.deposit
      }
    })

    // 只計算選中組的押金,排除過期訂單
    let total = 0
    selectedGroups.forEach(groupKey => {
      // groupKey 格式: "equipment_2026-01-20_2026-01-25" 或 "space_2026-01-20_2026-01-25"
      const parsed = parseGroupKey(groupKey)
      if (parsed) {
        const { category, startDate, endDate } = parsed
        const dateKey = `${startDate}_${endDate}` // "2026-01-20_2026-01-25"

        // 檢查該訂單是否過期,過期的不計入押金
        if (expiredOrdersValidation.expiredKeys.includes(dateKey)) {
          return // 跳過過期訂單
        }

        if (dateGroups[dateKey]) {
          if (category === 'equipment') {
            total += Math.min(dateGroups[dateKey].equipment, 5000)
          } else if (category === 'space') {
            total += Math.min(dateGroups[dateKey].space, 5000)
          }
        }
      }
    })

    return total
  })()

  // 從 location state 或 localStorage 獲取上一頁資訊
  useEffect(() => {
    const state = location.state as { from?: string } | null
    if (state?.from) {
      setPreviousPage(state.from as 'equipment' | 'space')
      localStorage.setItem('cart_previous_page', state.from)
    } else {
      const stored = localStorage.getItem('cart_previous_page')
      if (stored === 'equipment' || stored === 'space') {
        setPreviousPage(stored)
      }
    }
  }, [location])

  // 顯示可 undo 的 toast（清除訂單組與單項刪除共用）
  // ponytail: toast 開啟期間的多次刪除會累加進 deletedItems，Undo 一次全復原（涵蓋多區塊區域一次刪除）
  const showUndoToast = (removed: CartItem[], message: string) => {
    if (removed.length === 0) return
    if (undoTimeout) clearTimeout(undoTimeout)
    setDeletedItems(prev => [...prev, ...removed])
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setToastVisible(true), 10)
    const timeout = setTimeout(() => {
      setToastVisible(false)
      setTimeout(() => {
        setShowToast(false)
        setDeletedItems([])
      }, 400)
    }, 5000)
    setUndoTimeout(timeout)
  }

  // 刪除單一項目（點 ✕）→ 直接改 localStorage 並跳可 undo 的 toast
  const handleRemoveSingleItem = (itemId: string, startDate?: string, endDate?: string) => {
    const current = readCart()
    const isMatch = (item: CartItem) =>
      startDate && endDate
        ? item.id === itemId && item.startDate === startDate && item.endDate === endDate
        : item.id === itemId
    const removed = current.filter(isMatch)
    if (removed.length === 0) return
    writeCart(current.filter(item => !isMatch(item)))
    showUndoToast(removed, `已刪除「${removed[0].name}」`)
  }

  // 處理清除選中的訂單組
  const handleClearAll = async () => {
    if (selectedGroups.size === 0) return

    // 找出選中的訂單組對應的所有項目
    const itemsToDelete: CartItem[] = []

    selectedGroups.forEach(groupKey => {
      // groupKey 格式: "equipment_2026-01-20_2026-01-25" 或 "space_2026-01-20_2026-01-25"
      const parsed = parseGroupKey(groupKey)
      if (parsed) {
        const { category, startDate, endDate } = parsed

        // 找出該時段和類別的所有項目
        cart.forEach(item => {
          if (item.startDate === startDate && item.endDate === endDate) {
            // 檢查類別是否匹配
            if ((category === 'equipment' && item.category === 'equipment') ||
                (category === 'space' && (item.category === 'space-block' || item.category === 'classroom'))) {
              itemsToDelete.push(item)
            }
          }
        })
      }
    })

    // 計算要刪除的數量
    const equipmentCount = itemsToDelete
      .filter(item => item.category === 'equipment')
      .reduce((sum, item) => sum + item.quantity, 0)
    const spaceCount = itemsToDelete.filter(item => item.category === 'space-block' || item.category === 'classroom').length
    const totalCount = equipmentCount + spaceCount

    const confirmed = await confirm({
      title: '確認清除選中訂單',
      titleEn: 'Confirm Clear Selected Orders',
      message: `確定要清除選中的租借項目嗎？共 ${totalCount} 件將被移除。`,
      messageEn: `Are you sure you want to clear selected rental items? ${totalCount} item(s) will be removed.`,
      confirmText: 'Clear',
      confirmTextZh: '清除',
      variant: 'danger'
    })

    if (confirmed) {
      // 立即清空選中狀態（在刪除之前）
      setSelectedGroups(new Set())

      // 過濾掉要刪除的項目後寫回 localStorage
      const itemsToDeleteSet = new Set(
        itemsToDelete.map(item => `${item.id}_${item.startDate}_${item.endDate}`)
      )
      writeCart(cart.filter(item => !itemsToDeleteSet.has(`${item.id}_${item.startDate}_${item.endDate}`)))

      // 顯示可 undo 的 toast
      showUndoToast(itemsToDelete, '已刪除選中的訂單')
    }
  }

  // 處理 Undo
  const handleUndo = () => {
    if (undoTimeout) {
      clearTimeout(undoTimeout)
      setUndoTimeout(null)
    }

    // 恢復被刪除的項目（以 id+日期 為鍵，避免同設備不同時段被誤判為已存在）
    const currentCart = readCart()
    const currentKeys = new Set(currentCart.map((item: CartItem) => `${item.id}_${item.startDate}_${item.endDate}`))
    const itemsToRestore = deletedItems.filter(item => !currentKeys.has(`${item.id}_${item.startDate}_${item.endDate}`))

    if (itemsToRestore.length > 0) {
      const restoredCart = [...currentCart, ...itemsToRestore]
      writeCart(restoredCart)
    }

    // 確保選中狀態被清空（恢復的訂單不應該是選中狀態）
    setSelectedGroups(new Set())

    // 關閉 toast
    setToastVisible(false)
    setTimeout(() => {
      setShowToast(false)
      setDeletedItems([])
    }, 400)
  }

  // 送單流程（建收據、寫通知、清空購物車、導向 /profile）
  const submitOrder = useOrderSubmission({ cart, currentUser, clearCart, bookingDetails })

  const handleCheckout = () => {
    if (!agreedToTerms) {
      alert('請先同意使用規則與條款')
      return
    }
    if (cart.length === 0) {
      alert('購物車是空的')
      return
    }
    submitOrder()
  }

  return (
    <div className="bg-black text-white h-screen overflow-hidden flex flex-col">
      <Header />

      {/* 主要內容區塊 */}
      <main className="flex-1 pt-20 overflow-hidden">
        {/* 麵包屑 */}
        <div className="container hidden md:block">
          <div className="text-left pb-4">
            <nav className="breadcrumb-inline whitespace-nowrap">
              <Link to="/catalog" className="breadcrumb-item text-breadcrumb">
                &lt;
              </Link>
              <span> </span>
              <Link to="/catalog" className="breadcrumb-item text-breadcrumb">
                <span className="font-['Inter',_sans-serif]">Category</span> <span className="font-['Noto_Sans_TC',_sans-serif]">類別</span>
              </Link>
              {previousPage && (
                <>
                  <span className="breadcrumb-separator text-breadcrumb">/</span>
                  <Link
                    to={previousPage === 'equipment' ? '/equipment' : '/space'}
                    className="breadcrumb-item text-breadcrumb"
                  >
                    {previousPage === 'equipment' ? (
                      <>
                        <span className="font-['Inter',_sans-serif]">Equipment</span> <span className="font-['Noto_Sans_TC',_sans-serif]">設備</span>
                      </>
                    ) : (
                      <>
                        <span className="font-['Inter',_sans-serif]">Space</span> <span className="font-['Noto_Sans_TC',_sans-serif]">空間</span>
                      </>
                    )}
                  </Link>
                </>
              )}
              <span className="breadcrumb-separator text-breadcrumb">/</span>
              <span className="breadcrumb-item text-breadcrumb">
                <span className="font-['Inter',_sans-serif]">Cart</span> <span className="font-['Noto_Sans_TC',_sans-serif]">清單</span>
              </span>
            </nav>
          </div>
        </div>

        <div className="container h-full flex flex-col overflow-hidden">
          {/* 左右分欄佈局 */}
          <div className="flex gap-16 flex-1 overflow-hidden">
            {/* 左邊：租借清單 (75%) */}
            <div className="w-3/4 flex flex-col overflow-hidden">
              {/* 頁面標題 */}
              <div className="mb-6 flex justify-between items-center flex-shrink-0">
                <h1 className="font-['Inter',_sans-serif] text-white text-medium-title">
                  Cart 清單 ({totalUniqueItems})
                </h1>
                <button
                  onClick={handleClearAll}
                  disabled={selectedGroups.size === 0}
                  className={`text-small-title font-medium whitespace-nowrap ${
                    selectedGroups.size === 0
                      ? 'text-gray-scale4 cursor-not-allowed'
                      : 'text-white hover:opacity-70 transition-opacity cursor-pointer'
                  }`}
                >
                  <span className="font-['Inter',_sans-serif]">Clear</span> <span className="font-['Noto_Sans_TC',_sans-serif]">清除</span>
                </button>
              </div>

              {/* 設備列表 */}
              <div className="flex-1 overflow-y-auto pb-8">
                <CartList
                  cart={cart}
                  onQuantityChange={updateEquipmentQuantity}
                  onRemoveItem={handleRemoveSingleItem}
                  bookingDetails={bookingDetails}
                  onBookingDetailsChange={handleBookingDetailsChange}
                  expiredDateKeys={expiredOrdersValidation.expiredKeys}
                  selectedGroups={selectedGroups}
                  onSelectedGroupsChange={setSelectedGroups}
                />
              </div>
            </div>

            {/* 右邊：租借摘要 (25%) */}
            <div className="w-1/4 pr-4">
              {/* 租借摘要內容 */}
              <div>
                {/* 押金標籤 */}
                <div className="mb-2">
                  <div className="text-tiny text-gray-scale2">
                    <span className="font-['Inter',_sans-serif]">Total Deposit</span>{' '}
                    <span className="font-['Noto_Sans_TC',_sans-serif]">總押金</span>
                  </div>
                </div>

                {/* 總押金展開按鈕 */}
                <button
                  onClick={() => setDepositBreakdownExpanded(!depositBreakdownExpanded)}
                  className="w-full flex items-center justify-between mb-4 cursor-pointer"
                >
                  <div className="text-large-title font-['Inter',_sans-serif] font-normal text-white tracking-wide">
                    NT$ {totalDeposit.toLocaleString()}
                  </div>
                  <svg
                    className={`w-4 h-4 text-white transition-transform ${depositBreakdownExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* 時段押金明細 - 展開時顯示 */}
                {depositBreakdownExpanded && (
                  <div className="mb-6">
                    {(() => {
                      // 如果沒有選中任何組，不顯示明細
                      if (selectedGroups.size === 0) {
                        return (
                          <div className="text-tiny text-gray-scale2 font-['Noto_Sans_TC',_sans-serif]">
                            請先選擇訂單組
                          </div>
                        )
                      }

                      // 按日期分組計算每個時段的押金（設備和空間分開計算）
                      const dateGroups: Record<string, { startDate: string; endDate: string; equipment: number; space: number; equipmentSelected: boolean; spaceSelected: boolean }> = {}

                      cart.forEach(item => {
                        const key = `${item.startDate}_${item.endDate}`
                        if (!dateGroups[key]) {
                          dateGroups[key] = {
                            startDate: item.startDate,
                            endDate: item.endDate,
                            equipment: 0,
                            space: 0,
                            equipmentSelected: false,
                            spaceSelected: false
                          }
                        }

                        if (item.category === 'equipment') {
                          dateGroups[key].equipment += item.deposit * item.quantity
                        } else if (item.category === 'space-block' || item.category === 'classroom') {
                          dateGroups[key].space += item.deposit
                        }
                      })

                      // 標記哪些組被選中
                      selectedGroups.forEach(groupKey => {
                        const parsed = parseGroupKey(groupKey)
                        if (parsed) {
                          const { category, startDate, endDate } = parsed
                          const dateKey = `${startDate}_${endDate}`
                          if (dateGroups[dateKey]) {
                            if (category === 'equipment') {
                              dateGroups[dateKey].equipmentSelected = true
                            } else if (category === 'space') {
                              dateGroups[dateKey].spaceSelected = true
                            }
                          }
                        }
                      })

                      const sortedGroups = Object.values(dateGroups).sort((a, b) =>
                        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
                      )

                      // 只顯示被選中的組,排除過期訂單
                      const selectedGroupsList: { startDate: string; endDate: string; deposit: number }[] = []
                      sortedGroups.forEach(group => {
                        const dateKey = `${group.startDate}_${group.endDate}`

                        // 檢查該訂單是否過期,過期的不顯示在明細中
                        if (expiredOrdersValidation.expiredKeys.includes(dateKey)) {
                          return // 跳過過期訂單
                        }

                        if (group.equipmentSelected) {
                          selectedGroupsList.push({
                            startDate: group.startDate,
                            endDate: group.endDate,
                            deposit: Math.min(group.equipment, 5000)
                          })
                        }
                        if (group.spaceSelected) {
                          selectedGroupsList.push({
                            startDate: group.startDate,
                            endDate: group.endDate,
                            deposit: Math.min(group.space, 5000)
                          })
                        }
                      })

                      return selectedGroupsList.map((group, index) => {
                        // 格式化日期為 2026/01/20 格式
                        return (
                          <div key={index} className="flex items-center gap-3 text-tiny text-white mb-3">
                            {/* 數字符號：自製圓圈＋數字（像 Guide，無數量上限；固定寬度讓後面日期對齊） */}
                            <span className="flex-shrink-0 w-4 h-4 rounded-full border border-white flex items-center justify-center text-white text-[10px] font-['Inter',_sans-serif] leading-none">
                              {index + 1}
                            </span>
                            <span className="font-['Inter',_sans-serif]">
                              {formatYmd(new Date(group.startDate))} - {formatYmd(new Date(group.endDate))}
                            </span>
                            <span className="font-['Inter',_sans-serif]">
                              NT$ {group.deposit.toLocaleString()}
                            </span>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}

                <div className="mb-8"></div>

                <div className="mb-6">
                  <div className="text-shrink-container pr-4">
                    <p className="text-tiny font-['Inter',_sans-serif] text-white text-shrink-content mb-2">
                      Please visit the SA to pay the deposit and complete your reservation within 24 hrs of checkout.
                    </p>
                    <p className="text-tiny font-['Noto_Sans_TC',_sans-serif] text-white text-shrink-content">
                      結帳後會保留24小時的繳押金時間，請在時間內至系學會完成預約程序
                    </p>
                  </div>
                </div>

                {/* 同意條款 */}
                <div className="mb-12">
                  <div className="flex items-start gap-3">
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        id="terms-checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="peer h-4 w-4 shrink-0 cursor-pointer appearance-none border border-gray-scale2 bg-transparent checked:border-white checked:bg-white transition-all"
                      />
                      <svg
                        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 transition-opacity"
                        width="10"
                        height="8"
                        viewBox="0 0 10 8"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="black"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <span className="text-tiny text-white leading-tight">
                      <span className="font-['Inter',_sans-serif]">I have read and agree to the department&apos;s equipment &amp; space rental </span>
                      <span className="font-['Noto_Sans_TC',_sans-serif]">我已閱讀並同意系上租借設備與空間的</span>
                      <a
                        href="https://docs.google.com/document/d/1gSzAqyPO922dO6Y61sYF070jZmntP8Kyjz24YQbp4uA/edit?usp=sharing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline cursor-pointer hover:text-zinc-300 transition-colors"
                      >
                        <span className="font-['Inter',_sans-serif]">Terms &amp; Conditions </span>
                        <span className="font-['Noto_Sans_TC',_sans-serif]">使用規則與條款</span>
                      </a>
                    </span>
                  </div>
                </div>

                {/* 預約條件檢查清單 */}
                {cart.length > 0 && (
                  <div className="mb-6 space-y-2">
                    {/* 條件 0: 檢查過期訂單 - 僅有過期訂單時顯示 */}
                    {!expiredOrdersValidation.valid && (
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-tiny" style={{
                          color: '#ffff00',
                          marginTop: '2px'
                        }}>
                          info
                        </span>
                        <div className="flex-1">
                          <span className={`text-tiny text-[#ffff00]`}>
                            <span className="font-['Inter',_sans-serif]">{expiredOrdersValidation.detail}</span>
                            {' '}
                            <span className="font-['Noto_Sans_TC',_sans-serif]">{expiredOrdersValidation.message}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 條件 0.5: 檢查缺貨設備 - 僅有缺貨時顯示 */}
                    {!stockAvailabilityValidation.valid && (
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-tiny" style={{
                          color: '#ffff00',
                          marginTop: '2px'
                        }}>
                          info
                        </span>
                        <div className="flex-1">
                          <span className={`text-tiny text-[#ffff00]`}>
                            <span className="font-['Inter',_sans-serif]">{stockAvailabilityValidation.detail}</span>
                            {' '}
                            <span className="font-['Noto_Sans_TC',_sans-serif]">{stockAvailabilityValidation.message}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 條件 1: 填寫借用資訊 - 常駐 */}
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-tiny" style={{
                        color: bookingDetailsValidation.valid ? '#00ff80' : '#cccccc'
                      }}>
                        {bookingDetailsValidation.valid ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span className={`text-tiny ${
                        bookingDetailsValidation.valid ? 'text-white' : 'text-gray-scale2'
                      }`}>
                        <span className="font-['Inter',_sans-serif]">Fill in booking details</span>{' '}
                        <span className="font-['Noto_Sans_TC',_sans-serif]">填寫借用資訊</span>
                      </span>
                    </div>

                    {/* 條件 2: 大量訂單需滿 10 件 - 僅大量訂單顯示 */}
                    {(() => {
                      const hasMassBooking = cart.some(item =>
                        item.bookingType === 'mass-personal' || item.bookingType === 'mass-group'
                      )
                      if (!hasMassBooking) return null

                      return (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-tiny" style={{
                            color: cartValidation.valid ? '#00ff80' : '#cccccc'
                          }}>
                            {cartValidation.valid ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span className={`text-tiny ${
                            cartValidation.valid ? 'text-white' : 'text-gray-scale2'
                          }`}>
                            <span className="font-['Inter',_sans-serif]">Min. 10 items</span>{' '}
                            <span className="font-['Noto_Sans_TC',_sans-serif]">大量租借需滿 10 件</span>
                          </span>
                        </div>
                      )
                    })()}

                    {/* 條件 3: 同意條款 - 常駐 */}
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-tiny" style={{
                        color: agreedToTerms ? '#00ff80' : '#cccccc'
                      }}>
                        {agreedToTerms ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span className={`text-tiny ${
                        agreedToTerms ? 'text-white' : 'text-gray-scale2'
                      }`}>
                        <span className="font-['Inter',_sans-serif]">Agree to terms</span>{' '}
                        <span className="font-['Noto_Sans_TC',_sans-serif]">同意借用條款</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* 租借按鈕 */}
                <div>
                  <button
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || !agreedToTerms || !cartValidation.valid || !bookingDetailsValidation.valid || !expiredOrdersValidation.valid || !stockAvailabilityValidation.valid}
                    className={`text-small-title font-medium whitespace-nowrap ${
                      cart.length === 0 || !agreedToTerms || !cartValidation.valid || !bookingDetailsValidation.valid || !expiredOrdersValidation.valid || !stockAvailabilityValidation.valid
                        ? 'text-gray-scale4 cursor-not-allowed'
                        : 'text-white hover:opacity-70 transition-opacity cursor-pointer'
                    }`}
                  >
                    <span className="font-['Inter',_sans-serif]">Book</span> <span className="font-['Noto_Sans_TC',_sans-serif]">送出</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Toast 通知 - 使用 Portal 渲染到 body 層級 */}
      {showToast && createPortal(
        <div
          className={`toast ${toastVisible ? 'show' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <span className="font-['Noto_Sans_TC',_sans-serif] text-tiny">
            {toastMessage}
          </span>
          <button
            onClick={handleUndo}
            className="font-['Inter',_sans-serif] text-tiny text-black hover:opacity-50 transition-opacity cursor-pointer underline-offset-2"
          >
            Undo
          </button>
        </div>,
        document.body
      )}

      {/* 確認對話框 */}
      <ConfirmDialog />
    </div>
  )
}

export default RentalListPage
