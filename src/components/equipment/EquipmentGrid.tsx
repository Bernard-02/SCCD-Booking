/**
 * 設備列表組件
 * 以列表形式顯示設備
 */

import React, { useState, useEffect } from 'react'
import { cartGroupKey, type CartItem, type Equipment } from '../../types/equipment'
import { calcBundles, type Bundle } from '../../utils/bundleUtils'
import ConfirmDialog from '../common/ConfirmDialog'
import { useBookmarkStore } from '../../stores/bookmarkStore'
import { useCart } from '../../hooks/useCart'
import { useDateSelection } from '../../contexts/DateSelectionContext'
import { useAuth } from '../../contexts/AuthContext'
import { useEquipmentData, fetchEquipmentReserved } from '../../services/equipmentService'
import type { ReservedInfo } from '../../services/equipmentService'
import { toDateKey } from '../cart/cartHelpers'
import Toast from '../common/Toast'
import { useT } from '../../stores/langStore'

interface EquipmentGridProps {
  selectedCategory: string
  statusFilters: Set<'available' | 'unavailable' | 'partial'>
}

const EquipmentGrid: React.FC<EquipmentGridProps> = ({ selectedCategory, statusFilters }) => {
  const t = useT()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([])
  // 數量允許暫存空字串：使用者可先清空再輸入，失焦時若無有效值會回到 1
  const [quantities, setQuantities] = useState<Record<string, number | ''>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  // 統一 toast 入口：錯誤紅底、成功白底
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message)
    setToastType(type)
  }
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  // 使用認證 hook
  const { isAuthenticated } = useAuth()

  // 使用 bookmark store
  const bookmarkStore = useBookmarkStore()

  // 使用購物車 hook
  const {
    cart,
    addToCart,
    getCartQuantity,
    checkLittleBookingLimit,
    isSuspended,
    bundles
  } = useCart()

  // 使用日期選擇 hook
  const { getCurrentEquipmentDates } = useDateSelection()

  // 獲取當前模式的日期
  const equipmentDates = getCurrentEquipmentDates()

  // 檢查是否已選擇日期
  const hasSelectedDates = equipmentDates.startDate !== null && equipmentDates.endDate !== null

  // 該時段各設備的真實佔用量（來自生效訂單）
  const [reservedMap, setReservedMap] = useState<Record<string, ReservedInfo>>({})

  const startKey = equipmentDates.startDate ? toDateKey(equipmentDates.startDate) : null
  const endKey = equipmentDates.endDate ? toDateKey(equipmentDates.endDate) : null

  useEffect(() => {
    if (!startKey || !endKey) {
      setReservedMap({})
      return
    }
    let mounted = true
    fetchEquipmentReserved(startKey, endKey)
      .then(map => { if (mounted) setReservedMap(map) })
      .catch(err => console.error('讀取設備佔用失敗:', err))
    return () => { mounted = false }
  }, [startKey, endKey])

  // 可借數量 = 在庫 − 該時段生效訂單佔用 − 購物車內已加入數量
  const getAvailableQuantity = (id: string): number => {
    const stock = equipmentData[id]?.originalQuantity ?? 0
    const reserved = reservedMap[id]?.reserved ?? 0
    return Math.max(0, stock - reserved - getCartQuantity(id))
  }

  // 使用 state 來存儲 bookmarked IDs，避免每次渲染都創建新 Set
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())

  // 初始化和監聽 bookmark 變化
  useEffect(() => {
    // 初始載入
    setBookmarkedIds(new Set(bookmarkStore.getAllBookmarks()))

    // 監聽變化
    const handleBookmarkUpdate = () => {
      setBookmarkedIds(new Set(bookmarkStore.getAllBookmarks()))
    }
    window.addEventListener('bookmarkUpdated', handleBookmarkUpdate)
    return () => window.removeEventListener('bookmarkUpdated', handleBookmarkUpdate)
  }, [])

  // 設備數據（來自 Supabase，模組層快取）
  const equipmentData = useEquipmentData()

  // 載入設備數據
  useEffect(() => {
    const equipmentArray = Object.values(equipmentData)
    setEquipment(equipmentArray)
    setFilteredEquipment(equipmentArray)

    // 初始化數量為 1
    const initialQuantities: Record<string, number> = {}
    equipmentArray.forEach(item => {
      initialQuantities[item.id] = 1
    })
    setQuantities(initialQuantities)
  }, [equipmentData])

  // 篩選邏輯
  useEffect(() => {
    let filtered = equipment

    // 收藏篩選 - 顯示所有已收藏的設備（不管是否借出）
    if (selectedCategory === '收藏') {
      filtered = filtered.filter(item => bookmarkedIds.has(item.id))
    }
    // 分類篩選
    else if (selectedCategory !== '全部') {
      filtered = filtered.filter(item => item.category === selectedCategory)
    }

    // 狀態篩選 - 根據 statusFilters 顯示對應狀態的設備
    if (statusFilters.size > 0 && statusFilters.size < 3) {
      filtered = filtered.filter(item => {
        const status = getEquipmentStatus(item.id)
        return statusFilters.has(status)
      })
    }

    setFilteredEquipment(filtered)
  }, [equipment, selectedCategory, statusFilters, bookmarkedIds, cart, reservedMap, hasSelectedDates])

  // 切換書籤
  const toggleBookmark = (id: string, itemName: string) => {
    // 使用 AuthContext 檢查登入狀態
    if (!isAuthenticated) {
      showToast(t('Please log in to use bookmarks.', '請先登入以使用收藏功能'), 'error')
      return
    }

    // 切換收藏狀態
    const wasBookmarked = bookmarkStore.isBookmarked(id)
    bookmarkStore.toggleBookmark(id)

    // 顯示通知
    if (!wasBookmarked) {
      showToast(t(`Bookmarked ${itemName}`, `${itemName} 已加入收藏`))
    } else {
      showToast(t(`Removed ${itemName} from bookmarks`, `${itemName} 已移除收藏`))
    }
  }

  // 增加數量
  const incrementQuantity = (id: string) => {
    const availableQty = getMaxQuantity(id)
    setQuantities(prev => ({
      ...prev,
      [id]: Math.min((prev[id] || 1) + 1, availableQty)
    }))
  }

  // 減少數量
  const decrementQuantity = (id: string) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max((prev[id] || 1) - 1, 1)
    }))
  }

  // 直接輸入數量
  const handleQuantityChange = (id: string, value: string) => {
    const availableQty = getMaxQuantity(id)
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue) && numValue >= 1 && numValue <= availableQty) {
      setQuantities(prev => ({
        ...prev,
        [id]: numValue
      }))
    } else if (value === '') {
      // 清空輸入：暫存空字串，讓使用者直接填入想要的數字
      setQuantities(prev => ({
        ...prev,
        [id]: ''
      }))
    }
  }

  // 失焦時若沒有有效數字，自動回到 1
  const handleQuantityBlur = (id: string) => {
    setQuantities(prev => {
      const current = prev[id]
      if (typeof current === 'number' && current >= 1) return prev
      return { ...prev, [id]: 1 }
    })
  }

  // 以目前選的日期與類型組成購物車項目
  const toCartItem = (eq: Equipment, quantity: number): CartItem => ({
    id: eq.id,
    name: eq.name,
    category: 'equipment',
    deposit: eq.deposit,
    image: eq.mainImage,
    quantity,
    startDate: toDateKey(equipmentDates.startDate!),
    endDate: toDateKey(equipmentDates.endDate!),
    bookingType: equipmentDates.bookingType
  })

  // ---- 設備組合 ----
  // 每列可選「單個」或「整組」（modes：設備 id → 組合 id；沒有＝單個）。整組時數量＝要再加幾組，系統自動配好零件
  const [modes, setModes] = useState<Record<string, string>>({})
  // 單個加入組合內的設備、加入後還湊不成組時，彈窗問要不要整組借
  const [bundleOffer, setBundleOffer] = useState<{ item: Equipment; quantity: number; bundle: Bundle; sets: number; maxSets: number } | null>(null)

  // 本張設備單（同時段）的購物車品項
  const groupItems = (): CartItem[] => {
    if (!hasSelectedDates) return []
    const key = cartGroupKey({ category: 'equipment', startDate: toDateKey(equipmentDates.startDate!), endDate: toDateKey(equipmentDates.endDate!) })
    return cart.filter(i => cartGroupKey(i) === key)
  }
  const inGroup = (id: string): number => groupItems().filter(i => i.id === id).reduce((s, i) => s + i.quantity, 0)

  // 某組合：清單已湊成幾組（current）、還能再加幾組（extra）。
  // 可用零件＝單件（沒被湊進任何組合）＋本組合已用的＋還可借；被其他組合用掉的不算——
  // 卡在共用零件時回傳 blockedBy（例：腳架已用在木桌組 → 大桌組只能二選一）
  const bundleRoom = (bundle: Bundle) => {
    const calc = calcBundles(groupItems(), bundles)
    const current = calc.sets.find(s => s.bundle.id === bundle.id)?.count ?? 0
    const free = (id: string, q: number) => (calc.left[id] ?? 0) + current * q + getAvailableQuantity(id)
    const fits = (c: Bundle['items'][number]) => (equipmentData[c.equipmentId] ? Math.floor(free(c.equipmentId, c.quantity) / c.quantity) : 0)
    const extra = Math.max(0, Math.min(...bundle.items.map(fits)) - current)
    const blockedBy = extra > 0 ? [] : bundle.items.flatMap(c => {
      const others = calc.sets.filter(s => s.bundle.id !== bundle.id && s.bundle.items.some(x => x.equipmentId === c.equipmentId))
      // 只看庫存其實夠（含其他組合用掉的），是被其他組合佔走才不夠
      const enoughIgnoringOthers = Math.floor((inGroup(c.equipmentId) + getAvailableQuantity(c.equipmentId)) / c.quantity) > current
      return others.length > 0 && fits(c) <= current && enoughIgnoringOthers
        ? [{ part: equipmentData[c.equipmentId].name, others: others.map(s => s.bundle.name) }]
        : []
    })
    return { current, extra, blockedBy }
  }

  // 補到 target 組：每個零件補到 target × 一組數量（本組合已用的＋單件可湊的不重複加）
  const topUpItems = (bundle: Bundle, target: number): CartItem[] => {
    const calc = calcBundles(groupItems(), bundles)
    const current = calc.sets.find(s => s.bundle.id === bundle.id)?.count ?? 0
    return bundle.items
      .map(c => toCartItem(equipmentData[c.equipmentId], target * c.quantity - current * c.quantity - (calc.left[c.equipmentId] ?? 0)))
      .filter(i => i.quantity > 0)
  }

  // 整組加不進去的原因（二選一或單純庫存不足）
  const bundleShortReason = (bundle: Bundle, room: ReturnType<typeof bundleRoom>) =>
    room.blockedBy.length > 0
      ? t(
          `"${room.blockedBy[0].part}" is already used by "${room.blockedBy[0].others.join('", "')}" in your list, and there isn’t enough stock for "${bundle.name}" too. Please choose one of the two sets.`,
          `「${room.blockedBy[0].part}」已用在清單裡的「${room.blockedBy[0].others.join('、')}」，庫存不夠再借「${bundle.name}」，只能二選一`
        )
      : t(
          `Not enough stock — you can add up to ${room.extra} more "${bundle.name}" set(s).`,
          `庫存不足，「${bundle.name}」目前最多還能加 ${room.extra} 組`
        )

  // 該設備可選的組合（零件都在架上才列）
  const bundlesOf = (id: string) =>
    bundles.filter(b => b.items.some(c => c.equipmentId === id) && b.items.every(c => equipmentData[c.equipmentId]))
  const modeBundle = (id: string) => bundles.find(b => b.id === modes[id])

  // 數量上限：單個＝可借數量；整組＝還能加幾組
  const getMaxQuantity = (id: string): number => {
    const b = modeBundle(id)
    return b ? bundleRoom(b).extra : getAvailableQuantity(id)
  }

  const findBundleOffer = (item: Equipment, quantity: number) => {
    const group = [...groupItems(), toCartItem(item, quantity)]
    // 加入後這個設備已經全部湊進組合（例：補上最後幾個支架）就不用問
    const left = calcBundles(group, bundles).left[item.id] ?? 0
    if (left === 0) return null
    for (const bundle of bundlesOf(item.id)) {
      const part = bundle.items.find(c => c.equipmentId === item.id)!
      const room = bundleRoom(bundle)
      if (room.extra <= 0) continue
      const sets = Math.min(room.extra, Math.max(1, Math.ceil(left / part.quantity)))
      return { item, quantity, bundle, sets, maxSets: room.extra }
    }
    return null
  }

  // 實際加入（單件或整組），成功後重置該設備的數量為 1
  const commitAdd = (items: CartItem[], label: string, resetId: string) => {
    const result = addToCart(items)
    if (!result.ok) {
      // 加入失敗（停權／押金上限／類型衝突／9 件上限），顯示原因而非假的成功訊息
      showToast(result.reason || t('Couldn’t add to your list.', '無法加入清單'), 'error')
      return
    }
    showToast(t(`Added ${label} to your list`, `已成功加入 ${label} 到清單`))
    setQuantities(prev => ({ ...prev, [resetId]: 1 }))
  }

  // 整組加入：在清單已湊成的組數之上再加 sets 組（單件可湊的零件先用，不重複加）
  const addSets = (bundle: Bundle, sets: number, resetId: string) => {
    const room = bundleRoom(bundle)
    if (sets > room.extra) {
      showToast(bundleShortReason(bundle, room), 'error')
      return
    }
    commitAdd(topUpItems(bundle, room.current + sets), `${bundle.name} ×${sets}`, resetId)
  }

  const addBundle = () => {
    if (!bundleOffer) return
    const { bundle, sets, item } = bundleOffer
    setBundleOffer(null)
    addSets(bundle, sets, item.id)
  }

  // 加入購物車
  const handleAddToCart = (item: Equipment) => {
    // 檢查是否已選擇日期
    if (!hasSelectedDates) {
      showToast(t('Please select rental dates first.', '請先選擇租借日期'), 'error')
      return
    }

    const quantity = quantities[item.id] || 1

    // 下拉選了整組：數量＝組數，直接配好零件
    const setMode = modeBundle(item.id)
    if (setMode) {
      addSets(setMode, quantity, item.id)
      return
    }

    const availableQty = getAvailableQuantity(item.id)

    // 檢查庫存
    if (quantity > availableQty) {
      showToast(t(`Not enough stock — only ${availableQty} ${item.name} available.`, `庫存不足，${item.name} 剩餘可借數量：${availableQty}`), 'error')
      return
    }

    // 單個加入組合內的設備 → 先問要不要整組借
    const offer = isAuthenticated ? findBundleOffer(item, quantity) : null
    if (offer) {
      setBundleOffer(offer)
      return
    }

    commitAdd([toCartItem(item, quantity)], `${item.name} x${quantity}`, item.id)
  }

  // 處理圖片點擊 - 全螢幕顯示
  const handleImageClick = (e: React.MouseEvent, imageSrc: string) => {
    e.stopPropagation()
    setFullscreenImage(imageSrc)
  }

  // 關閉全螢幕圖片
  const closeFullscreenImage = () => {
    setFullscreenImage(null)
  }

  // 獲取設備狀態（綠色/黃色/紅色）
  // 目前使用簡化邏輯，未來需要接入實際預訂數據
  const getEquipmentStatus = (itemId: string): 'available' | 'partial' | 'unavailable' => {
    // 目前無論是否選日期，邏輯相同：有庫存→可借，無庫存→不可借
    // TODO: 接入實際預訂數據後，可依日期範圍實作部分可借（黃色 'partial'）
    return getAvailableQuantity(itemId) > 0 ? 'available' : 'unavailable'
  }

  // 獲取狀態顏色
  const getStatusColor = (status: 'available' | 'partial' | 'unavailable'): string => {
    return status === 'available' ? 'var(--color-success)' : 'var(--color-error)'
  }

  return (
    // 表格 RWD：外層 overflow-x-auto ＋ 表頭／列 min-w-[1000px]。
    // 1000 < 1400px 視窗時右欄實際寬度（約 1038：container 扣 padding、捲軸、左欄 20%、gap），
    // 視窗 ≥1400 不出現橫向捲軸，約 1350 以下才開始捲，名稱欄不會被壓縮到逐字直排
    <div className="w-full h-full flex flex-col pt-[60px] overflow-x-auto">
      {/* Toast 通知 */}
      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage(null)} />
      )}

      {/* 整組借的提示：確認＝整組加入（自動補齊零件）、文字鈕＝只加這件、取消＝都不加 */}
      {bundleOffer && (() => {
        const { item, quantity, bundle, sets, maxSets } = bundleOffer
        const step = (d: number) => setBundleOffer({ ...bundleOffer, sets: Math.min(maxSets, Math.max(1, sets + d)) })
        const stepCls = (enabled: boolean) =>
          `w-7 h-7 flex items-center justify-center border rounded-lg text-xs ${
            enabled ? 'border-white text-white hover:bg-white hover:text-black cursor-pointer' : 'border-gray-scale3 text-gray-scale3 cursor-not-allowed'
          }`
        return (
          <ConfirmDialog
            isOpen
            title="要整組借嗎？"
            titleEn="Borrow as a set?"
            message={`「${item.name}」屬於「${bundle.name}」。整組借押金只算一組 NT$ ${bundle.deposit.toLocaleString()}，也只佔 1 件額度；系統會自動配好其他零件。`}
            messageEn={`"${item.name}" is part of "${bundle.name}". A full set costs one deposit of NT$ ${bundle.deposit.toLocaleString()} and counts as 1 item; we'll add the other parts for you.`}
            confirmText="Add set"
            confirmTextZh="整組加入"
            onConfirm={addBundle}
            onCancel={() => setBundleOffer(null)}
          >
            <div className="mt-4 space-y-4 text-xs text-white">
              <ul className="space-y-1">
                {bundle.items.map(c => (
                  <li key={c.equipmentId} className="flex justify-between">
                    <span>{equipmentData[c.equipmentId]?.name}</span>
                    <span className="font-['Inter',_sans-serif]">×{c.quantity * sets}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <span className="mr-auto">{t('Sets', '組數')}</span>
                <button type="button" className={stepCls(sets > 1)} disabled={sets <= 1} onClick={() => step(-1)} aria-label={t('Fewer', '減少')}>−</button>
                <span className="w-8 text-center font-['Inter',_sans-serif]">{sets}</span>
                <button type="button" className={stepCls(sets < maxSets)} disabled={sets >= maxSets} onClick={() => step(1)} aria-label={t('More', '增加')}>+</button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBundleOffer(null)
                  commitAdd([toCartItem(item, quantity)], `${item.name} x${quantity}`, item.id)
                }}
                className="text-gray-scale2 underline underline-offset-4 hover:!text-white cursor-pointer"
              >
                {t(`Just add ${item.name} ×${quantity}`, `只加入「${item.name}」×${quantity}`)}
              </button>
            </div>
          </ConfirmDialog>
        )
      })()}

      {/* 全螢幕圖片檢視 */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center py-20"
          onClick={closeFullscreenImage}
        >
          {/* 關閉按鈕 */}
          <button
            onClick={closeFullscreenImage}
            className="absolute top-20 right-8 text-white text-xl font-normal hover:text-gray-scale2 cursor-pointer z-10"
            aria-label="關閉"
          >
            ×
          </button>

          {/* 圖片 */}
          <img
            src={fullscreenImage}
            alt="設備圖片"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 表頭 - 固定不滾動 - 始終顯示 */}
      <div className="min-w-[1000px] grid grid-cols-[6px_40px_80px_1fr_80px_80px_90px_100px_120px_60px] items-center gap-6 pb-3 border-b border-[#7c7c7c] flex-shrink-0">
        {/* 狀態指示器列 - 空白表頭 */}
        <div></div>

        <div className="font-['Inter',_sans-serif] text-xs text-gray-scale2 text-left">
          <div>{t('Favorites', '收藏')}</div>
        </div>
        <div className="font-['Inter',_sans-serif] text-xs text-gray-scale2"></div>
        <div className="font-['Inter',_sans-serif] text-xs text-gray-scale2"></div>
        <div className="font-['Inter',_sans-serif] text-xs text-gray-scale2 text-center">
          <div>{t('Total Qty', '總數量')}</div>
        </div>
        <div className="font-['Inter',_sans-serif] text-xs text-gray-scale2 text-center">
          <div>{t('Available', '可借數量')}</div>
        </div>
        <div className="font-['Inter',_sans-serif] text-xs text-gray-scale2 text-center flex items-center justify-center gap-1">
          <div>
            <div>{t('On Hold', '待繳押金')}</div>
          </div>
          <div className="relative group flex">
            <span className="material-symbols-outlined text-gray-scale2 cursor-help" style={{ fontSize: '20px' }}>
              info
            </span>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-gray-scale4 text-white text-xs whitespace-nowrap rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none z-50">
              已送出但未繳押金的設備
              {/* 小三角形 */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-scale4"></div>
            </div>
          </div>
        </div>
        <div className="font-['Inter',_sans-serif] text-xs text-gray-scale2 text-center">
          <div>{t('Deposit', '押金/個')}</div>
        </div>
        <div className="font-['Inter',_sans-serif] text-xs text-gray-scale2 text-center">
          <div>{t('Quantity', '數量')}</div>
        </div>
        <div className="font-['Inter',_sans-serif] text-xs text-gray-scale2 text-center"></div>
      </div>

      {filteredEquipment.length > 0 ? (
        // 設備列表 - 可滾動
        <div className="flex-1 overflow-y-auto min-w-[1000px]">
            {filteredEquipment.map(item => {
              const isBookmarked = bookmarkedIds.has(item.id)
              const quantity = quantities[item.id] || 1
              const availableQty = getAvailableQuantity(item.id)
              const isAvailable = availableQty > 0
              const status = getEquipmentStatus(item.id)
              const statusColor = getStatusColor(status)

              // 組合：可選的組合與目前模式（整組時數量＝組數、上限＝還能加幾組）
              const rowBundles = bundlesOf(item.id)
              const setBundle = modeBundle(item.id)
              const room = setBundle ? bundleRoom(setBundle) : null
              const maxQty = room ? room.extra : availableQty
              const canAdd = room ? room.extra > 0 : isAvailable
              const setItems = setBundle && room && hasSelectedDates ? topUpItems(setBundle, room.current + quantity) : []

              // 檢查是否達到 Light 9件限制（整組看補齊後的件數，整組算 1 件）
              const wouldExceedLightLimit = setBundle
                ? setItems.length > 0 && checkLittleBookingLimit(setItems).allowed === false
                : checkLittleBookingLimit({
                    id: item.id,
                    name: item.name,
                    category: 'equipment',
                    deposit: item.deposit,
                    image: item.mainImage,
                    quantity: quantity,
                    startDate: equipmentDates.startDate ? toDateKey(equipmentDates.startDate) : '',
                    endDate: equipmentDates.endDate ? toDateKey(equipmentDates.endDate) : '',
                    bookingType: equipmentDates.bookingType
                  }).allowed === false

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[6px_40px_80px_1fr_80px_80px_90px_100px_120px_60px] gap-6 py-3 border-b border-[#7c7c7c] items-center"
                >
                  {/* 狀態指示器 - 獨立的 grid 列 */}
                  <div
                    className="h-full w-full"
                    style={{
                      backgroundColor: statusColor
                    }}
                  />

                  {/* Bookmark（font-variation-settings 是整組覆寫：只寫 FILL 會把全域的 wght/opsz 洗掉、線條變粗，所以所有軸都要帶） */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleBookmark(item.id, item.name)
                    }}
                    className="w-6 h-6 flex items-center justify-center cursor-pointer"
                    aria-label={isBookmarked ? '取消收藏' : '加入收藏'}
                  >
                    <span
                      className="material-symbols-outlined text-white"
                      style={{ fontSize: '24px', fontVariationSettings: `'FILL' ${isBookmarked ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
                    >
                      bookmark
                    </span>
                  </button>

                  {/* 設備圖片 */}
                  <div
                    className="w-[80px] h-[80px] flex-shrink-0 cursor-pointer overflow-hidden rounded-lg"
                    onClick={(e) => handleImageClick(e, item.mainImage)}
                  >
                    <img
                      src={item.mainImage}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                    />
                  </div>

                  {/* 設備名稱＋（屬於組合時）單個／整組下拉 */}
                  <div className={`font-['Inter','Noto_Sans_TC',_sans-serif] text-sm flex flex-col items-start gap-1 ${
                    !isAvailable ? 'text-[#545454]' : 'text-white'
                  }`}>
                    {item.name}
                    {rowBundles.length > 0 && (
                      <select
                        value={modes[item.id] ?? ''}
                        onChange={e => {
                          const v = e.target.value
                          setModes(prev => ({ ...prev, [item.id]: v }))
                          setQuantities(prev => ({ ...prev, [item.id]: 1 }))
                        }}
                        aria-label={t('Single or set', '單個或整組')}
                        className="bg-black border border-gray-scale4 rounded-lg px-2 py-1 text-2xs text-white focus:border-white outline-none cursor-pointer"
                      >
                        <option value="">{t('Single', '單個')}</option>
                        {rowBundles.map(b => (
                          <option key={b.id} value={b.id}>
                            {t(`Set: ${b.name} (NT$ ${b.deposit.toLocaleString()} / set)`, `整組：${b.name}（押金 NT$ ${b.deposit.toLocaleString()}/組）`)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* 總數量 */}
                  <div className={`font-['Inter',_sans-serif] text-sm text-center ${
                    !isAvailable ? 'text-[#545454]' : 'text-white'
                  }`}>
                    {item.originalQuantity}
                  </div>

                  {/* 可借數量 */}
                  <div className={`font-['Inter',_sans-serif] text-sm text-center ${
                    !isAvailable ? 'text-[#545454]' : 'text-white'
                  }`}>
                    {availableQty}
                  </div>

                  {/* 待繳押金數量（該時段押金未繳的佔用，見 equipment_reserved） */}
                  <div className={`font-['Inter',_sans-serif] text-sm text-center ${
                    !isAvailable ? 'text-[#545454]' : 'text-white'
                  }`}>
                    {reservedMap[item.id]?.onHold ?? 0}
                  </div>

                  {/* 押金/個 */}
                  <div className={`font-['Inter',_sans-serif] text-sm text-center ${
                    !isAvailable ? 'text-[#545454]' : 'text-white'
                  }`}>
                    NT$ {setBundle ? setBundle.deposit : item.deposit}
                    {setBundle && <span className="text-2xs text-gray-scale2">/{t('set', '組')}</span>}
                  </div>

                  {/* 數量調整 - + (純文字按鈕，中間可輸入) */}
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        decrementQuantity(item.id)
                      }}
                      disabled={!canAdd || quantity <= 1}
                      className={`font-['Inter',_sans-serif] text-sm ${
                        !canAdd || quantity <= 1
                          ? 'text-[#545454] cursor-not-allowed'
                          : 'text-white hover:text-gray-scale1 cursor-pointer'
                      }`}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={maxQty}
                      value={quantities[item.id] ?? 1}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      onBlur={() => handleQuantityBlur(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={!canAdd}
                      className={`font-['Inter',_sans-serif] text-sm w-12 text-center bg-transparent border-none outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        !canAdd ? 'text-[#545454] cursor-not-allowed' : 'text-white'
                      }`}
                      style={{
                        MozAppearance: 'textfield',
                        margin: 0
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        incrementQuantity(item.id)
                      }}
                      disabled={!canAdd || quantity >= maxQty}
                      className={`font-['Inter',_sans-serif] text-sm ${
                        !canAdd || quantity >= maxQty
                          ? 'text-[#545454] cursor-not-allowed'
                          : 'text-white hover:text-gray-scale1 cursor-pointer'
                      }`}
                    >
                      +
                    </button>
                  </div>

                  {/* 加入清單：白底圓角購物車 icon；不可加時 50% 透明但仍可點（toast 說明原因） */}
                  <div className="flex justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddToCart(item)
                      }}
                      aria-disabled={!canAdd || !hasSelectedDates || wouldExceedLightLimit || isSuspended}
                      aria-label={t('Add', '加入清單')}
                      className={`w-9 h-9 rounded-lg bg-white text-black flex items-center justify-center ${
                        canAdd && hasSelectedDates && !wouldExceedLightLimit && !isSuspended
                          ? 'cursor-pointer'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add_shopping_cart</span>
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-gray-scale2 text-sm">{t('No Equipment Found', '找不到符合條件的設備')}</p>
        </div>
      )}
    </div>
  )
}

export default EquipmentGrid
