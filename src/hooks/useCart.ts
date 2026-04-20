/**
 * 購物車管理 Hook
 * 從 cart-manager.js 遷移
 */

import { useState, useEffect, useCallback } from 'react'
import type { CartItem, Equipment, EquipmentData } from '../types/equipment'
import equipmentDataRaw from '../data/equipment-data.json'

const CART_STORAGE_KEY = 'sccd-rental-cart'
const EQUIPMENT_DATA = equipmentDataRaw as EquipmentData

export const useCart = () => {
  const [cart, setCart] = useState<CartItem[]>([])
  // 設備資料由 bundle 直接載入，初始即可用
  const [equipmentData] = useState<EquipmentData>(EQUIPMENT_DATA)
  const [isEquipmentLoaded] = useState(true)

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

  // 檢查是否有庫存
  const hasStock = useCallback(
    (equipmentId: string): boolean => {
      return getAvailableQuantity(equipmentId) > 0
    },
    [getAvailableQuantity]
  )

  // 檢查添加項目後是否超過時段押金上限
  const checkDepositLimit = useCallback(
    (newItem: CartItem): { allowed: boolean; reason?: string } => {
      // 計算該時段現有的押金
      const dateKey = `${newItem.startDate}_${newItem.endDate}`
      const itemsInSamePeriod = cart.filter(
        (item) => `${item.startDate}_${item.endDate}` === dateKey
      )

      // 取得租借類型（從該時段已有項目或新項目）
      const bookingType = itemsInSamePeriod.length > 0
        ? (itemsInSamePeriod[0].bookingType || 'little')
        : (newItem.bookingType || 'little')

      // 大量訂單不檢查押金上限（押金會在結算時 cap 在 5000）
      if (bookingType === 'mass-personal' || bookingType === 'mass-group') {
        return { allowed: true }
      }

      // 小量訂單才檢查押金上限
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

      // 檢查設備押金上限
      if (equipmentDeposit > 5000) {
        return {
          allowed: false,
          reason: '該時段設備押金已達上限 NT$ 5,000'
        }
      }

      // 檢查空間押金上限
      if (spaceDeposit > 5000) {
        return {
          allowed: false,
          reason: '該時段空間押金已達上限 NT$ 5,000'
        }
      }

      // 檢查總押金上限
      const totalDeposit = equipmentDeposit + spaceDeposit
      if (totalDeposit > 10000) {
        return {
          allowed: false,
          reason: '該時段總押金已達上限 NT$ 10,000'
        }
      }

      return { allowed: true }
    },
    [cart]
  )

  // 添加設備到購物車
  const addEquipmentToCart = useCallback(
    (equipment: Equipment, startDate: string, endDate: string): boolean => {
      // 檢查是否有庫存
      if (!hasStock(equipment.id)) {
        console.warn('設備無庫存:', equipment.id)
        return false
      }

      const existingItem = cart.find((item) => item.id === equipment.id)

      if (existingItem) {
        // 檢查是否超過庫存限制
        if (existingItem.quantity >= getOriginalQuantity(equipment.id)) {
          console.warn('已達庫存上限:', equipment.id)
          return false
        }

        // 檢查押金上限（假設增加 1 個數量）
        const tempItem: CartItem = {
          ...existingItem,
          quantity: 1
        }
        const limitCheck = checkDepositLimit(tempItem)
        if (!limitCheck.allowed) {
          console.warn('無法加入購物車:', limitCheck.reason)
          alert(limitCheck.reason)
          return false
        }

        existingItem.quantity += 1
        saveCart([...cart])
      } else {
        // 新增項目
        const newItem: CartItem = {
          id: equipment.id,
          name: equipment.name,
          category: equipment.category,
          deposit: equipment.deposit,
          image: equipment.mainImage,
          quantity: 1,
          startDate,
          endDate
        }

        // 檢查押金上限
        const limitCheck = checkDepositLimit(newItem)
        if (!limitCheck.allowed) {
          console.warn('無法加入購物車:', limitCheck.reason)
          alert(limitCheck.reason)
          return false
        }

        saveCart([...cart, newItem])
      }

      return true
    },
    [cart, hasStock, getOriginalQuantity, saveCart, checkDepositLimit]
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

  // 檢查租借類型衝突
  const checkBookingTypeConflict = useCallback(
    (newItem: CartItem): { allowed: boolean; reason?: string } => {
      const dateKey = `${newItem.startDate}_${newItem.endDate}`
      const itemsInSamePeriod = cart.filter(
        (item) => `${item.startDate}_${item.endDate}` === dateKey
      )

      if (itemsInSamePeriod.length === 0) {
        return { allowed: true }
      }

      const newBookingType = newItem.bookingType || 'little'

      // 檢查該時段現有的租借類型
      const existingBookingTypes = new Set(
        itemsInSamePeriod.map(item => item.bookingType || 'little')
      )

      // 規則：小量和大量-個人不能共存
      if (newBookingType === 'little' && existingBookingTypes.has('mass-personal')) {
        return {
          allowed: false,
          reason: '該時段已有大量-個人訂單，無法加入小量訂單'
        }
      }

      if (newBookingType === 'mass-personal' && existingBookingTypes.has('little')) {
        return {
          allowed: false,
          reason: '該時段已有小量訂單，無法加入大量-個人訂單'
        }
      }

      // 大量-個人和大量-團體可以共存
      return { allowed: true }
    },
    [cart]
  )

  // 檢查小量訂單的 9 件限制
  const checkLittleBookingLimit = useCallback(
    (newItem: CartItem): { allowed: boolean; reason?: string } => {
      const bookingType = newItem.bookingType || 'little'

      // 只檢查小量訂單，大量訂單沒有數量限制
      if (bookingType !== 'little') {
        return { allowed: true }
      }

      const dateKey = `${newItem.startDate}_${newItem.endDate}`
      const itemsInSamePeriod = cart.filter(
        (item) => `${item.startDate}_${item.endDate}` === dateKey
      )

      // 只計算同為小量訂單的項目數量
      let currentCount = 0
      itemsInSamePeriod.forEach(item => {
        const itemBookingType = item.bookingType || 'little'
        if (itemBookingType === 'little') {
          if (item.category === 'equipment') {
            currentCount += item.quantity
          } else if (item.category === 'space-block' || item.category === 'classroom') {
            currentCount += 1
          }
        }
      })

      // 計算新增項目的數量
      let newItemCount = 0
      if (newItem.category === 'equipment') {
        newItemCount = newItem.quantity
      } else if (newItem.category === 'space-block' || newItem.category === 'classroom') {
        newItemCount = 1
      }

      // 檢查是否超過 9 件
      if (currentCount + newItemCount > 9) {
        return {
          allowed: false,
          reason: `小量訂單上限為 9 件，該時段已有 ${currentCount} 件，無法再加入 ${newItemCount} 件`
        }
      }

      return { allowed: true }
    },
    [cart]
  )

  // 通用加入購物車 (不檢查庫存，用於教室或強制加入)
  const addToCart = useCallback(
    (item: CartItem) => {
      // 檢查租借類型衝突
      const typeCheck = checkBookingTypeConflict(item)
      if (!typeCheck.allowed) {
        console.warn('無法加入購物車:', typeCheck.reason)
        alert(typeCheck.reason)
        return false
      }

      // 檢查小量訂單 9 件限制（靜默失敗，不顯示 alert，應該在 UI 層面 disable 按鈕）
      const limitCheck9 = checkLittleBookingLimit(item)
      if (!limitCheck9.allowed) {
        console.warn('無法加入購物車:', limitCheck9.reason)
        // 不顯示 alert，應該在 UI 上 disable
        return false
      }

      // 檢查押金上限
      const limitCheck = checkDepositLimit(item)
      if (!limitCheck.allowed) {
        console.warn('無法加入購物車:', limitCheck.reason)
        alert(limitCheck.reason)
        return false
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
      return true
    },
    [cart, saveCart, checkDepositLimit, checkBookingTypeConflict, checkLittleBookingLimit]
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
      if (newQuantity > item.quantity) {
        const bookingType = item.bookingType || 'little'

        if (bookingType === 'little') {
          const dateKey = `${item.startDate}_${item.endDate}`
          const itemsInSamePeriod = cart.filter(
            (cartItem) => `${cartItem.startDate}_${cartItem.endDate}` === dateKey
          )

          // 計算當前同時段小量訂單的總數量（排除當前要更新的項目）
          let currentCount = 0
          itemsInSamePeriod.forEach(cartItem => {
            const itemBookingType = cartItem.bookingType || 'little'
            if (itemBookingType === 'little' && cartItem.id !== equipmentId) {
              if (cartItem.category === 'equipment') {
                currentCount += cartItem.quantity
              } else if (cartItem.category === 'space-block' || cartItem.category === 'classroom') {
                currentCount += 1
              }
            }
          })

          // 檢查新數量是否會超過 9 件限制
          if (currentCount + newQuantity > 9) {
            console.warn('無法更新數量: 小量訂單上限為 9 件')
            return false
          }
        }
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
    [cart, getOriginalQuantity, saveCart, checkDepositLimit, removeFromCart]
  )

  // 清空購物車
  const clearCart = useCallback(() => {
    saveCart([])
  }, [saveCart])

  // 獲取購物車總數量
  const getTotalQuantity = useCallback(() => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }, [cart])

  // 獲取設備押金（上限 5000）
  const getEquipmentDeposit = useCallback(() => {
    const total = cart
      .filter((item) => item.category === 'equipment')
      .reduce((sum, item) => sum + item.deposit * item.quantity, 0)
    return Math.min(total, 5000)
  }, [cart])

  // 獲取空間押金（上限 5000）
  const getSpaceDeposit = useCallback(() => {
    const total = cart
      .filter((item) => item.category === 'space-block' || item.category === 'classroom')
      .reduce((sum, item) => sum + item.deposit * item.quantity, 0)
    return Math.min(total, 5000)
  }, [cart])

  // 獲取購物車總押金（設備和空間各上限 5000，總上限 10000）
  const getTotalDeposit = useCallback(() => {
    return getEquipmentDeposit() + getSpaceDeposit()
  }, [getEquipmentDeposit, getSpaceDeposit])

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
    isEquipmentLoaded,
    getEquipmentById,
    getOriginalQuantity,
    getCartQuantity,
    getAvailableQuantity,
    hasStock,
    addEquipmentToCart,
    addToCart,
    updateEquipmentQuantity,
    removeFromCart,
    clearCart,
    getTotalQuantity,
    getTotalDeposit,
    getEquipmentDeposit,
    getSpaceDeposit,
    checkLittleBookingLimit
  }
}
