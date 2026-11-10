/**
 * Cart List 組件
 * 按照租借日期分組顯示購物車項目
 */

import { BTN, BTN_OUTLINE, CHIP, TAP } from '@/components/common/btn'
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import type { CartItem, BookingType } from '../../types/equipment'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../contexts/AuthContext'
import { useItemImages, useItemName } from '../../services/equipmentService'
import { useConfirmDialog } from '../../hooks/useConfirmDialog'
import BookingDetailsDialog, { type BookingDetailsData } from '../common/BookingDetailsDialog'
import DateEditDialog from './DateEditDialog'
import { useDateGroups, type DateGroup } from './useDateGroups'
import { formatDate, getBlockArea, getBlockImage, sortBlockIds, readCart, writeCart } from './cartHelpers'
import { useAreaName } from '../../services/contentService'
import { useT } from '../../stores/langStore'
import Collapse from '../common/Collapse'
import { calcBundles, type Bundle } from '../../utils/bundleUtils'
import { isSophomoreOrAbove } from '../../utils/gradeUtils'

interface CartListProps {
  cart: CartItem[]
  onQuantityChange: (itemId: string, newQuantity: number) => void
  onRemoveItem: (itemId: string, startDate?: string, endDate?: string) => void
  bookingDetails: Record<string, BookingDetailsData>
  onBookingDetailsChange: (groupKey: string, data: BookingDetailsData) => void
  expiredDateKeys?: string[]
  selectedGroups?: Set<string>
  onSelectedGroupsChange?: (selectedGroups: Set<string>) => void
  /** 選取模式：顯示每組左側的圓圈（點「選取」才進入，用來清除） */
  selectMode?: boolean
  /** 該品項時段已被他人訂單佔用的量（含 On Hold，useCartReserved） */
  getReserved?: (item: CartItem) => number
}

