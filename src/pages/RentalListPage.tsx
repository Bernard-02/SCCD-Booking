/**
 * 租借清單頁面（購物車）
 * 從 rental-list.html 遷移
 */

import { BTN, BTN_INVERT, BTN_TOOL } from '@/components/common/btn'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cartGroupKey, type CartItem } from '../types/equipment'
import { calcBundles } from '../utils/bundleUtils'
import Header from '../components/layouts/Header'
import BackButton from '../components/common/BackButton'
import Footer from '../components/layouts/Footer'
import CartList from '../components/cart/CartList'
import type { BookingDetailsData } from '../components/common/BookingDetailsDialog'
import { useCart } from '../hooks/useCart'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useCartValidation } from '../hooks/useCartValidation'
import { useOrderSubmission } from '../hooks/useOrderSubmission'
import { useSuspension } from '../hooks/useSuspension'
import { useToast } from '../hooks/useToast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useAuth } from '../contexts/AuthContext'
import { useCartReserved, useItemName } from '../services/equipmentService'
import { useCartTakenSpaces } from '../services/spaceService'
import { updateMyPhone } from '../services/authService'
import Dialog from '../components/common/ConfirmDialog'
import EditProfileDialog from '../components/profile/EditProfileDialog'
import { readCart, writeCart, formatYmd, detailsKey, readDetails, writeDetails, sortBlockIds } from '../components/cart/cartHelpers'
import { daysLabel } from '../utils/timeUtils'
import { useT } from '../stores/langStore'
import { useGuideDocUrl } from '../services/contentService'

// 解析 groupKey（格式："equipment_<start>_<end>" 或 "space_<start>_<end>"）
// 日期僅含連字號不含底線，故第一個底線後即為 start，最後一個底線後即為 end
const parseGroupKey = (key: string): { category: string; startDate: string; endDate: string } | null => {
  const match = key.match(/^(equipment|space)_(.+)_(.+)$/)
  if (!match) return null
  return { category: match[1], startDate: match[2], endDate: match[3] }
}

