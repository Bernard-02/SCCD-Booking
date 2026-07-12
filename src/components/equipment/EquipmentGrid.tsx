/**
 * 設備列表組件
 * 以列表形式顯示設備
 */

import React, { useState, useEffect } from 'react'
import type { Equipment } from '../../types/equipment'
import { useBookmarkStore } from '../../stores/bookmarkStore'
import { useCart } from '../../hooks/useCart'
import { useDateSelection } from '../../contexts/DateSelectionContext'
import { useAuth } from '../../contexts/AuthContext'
import { useEquipmentData, fetchEquipmentReserved } from '../../services/equipmentService'
import type { ReservedInfo } from '../../services/equipmentService'
import { toDateKey } from '../cart/cartHelpers'
import Toast from '../common/Toast'

interface EquipmentGridProps {
  selectedCategory: string
  statusFilters: Set<'available' | 'unavailable' | 'partial'>
}

const EquipmentGrid: React.FC<EquipmentGridProps> = ({ selectedCategory, statusFilters }) => {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([])
  // 數量允許暫存空字串：使用者可先清空再輸入，失焦時若無有效值會回到 1
  const [quantities, setQuantities] = useState<Record<string, number | ''>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
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
    checkLittleBookingLimit
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
      setToastMessage('請先登入以使用收藏功能')
      return
    }

    // 切換收藏狀態
    const wasBookmarked = bookmarkStore.isBookmarked(id)
    bookmarkStore.toggleBookmark(id)

    // 顯示通知
    if (!wasBookmarked) {
      setToastMessage(`${itemName} 已加入收藏`)
    } else {
      setToastMessage(`${itemName} 已移除收藏`)
    }
  }

  // 增加數量
  const incrementQuantity = (id: string) => {
    const availableQty = getAvailableQuantity(id)
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
    const availableQty = getAvailableQuantity(id)
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

  // 加入購物車
  const handleAddToCart = (item: Equipment) => {
    // 檢查是否已選擇日期
    if (!hasSelectedDates) {
      setToastMessage('請先選擇租借日期')
      return
    }

    const quantity = quantities[item.id] || 1
    const availableQty = getAvailableQuantity(item.id)

    // 檢查庫存
    if (quantity > availableQty) {
      setToastMessage(`庫存不足！${item.name} 剩餘可借數量：${availableQty}`)
      return
    }

    // 加入購物車（包含日期資訊）
    const result = addToCart({
      id: item.id,
      name: item.name,
      category: 'equipment',
      deposit: item.deposit,
      image: '/Images/Extension Cord.webp', // TODO: 使用實際圖片
      quantity: quantity,
      startDate: equipmentDates.startDate!.toISOString(),
      endDate: equipmentDates.endDate!.toISOString(),
      bookingType: equipmentDates.bookingType
    })

    if (!result.ok) {
      // 加入失敗（押金上限／類型衝突／9 件上限），顯示原因而非假的成功訊息
      setToastMessage(result.reason || '無法加入清單')
      return
    }

    // 顯示成功訊息
    setToastMessage(`已成功加入 ${item.name} x${quantity} 到清單！`)

    // 重置該設備的數量為 1
    setQuantities(prev => ({
      ...prev,
      [item.id]: 1
    }))
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
    <div className="w-full h-full flex flex-col pt-[60px]">
      {/* Toast 通知 */}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      {/* 全螢幕圖片檢視 */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center py-20"
          onClick={closeFullscreenImage}
        >
          {/* 關閉按鈕 */}
          <button
            onClick={closeFullscreenImage}
            className="absolute top-20 right-8 text-white text-4xl font-light hover:text-gray-scale2 transition-colors cursor-pointer z-10"
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
      <div className="grid grid-cols-[6px_40px_80px_1fr_100px_100px_100px_120px_140px_80px] gap-6 pb-3 border-b border-[#7c7c7c] flex-shrink-0">
        {/* 狀態指示器列 - 空白表頭 */}
        <div></div>

        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-left">
          <div className="font-['Inter',_sans-serif]">Favorites</div>
          <div className="font-['Noto_Sans_TC',_sans-serif]">收藏</div>
        </div>
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2"></div>
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2"></div>
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-center">
          <div className="font-['Inter',_sans-serif]">Total Qty</div>
          <div className="font-['Noto_Sans_TC',_sans-serif]">總數量</div>
        </div>
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-center">
          <div className="font-['Inter',_sans-serif]">Available</div>
          <div className="font-['Noto_Sans_TC',_sans-serif]">可借數量</div>
        </div>
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-center flex items-center justify-center gap-1">
          <div>
            <div className="font-['Inter',_sans-serif]">On Hold</div>
            <div className="font-['Noto_Sans_TC',_sans-serif]">待繳押金</div>
          </div>
          <div className="relative group">
            <span className="material-symbols-outlined text-gray-scale2 cursor-help" style={{ fontSize: '20px' }}>
              info
            </span>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-gray-scale4 text-white text-tiny whitespace-nowrap rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
              已送出但未繳押金的設備
              {/* 小三角形 */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-scale4"></div>
            </div>
          </div>
        </div>
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-center">
          <div className="font-['Inter',_sans-serif]">Deposit</div>
          <div className="font-['Noto_Sans_TC',_sans-serif]">押金/個</div>
        </div>
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-center">
          <div className="font-['Inter',_sans-serif]">Quantity</div>
          <div className="font-['Noto_Sans_TC',_sans-serif]">數量</div>
        </div>
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-center"></div>
      </div>

      {filteredEquipment.length > 0 ? (
        // 設備列表 - 可滾動
        <div className="flex-1 overflow-y-auto">
            {filteredEquipment.map(item => {
              const isBookmarked = bookmarkedIds.has(item.id)
              const quantity = quantities[item.id] || 1
              const availableQty = getAvailableQuantity(item.id)
              const isAvailable = availableQty > 0
              const status = getEquipmentStatus(item.id)
              const statusColor = getStatusColor(status)

              // 檢查是否達到 Light 9件限制
              const wouldExceedLightLimit = checkLittleBookingLimit({
                id: item.id,
                name: item.name,
                category: 'equipment',
                deposit: item.deposit,
                image: '/Images/Extension Cord.webp',
                quantity: quantity,
                startDate: equipmentDates.startDate?.toISOString() || '',
                endDate: equipmentDates.endDate?.toISOString() || '',
                bookingType: equipmentDates.bookingType
              }).allowed === false

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[6px_40px_80px_1fr_100px_100px_100px_120px_140px_80px] gap-6 py-3 border-b border-[#7c7c7c] items-center transition-colors"
                >
                  {/* 狀態指示器 - 獨立的 grid 列 */}
                  <div
                    className="h-full w-full"
                    style={{
                      backgroundColor: statusColor
                    }}
                  />

                  {/* Bookmark */}
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
                      style={{ fontSize: '24px', fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      bookmark
                    </span>
                  </button>

                  {/* 設備圖片 */}
                  <div
                    className="w-[80px] h-[80px] flex-shrink-0 cursor-pointer overflow-hidden rounded-lg"
                    onClick={(e) => handleImageClick(e, '/Images/Extension Cord.webp')}
                  >
                    <img
                      src="/Images/Extension Cord.webp"
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                    />
                  </div>

                  {/* 設備名稱 */}
                  <div className={`font-['Noto_Sans_TC',_sans-serif] text-small-title ${
                    !isAvailable ? 'text-[#545454]' : 'text-white'
                  }`}>
                    {item.name}
                  </div>

                  {/* 總數量 */}
                  <div className={`font-['Inter',_sans-serif] text-small-title text-center ${
                    !isAvailable ? 'text-[#545454]' : 'text-white'
                  }`}>
                    {item.originalQuantity}
                  </div>

                  {/* 可借數量 */}
                  <div className={`font-['Inter',_sans-serif] text-small-title text-center ${
                    !isAvailable ? 'text-[#545454]' : 'text-white'
                  }`}>
                    {availableQty}
                  </div>

                  {/* 待繳押金數量（該時段 pending 訂單佔用） */}
                  <div className={`font-['Inter',_sans-serif] text-small-title text-center ${
                    !isAvailable ? 'text-[#545454]' : 'text-white'
                  }`}>
                    {reservedMap[item.id]?.onHold ?? 0}
                  </div>

                  {/* 押金/個 */}
                  <div className={`font-['Inter',_sans-serif] text-small-title text-center ${
                    !isAvailable ? 'text-[#545454]' : 'text-white'
                  }`}>
                    NT$ {item.deposit}
                  </div>

                  {/* 數量調整 - + (純文字按鈕，中間可輸入) */}
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        decrementQuantity(item.id)
                      }}
                      disabled={!isAvailable || quantity <= 1}
                      className={`font-['Inter',_sans-serif] text-small-title ${
                        !isAvailable || quantity <= 1
                          ? 'text-[#545454] cursor-not-allowed'
                          : 'text-white hover:text-gray-scale1 cursor-pointer'
                      }`}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={availableQty}
                      value={quantities[item.id] ?? 1}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      onBlur={() => handleQuantityBlur(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={!isAvailable}
                      className={`font-['Inter',_sans-serif] text-small-title w-12 text-center bg-transparent border-none outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        !isAvailable ? 'text-[#545454] cursor-not-allowed' : 'text-white'
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
                      disabled={!isAvailable || quantity >= availableQty}
                      className={`font-['Inter',_sans-serif] text-small-title ${
                        !isAvailable || quantity >= availableQty
                          ? 'text-[#545454] cursor-not-allowed'
                          : 'text-white hover:text-gray-scale1 cursor-pointer'
                      }`}
                    >
                      +
                    </button>
                  </div>

                  {/* Add 按鈕 (純文字) */}
                  <div className="flex justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddToCart(item)
                      }}
                      disabled={!isAvailable || !hasSelectedDates || wouldExceedLightLimit}
                      className={`font-['Inter',_sans-serif] text-small-title ${
                        isAvailable && hasSelectedDates && !wouldExceedLightLimit
                          ? 'text-white hover:text-gray-scale1 cursor-pointer'
                          : 'text-[#545454] cursor-not-allowed'
                      }`}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="font-['Inter',_sans-serif] text-gray-scale2 text-small-title">No Equipment Found</p>
          <p className="font-['Noto_Sans_TC',_sans-serif] text-gray-scale2 text-small-title">找不到符合條件的設備</p>
        </div>
      )}
    </div>
  )
}

export default EquipmentGrid
