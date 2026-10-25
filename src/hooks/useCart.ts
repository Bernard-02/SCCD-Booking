/**
 * 購物車管理 Hook
 * 從 cart-manager.js 遷移
 */

import { useState, useEffect, useCallback } from 'react'
import { cartGroupKey } from '../types/equipment'
import type { CartItem, Equipment } from '../types/equipment'
import { useBundles, useEquipmentData } from '../services/equipmentService'
import { calcBundles } from '../utils/bundleUtils'
import { tr } from '../stores/langStore'
import { useSuspension } from './useSuspension'
import { useAuth } from '../contexts/AuthContext'
import { cartKey, readCart, writeCart } from '../components/cart/cartHelpers'

// 訪客可逛型錄、選日期，加入清單才要求登入
export const loginRequiredMsg = () => tr('Please log in to add items to your list.', '請先登入才能加入清單')

export const useCart = () => {
  const [cart, setCart] = useState<CartItem[]>([])
  // 設備資料來自 Supabase（模組層快取，全 app 只抓一次；載入完成前為空物件）
  const equipmentData = useEquipmentData()
  // 設備組合：湊滿一組押金只收一組、件數算 1（後台設定，載入完成前為空＝照單件計）
  const bundles = useBundles()
  // 停權帳號連加入購物車都擋（情境 7；送單端 RPC 仍是最終防線）
  const isSuspended = useSuspension()
  const { isAuthenticated, currentUser } = useAuth()

  // 從 localStorage 載入購物車（依學號分開；訪客為空）
  const loadCart = useCallback(() => {
    try {
      setCart(readCart())
    } catch (error) {
      console.error('讀取購物車數據錯誤:', error)
    }
  }, [])

  // 保存購物車到 localStorage（writeCart 會廣播 storage 事件用於跨頁面同步）
  const saveCart = useCallback((cartData: CartItem[]) => {
    try {
      writeCart(cartData)
      setCart(cartData)
    } catch (error) {
      console.error('保存購物車數據錯誤:', error)
    }
  }, [])

  // 獲取設備資料
  const getEquipmentById = useCallback(
    (equipmentId: string): Equipment | null => {
      return equipmentData[equipmentId] || null
    },
    [equipmentData]
  )

  // 獲取原始數量
  const getOriginalQuantity = useCallback(
    (equipmentId: string): number => {
      const equipment = getEquipmentById(equipmentId)
      return equipment ? equipment.originalQuantity : 0
    },
    [getEquipmentById]
  )

  // 獲取購物車中該設備的數量（累計所有日期段的數量）
  const getCartQuantity = useCallback(
    (equipmentId: string): number => {
      return cart
        .filter((item) => item.id === equipmentId && item.category !== 'area')
        .reduce((sum, item) => sum + item.quantity, 0)
    },
    [cart]
  )

  // 加入後的整張訂單（同類別同時段）：新項目併進同設備的數量——組合要看加入後湊不湊得成組
  const groupAfterAdding = useCallback(
    (newItems: CartItem[]): CartItem[] => {
      const groupKey = cartGroupKey(newItems[0])
      const group = cart.filter((item) => cartGroupKey(item) === groupKey).map((item) => ({ ...item }))
      newItems.forEach((n) => {
        const same = group.find((i) => i.id === n.id)
        if (same) same.quantity += n.quantity
        else group.push({ ...n })
      })
      return group
    },
    [cart]
  )

  // 檢查添加項目後是否超過時段押金上限（可一次加多項：整組加入）
  const checkDepositLimit = useCallback(
    (newItem: CartItem | CartItem[]): { allowed: boolean; reason?: string } => {
      const newItems = Array.isArray(newItem) ? newItem : [newItem]
      const group = groupAfterAdding(newItems)

      // 租借類型以購物車該單既有的為準（同 cartGroupKey 第一筆）
      const bookingType = group[0].bookingType || 'little'

      // 大量-團體完全不檢查押金上限（押金會在結算時 cap 在 5000）
      if (bookingType === 'mass-group') {
        return { allowed: true }
      }

      // 大量訂單設備數量不限、不檢查設備押金（押金結算時 cap 在 5000）
      const isMass = bookingType === 'mass-personal'
      // 設備押金套用組合（湊滿一組只收一組）
      const equipmentDeposit = calcBundles(
        group.filter((item) => item.category === 'equipment'),
        bundles
      ).deposit

      const spaceDeposit = group
        .filter((item) => item.category === 'space-block' || item.category === 'classroom')
        .reduce((sum, item) => sum + item.deposit * item.quantity, 0)

      // 檢查設備押金上限（僅小量；大量設備不限量，押金結算時 cap 5000）
      if (!isMass && equipmentDeposit > 5000) {
        return {
          allowed: false,
          reason: tr('The equipment deposit for this period has reached the NT$ 5,000 limit.', '該時段設備押金已達上限 NT$ 5,000')
        }
      }

      // 檢查空間押金上限（個人租借：小量／大量-個人）
      if (spaceDeposit > 5000) {
        return {
          allowed: false,
          reason: tr('The space deposit for this period has reached the NT$ 5,000 limit.', '該時段空間押金已達上限 NT$ 5,000')
        }
      }

      return { allowed: true }
    },
    [groupAfterAdding, bundles]
  )

  // 從購物車移除項目
  const removeFromCart = useCallback(
    (itemId: string, startDate?: string, endDate?: string): boolean => {
      const updatedCart = cart.filter((item) => {
        if (startDate && endDate) {
          return !(item.id === itemId && item.startDate === startDate && item.endDate === endDate)
        }
        return item.id !== itemId
      })

      if (updatedCart.length !== cart.length) {
        saveCart(updatedCart)
        return true
      }

      console.warn('購物車中找不到項目:', itemId)
      return false
    },
    [cart, saveCart]
  )

  // 同類別一次一張訂單（2026-10-02，rental-rules §5＋新規則 7）：購物車內設備、空間各最多一張——
  // 類型擇一（設備小量／大量、空間個人／團體），時段也只能一個（學會規定上一張歸還才能開下一張；
  // 送單時 submit_orders 另擋同類型未歸還單）。設備與空間可同時存在，送單時自動拆成兩張訂單
  const checkBookingTypeConflict = useCallback(
    (newItem: CartItem): { allowed: boolean; reason?: string } => {
      const isEquipment = newItem.category === 'equipment'
      const existing = cart.find((item) => (item.category === 'equipment') === isEquipment)
      if (!existing) return { allowed: true }

      const existingType = existing.bookingType || 'little'
      const newType = newItem.bookingType || 'little'
      const samePeriod = existing.startDate === newItem.startDate && existing.endDate === newItem.endDate
      if (existingType === newType && samePeriod) return { allowed: true }

      // 標籤同購物車：設備 小量／大量、空間 個人／團體
      const label = (t: string) => (t === 'little' ? (isEquipment ? '小量' : '個人') : isEquipment ? '大量' : '團體')
      const labelEn = (t: string) => (t === 'little' ? (isEquipment ? 'light' : 'personal') : isEquipment ? 'mass' : 'group')
      const what = isEquipment ? '設備' : '空間'
      const whatEn = isEquipment ? 'equipment' : 'space'
      const period = `${existing.startDate} – ${existing.endDate}`
      const order = `${label(existingType)}${what}訂單（${period}）`
      const orderEn = `${labelEn(existingType)} ${whatEn} order (${period})`
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const start = new Date(existing.startDate)
      start.setHours(0, 0, 0, 0)
      return {
        allowed: false,
        reason: start < today
          ? tr(
              `The ${orderEn} in your cart has expired. Please pick new dates in the cart or clear it first — you can only have one ${whatEn} order at a time.`,
              `購物車內的${order}已過期，請先到購物車重選日期或清除；${what}一次只能有一張訂單`
            )
          : tr(
              `Your cart already has a ${orderEn}. You can only have one ${whatEn} order at a time (${labelEn('little')} or ${labelEn('mass')}, one period). Please submit or clear it before adding more.`,
              `購物車已有一張${order}，${what}一次只能有一張訂單（${label('little')}／${label('mass')}擇一、時段一個），請先送出或清除後再加入`
            )
      }
    },
    [cart]
  )

  // 檢查小量訂單的 9 件限制：僅計設備（2026-09-30 定案，空間由押金 cap 5,000 限量）；
  // 湊滿的組合算 1 件，所以看「加入後」的件數（補齊最後一個零件可能反而變少）
  const checkLittleBookingLimit = useCallback(
    (newItem: CartItem | CartItem[]): { allowed: boolean; reason?: string } => {
      const newItems = Array.isArray(newItem) ? newItem : [newItem]
      if ((newItems[0].bookingType || 'little') !== 'little' || newItems[0].category !== 'equipment') {
        return { allowed: true }
      }

      const units = calcBundles(groupAfterAdding(newItems), bundles).units
      if (units > 9) {
        return {
          allowed: false,
          reason: tr('Light bookings allow up to 9 items.', '小量設備最大 9 件')
        }
      }

      return { allowed: true }
    },
    [groupAfterAdding, bundles]
  )

  // 通用加入購物車 (不檢查庫存，用於教室或強制加入)；傳陣列＝整組一次加入（同一張單，全成功或全不加）
  // 回傳 { ok, reason }，由呼叫端以 toast 呈現，不再用原生 alert
  const addToCart = useCallback(
    (itemOrItems: CartItem | CartItem[]): { ok: boolean; reason?: string } => {
      const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems]
      const item = items[0]
      if (!isAuthenticated) {
        return { ok: false, reason: loginRequiredMsg() }
      }

      // 停權檢查
      if (isSuspended) {
        return { ok: false, reason: tr('Your account is suspended (clean return not completed), so you can’t add items. Please contact the SA.', '帳號已停權（未完成清潔歸還），無法加入購物車，請聯絡系學會') }
      }

      // 檢查租借類型衝突
      const typeCheck = checkBookingTypeConflict(item)
      if (!typeCheck.allowed) {
        console.warn('無法加入購物車:', typeCheck.reason)
        return { ok: false, reason: typeCheck.reason }
      }

      // 檢查小量訂單 9 件限制
      const limitCheck9 = checkLittleBookingLimit(items)
      if (!limitCheck9.allowed) {
        console.warn('無法加入購物車:', limitCheck9.reason)
        return { ok: false, reason: limitCheck9.reason }
      }

      // 檢查押金上限
      const limitCheck = checkDepositLimit(items)
      if (!limitCheck.allowed) {
        console.warn('無法加入購物車:', limitCheck.reason)
        return { ok: false, reason: limitCheck.reason }
      }

      // 需要同時比對 id、startDate 和 endDate，因為同一設備可能在不同時段被租借
      const next = cart.map((i) => ({ ...i }))
      items.forEach((n) => {
        const existingItem = next.find((i) =>
          i.id === n.id &&
          i.startDate === n.startDate &&
          i.endDate === n.endDate
        )
        if (existingItem) existingItem.quantity += n.quantity
        else next.push(n)
      })
      saveCart(next)
      return { ok: true }
    },
    [cart, saveCart, checkDepositLimit, checkBookingTypeConflict, checkLittleBookingLimit, isSuspended, isAuthenticated]
  )

  // 更新設備數量
  const updateEquipmentQuantity = useCallback(
    (equipmentId: string, newQuantity: number): boolean => {
      const item = cart.find((item) => item.id === equipmentId)

      if (!item) {
        console.warn('購物車中找不到設備:', equipmentId)
        return false
      }

      // 檢查數量限制
      const maxQuantity = getOriginalQuantity(equipmentId)
      if (newQuantity > maxQuantity) {
        console.warn('超過庫存限制:', equipmentId, '最大:', maxQuantity)
        return false
      }

      if (newQuantity <= 0) {
        // 移除項目
        return removeFromCart(equipmentId)
      }

      // 檢查小量訂單 9 件限制（只在增加數量時檢查）
      // 增加量當作新加入的一筆檢查：組內現有（含本項原數量）＋差額 > 9 即擋
      if (newQuantity > item.quantity && !checkLittleBookingLimit({ ...item, quantity: newQuantity - item.quantity }).allowed) {
        console.warn('無法更新數量: 小量設備上限為 9 件')
        return false
      }

      // 檢查押金上限（只在增加數量時檢查）
      if (newQuantity > item.quantity) {
        const quantityDiff = newQuantity - item.quantity
        const tempItem: CartItem = {
          ...item,
          quantity: quantityDiff
        }
        const limitCheck = checkDepositLimit(tempItem)
        if (!limitCheck.allowed) {
          console.warn('無法更新數量:', limitCheck.reason)
          alert(limitCheck.reason)
          return false
        }
      }

      item.quantity = newQuantity
      saveCart([...cart])
      return true
    },
    [cart, getOriginalQuantity, saveCart, checkDepositLimit, checkLittleBookingLimit, removeFromCart]
  )

  // 清空購物車
  const clearCart = useCallback(() => {
    saveCart([])
  }, [saveCart])

  // 初始化；登入／登出／換人時重新載入（購物車依學號分開）
  const studentId = currentUser?.studentId
  useEffect(() => {
    loadCart()

    // 監聽 storage 事件，用於跨頁面同步
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === cartKey()) {
        loadCart()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [loadCart, studentId])

  return {
    cart,
    equipmentData,
    bundles,
    isSuspended,
    getOriginalQuantity,
    getCartQuantity,
    addToCart,
    updateEquipmentQuantity,
    removeFromCart,
    clearCart,
    checkLittleBookingLimit
  }
}