// 送出條件的圈：大小、線寬同 .custom-checkbox（同意條款的勾選圈，css/common.css），完成＝綠底黑勾
const StatusCircle = ({ done }: { done: boolean }) => (
  <span className={`w-[1.125rem] h-[1.125rem] shrink-0 rounded-full border-[1.5px] flex items-center justify-center ${done ? 'bg-green border-green' : 'border-gray-light'}`}>
    {done && (
      <svg viewBox="0 0 10 8" fill="none" className="w-[55%]" aria-hidden="true">
        <path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </span>
)

const RentalListPage = () => {
  const t = useT()
  const guideDocUrl = useGuideDocUrl() // 使用教學第一個「連結」積木的網址
  const {
    cart,
    updateEquipmentQuantity,
    clearCart,
    getOriginalQuantity,
    getCartQuantity,
    bundles
  } = useCart()
  // 先送先贏、購物車不佔位：別人先送出後，清單裡被借走的要標出來、送出鈕鎖住。
  // 每分鐘＋切回分頁重查一次，送單被 server 擋下時也馬上重查（availTick）
  const [availTick, setAvailTick] = useState(0)
  useAutoRefresh(() => setAvailTick(n => n + 1))
  const getReserved = useCartReserved(cart, availTick)
  const isTaken = useCartTakenSpaces(cart, availTick)
  const { currentUser, updateUser } = useAuth()
  const itemName = useItemName()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast: showErrorToast, toastElement } = useToast()

  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [depositBreakdownExpanded, setDepositBreakdownExpanded] = useState(false)
  // Toast 狀態
  const [showToast, setShowToast] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [deletedItems, setDeletedItems] = useState<CartItem[]>([])
  const [undoTimeout, setUndoTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [toastMessage, setToastMessage] = useState('')
  // Booking Details 狀態
  const [bookingDetails, setBookingDetails] = useState<Record<string, BookingDetailsData>>(readDetails)
  // 選取模式＋選中的訂單組（只用來清除）
  const [selectMode, setSelectMode] = useState(false)
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedGroups(new Set())
  }

  // 借用資訊：從帳號拉回較新的一份時（cartService 寫進本機並廣播）跟著更新
  useEffect(() => {
    const reload = (e: StorageEvent) => { if (e.key === detailsKey()) setBookingDetails(readDetails()) }
    window.addEventListener('storage', reload)
    return () => window.removeEventListener('storage', reload)
  }, [])

  // 處理 Booking Details 變更
  const handleBookingDetailsChange = (groupKey: string, data: BookingDetailsData) => {
    const updated = {
      ...bookingDetails,
      [groupKey]: data
    }
    setBookingDetails(updated)
    writeDetails(updated)
  }

  // 彙整購物車驗證規則
  const {
    cartValidation,
    expiredOrdersValidation,
    stockAvailabilityValidation,
    bookingDetailsValidation,
    singleOrderValidation,
    littleLimitValidation
  } = useCartValidation({ cart, bookingDetails, getOriginalQuantity, getCartQuantity, getReserved, isTaken, bundles })

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

  // 各訂單押金（設備／空間分單，各自 5000 上限；設備套用組合），排除過期時段。
  // 送出是整車送，總押金不看選取（選取只用來清除）
  const depositGroups = (() => {
    const groups: Record<string, CartItem[]> = {}
    cart.forEach(item => {
      if (expiredOrdersValidation.expiredKeys.includes(`${item.startDate}_${item.endDate}`)) return
      if (!['equipment', 'space-block', 'classroom'].includes(item.category)) return
      ;(groups[cartGroupKey(item)] ??= []).push(item)
    })
    return Object.values(groups)
      .map(items => ({
        key: cartGroupKey(items[0]),
        items,
        startDate: items[0].startDate,
        endDate: items[0].endDate,
        deposit: bookingDetails[cartGroupKey(items[0])]?.asTeacher ? 0 : Math.min( // 老師名義免押金
          items[0].category === 'equipment'
            ? calcBundles(items, bundles).deposit
            : items.reduce((s, i) => s + i.deposit, 0),
          5000
        )
      }))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  })()
  const totalDeposit = depositGroups.reduce((sum, g) => sum + g.deposit, 0)

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
    showUndoToast(removed, t(`Removed "${removed[0].name}"`, `已刪除「${removed[0].name}」`))
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
      messageEn: `Clear the selected orders? ${totalCount} item(s) will be removed.`,
      confirmText: 'Clear',
      confirmTextZh: '清除',
      variant: 'danger'
    })

    if (confirmed) {
      // 立即清空選中狀態並退出選取模式（在刪除之前）
      exitSelectMode()

      // 過濾掉要刪除的項目後寫回 localStorage
      const itemsToDeleteSet = new Set(
        itemsToDelete.map(item => `${item.id}_${item.startDate}_${item.endDate}`)
      )
      writeCart(cart.filter(item => !itemsToDeleteSet.has(`${item.id}_${item.startDate}_${item.endDate}`)))

      // 顯示可 undo 的 toast
      showUndoToast(itemsToDelete, t('Removed the selected orders', '已刪除選中的訂單'))
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
  const submitOrder = useOrderSubmission({ cart, clearCart, bookingDetails })

  // 停權帳號直接鎖住送單按鈕（即時查詢；真正的防線在 submit_orders RPC，此處為 UX）
  const isSuspended = useSuspension()

  // 送出＝三步：沒留手機先填（學會要聯絡得到人，server 端 submit_orders 也擋）→ 再確認一次要借的東西 → 送單
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleCheckout = () => {
    if (!agreedToTerms) {
      alert(t('Please agree to the terms and conditions first.', '請先同意使用規則與條款'))
      return
    }
    if (cart.length === 0) {
      alert(t('Your cart is empty.', '購物車是空的'))
      return
    }
    if (!currentUser?.phone) setPhoneOpen(true)
    else setReviewOpen(true)
  }

  const handleSavePhone = async (phone: string) => {
    const res = await updateMyPhone(phone)
    if (!res.ok) return { ok: false }
    updateUser({ phone })
    setPhoneOpen(false)
    setReviewOpen(true)
    return { ok: true }
  }

  const handleSubmit = async () => {
    if (submitting) return
    setReviewOpen(false)
    setSubmitting(true)
    // 失敗時購物車保留原樣；最常見是剛好被別人先借走，重查佔用把那幾項標出來（送出鈕跟著鎖住）
    const result = await submitOrder()
    setSubmitting(false)
    if (!result.ok) {
      showErrorToast(result.reason || t('Submission failed. Please try again.', '送出失敗，請再試一次'))
      setAvailTick(n => n + 1)
    }
  }

  const title = <h1 className="font-english text-white text-xl max-lg:text-md">{t('Cart', '清單')} ({totalUniqueItems})</h1>
  // 選取 → 進入選取模式（各組左側出現圓圈），按鈕變清除；取消退出
  const selectButtons = (
    <div className="flex items-center gap-2">
      {selectMode && (
        <button
          onClick={exitSelectMode}
          className={`${BTN_TOOL} ${BTN_INVERT}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>undo</span>
          {t('Cancel', '取消')}
        </button>
      )}
      <button
        onClick={selectMode ? handleClearAll : () => setSelectMode(true)}
        disabled={selectMode ? selectedGroups.size === 0 : cart.length === 0}
        className={`${BTN_TOOL} ${selectMode ? '' : '!pl-3'} ${BTN_INVERT}`}
      >
        {selectMode && <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>}
        {selectMode ? t('Clear', '清除') : t('Select', '選取')}
      </button>
    </div>
  )

  return (
    <div className="bg-black text-white h-dvh overflow-hidden flex flex-col">
      <Header />

      {/* 主要內容區塊 */}
      <main className="flex-1 pt-[calc(var(--gutter)+4rem)] max-md:pt-[calc(var(--gutter)+3rem)] overflow-hidden flex flex-col">
        {/* 返回上一頁；lg 以下標題（置中）與選取鈕也放這列，固定不捲 */}
        <div className="container max-lg:grid max-lg:grid-cols-[1fr_auto_1fr] max-lg:items-center max-lg:mb-4">
          <div><BackButton /></div>
          <div className="lg:hidden">{title}</div>
          <div className="lg:hidden justify-self-end">{selectButtons}</div>
        </div>

        {/* flex-1 而非 h-full：扣掉返回鈕高度，底部送出鈕才不會被裁掉 */}
        <div className="container flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* 左右分欄佈局；lg 以下上下排：清單自己捲，摘要＋送出固定在底部 */}
          <div className="flex gap-16 flex-1 min-h-0 overflow-hidden max-lg:flex-col max-lg:gap-0">
            {/* 左邊：租借清單（剩餘寬度） */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
              {/* 頁面標題（lg 以下在返回那列） */}
              <div className="mb-6 flex justify-between items-center flex-shrink-0 max-lg:hidden">
                {title}
                {selectButtons}
              </div>

              {/* 設備列表 */}
              <div className="flex-1 min-h-0 overflow-y-auto pb-8 max-lg:pb-4">
                <CartList
                  cart={cart}
                  onQuantityChange={updateEquipmentQuantity}
                  onRemoveItem={handleRemoveSingleItem}
                  bookingDetails={bookingDetails}
                  onBookingDetailsChange={handleBookingDetailsChange}
                  expiredDateKeys={expiredOrdersValidation.expiredKeys}
                  selectedGroups={selectedGroups}
                  onSelectedGroupsChange={setSelectedGroups}
                  selectMode={selectMode}
                  getReserved={getReserved}
                  isTaken={isTaken}
                />
              </div>
            </div>

            {/* 右邊：租借摘要 (20%)：押金／提醒／檢查清單可捲動，同意條款＋送出固定在底部；
                lg 以下整塊固定在畫面底部，押金明細往上展開（清單區跟著變矮） */}
            <div className="w-1/5 flex-shrink-0 pr-4 pb-8 flex flex-col max-lg:w-full max-lg:pr-0 max-lg:pb-4 max-lg:pt-4 max-lg:border-t max-lg:border-gray-mid">
              {/* 租借摘要內容 */}
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col max-lg:overflow-visible">
                {/* 總押金（整列可點展開明細）：桌機標籤在上、金額在下；lg 以下同一列、金額靠右，chevron 朝上＝往上展開 */}
                <button
                  onClick={() => setDepositBreakdownExpanded(!depositBreakdownExpanded)}
                  disabled={depositGroups.length === 0}
                  className={`group w-full grid grid-cols-[1fr_auto] items-center gap-y-2 mb-4 text-left max-lg:grid-cols-[1fr_auto_auto] max-lg:gap-x-3 max-lg:mb-3 ${depositGroups.length === 0 ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className="text-xs text-gray-light col-span-2 max-lg:col-span-1">{t('Total Deposit', '總押金')}</span>
                  <span className="text-2xl max-xl:text-xl font-english font-normal text-white whitespace-nowrap">
                    NT$ {totalDeposit.toLocaleString()}
                  </span>
                  {/* 沒有明細時隱形但佔位，金額位置不跳 */}
                  <svg
                    className={`w-4 h-4 text-white transition-transform group-hover:opacity-50 ${depositGroups.length === 0 ? 'invisible' : ''} ${depositBreakdownExpanded ? 'rotate-180 max-lg:rotate-0' : 'max-lg:rotate-180'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* 各訂單押金明細 - 展開時顯示；lg 以下排在總押金上方 */}
                {depositBreakdownExpanded && depositGroups.length > 0 && (
                  <div className="mb-6 max-lg:order-first max-lg:mb-1">
                    {depositGroups.map((group, index) => (
                      <div key={index} className="flex items-center gap-3 text-xs text-white mb-3">
                        {/* 數字符號：自製圓圈＋數字（像 Guide，無數量上限；固定寬度讓後面日期對齊） */}
                        <span className="flex-shrink-0 w-4 h-4 rounded-full border border-white flex items-center justify-center text-white text-[10px] font-english leading-none">
                          {index + 1}
                        </span>
                        <span className="font-english">
                          {formatYmd(new Date(group.startDate))} - {formatYmd(new Date(group.endDate))}
                        </span>
                        <span className="font-english">
                          NT$ {group.deposit.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mb-8 max-lg:hidden"></div>

                <div className="mb-6 max-lg:mb-4">
                  <div className="text-shrink-container pr-4">
                    <p className="text-xs text-white text-shrink-content">{t('Please visit the SA to pay the deposit and complete your reservation within 24 hrs of checkout.', '結帳後會保留24小時的繳押金時間，請在時間內至系學會完成預約程序')}</p>
                  </div>
                </div>

                {/* 預約條件檢查清單 */}
                {cart.length > 0 && (
                  <div className="mb-6 space-y-2 max-lg:mb-2">
                    {/* 條件 0: 檢查過期訂單 - 僅有過期訂單時顯示 */}
                    {!expiredOrdersValidation.valid && (
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-xs" style={{
                          color: 'var(--color-yellow)',
                          marginTop: '2px'
                        }}>
                          info
                        </span>
                        <div className="flex-1">
                          <span className={`text-xs text-yellow`}>
                            <span>{t(expiredOrdersValidation.detail, expiredOrdersValidation.message)}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 條件 0.5: 檢查缺貨設備 - 僅有缺貨時顯示 */}
                    {!stockAvailabilityValidation.valid && (
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-xs" style={{
                          color: 'var(--color-yellow)',
                          marginTop: '2px'
                        }}>
                          info
                        </span>
                        <div className="flex-1">
                          <span className={`text-xs text-yellow`}>
                            <span>{t(stockAvailabilityValidation.detail, stockAvailabilityValidation.message)}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 條件 0.55: 小量設備超過 9 件（減少數量拆散組合時）- 僅違規時顯示 */}
                    {!littleLimitValidation.valid && (
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-xs" style={{ color: 'var(--color-yellow)', marginTop: '2px' }}>
                          info
                        </span>
                        <div className="flex-1">
                          <span className="text-xs text-yellow">
                            <span>{t(littleLimitValidation.detail, littleLimitValidation.message)}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 條件 0.6: 同類別多張訂單（規則上線前的舊購物車）- 僅違規時顯示 */}
                    {!singleOrderValidation.valid && (
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-xs" style={{ color: 'var(--color-yellow)', marginTop: '2px' }}>
                          info
                        </span>
                        <div className="flex-1">
                          <span className="text-xs text-yellow">
                            <span>{t(singleOrderValidation.detail, singleOrderValidation.message)}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 條件 1: 填寫借用資訊 - 常駐 */}
                    <div className="flex items-center gap-3">
                      <StatusCircle done={bookingDetailsValidation.valid} />
                      <span className={`text-xs ${
                        bookingDetailsValidation.valid ? 'text-green' : 'text-gray-light'
                      }`}>
                        <span>{t('Fill in booking details', '填寫借用資訊')}</span>
                      </span>
                    </div>

                    {/* 條件 2: 大量訂單需滿 10 件 - 僅大量訂單顯示 */}
                    {(() => {
                      const hasMassBooking = cart.some(item =>
                        item.bookingType === 'mass-personal' || item.bookingType === 'mass-group'
                      )
                      if (!hasMassBooking) return null

                      return (
                        <div className="flex items-center gap-3">
                          <StatusCircle done={cartValidation.valid} />
                          <span className={`text-xs ${
                            cartValidation.valid ? 'text-green' : 'text-gray-light'
                          }`}>
                            <span>{t('Min. 10 items', '大量租借需滿 10 件')}</span>
                          </span>
                        </div>
                      )
                    })()}

                    {/* 條件 3: 同意條款 - 常駐 */}
                    <div className="flex items-center gap-3">
                      <StatusCircle done={agreedToTerms} />
                      <span className={`text-xs ${
                        agreedToTerms ? 'text-green' : 'text-gray-light'
                      }`}>
                        <span>{t('Agree to terms', '同意借用條款')}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 底部：同意條款＋送出（停權帳號鎖定） */}
              <div className="flex-shrink-0 pt-6 max-lg:pt-4">
                <div className="flex items-start gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="terms-checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="custom-checkbox"
                  />
                  <span className="text-xs text-white leading-tight">
                    <span>{t("I have read and agree to the department's equipment & space rental ", '我已閱讀並同意系上租借設備與空間的')}</span>
                    <a
                      href={guideDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline cursor-pointer hover:opacity-50"
                    >
                      <span>{t('Terms & Conditions', '使用規則與條款')}</span>
                    </a>
                  </span>
                </div>

                {isSuspended && (
                  <div className="flex items-start gap-2 mb-3 text-error">
                    <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', marginTop: '1px' }}>warning</span>
                    <div className="text-xs">
                      <p>{t('Account suspended — bookings are disabled.', '帳號已停權，無法送出預約，請聯絡系學會')}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleCheckout}
                  disabled={submitting || isSuspended || cart.length === 0 || !agreedToTerms || !cartValidation.valid || !bookingDetailsValidation.valid || !expiredOrdersValidation.valid || !stockAvailabilityValidation.valid || !singleOrderValidation.valid || !littleLimitValidation.valid}
                  className={`w-full h-12 flex items-center justify-center gap-1 pl-4 pr-3 rounded-lg text-sm font-normal whitespace-nowrap bg-white text-black ${BTN}`}
                >
                  {t('Book', '送出')}
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
                </button>
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
          <span className="text-xs">
            {toastMessage}
          </span>
          <button
            onClick={handleUndo}
            aria-label={t('Undo', '復原')}
            title={t('Undo', '復原')}
            className="flex items-center text-black hover:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>undo</span>
          </button>
        </div>,
        document.body
      )}

      {/* 確認對話框 */}
      <ConfirmDialog />
      {toastElement}

      {/* 沒留手機：送出前先填 */}
      <EditProfileDialog
        isOpen={phoneOpen}
        mode="phone"
        hint={{
          en: 'Please leave a phone number before booking so the SA can reach you about your rental.',
          zh: '送出預約前請先留手機號碼，租借有狀況時系學會才聯絡得到你。'
        }}
        onConfirm={handleSavePhone}
        onCancel={() => setPhoneOpen(false)}
      />

      {/* 送出前再確認一次：一張訂單一段（類型、時段、品項、押金） */}
      <Dialog
        isOpen={reviewOpen}
        title="確認送出"
        titleEn="Confirm booking"
        message="請再確認一次要借的東西。送出後請在 24 小時內到系學會繳押金。"
        messageEn="Please check what you’re borrowing once more. After submitting, pay the deposit at the SA within 24 hrs."
        confirmText="Book"
        confirmTextZh="送出"
        onConfirm={() => void handleSubmit()}
        onCancel={() => setReviewOpen(false)}
      >
        <div className="mt-4 max-h-[50dvh] overflow-y-auto pr-2 custom-scrollbar text-xs text-white">
          {depositGroups.map(g => {
            const isEquip = g.items[0].category === 'equipment'
            const little = (g.items[0].bookingType || 'little') === 'little'
            const blockIds = sortBlockIds(g.items.filter(i => i.category === 'space-block').map(i => i.id))
            return (
              <div key={g.key} className="py-3 border-t border-gray-mid first:border-t-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-4">
                  <span>
                    {isEquip ? t('Equipment', '設備') : t('Space', '空間')}・{isEquip
                      ? (little ? t('Light', '小量') : t('Mass', '大量'))
                      : (little ? t('Personal', '個人') : t('Group', '團體'))}
                  </span>
                  <span className="font-english">{formatYmd(new Date(g.startDate))} - {formatYmd(new Date(g.endDate))}</span>
                </div>
                <ul className="mt-2 space-y-1 text-gray-light">
                  {g.items.filter(i => i.category !== 'space-block').map(i => (
                    <li key={i.id} className="flex justify-between gap-4">
                      <span>
                        {itemName(i.id, i.name)}
                        {/* 分時段的設備：借的是哪幾天 */}
                        {i.days && <span className="font-english">（{daysLabel(i.days, t(', ', '、'))}）</span>}
                      </span>
                      {isEquip && <span className="font-english">×{i.quantity}</span>}
                    </li>
                  ))}
                  {blockIds.length > 0 && (
                    <li>{t('Numbered area', '編號區')}：<span className="font-english">{blockIds.join(', ')}</span></li>
                  )}
                </ul>
                <div className="mt-2 flex justify-between gap-4">
                  <span>{t('Deposit', '押金')}</span>
                  <span className="font-english">NT$ {g.deposit.toLocaleString()}</span>
                </div>
              </div>
            )
          })}
          <div className="pt-3 border-t border-gray-mid flex justify-between gap-4 text-sm">
            <span>{t('Total Deposit', '總押金')}</span>
            <span className="font-english">NT$ {totalDeposit.toLocaleString()}</span>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default RentalListPage
