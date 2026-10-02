/**
 * 購物車管理 Hook
 * 從 cart-manager.js 遷移
 */

import { useState, useEffect, useCallback } from 'react'
import { cartGroupKey } from '../types/equipment'
import type { CartItem, Equipment } from '../types/equipment'
import { useEquipmentData } from '../services/equipmentService'
import { useSuspension } from './useSuspension'

const CART_STORAGE_KEY = 'sccd-rental-cart'

export const useCart = () => {
  const [cart, setCart] = useState<CartItem[]>([])
  // 設備資料來自 Supabase（模組層快取，全 app 只抓一次；載入完成前為空物件）
  const equipmentData = useEquipmentData()
  // 停權帳號連加入購物車都擋（情境 7；送單端 RPC 仍是最終防線）
  const isSuspended = useSuspension()

  // 從 localStorage 載入購物車
  const loadCart = useCallback(() => {
    try {
      const cartData = localStorage.getItem(CART_STORAGE_KEY)
      if (cartData) {
        setCart(JSON.parse(cartData))
      }
    } catch (error) {
      console.error('讀取購物車數據錯誤:', error)
    }
  }, [])

  // 保存購物車到 localStorage
  const saveCart = useCallback((cartData: CartItem[]) => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData))
      setCart(cartData)

      // 觸發 storage 事件用於跨頁面同步
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: CART_STORAGE_KEY,
          newValue: JSON.stringify(cartData)
        })
      )
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

  // 動態計算可用數量
  const getAvailableQuantity = useCallback(
    (equipmentId: string): number => {
      const originalQty = getOriginalQuantity(equipmentId)
      const cartQty = getCartQuantity(equipmentId)
      return Math.max(0, originalQty - cartQty)
    },
    [getOriginalQuantity, getCartQuantity]
  )

  // 檢查添加項目後是否超過時段押金上限
  const checkDepositLimit = useCallback(
    (newItem: CartItem): { allowed: boolean; reason?: string } => {
      // 計算同一張訂單（同類別同時段）現有的押金
      const groupKey = cartGroupKey(newItem)
      const itemsInSamePeriod = cart.filter((item) => cartGroupKey(item) === groupKey)

      // 取得租借類型（從該時段已有項目或新項目）
      const bookingType = itemsInSamePeriod.length > 0
        ? (itemsInSamePeriod[0].bookingType || 'little')
        : (newItem.bookingType || 'little')

      // 大量-團體完全不檢查押金上限（押金會在結算時 cap 在 5000）
      if (bookingType === 'mass-group') {
        return { allowed: true }
      }

      // 大量訂單設備數量不限、不檢查設備押金（押金結算時 cap 在 5000）
      const isMass = bookingType === 'mass-personal'
      // 計算該時段設備押金
      let equipmentDeposit = itemsInSamePeriod
        .filter((item) => item.category === 'equipment')
        .reduce((sum, item) => sum + item.deposit * item.quantity, 0)

      // 計算該時段空間押金
      let spaceDeposit = itemsInSamePeriod
        .filter((item) => item.category === 'space-block' || item.category === 'classroom')
        .reduce((sum, item) => sum + item.deposit * item.quantity, 0)

      // 計算新增項目的押金
      const newItemDeposit = newItem.deposit * newItem.quantity

      // 將新項目押金加到對應類別
      if (newItem.category === 'equipment') {
        equipmentDeposit += newItemDeposit
      } else if (newItem.category === 'space-block' || newItem.category === 'classroom') {
        spaceDeposit += newItemDeposit
      }

      // 檢查設備押金上限（僅小量；大量設備不限量，押金結算時 cap 5000）
      if (!isMass && equipmentDeposit > 5000) {
        return {
          allowed: false,
          reason: '該時段設備押金已達上限 NT$ 5,000'
        }
      }

      // 檢查空間押金上限（個人租借：小量／大量-個人）
      if (spaceDeposit > 5000) {
        return {
          allowed: false,
          reason: '該時段空間押金已達上限 NT$ 5,000'
        }
      }

      return { allowed: true }
    },
    [cart]
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

  // 檢查租借類型衝突（2026-10-02）：購物車內設備只能小量／大量擇一、空間只能個人／團體擇一（不分時段）；
  // 設備與空間可同時存在，送單時自動拆成兩張訂單
  const checkBookingTypeConflict = useCallback(
    (newItem: CartItem): { allowed: boolean; reason?: string } => {
      const isEquipment = newItem.category === 'equipment'
      const existing = cart.find((item) => (item.category === 'equipment') === isEquipment)
      if (!existing) return { allowed: true }

      const existingType = existing.bookingType || 'little'
      const newType = newItem.bookingType || 'little'
      if (existingType === newType) return { allowed: true }

      // 標籤同購物車：設備 小量／大量、空間 個人／團體
      const label = (t: string) => (t === 'little' ? (isEquipment ? '小量' : '個人') : isEquipment ? '大量' : '團體')
      const what = isEquipment ? '設備' : '空間'
      return {
        allowed: false,
        reason: `購物車已有${label(existingType)}${what}，${what}只能選${label('little')}或${label('mass')}其中一種，請先送出或清除後再加入${label(newType)}${what}`
      }
    },
    [cart]
  )

  // 檢查小量訂單的 9 件限制：僅計設備（2026-09-30 定案，空間由押金 cap 5,000 限量）
  const checkLittleBookingLimit = useCallback(
    (newItem: CartItem): { allowed: boolean; reason?: string } => {
      if ((newItem.bookingType || 'little') !== 'little' || newItem.category !== 'equipment') {
        return { allowed: true }
      }

      const groupKey = cartGroupKey(newItem)
      const currentCount = cart
        .filter((item) => cartGroupKey(item) === groupKey)
        .reduce((sum, item) => sum + item.quantity, 0)

      if (currentCount + newItem.quantity > 9) {
        return {
          allowed: false,
          reason: `小量設備上限為 9 件，該時段已有 ${currentCount} 件，無法再加入 ${newItem.quantity} 件`
        }
      }

      return { allowed: true }
    },
    [cart]
  )

  // 通用加入購物車 (不檢查庫存，用於教室或強制加入)
  // 回傳 { ok, reason }，由呼叫端以 toast 呈現，不再用原生 alert
  const addToCart = useCallback(
    (item: CartItem): { ok: boolean; reason?: string } => {
      // 停權檢查
      if (isSuspended) {
        return { ok: false, reason: '帳號已停權（未完成清潔歸還），無法加入購物車，請聯絡系學會' }
      }

      // 檢查租借類型衝突
      const typeCheck = checkBookingTypeConflict(item)
      if (!typeCheck.allowed) {
        console.warn('無法加入購物車:', typeCheck.reason)
        return { ok: false, reason: typeCheck.reason }
      }

      // 檢查小量訂單 9 件限制
      const limitCheck9 = checkLittleBookingLimit(item)
      if (!limitCheck9.allowed) {
        console.warn('無法加入購物車:', limitCheck9.reason)
        return { ok: false, reason: limitCheck9.reason }
      }

      // 檢查押金上限
      const limitCheck = checkDepositLimit(item)
      if (!limitCheck.allowed) {
        console.warn('無法加入購物車:', limitCheck.reason)
        return { ok: false, reason: limitCheck.reason }
      }

      // 需要同時比對 id、startDate 和 endDate，因為同一設備可能在不同時段被租借
      const existingItem = cart.find((i) =>
        i.id === item.id &&
        i.startDate === item.startDate &&
        i.endDate === item.endDate
      )

      if (existingItem) {
        existingItem.quantity += item.quantity
        saveCart([...cart])
      } else {
        saveCart([...cart, item])
      }
      return { ok: true }
    },
    [cart, saveCart, checkDepositLimit, checkBookingTypeConflict, checkLittleBookingLimit, isSuspended]
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

  // 初始化
  useEffect(() => {
    loadCart()

    // 監聽 storage 事件，用於跨頁面同步
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) {
        loadCart()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [loadCart])

  return {
    cart,
    equipmentData,
    isSuspended,
    getOriginalQuantity,
    getCartQuantity,
    getAvailableQuantity,
    addToCart,
    updateEquipmentQuantity,
    removeFromCart,
    clearCart,
    checkLittleBookingLimit
  }
}
