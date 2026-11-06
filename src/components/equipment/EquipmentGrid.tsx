/**
 * 設備列表組件
 * 以列表形式顯示設備
 */

import { BTN, BTN_OUTLINE, CHIP, TAP } from '@/components/common/btn'
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { cartGroupKey, EQUIPMENT_CATEGORIES, type CartItem, type Equipment } from '../../types/equipment'
import { calcBundles, type Bundle } from '../../utils/bundleUtils'
import ConfirmDialog from '../common/ConfirmDialog'
import { useBookmarkStore } from '../../stores/bookmarkStore'
import { useCart, loginPath, takePendingSelection } from '../../hooks/useCart'
import { useDateSelection } from '../../contexts/DateSelectionContext'
import { useAuth } from '../../contexts/AuthContext'
import { useEquipmentData, fetchEquipmentReserved, fetchEquipmentReservedDaily } from '../../services/equipmentService'
import type { ReservedInfo } from '../../services/equipmentService'
import { toDateKey, rescheduleCategory } from '../cart/cartHelpers'
import { dayKeysBetween, fromDateKey } from '../../utils/timeUtils'
import PartialDialog from '../common/PartialDialog'
import { Select } from '../admin/adminUi'
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
  // 訪客被導去登入前的選取（數量／整組），回來後還原
  const [pending] = useState(() => takePendingSelection<{ quantities: Record<string, number | ''>; modes: Record<string, string> }>('equipment'))
  const [quantities, setQuantities] = useState<Record<string, number | ''>>({})
  const [openCard, setOpenCard] = useState<string | null>(null) // 卡片模式展開中的設備（一次一張，同 Profile 訂單）
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
  const navigate = useNavigate()

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
  const { getCurrentEquipmentDates, setEquipmentDates } = useDateSelection()

  // 獲取當前模式的日期
  const equipmentDates = getCurrentEquipmentDates()

  // 檢查是否已選擇日期
  const hasSelectedDates = equipmentDates.startDate !== null && equipmentDates.endDate !== null

  // 該時段各設備的真實佔用量（來自生效訂單）
  const [reservedMap, setReservedMap] = useState<Record<string, ReservedInfo>>({})
  // 逐日佔用（部分時段可借用，supabase/partial-availability.sql）；RPC 不在時為 null → 退回整段判定
  const [dailyMap, setDailyMap] = useState<Record<string, Record<string, number>> | null>(null)
  // 正在開選段 popup 的設備
  const [partialItem, setPartialItem] = useState<Equipment | null>(null)

  const startKey = equipmentDates.startDate ? toDateKey(equipmentDates.startDate) : null
  const endKey = equipmentDates.endDate ? toDateKey(equipmentDates.endDate) : null

  useEffect(() => {
    if (!startKey || !endKey) {
      setReservedMap({})
      setDailyMap(null)
      return
    }
    let mounted = true
    fetchEquipmentReserved(startKey, endKey)
      .then(map => { if (mounted) setReservedMap(map) })
      .catch(err => console.error('讀取設備佔用失敗:', err))
    fetchEquipmentReservedDaily(startKey, endKey)
      .then(map => { if (mounted) setDailyMap(map) })
      .catch(err => { console.warn('逐日佔用 RPC 不可用，退回整段判定:', err); if (mounted) setDailyMap(null) })
    return () => { mounted = false }
  }, [startKey, endKey])

  // 可借數量 = 在庫 − 該時段生效訂單佔用 − 購物車內已加入數量
  const getAvailableQuantity = (id: string): number => {
    const stock = equipmentData[id]?.originalQuantity ?? 0
    const reserved = reservedMap[id]?.reserved ?? 0
    return Math.max(0, stock - reserved - getCartQuantity(id))
  }

  // 區間內每一天的 key；逐日可借量＝在庫 − 當天佔用 − 購物車內已加入（部分時段可借用）
  const rangeDays = useMemo(() => (startKey && endKey ? dayKeysBetween(fromDateKey(startKey), fromDateKey(endKey)) : []), [startKey, endKey])
  const dayAvail = (id: string, day: string): number =>
    Math.max(0, (equipmentData[id]?.originalQuantity ?? 0) - (dailyMap?.[id]?.[day] ?? 0) - getCartQuantity(id))
  // 區間內「最好的一天」可借量：有逐日資料時當數量上限（借得到部分時段）；沒有就同整段可借量
  const getMaxDayAvailable = (id: string): number =>
    dailyMap && rangeDays.length ? Math.max(...rangeDays.map(d => dayAvail(id, d))) : getAvailableQuantity(id)

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
    setQuantities({ ...initialQuantities, ...pending?.quantities })
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
  }, [equipment, selectedCategory, statusFilters, bookmarkedIds, cart, reservedMap, hasSelectedDates, dailyMap, quantities])

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
  const [modes, setModes] = useState<Record<string, string>>(pending?.modes ?? {})
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
  // avail 可換成「某一天」的可借量（部分時段：零件逐日夠不夠，哪天缺哪個零件那天就湊不成）
  const bundleRoom = (bundle: Bundle, avail: (id: string) => number = getAvailableQuantity) => {
    const calc = calcBundles(groupItems(), bundles)
    const current = calc.sets.find(s => s.bundle.id === bundle.id)?.count ?? 0
    const free = (id: string, q: number) => (calc.left[id] ?? 0) + current * q + avail(id)
    const fits = (c: Bundle['items'][number]) => (equipmentData[c.equipmentId] ? Math.floor(free(c.equipmentId, c.quantity) / c.quantity) : 0)
    const extra = Math.max(0, Math.min(...bundle.items.map(fits)) - current)
    const blockedBy = extra > 0 ? [] : bundle.items.flatMap(c => {
      const others = calc.sets.filter(s => s.bundle.id !== bundle.id && s.bundle.items.some(x => x.equipmentId === c.equipmentId))
      // 只看庫存其實夠（含其他組合用掉的），是被其他組合佔走才不夠
      const enoughIgnoringOthers = Math.floor((inGroup(c.equipmentId) + avail(c.equipmentId)) / c.quantity) > current
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

  // 某組合在某一天還能加幾組（部分時段）
  const bundleRoomOn = (bundle: Bundle, day: string) => bundleRoom(bundle, id => dayAvail(id, day))
  // 這一列（單件或整組）在區間內哪幾天夠卡片上填的數量
  const okDaysFor = (itemId: string): string[] => {
    const q = quantities[itemId] || 1
    const b = modeBundle(itemId)
    return rangeDays.filter(d => (b ? bundleRoomOn(b, d).extra : dayAvail(itemId, d)) >= q)
  }

  // 數量上限：單個＝區間裡最好的一天可借幾件；整組＝最好的一天還能加幾組（沒有逐日資料就看整段）
  const getMaxQuantity = (id: string): number => {
    const b = modeBundle(id)
    if (!b) return getMaxDayAvailable(id)
    return dailyMap && rangeDays.length ? Math.max(...rangeDays.map(d => bundleRoomOn(b, d).extra)) : bundleRoom(b).extra
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
    // 訪客：導去登入頁，登入後回來還原數量（日期已存 localStorage）
    if (!isAuthenticated) { navigate(loginPath('equipment', { quantities, modes })); return }
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

    // 部分時段（單件或整組）：開 popup 選一段（設備日期會改成那段），不走整段庫存檢查
    if (getEquipmentStatus(item.id) === 'partial') {
      if (!isAuthenticated) { navigate(loginPath('equipment', { quantities, modes })); return }
      setPartialItem(item)
      return
    }

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

  // 部分時段 popup 確認：設備日期改成選的那段，清單裡的設備一起改日期（同一次 save），再加入這件
  const confirmPartial = (startDate: string, endDate: string) => {
    if (!partialItem) return
    const item = partialItem
    setPartialItem(null)
    const quantity = quantities[item.id] || 1
    const base = rescheduleCategory(cart, 'equipment', startDate, endDate)
    const hadOthers = base.some(i => i.category === 'equipment')
    setEquipmentDates(fromDateKey(startDate), fromDateKey(endDate), equipmentDates.bookingType)
    // 整組：在清單已湊成的組數之上再加 quantity 組（零件先用單件可湊的）；單件：就這一件。日期都換成選的那段
    const b = modeBundle(item.id)
    const items = (b ? topUpItems(b, bundleRoom(b).current + quantity) : [toCartItem(item, quantity)])
      .map(i => ({ ...i, startDate, endDate }))
    const result = addToCart(items, base)
    if (!result.ok) {
      showToast(result.reason || t('Couldn’t add to your list.', '無法加入清單'), 'error')
      return
    }
    const label = `${b ? b.name : item.name} ×${quantity}`
    showToast(hadOthers
      ? t(`Added ${label}. Equipment dates changed to ${startDate} – ${endDate}; the other equipment in your list was rechecked.`,
          `已加入 ${label}，設備日期改為 ${startDate} – ${endDate}，清單裡其他設備已重新檢查`)
      : t(`Added ${label}. Equipment dates changed to ${startDate} – ${endDate}.`,
          `已加入 ${label}，設備日期改為 ${startDate} – ${endDate}`))
    setQuantities(prev => ({ ...prev, [item.id]: 1 }))
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

  // 設備狀態看卡片上填的數量（2026-11-02 部分時段）：每天都夠＝可借（綠）、沒有一天夠＝不可借（粉）、
  // 有些天夠＝部分時段（橘，點加入開 PartialDialog 選一段）。沒有逐日資料（RPC 未部署）退回整段判定
  const getEquipmentStatus = (itemId: string): 'available' | 'partial' | 'unavailable' => {
    const b = modeBundle(itemId)
    if (!dailyMap || !rangeDays.length) return (b ? bundleRoom(b).extra : getAvailableQuantity(itemId)) > 0 ? 'available' : 'unavailable'
    const ok = okDaysFor(itemId).length
    return ok === rangeDays.length ? 'available' : ok === 0 ? 'unavailable' : 'partial'
  }

  const getStatusColor = (status: 'available' | 'partial' | 'unavailable'): string =>
    status === 'available' ? 'var(--color-green)' : status === 'partial' ? 'var(--color-orange)' : 'var(--color-pink)'

  return (
    // 表格 RWD：表頭與列都接 card: 變體，容器 < 940px 改卡片（index.css），不再橫向捲動
    <div className="w-full h-full flex flex-col pt-[60px] max-lg:pt-0">
      {/* Toast 通知 */}
      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage(null)} />
      )}

      {/* 整組借的提示：確認＝整組加入（自動補齊零件）、文字鈕＝只加這件、取消＝都不加 */}
      {/* 部分時段：選一段再加入（設備日期改成那段） */}
      {partialItem && (
        <PartialDialog
          isOpen
          title={`${modeBundle(partialItem.id)?.name ?? partialItem.name} ×${quantities[partialItem.id] || 1}：只有部分天數可借`}
          titleEn={`${modeBundle(partialItem.id)?.name ?? partialItem.name} ×${quantities[partialItem.id] || 1}: only some days available`}
          days={rangeDays}
          okDays={new Set(okDaysFor(partialItem.id))}
          what="equipment"
          quantity={quantities[partialItem.id] || 1}
          unitZh={modeBundle(partialItem.id) ? '組' : '件'}
          affectsOthers={cart.some(i => i.category === 'equipment')}
          onConfirm={confirmPartial}
          onCancel={() => setPartialItem(null)}
        />
      )}
      {bundleOffer && (() => {
        const { item, quantity, bundle, sets, maxSets } = bundleOffer
        const step = (d: number) => setBundleOffer({ ...bundleOffer, sets: Math.min(maxSets, Math.max(1, sets + d)) })
        const stepCls = `w-7 h-7 flex items-center justify-center rounded-lg text-xs ${BTN_OUTLINE}`
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
                    <span className="font-english">×{c.quantity * sets}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <span className="mr-auto">{t('Sets', '組數')}</span>
                <button type="button" className={stepCls} disabled={sets <= 1} onClick={() => step(-1)} aria-label={t('Fewer', '減少')}>−</button>
                <span className="w-8 text-center font-english">{sets}</span>
                <button type="button" className={stepCls} disabled={sets >= maxSets} onClick={() => step(1)} aria-label={t('More', '增加')}>+</button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBundleOffer(null)
                  commitAdd([toCartItem(item, quantity)], `${item.name} x${quantity}`, item.id)
                }}
                className={`text-gray-light underline underline-offset-4 ${BTN}`}
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
            className={`absolute top-20 right-8 text-white text-xl font-normal z-10 ${BTN}`}
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

      {/* @container 不放在外層：container 會變成 fixed 的定位基準，全螢幕圖片要留在外面 */}
      <div className="@container flex-1 min-h-0 flex flex-col">
      {/* 表頭 - 固定不滾動；卡片模式每格自帶標籤，不顯示 */}
      <div className="grid grid-cols-[6px_40px_80px_1fr_80px_80px_90px_100px_120px_60px] items-center gap-4 @[1040px]:gap-6 pb-3 border-b border-gray-mid flex-shrink-0 card:hidden">
        {/* 狀態指示器列 - 空白表頭 */}
        <div></div>

        <div className="font-english text-xs text-gray-light text-left">
          <div>{t('Favorites', '收藏')}</div>
        </div>
        <div className="font-english text-xs text-gray-light"></div>
        <div className="font-english text-xs text-gray-light"></div>
        <div className="font-english text-xs text-gray-light text-center">
          <div>{t('Total Qty', '總數量')}</div>
        </div>
        <div className="font-english text-xs text-gray-light text-center">
          <div>{t('Available', '可借數量')}</div>
        </div>
        <div className="font-english text-xs text-gray-light text-center flex items-center justify-center gap-1">
          <div>
            <div>{t('On Hold', '待繳押金')}</div>
          </div>
          <div className="relative group flex">
            <span className="material-symbols-outlined text-gray-light cursor-help" style={{ fontSize: '20px' }}>
              info
            </span>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-gray-dark text-white text-xs whitespace-nowrap rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none z-50">
              已送出但未繳押金的設備
              {/* 小三角形 */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-mid"></div>
            </div>
          </div>
        </div>
        <div className="font-english text-xs text-gray-light text-center">
          <div>{t('Deposit', '押金/個')}</div>
        </div>
        <div className="font-english text-xs text-gray-light text-center">
          <div>{t('Quantity', '數量')}</div>
        </div>
        <div className="font-english text-xs text-gray-light text-center"></div>
      </div>

      {filteredEquipment.length > 0 ? (
        // 設備列表 - 可滾動
        <div className="flex-1 overflow-y-auto">
            {filteredEquipment.map(item => {
              const isBookmarked = bookmarkedIds.has(item.id)
              const quantity = quantities[item.id] || 1
              const availableQty = getAvailableQuantity(item.id)
              const maxDayQty = getMaxDayAvailable(item.id) // 部分時段：最好的一天可借幾件＝數量上限
              const isAvailable = maxDayQty > 0
              const status = getEquipmentStatus(item.id)
              const statusColor = getStatusColor(status)

              // 組合：可選的組合與目前模式（整組時數量＝組數、上限＝還能加幾組）
              const rowBundles = bundlesOf(item.id)
              const setBundle = modeBundle(item.id)
              const room = setBundle ? bundleRoom(setBundle) : null
              const maxQty = getMaxQuantity(item.id) // 整組＝最好的一天還能加幾組
              const canAdd = room ? maxQty > 0 : isAvailable
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

              // 卡片模式收起時藏的欄（數量、收藏、待繳、分類、單個／整組）；表格模式 card: 不作用
              const fold = openCard === item.id ? '' : 'card:hidden'

              return (
                <div
                  key={item.id}
                  onClick={() => setOpenCard(openCard === item.id ? null : item.id)}
                  className="grid grid-cols-[6px_40px_80px_1fr_80px_80px_90px_100px_120px_60px] gap-4 @[1040px]:gap-6 card:grid-cols-[6px_64px_1fr_44px] card:gap-x-3 card:gap-y-1 card:cursor-pointer py-3 border-b border-gray-mid items-center"
                >
                  {/* 狀態指示器 - 獨立的 grid 列 */}
                  <div
                    className={`h-full w-full ${fold ? 'card:row-span-2' : 'card:row-span-3'}`}
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
                    className={`w-6 h-6 card:box-content card:col-start-4 card:row-start-3 card:justify-self-center flex items-center justify-center ${fold} ${TAP} ${isBookmarked ? 'cursor-pointer' : BTN}`}
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
                    className="w-[80px] h-[80px] card:w-16 card:h-16 card:col-start-2 card:row-start-1 card:row-span-2 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg"
                    onClick={(e) => handleImageClick(e, item.mainImage)}
                  >
                    <img
                      src={item.mainImage}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                    />
                  </div>

                  {/* 設備名稱＋（屬於組合時）單個／整組下拉 */}
                  <div className={`font-chinese text-sm flex flex-col items-start gap-1 card:col-start-3 card:row-start-1 ${
                    !isAvailable ? 'text-gray-mid' : 'text-white'
                  }`}>
                    {item.name}
                    {/* 全部／收藏底下混了各種分類，名稱下方標出分類 chip（純文字）；進到單一分類就不用 */}
                    {(selectedCategory === '全部' || selectedCategory === '收藏') && (() => {
                      const cat = EQUIPMENT_CATEGORIES.find(c => c.zh === item.category)
                      return (
                        <span className={`${CHIP} bg-gray-dark font-chinese ${fold} ${isAvailable ? 'text-gray-light' : ''}`}>
                          {cat ? t(cat.en, cat.zh) : item.category}
                        </span>
                      )
                    })()}
                    {rowBundles.length > 0 && (
                      <div className={fold} onClick={e => e.stopPropagation()}>
                      <Select
                        size="xs"
                        value={modes[item.id] ?? ''}
                        onChange={v => {
                          setModes(prev => ({ ...prev, [item.id]: v }))
                          setQuantities(prev => ({ ...prev, [item.id]: 1 }))
                        }}
                        aria-label={t('Single or set', '單個或整組')}
                        options={[
                          { value: '', label: t('Single', '單個') },
                          ...rowBundles.map(b => ({
                            value: b.id,
                            label: t(`Set: ${b.name} (NT$ ${b.deposit.toLocaleString()} / set)`, `整組：${b.name}（押金 NT$ ${b.deposit.toLocaleString()}/組）`)
                          }))
                        ]}
                      />
                      </div>
                    )}
                  </div>

                  {/* 數字欄：表格時 contents＝各佔一格；卡片時併一列（總數量收掉，留可借／待繳／押金） */}
                  <div className="contents card:flex card:flex-wrap card:items-center card:gap-x-2 card:gap-y-1 card:col-start-3 card:row-start-2">
                  {/* 總數量 */}
                  <div className={`font-english text-sm text-center card:hidden ${
                    !isAvailable ? 'text-gray-mid' : 'text-white'
                  }`}>
                    {item.originalQuantity}
                  </div>

                  {/* 可借數量：部分時段顯示最好的一天可借幾件（橘字） */}
                  <div className={`font-english text-sm card:text-xs text-center card:flex card:items-baseline card:gap-1 ${
                    !isAvailable ? 'text-gray-mid' : status === 'partial' ? 'text-orange' : 'text-white'
                  }`}>
                    <div className="hidden card:block text-2xs text-gray-light">{t('Avail.', '可借')}</div>
                    {status === 'partial' ? maxDayQty : availableQty}
                  </div>

                  {/* 待繳押金數量（該時段押金未繳的佔用，見 equipment_reserved）；卡片展開時獨立一行 */}
                  <div className={`font-english text-sm card:text-xs text-center card:flex card:items-baseline card:gap-1 card:order-last card:basis-full ${fold} ${
                    !isAvailable ? 'text-gray-mid' : 'text-white'
                  }`}>
                    <div className="hidden card:block text-2xs text-gray-light">{t('On Hold', '待繳押金')}</div>
                    {reservedMap[item.id]?.onHold ?? 0}
                  </div>

                  {/* 押金/個 */}
                  <div className={`font-english text-sm card:text-xs text-center ${
                    !isAvailable ? 'text-gray-mid' : 'text-white'
                  }`}>
                    NT$ {setBundle ? setBundle.deposit : item.deposit}
                    {setBundle && <span className="text-2xs text-gray-light">/{t('set', '組')}</span>}
                  </div>

                  {/* 展開鈕：點擊冒泡到整列的 onClick，鍵盤 Enter 也走同一條 */}
                  <button
                    type="button"
                    aria-expanded={!fold}
                    aria-label={t('Details', '明細')}
                    className={`hidden card:flex ml-auto items-center text-gray-light cursor-pointer ${TAP}`}
                  >
                    <span className={`material-symbols-outlined transition-transform duration-300 ${fold ? '' : 'rotate-180'}`}>expand_more</span>
                  </button>
                  </div>

                  {/* 數量調整 - + (純文字按鈕，中間可輸入) */}
                  <div className={`flex items-center justify-center gap-4 card:gap-0 card:justify-start card:col-start-2 card:col-span-2 card:row-start-3 ${fold}`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        decrementQuantity(item.id)
                      }}
                      disabled={!canAdd || quantity <= 1}
                      className={`font-english text-sm text-white card:w-11 card:h-11 ${BTN}`}
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
                      className={`font-english text-sm w-12 text-center bg-transparent border-none outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        !canAdd ? 'text-white opacity-20 cursor-not-allowed' : 'text-white'
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
                      className={`font-english text-sm text-white card:w-11 card:h-11 ${BTN}`}
                    >
                      +
                    </button>
                  </div>

                  {/* 加入清單：白底圓角購物車 icon；不可加時 50% 透明但仍可點（toast 說明原因） */}
                  <div className="flex justify-center card:col-start-4 card:row-start-1 card:row-span-2 card:justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddToCart(item)
                      }}
                      aria-disabled={!canAdd || !hasSelectedDates || wouldExceedLightLimit || isSuspended}
                      aria-label={t('Add', '加入清單')}
                      className={`w-9 h-9 card:w-11 card:h-11 rounded-lg flex items-center justify-center ${
                        canAdd && hasSelectedDates && !wouldExceedLightLimit && !isSuspended
                          ? `bg-white text-black ${BTN}`
                          : 'bg-white text-black opacity-20 cursor-not-allowed'
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
          <p className="text-gray-light text-sm">{t('No Equipment Found', '找不到符合條件的設備')}</p>
        </div>
      )}
      </div>
    </div>
  )
}

export default EquipmentGrid