const CartList: React.FC<CartListProps> = ({ cart, onQuantityChange, onRemoveItem, bookingDetails, onBookingDetailsChange, expiredDateKeys = [], selectedGroups: externalSelectedGroups, onSelectedGroupsChange, selectMode = false, getReserved = () => 0 }) => {
  const t = useT()
  const itemName = useItemName()
  const areaLabel = useAreaName()
  const navigate = useNavigate()
  const { isAuthenticated, currentUser } = useAuth()
  const { getOriginalQuantity, getCartQuantity, bundles } = useCart()
  // 加入購物車時存的是當下的圖片網址；顯示一律用後台最新的（含已下架／關閉的）
  const images = useItemImages()
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
      navigate(`/space?${params.toString()}`)
    } else {
      navigate(`/equipment?${params.toString()}`)
    }
  }

  // 檢查是否達到小量限制（9件）：僅小量設備組，只計本組（設備／空間分單，空間由押金 cap 限量）
  // 該品項此時段最多可借（同型錄「可借數量」）：庫存 − 他人訂單佔用 − 購物車其他時段的同設備
  const maxQtyOf = (item: CartItem) =>
    getOriginalQuantity(item.id) - getReserved(item) - (getCartQuantity(item.id) - item.quantity)

  // 組合缺貨時：拆開＝缺貨零件減到可借數量（組合拆散、照單件計）；整組移除＝扣掉這個組合的所有零件
  const fixBundle = (group: DateGroup, set: { bundle: Bundle; count: number }, mode: 'split' | 'remove') => {
    const next = readCart()
      .map((i: CartItem) => {
        if (i.category !== 'equipment' || i.startDate !== group.startDate || i.endDate !== group.endDate) return i
        const part = set.bundle.items.find(c => c.equipmentId === i.id)
        if (!part) return i
        if (mode === 'remove') return { ...i, quantity: i.quantity - set.count * part.quantity }
        return i.quantity > maxQtyOf(i) ? { ...i, quantity: Math.max(0, maxQtyOf(i)) } : i
      })
      .filter((i: CartItem) => i.quantity > 0)
    writeCart(next)
  }

  // 件數套用組合（湊滿一組算 1 件）；可傳 +1 後的品項判斷「再加一個會不會超過」
  const isLittleBookingLimitReached = (group: DateGroup, items: CartItem[] = group.items, limit = 9): boolean =>
    group.category === 'equipment' &&
    (group.items[0]?.bookingType || 'little') === 'little' &&
    calcBundles(items, bundles).units >= limit

  return (
    <div className="w-full">
      {cart.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] pointer-events-none">
          <p className="text-sm text-white">
            {t('This list is empty.', '此清單是空的。')}
            {/* 訪客導去登入頁（登入後預設落在型錄）；已登入直接去型錄。容器 pointer-events: none，連結要自己開回來 */}
            <Link to={isAuthenticated ? '/catalog' : '/'} className="ml-1 underline underline-offset-4 hover:opacity-50 pointer-events-auto">
              {isAuthenticated ? t('Start renting', '開始租借') : t('Log in to start renting', '登入以開始租借')}
            </Link>
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

        // 計算該組的押金（設備套用組合：湊滿一組只收一組；應用上限）
        const bundleCalc = group.category === 'equipment' ? calcBundles(group.items, bundles) : null
        const rawDeposit = bundleCalc ? bundleCalc.deposit : group.items.reduce((sum: number, item: CartItem) => sum + item.deposit, 0)
        const groupDeposit = bookingDetails[groupKey]?.asTeacher ? 0 : Math.min(rawDeposit, 5000) // 老師名義免押金；上限不放寬，新增鈕照 rawDeposit 判斷

        // 取得該組的租借類型
        const bookingType = group.items.length > 0 ? (group.items[0].bookingType || 'little') : 'little'

        // 新增鈕停用：小量 9 件滿、過期，或押金即時擋已滿（同 useCart.checkDepositLimit：空間個人／小量設備；
        // 團體與大量設備結算才 cap，不擋）。停用時不跳 toast
        // ponytail: 押金滿 5000 後押金 0 元的設備理論上還能加，但一律停用，少見到不值得特判
        const isAddDisabled = isLittleBookingLimitReached(group) || isExpired ||
          (bookingType !== 'mass-group' && (group.category === 'space' || bookingType === 'little') && rawDeposit >= 5000)

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
          // 選取模式：整組 padding 緩動右移 36px，圓圈從左側淡入（絕對定位在讓出的空間）
          <div key={groupKey} className={`mb-8 transition-[padding] duration-300 ease-in-out ${selectMode ? 'pl-9' : 'pl-0'}`}>
            {/* 第一行：Checkbox（僅選取模式）+ 時間 + 押金 + Chevron */}
            <div className="relative flex items-center gap-3 max-md:flex-wrap max-md:gap-y-0">
              {/* Checkbox - 過期訂單也可以被選中用於刪除；invisible 讓隱藏時不能點也不能 tab 到 */}
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
                className={`absolute -left-9 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer transition-[opacity,visibility] duration-300 ease-in-out ${selectMode ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                aria-label={isSelected ? '取消選取' : '選取'}
              >
                <span
                  className="material-symbols-outlined hover:opacity-50"
                  style={{ fontSize: '24px', color: isSelected ? 'var(--color-green)' : 'var(--color-gray-light)' }}
                >
                  {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                </span>
              </button>

              {/* 時間 */}
              <h3 className={`font-english text-xl max-md:text-md max-md:flex-1 max-md:order-1 ${isExpired ? 'text-gray-mid' : 'text-white'}`}>
                {formatDate(group.startDate)} - {formatDate(group.endDate)} ({getTotalItemCount()})
              </h3>

              {/* 押金（應用上限） */}
              <span className={`font-english text-xl ml-auto max-md:text-md max-md:ml-0 max-md:basis-full max-md:order-3 ${isExpired ? 'text-gray-mid' : 'text-white'}`}>
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
                className={`flex items-center justify-center max-md:order-2 ${BTN}`}
              >
                <span
                  className={`material-symbols-outlined transition-transform duration-300 text-xl ${isExpanded ? 'rotate-180' : ''} ${isExpired ? 'text-gray-mid' : 'text-white'}`}
                  style={{ fontSize: '30px' }}
                >
                  expand_more
                </span>
              </button>
            </div>

            {/* 第二行：Tags + 填寫資訊按鈕 + Add 按鈕 */}
            <div className="flex flex-wrap items-center gap-3 py-4">
              {/* 類別標籤 (SPC 空間 / EQPT 設備) */}
              <span className={`${CHIP} bg-gray-dark ${isExpired ? 'text-gray-light' : 'text-white'}`}>
                {t(categoryLabel.en, categoryLabel.zh)}
              </span>

              {/* 租借類型標籤 (個人/團體 或 小量/大量) */}
              <span className={`${CHIP} bg-gray-dark ${isExpired ? 'text-gray-light' : 'text-white'}`}>
                {t(bookingTypeLabel.en, bookingTypeLabel.zh)}
              </span>

              {/* 湊成的組合（押金以組計、算 1 件）；組合名稱只有後台填的中文。
                  零件缺貨（別人先送出）時變黃，讓使用者選拆開或整組不借 */}
              {bundleCalc?.sets.map(s => {
                const short = isExpired ? [] : s.bundle.items
                  .map(c => group.items.find(i => i.id === c.equipmentId))
                  .filter((i): i is CartItem => !!i && i.quantity > maxQtyOf(i))
                const color = short.length > 0 ? 'var(--color-yellow)' : 'var(--color-green)'
                return (
                  <div key={s.bundle.id} className={`${CHIP} !pl-1.5 gap-1 border`} style={{ borderColor: color }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color }}>inventory_2</span>
                    <span className="whitespace-nowrap" style={{ color }}>
                      {itemName(s.bundle.id, s.bundle.name)} ×{s.count}
                      {short.length > 0 && `：${short.map(i => i.name).join('、')}${t(' out of stock', '庫存不足')}`}
                    </span>
                    {short.length > 0 && (
                      <>
                        <button
                          onClick={() => fixBundle(group, s, 'split')}
                          title={t('Reduce the short parts to what is available; the rest is charged per item', '缺貨的零件減到可借數量，其餘照單件計')}
                          className={`ml-2 text-yellow underline underline-offset-2 whitespace-nowrap ${BTN}`}
                        >
                          {t('Split', '拆開')}
                        </button>
                        <button
                          onClick={() => fixBundle(group, s, 'remove')}
                          className={`ml-2 text-yellow underline underline-offset-2 whitespace-nowrap ${BTN}`}
                        >
                          {t('Remove set', '整組移除')}
                        </button>
                      </>
                    )}
                  </div>
                )
              })}

              {/* 操作按鈕群組 - 靠右對齊 */}
              <div className="ml-auto flex items-center gap-3">
                {/* 填寫狀態按鈕 */}
                <button
                  onClick={() => {
                    setCurrentEditingGroup(groupKey) // 借用資訊每張訂單各填（設備／空間分單）
                    setCurrentBookingType(bookingType)
                    setIsDetailsDialogOpen(true)
                  }}
                  disabled={isExpired}
                  className={`pl-2 pr-3 py-1 flex items-center justify-center gap-1 rounded-lg ${bookingDetails[groupKey] ? 'bg-green' : 'bg-yellow'} ${BTN}`}
                >
                  <span className={`material-symbols-outlined text-md ${isExpired ? 'text-gray-light' : 'text-black'}`} style={{ fontSize: '20px' }}>
                    {bookingDetails[groupKey] ? 'check' : 'description'}
                  </span>
                  <span className={`text-xs whitespace-nowrap ${isExpired ? 'text-gray-light' : 'text-black'}`}>
                    {bookingDetails[groupKey] ? (
                      <>{t('Filled', '資訊已填')}</>
                    ) : (
                      <>{t('Details', '借用資訊')}</>
                    )}
                  </span>
                </button>

                {/* Add 按鈕 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddMore(group.category, group.startDate, group.endDate, bookingType)
                  }}
                  disabled={isAddDisabled}
                  className={`pl-2 pr-3 py-1 flex items-center justify-center gap-1 rounded-lg ${BTN_OUTLINE}`}
                >
                  <span className="material-symbols-outlined text-md" style={{ fontSize: '20px' }}>add</span>
                  <span className="text-xs whitespace-nowrap">{t('Add', '新增')}</span>
                </button>
              </div>
            </div>

            {/* 第三行：過期提示 + 鉛筆改日期（僅過期時顯示） */}
            {isExpired && (
              <div className={`flex items-center justify-between py-1 pl-4 pr-1 mb-4 bg-yellow rounded-lg`}>
                <span className="text-xs text-black">{t('Dates expired, please reselect', '日期已過期，請重新選擇')}</span>
                <button
                  onClick={() => handleEditDate(group.startDate, group.endDate, dateKey, group.category, bookingType)}
                  aria-label={t('Edit Date', '編輯日期')}
                  title={t('Edit Date', '編輯日期')}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-black hover:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
                </button>
              </div>
            )}

            {/* 項目列表 - 展開時往下滑開 */}
            <Collapse open={isExpanded}>
              <div>
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

                      const areaName = areaLabel(area)
                      const displayImage = images[blocks[0].id] || getBlockImage(blocks[0].id)
                      const blockIds = sortBlockIds(blocks.map(b => b.id))
                      const totalDeposit = blocks.reduce((sum, b) => sum + b.deposit, 0)
                      const areaGroupKey = `${area}_${blockIds.join('_')}`

                      // 檢查是否有任何區塊正在被刪除
                      const isRemoving = blocks.some(b => removingItems.has(`${b.id}_${group.startDate}_${group.endDate}`))

                      renderedItems.push(
                        <div
                          key={areaGroupKey}
                          className={`grid grid-cols-[80px_1fr_120px_40px] max-md:grid-cols-[64px_1fr_auto] gap-6 max-md:gap-x-3 max-md:gap-y-1 py-3 border-b border-gray-mid items-center transition-opacity duration-300 ${
                            isRemoving ? 'opacity-0' : 'opacity-100'
                          }`}
                        >
                          {/* 縮圖 */}
                          <div
                            className="w-[80px] h-[80px] max-md:w-16 max-md:h-16 max-md:row-span-2 flex-shrink-0 overflow-hidden cursor-pointer rounded-lg"
                            onClick={(e) => handleImageClick(e, displayImage)}
                          >
                            <img
                              src={displayImage}
                              alt={areaName}
                              className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                            />
                          </div>

                          {/* 名稱（區域 + 所有編號） */}
                          <div className="font-chinese text-sm text-white">
                            {areaName}（{blockIds.join('、')}）
                          </div>

                          {/* 押金（總和） */}
                          <div className="font-english text-sm text-white text-center max-md:col-start-2 max-md:col-span-2 max-md:row-start-2 max-md:text-left">
                            NT$ {totalDeposit.toLocaleString()}
                          </div>

                          {/* 刪除按鈕 - 一次刪除該區域所有區塊 */}
                          <button
                            onClick={() => {
                              // 刪除該區域的所有區塊
                              blocks.forEach(block => handleRemoveItem(block.id, group.startDate, group.endDate))
                            }}
                            className={`font-english text-sm text-white max-md:col-start-3 max-md:row-start-1 max-md:justify-self-end ${TAP} ${BTN}`}
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
                          className={`grid grid-cols-[80px_1fr_120px_40px] max-md:grid-cols-[64px_1fr_auto] gap-6 max-md:gap-x-3 max-md:gap-y-1 py-3 border-b border-gray-mid items-center transition-opacity duration-300 ${
                            isRemoving ? 'opacity-0' : 'opacity-100'
                          }`}
                        >
                          {/* 縮圖 */}
                          <div
                            className="w-[80px] h-[80px] max-md:w-16 max-md:h-16 max-md:row-span-2 flex-shrink-0 overflow-hidden cursor-pointer rounded-lg"
                            onClick={(e) => handleImageClick(e, images[item.id] || item.image)}
                          >
                            <img
                              src={images[item.id] || item.image}
                              alt={item.name}
                              className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                            />
                          </div>

                          {/* 名稱 */}
                          <div className="text-sm text-white">
                            {itemName(item.id, item.name)}
                          </div>

                          {/* 押金 */}
                          <div className="font-english text-sm text-white text-center max-md:col-start-2 max-md:col-span-2 max-md:row-start-2 max-md:text-left">
                            NT$ {item.deposit.toLocaleString()}
                          </div>

                          {/* 刪除按鈕 */}
                          <button
                            onClick={() => handleRemoveItem(item.id, group.startDate, group.endDate)}
                            className={`font-english text-sm text-white max-md:col-start-3 max-md:row-start-1 max-md:justify-self-end ${TAP} ${BTN}`}
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
                    // 計算這個設備的最大可用數量（同型錄「可借數量」）
                    // 庫存 - 該時段他人訂單佔用（含 On Hold）- (購物車中所有相同設備的數量 - 當前這個項目的數量)
                    const totalStock = getOriginalQuantity(item.id) - getReserved(item)
                    const otherItemsQty = getCartQuantity(item.id) - item.quantity
                    const maxQtyForThisItem = totalStock - otherItemsQty

                    // 日期已過期：新時段的庫存未知，先改日期才能調數量（也不判缺貨）
                    // 檢查小量設備 9 件限制（本組已達 9 件即禁止增加）
                    // （補齊組合的最後一個零件會讓件數變少，所以看 +1 之後是否超過 9）
                    const plusOne = group.items.map(i => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
                    const canIncrement = !isExpired && item.quantity < maxQtyForThisItem && !isLittleBookingLimitReached(group, plusOne, 10)
                    const canDecrement = !isExpired && item.quantity > 1

                    // 判斷是否完全缺貨（當前數量超過最大可用數量）
                    const isOutOfStock = !isExpired && item.quantity > maxQtyForThisItem

                    return (
                      <div
                        key={item.id}
                        className={`grid grid-cols-[80px_1fr_140px_120px_40px] max-md:grid-cols-[64px_1fr_auto] gap-6 max-md:gap-x-3 max-md:gap-y-1 py-3 border-b border-gray-mid items-center transition-opacity duration-300 ${
                          isRemoving ? 'opacity-0' : 'opacity-100'
                        } ${isOutOfStock ? 'opacity-50' : ''}`}
                      >
                        {/* 縮圖 */}
                        <div
                          className="w-[80px] h-[80px] max-md:w-16 max-md:h-16 max-md:row-span-2 flex-shrink-0 overflow-hidden cursor-pointer rounded-lg"
                          onClick={(e) => handleImageClick(e, images[item.id] || item.image)}
                        >
                          <img
                            src={images[item.id] || item.image}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                          />
                        </div>

                        {/* 名稱和庫存狀態 */}
                        <div className="flex flex-col gap-1">
                          <div className="text-sm text-white">
                            {itemName(item.id, item.name)}
                          </div>
                          {/* 只在完全缺貨（灰色狀態）時顯示錯誤訊息 */}
                          {isOutOfStock && (
                            <div className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs text-pink">
                                error
                              </span>
                              <span className="font-english text-xs text-pink">
                                {t('Out of Stock', '缺貨')} ({t('Available', '可借')}: {maxQtyForThisItem})
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 數量調整 */}
                        <div className="flex items-center justify-center gap-4 max-md:gap-0 max-md:justify-start max-md:col-start-2 max-md:row-start-2">
                          <button
                            onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                            disabled={!canDecrement}
                            className={`font-english text-sm text-white max-md:w-11 max-md:h-11 ${BTN}`}
                          >
                            -
                          </button>
                          <span className="font-english text-sm text-white w-8 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                            disabled={!canIncrement}
                            className={`font-english text-sm text-white max-md:w-11 max-md:h-11 ${BTN}`}
                          >
                            +
                          </button>
                        </div>

                        {/* 押金 */}
                        <div className="font-english text-sm text-white text-center max-md:col-start-3 max-md:row-start-2 max-md:text-right">
                          NT$ {(item.deposit * item.quantity).toLocaleString()}
                        </div>

                        {/* 刪除按鈕 */}
                        <button
                          onClick={() => handleRemoveItem(item.id, group.startDate, group.endDate)}
                          className={`font-english text-sm text-white max-md:col-start-3 max-md:row-start-1 max-md:justify-self-end ${TAP} ${BTN}`}
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </Collapse>
          </div>
        )
      })}

      {/* 圖片預覽 Modal - 與 EquipmentGrid 相同樣式 */}
      {previewImage && createPortal(
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center py-20"
          onClick={() => setPreviewImage(null)}
        >
          {/* 關閉按鈕 */}
          <button
            onClick={() => setPreviewImage(null)}
            className={`absolute top-20 right-8 text-white text-xl font-normal z-10 ${BTN}`}
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
        pickupDate={(() => {
          // 大量設備單：起租日＝取件日，對話框據此列繳押金／取件時段
          const g = dateGroups.find(g => `${g.category}_${g.startDate}_${g.endDate}` === currentEditingGroup)
          return g?.category === 'equipment' && currentBookingType === 'mass-personal' ? g.startDate : undefined
        })()}
        needsProof={(() => {
          // 雷切機一年級要授課教師核可（年級空白從嚴，同 A508；server 端 submit_orders 同檢查）
          const g = dateGroups.find(g => `${g.category}_${g.startDate}_${g.endDate}` === currentEditingGroup)
          return !!g?.items.some(i => i.name.includes('雷切')) &&
            (currentUser?.role ?? 'student') === 'student' && !isSophomoreOrAbove(currentUser?.year)
        })()}
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
