/**
 * Cart List 組件
 * 按照租借日期分組顯示購物車項目
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import type { CartItem, BookingType } from '../../types/equipment'
import { mockAreaBlocksData } from '../space/SpaceAreaMap'
import { useCart } from '../../hooks/useCart'
import { useConfirmDialog } from '../../hooks/useConfirmDialog'
import BookingDetailsDialog from '../common/BookingDetailsDialog'
import DateEditDialog from './DateEditDialog'
import { useDateGroups, type DateGroup } from './useDateGroups'
import { formatDate, getAreaName, getBlockImage, sortBlockIds, readCart, writeCart } from './cartHelpers'

interface BookingDetailsData {
  reason: string
  className?: string
  teacher?: string
}

interface CartListProps {
  cart: CartItem[]
  onQuantityChange: (itemId: string, newQuantity: number) => void
  onRemoveItem: (itemId: string, startDate?: string, endDate?: string) => void
  bookingDetails: Record<string, BookingDetailsData>
  onBookingDetailsChange: (groupKey: string, data: BookingDetailsData) => void
  expiredDateKeys?: string[]
  selectedGroups?: Set<string>
  onSelectedGroupsChange?: (selectedGroups: Set<string>) => void
}

const CartList: React.FC<CartListProps> = ({ cart, onQuantityChange, onRemoveItem, bookingDetails, onBookingDetailsChange, expiredDateKeys = [], selectedGroups: externalSelectedGroups, onSelectedGroupsChange }) => {
  const navigate = useNavigate()
  const { getOriginalQuantity, getCartQuantity } = useCart()
  const { ConfirmDialog } = useConfirmDialog()

  // 只展開第一個日期組
  const [expandedEquipment, setExpandedEquipment] = useState<Set<string>>(new Set())
  const [expandedSpace, setExpandedSpace] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)
  // 追蹤正在刪除的項目
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set())
  // 追蹤選中的訂單組 - 如果外部傳入則使用外部狀態，否則使用內部狀態
  const [internalSelectedGroups, setInternalSelectedGroups] = useState<Set<string>>(new Set())
  const selectedGroups = externalSelectedGroups !== undefined ? externalSelectedGroups : internalSelectedGroups
  const setSelectedGroups = (newSelectedGroups: Set<string>) => {
    if (externalSelectedGroups !== undefined && onSelectedGroupsChange) {
      onSelectedGroupsChange(newSelectedGroups)
    } else {
      setInternalSelectedGroups(newSelectedGroups)
    }
  }
  // BookingDetails Dialog 狀態
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [currentEditingGroup, setCurrentEditingGroup] = useState<string | null>(null)
  const [currentBookingType, setCurrentBookingType] = useState<'little' | 'mass-personal' | 'mass-group'>('little')

  // DateEdit Dialog 狀態
  const [isDateEditDialogOpen, setIsDateEditDialogOpen] = useState(false)
  const [editingDateGroup, setEditingDateGroup] = useState<{
    startDate: string
    endDate: string
    dateKey: string
    category: 'equipment' | 'space'
    bookingType: 'little' | 'mass-personal' | 'mass-group'
  } | null>(null)

  // 圖片預覽狀態
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // 按日期和類別分組（空間優先、日期較早優先）
  const dateGroups = useDateGroups(cart)

  // 初次載入時自動展開第一組
  useEffect(() => {
    if (initialized || dateGroups.length === 0) return
    const first = dateGroups[0]
    const firstKey = `${first.category}_${first.startDate}_${first.endDate}`
    if (first.category === 'equipment') {
      setExpandedEquipment(new Set([firstKey]))
    } else {
      setExpandedSpace(new Set([firstKey]))
    }
    setInitialized(true)
  }, [dateGroups, initialized])

  // 切換 Equipment 展開狀態
  const toggleEquipment = (key: string) => {
    setExpandedEquipment(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // 切換 Space 展開狀態
  const toggleSpace = (key: string) => {
    setExpandedSpace(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // 處理刪除項目（帶淡出動畫）
  const handleRemoveItem = (itemId: string, startDate: string, endDate: string) => {
    const uniqueKey = `${itemId}_${startDate}_${endDate}`
    // 標記為正在刪除
    setRemovingItems(prev => new Set(prev).add(uniqueKey))

    // 300ms 後實際刪除
    setTimeout(() => {
      onRemoveItem(itemId, startDate, endDate)
      setRemovingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(uniqueKey)
        return newSet
      })
    }, 300)
  }

  // 處理圖片點擊 - 顯示大圖
  const handleImageClick = (e: React.MouseEvent, imageSrc: string) => {
    e.stopPropagation()
    setPreviewImage(imageSrc)
  }

  // 處理編輯日期
  const handleEditDate = (startDate: string, endDate: string, dateKey: string, category: 'equipment' | 'space', bookingType: 'little' | 'mass-personal' | 'mass-group') => {
    setEditingDateGroup({ startDate, endDate, dateKey, category, bookingType })
    setIsDateEditDialogOpen(true)
  }

  // 確認編輯日期
  const handleConfirmDateEdit = (newStartDate: string, newEndDate: string) => {
    if (!editingDateGroup) return

    const { dateKey, category } = editingDateGroup

    // 更新購物車中該時段和類別的所有項目
    const currentCart = readCart()
    const updatedCart = currentCart.map((item: CartItem) => {
      const itemDateKey = `${item.startDate}_${item.endDate}`
      const itemCategory = item.category === 'equipment' ? 'equipment' : 'space'

      if (itemDateKey === dateKey && itemCategory === category) {
        return {
          ...item,
          startDate: newStartDate,
          endDate: newEndDate
        }
      }
      return item
    })

    // 保存到 localStorage
    writeCart(updatedCart)

    // 關閉對話框
    setIsDateEditDialogOpen(false)
    setEditingDateGroup(null)
  }

  // 處理 Add More - 導航到對應頁面
  const handleAddMore = (category: 'space' | 'equipment', startDate: string, endDate: string, bookingType: BookingType) => {
    // 使用 URL 參數傳遞鎖定信息
    const params = new URLSearchParams({
      startDate,
      endDate,
      bookingType: bookingType || 'little'
    })

    if (category === 'space') {
      navigate(`/space?${params.toString()}`, { state: { from: 'cart' } })
    } else {
      navigate(`/equipment?${params.toString()}`, { state: { from: 'cart' } })
    }
  }

  // 檢查是否達到小量限制（9件）
  const isLittleBookingLimitReached = (group: DateGroup): boolean => {
    if (group.items.length === 0) return false

    const bookingType = group.items[0].bookingType || 'little'

    // 只有小量才有 9 件限制
    if (bookingType !== 'little') return false

    // 需要檢查同一時段所有組的總數（設備+空間）
    const dateKey = `${group.startDate}_${group.endDate}`
    const allGroupsInSamePeriod = dateGroups.filter(g => `${g.startDate}_${g.endDate}` === dateKey)

    const totalInPeriod = allGroupsInSamePeriod.reduce((sum, g) => {
      return sum + (g.category === 'equipment'
        ? g.items.reduce((s: number, item: CartItem) => s + item.quantity, 0)
        : g.items.length)
    }, 0)

    return totalInPeriod >= 9
  }

  return (
    <div className="w-full">
      {cart.length === 0 && (
        <div className="empty-message-container">
          <p className="text-header text-white tracking-wide font-['Noto_Sans_TC',_sans-serif]">
            此清單是空的，快去租借吧！
          </p>
        </div>
      )}

      {dateGroups.map((group) => {
        const groupKey = `${group.category}_${group.startDate}_${group.endDate}`
        const dateKey = `${group.startDate}_${group.endDate}`
        const isExpanded = group.category === 'equipment'
          ? expandedEquipment.has(groupKey)
          : expandedSpace.has(groupKey)

        // 檢查該時段是否過期
        const isExpired = expiredDateKeys.includes(dateKey)

        // 計算該組的押金（應用上限）
        const groupDeposit = Math.min(
          group.items.reduce((sum: number, item: CartItem) => {
            return sum + (group.category === 'equipment' ? item.deposit * item.quantity : item.deposit)
          }, 0),
          5000
        )

        // 取得該組的租借類型
        const bookingType = group.items.length > 0 ? (group.items[0].bookingType || 'little') : 'little'

        // 根據 booking type 和 category 顯示標籤
        const getCategoryLabel = () => {
          if (group.category === 'space') {
            return { en: 'Space', zh: '空間' }
          } else {
            return { en: 'Equipment', zh: '設備' }
          }
        }
        const categoryLabel = getCategoryLabel()

        const getBookingTypeLabel = () => {
          if (group.category === 'space') {
            // 空間：個人/團體
            if (bookingType === 'little') {
              return { en: 'Personal', zh: '個人' }
            } else {
              return { en: 'Group', zh: '團體' }
            }
          } else {
            // 設備：小量/大量
            if (bookingType === 'little') {
              return { en: 'Light', zh: '小量' }
            } else {
              return { en: 'Mass', zh: '大量' }
            }
          }
        }
        const bookingTypeLabel = getBookingTypeLabel()

        // 計算實際數量總和
        const getTotalItemCount = () => {
          // 將所有項目的 quantity 加總
          return group.items.reduce((sum, item) => sum + item.quantity, 0)
        }

        const isSelected = selectedGroups.has(groupKey)

        return (
          <div key={groupKey} className="mb-8">
            {/* 第一行：Checkbox + 時間 + 押金 + Chevron */}
            <div className="flex items-center gap-3">
              {/* Checkbox - 过期订单也可以被选中用于删除 */}
              <button
                onClick={() => {
                  const newSelected = new Set(selectedGroups)
                  if (isSelected) {
                    newSelected.delete(groupKey)
                  } else {
                    newSelected.add(groupKey)
                  }
                  setSelectedGroups(newSelected)
                }}
                className="flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                aria-label={isSelected ? '取消選取' : '選取'}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '24px', color: isSelected ? '#00ff80' : '#cccccc' }}
                >
                  {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                </span>
              </button>

              {/* 時間 */}
              <h3 className={`font-['Inter',_sans-serif] text-medium-title ${isExpired ? 'text-gray-scale4' : 'text-white'}`}>
                {formatDate(group.startDate)} - {formatDate(group.endDate)} ({getTotalItemCount()})
              </h3>

              {/* 押金（應用上限） */}
              <span className={`font-['Inter',_sans-serif] text-medium-title ml-auto ${isExpired ? 'text-gray-scale4' : 'text-white'}`}>
                NT$ {groupDeposit.toLocaleString()}
              </span>

              {/* Chevron 按鈕 */}
              <button
                onClick={() => {
                  if (group.category === 'equipment') {
                    toggleEquipment(groupKey)
                  } else {
                    toggleSpace(groupKey)
                  }
                }}
                className="flex items-center justify-center cursor-pointer"
              >
                <span
                  className={`material-icons transition-transform text-[30px] ${isExpanded ? 'rotate-180' : ''} ${isExpired ? 'text-gray-scale4' : 'text-white'}`}
                  style={{ fontSize: '30px' }}
                >
                  expand_more
                </span>
              </button>
            </div>

            {/* 第二行：Tags + 填寫資訊按鈕 + Add 按鈕 */}
            <div className="flex items-center gap-3 py-4 pl-9">
              {/* 類別標籤 (SPC 空間 / EQPT 設備) */}
              <div className="px-3 py-1 bg-gray-scale4 flex items-center justify-center rounded-lg">
                <span className={`font-['Inter',_sans-serif] text-tiny whitespace-nowrap ${isExpired ? 'text-gray-scale2' : 'text-white'}`}>
                  {categoryLabel.en}{' '}
                  <span className="font-['Noto_Sans_TC',_sans-serif]">{categoryLabel.zh}</span>
                </span>
              </div>

              {/* 租借類型標籤 (個人/團體 或 小量/大量) */}
              <div className="px-3 py-1 bg-gray-scale4 flex items-center justify-center rounded-lg">
                <span className={`font-['Inter',_sans-serif] text-tiny whitespace-nowrap ${isExpired ? 'text-gray-scale2' : 'text-white'}`}>
                  {bookingTypeLabel.en}{' '}
                  <span className="font-['Noto_Sans_TC',_sans-serif]">{bookingTypeLabel.zh}</span>
                </span>
              </div>

              {/* 操作按鈕群組 - 靠右對齊 */}
              <div className="ml-auto flex items-center gap-3">
                {/* 填寫狀態按鈕 */}
                <button
                  onClick={() => {
                    setCurrentEditingGroup(dateKey)
                    setCurrentBookingType(bookingType)
                    setIsDetailsDialogOpen(true)
                  }}
                  disabled={isExpired}
                  className={`pl-2 pr-3 py-1 flex items-center justify-center gap-1 transition-colors rounded-lg ${
                    isExpired
                      ? 'bg-gray-scale4 cursor-not-allowed'
                      : bookingDetails[dateKey]
                      ? 'bg-[#00ff80] hover:bg-[#00e070] cursor-pointer'
                      : 'bg-[#ffff00] hover:bg-[#e6e600] cursor-pointer'
                  }`}
                >
                  <span className={`material-icons text-[20px] ${isExpired ? 'text-gray-scale2' : 'text-black'}`} style={{ fontSize: '20px' }}>
                    {bookingDetails[dateKey] ? 'check' : 'edit'}
                  </span>
                  <span className={`text-tiny whitespace-nowrap ${isExpired ? 'text-gray-scale2' : 'text-black'}`}>
                    {bookingDetails[dateKey] ? (
                      <><span className="font-['Inter',_sans-serif]">Filled</span> <span className="font-['Noto_Sans_TC',_sans-serif]">資訊已填</span></>
                    ) : (
                      <><span className="font-['Inter',_sans-serif]">Details</span> <span className="font-['Noto_Sans_TC',_sans-serif]">借用資訊</span></>
                    )}
                  </span>
                </button>

                {/* Add 按鈕 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddMore(group.category, group.startDate, group.endDate, bookingType)
                  }}
                  disabled={isLittleBookingLimitReached(group) || isExpired}
                  className={`pl-2 pr-3 py-1 flex items-center justify-center gap-1 border transition-colors rounded-lg ${
                    isLittleBookingLimitReached(group) || isExpired
                      ? 'border-gray-scale4 text-gray-scale4 cursor-not-allowed'
                      : 'border-white text-white hover:bg-white hover:text-black cursor-pointer'
                  }`}
                >
                  <span className="material-icons text-[20px]" style={{ fontSize: '20px' }}>add</span>
                  <span className="font-['Inter',_sans-serif] text-tiny whitespace-nowrap">Add</span>
                  <span className="font-['Noto_Sans_TC',_sans-serif] text-tiny whitespace-nowrap">新增</span>
                </button>
              </div>
            </div>

            {/* 第三行：過期提示 + 編輯日期按鈕（僅過期時顯示） */}
            {isExpired && (
              <div className="flex items-center justify-between py-2 px-4 ml-9 mb-4 bg-[#ffff00] rounded-lg">
                <span className="text-tiny text-black">
                  <span className="font-['Inter',_sans-serif]">Some orders have expired dates, please click Edit to update</span>
                  {' '}
                  <span className="font-['Noto_Sans_TC',_sans-serif]">部分訂單日期已過期，請點擊 Edit 編輯日期</span>
                </span>
                <button
                  onClick={() => handleEditDate(group.startDate, group.endDate, dateKey, group.category, bookingType)}
                  className="text-small-title font-medium text-black hover:opacity-70 transition-opacity cursor-pointer whitespace-nowrap"
                >
                  <span className="font-['Inter',_sans-serif]">Edit</span> <span className="font-['Noto_Sans_TC',_sans-serif]">編輯日期</span>
                </button>
              </div>
            )}

            {/* 項目列表 - 只有展開時顯示 */}
            {isExpanded && (
              <div className="pl-9">
                {group.category === 'space' ? (
                  // Space 項目渲染
                  (() => {
                    // 分組處理：將 space-block 按區域分組，教室保持獨立
                    const classrooms: CartItem[] = []
                    const blocksByArea: Record<string, CartItem[]> = {}

                    group.items.forEach(item => {
                      if (item.category === 'classroom') {
                        classrooms.push(item)
                      } else if (item.category === 'space-block') {
                        const blockData = mockAreaBlocksData[item.id]
                        const area = blockData?.area || 'unknown'
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
                      const areaGroupKey = `${area}_${blockIds.join('_')}`

                      // 檢查是否有任何區塊正在被刪除
                      const isRemoving = blocks.some(b => removingItems.has(`${b.id}_${group.startDate}_${group.endDate}`))

                      renderedItems.push(
                        <div
                          key={areaGroupKey}
                          className={`grid grid-cols-[80px_1fr_120px_40px] gap-6 py-3 border-b border-[#7c7c7c] items-center transition-opacity duration-300 ${
                            isRemoving ? 'opacity-0' : 'opacity-100'
                          }`}
                        >
                          {/* 縮圖 */}
                          <div
                            className="w-[80px] h-[80px] flex-shrink-0 overflow-hidden cursor-pointer rounded-lg"
                            onClick={(e) => handleImageClick(e, displayImage)}
                          >
                            <img
                              src={displayImage}
                              alt={areaName}
                              className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                            />
                          </div>

                          {/* 名稱（區域 + 所有編號） */}
                          <div className="font-['Noto_Sans_TC',_sans-serif] text-small-title text-white">
                            {areaName}（{blockIds.join('、')}）
                          </div>

                          {/* 押金（總和） */}
                          <div className="font-['Inter',_sans-serif] text-small-title text-white text-center">
                            NT$ {totalDeposit.toLocaleString()}
                          </div>

                          {/* 刪除按鈕 - 一次刪除該區域所有區塊 */}
                          <button
                            onClick={() => {
                              // 刪除該區域的所有區塊
                              blocks.forEach(block => handleRemoveItem(block.id, group.startDate, group.endDate))
                            }}
                            className="font-['Inter',_sans-serif] text-small-title text-white hover:text-gray-scale1 transition-colors cursor-pointer"
                            title={`移除 ${areaName} 所有區塊`}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })

                    // 再渲染教室
                    classrooms.forEach(item => {
                      const isRemoving = removingItems.has(`${item.id}_${group.startDate}_${group.endDate}`)

                      renderedItems.push(
                        <div
                          key={item.id}
                          className={`grid grid-cols-[80px_1fr_120px_40px] gap-6 py-3 border-b border-[#7c7c7c] items-center transition-opacity duration-300 ${
                            isRemoving ? 'opacity-0' : 'opacity-100'
                          }`}
                        >
                          {/* 縮圖 */}
                          <div
                            className="w-[80px] h-[80px] flex-shrink-0 overflow-hidden cursor-pointer rounded-lg"
                            onClick={(e) => handleImageClick(e, item.image)}
                          >
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                            />
                          </div>

                          {/* 名稱 */}
                          <div className="font-['Noto_Sans_TC',_sans-serif] text-small-title text-white">
                            {item.name}
                          </div>

                          {/* 押金 */}
                          <div className="font-['Inter',_sans-serif] text-small-title text-white text-center">
                            NT$ 5,000
                          </div>

                          {/* 刪除按鈕 */}
                          <button
                            onClick={() => handleRemoveItem(item.id, group.startDate, group.endDate)}
                            className="font-['Inter',_sans-serif] text-small-title text-white hover:text-gray-scale1 transition-colors cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })

                    return renderedItems
                  })()
                ) : (
                  // Equipment 項目渲染
                  group.items.map(item => {
                    const isRemoving = removingItems.has(`${item.id}_${group.startDate}_${group.endDate}`)
                    // 計算這個設備的最大可用數量
                    // 總庫存 - (購物車中所有相同設備的數量 - 當前這個項目的數量)
                    const totalStock = getOriginalQuantity(item.id)
                    const otherItemsQty = getCartQuantity(item.id) - item.quantity
                    const maxQtyForThisItem = totalStock - otherItemsQty

                    // 檢查小量訂單 9 件限制
                    const bookingType = item.bookingType || 'little'
                    let canIncrementByLimit = true
                    if (bookingType === 'little') {
                      // 計算同一時段的總數量
                      const dateKey = `${group.startDate}_${group.endDate}`
                      const allGroupsInSamePeriod = dateGroups.filter(g => `${g.startDate}_${g.endDate}` === dateKey)

                      let totalInPeriod = 0
                      allGroupsInSamePeriod.forEach(g => {
                        const gBookingType = g.items.length > 0 ? (g.items[0].bookingType || 'little') : 'little'
                        if (gBookingType === 'little') {
                          if (g.category === 'equipment') {
                            totalInPeriod += g.items.reduce((s: number, i: CartItem) => s + i.quantity, 0)
                          } else {
                            totalInPeriod += g.items.length
                          }
                        }
                      })

                      // 如果已經達到 9 件，禁止增加
                      if (totalInPeriod >= 9) {
                        canIncrementByLimit = false
                      }
                    }

                    const canIncrement = item.quantity < maxQtyForThisItem && canIncrementByLimit

                    // 判斷是否完全缺貨（當前數量超過最大可用數量）
                    const isOutOfStock = item.quantity > maxQtyForThisItem

                    return (
                      <div
                        key={item.id}
                        className={`grid grid-cols-[80px_1fr_140px_120px_40px] gap-6 py-3 border-b border-[#7c7c7c] items-center transition-opacity duration-300 ${
                          isRemoving ? 'opacity-0' : 'opacity-100'
                        } ${isOutOfStock ? 'opacity-50' : ''}`}
                      >
                        {/* 縮圖 */}
                        <div
                          className="w-[80px] h-[80px] flex-shrink-0 overflow-hidden cursor-pointer rounded-lg"
                          onClick={(e) => handleImageClick(e, item.image)}
                        >
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                          />
                        </div>

                        {/* 名稱和庫存狀態 */}
                        <div className="flex flex-col gap-1">
                          <div className="font-['Noto_Sans_TC',_sans-serif] text-small-title text-white">
                            {item.name}
                          </div>
                          {/* 只在完全缺貨（灰色狀態）時顯示錯誤訊息 */}
                          {isOutOfStock && (
                            <div className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-tiny text-[#ff448a]">
                                error
                              </span>
                              <span className="font-['Inter',_sans-serif] text-tiny text-[#ff448a]">
                                Out of Stock{' '}
                                <span className="font-['Noto_Sans_TC',_sans-serif]">缺貨</span>
                                {' '}(Available: {maxQtyForThisItem})
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 數量調整 */}
                        <div className="flex items-center justify-center gap-4">
                          <button
                            onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1 || isOutOfStock}
                            className={`font-['Inter',_sans-serif] text-small-title transition-colors ${
                              item.quantity <= 1 || isOutOfStock
                                ? 'text-gray-scale4 cursor-not-allowed'
                                : 'text-white hover:text-gray-scale1 cursor-pointer'
                            }`}
                          >
                            -
                          </button>
                          <span className="font-['Inter',_sans-serif] text-small-title text-white w-8 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                            disabled={!canIncrement}
                            className={`font-['Inter',_sans-serif] text-small-title transition-colors ${
                              !canIncrement
                                ? 'text-gray-scale4 cursor-not-allowed'
                                : 'text-white hover:text-gray-scale1 cursor-pointer'
                            }`}
                          >
                            +
                          </button>
                        </div>

                        {/* 押金 */}
                        <div className="font-['Inter',_sans-serif] text-small-title text-white text-center">
                          NT$ {(item.deposit * item.quantity).toLocaleString()}
                        </div>

                        {/* 刪除按鈕 */}
                        <button
                          onClick={() => handleRemoveItem(item.id, group.startDate, group.endDate)}
                          className="font-['Inter',_sans-serif] text-small-title text-white hover:text-gray-scale1 transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* 圖片預覽 Modal - 與 EquipmentGrid 相同樣式 */}
      {previewImage && createPortal(
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center py-20"
          onClick={() => setPreviewImage(null)}
        >
          {/* 關閉按鈕 */}
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-20 right-8 text-white text-4xl font-light hover:text-gray-scale2 transition-colors cursor-pointer z-10"
            aria-label="關閉"
          >
            ×
          </button>

          {/* 圖片 */}
          <img
            src={previewImage}
            alt="設備圖片"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

      {/* 確認對話框 */}
      <ConfirmDialog />

      {/* 借用資訊對話框 */}
      <BookingDetailsDialog
        isOpen={isDetailsDialogOpen}
        bookingType={currentBookingType}
        initialData={currentEditingGroup ? bookingDetails[currentEditingGroup] : undefined}
        onConfirm={(data) => {
          if (currentEditingGroup) {
            onBookingDetailsChange(currentEditingGroup, data)
          }
          setIsDetailsDialogOpen(false)
          setCurrentEditingGroup(null)
        }}
        onCancel={() => {
          setIsDetailsDialogOpen(false)
          setCurrentEditingGroup(null)
        }}
      />

      {/* 日期編輯對話框 */}
      {editingDateGroup && (
        <DateEditDialog
          isOpen={isDateEditDialogOpen}
          currentStartDate={editingDateGroup.startDate}
          currentEndDate={editingDateGroup.endDate}
          bookingType={editingDateGroup.bookingType}
          category={editingDateGroup.category}
          onConfirm={handleConfirmDateEdit}
          onCancel={() => {
            setIsDateEditDialogOpen(false)
            setEditingDateGroup(null)
          }}
        />
      )}
    </div>
  )
}

export default CartList
