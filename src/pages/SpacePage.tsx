/**
 * 空間租借頁面 - React 新版
 */

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'
import DatePickerBar from '../components/DatePickerBar'
import SpaceAreaMap from '../components/space/SpaceAreaMap'
import ClassroomList from '../components/space/ClassroomList'
import { useSpaceBlocks, fetchOccupiedSpaces } from '../services/spaceService'
import { toDateKey } from '../components/cart/cartHelpers'
import { useCart } from '../hooks/useCart'
import { useDateSelection } from '../contexts/DateSelectionContext'
import Toast from '../components/common/Toast'
import { useAuth } from '../contexts/AuthContext'
import { checkDuplicateOrder } from '../utils/orderValidation'
import { isSophomoreOrAbove } from '../utils/gradeUtils'
import { sortBlockIds } from '../components/cart/cartHelpers'

// 子分類 → SVG 區域代碼對應（專案許可區包含 corridor 與 pillar）
const AREA_MAPPING: Record<string, string[]> = {
  'Square': ['square'],
  'FrontTerrace': ['front-terrace'],
  'BackTerrace': ['back-terrace'],
  'GlassWall': ['glass-wall'],
  'CasePermitArea': ['corridor', 'pillar']
}

const SpacePage: React.FC = () => {
  const { cart, addToCart, removeFromCart, checkLittleBookingLimit, isSuspended } = useCart()
  const { getCurrentSpaceDates } = useDateSelection()
  const { currentUser } = useAuth()
  const location = useLocation()

  // 獲取當前模式的日期
  const spaceDates = getCurrentSpaceDates()

  // 檢查是否已選擇日期
  const hasSelectedDates = spaceDates.startDate !== null && spaceDates.endDate !== null

  // 空間區塊定義（id → 區域/押金，來自 Supabase space_blocks）
  const spaceBlocks = useSpaceBlocks()

  // 該時段被生效訂單佔用的空間 id（區塊＋教室）
  const [occupiedIds, setOccupiedIds] = useState<string[]>([])
  const occupiedStartKey = spaceDates.startDate ? toDateKey(spaceDates.startDate) : null
  const occupiedEndKey = spaceDates.endDate ? toDateKey(spaceDates.endDate) : null

  useEffect(() => {
    if (!occupiedStartKey || !occupiedEndKey) {
      setOccupiedIds([])
      return
    }
    let mounted = true
    fetchOccupiedSpaces(occupiedStartKey, occupiedEndKey)
      .then(ids => { if (mounted) setOccupiedIds(ids) })
      .catch(err => console.error('讀取空間佔用失敗:', err))
    return () => { mounted = false }
  }, [occupiedStartKey, occupiedEndKey])

  // 個人租借（小量／大量-個人）：受每時段押金上限 5,000 約束，全選必定超標
  const isPersonalBooking = spaceDates.bookingType !== 'mass-group'

  // 使用 Ref 來保存最新的 addToCart 函數，解決閉包導致的狀態覆蓋問題
  const addToCartRef = useRef(addToCart)
  useEffect(() => {
    addToCartRef.current = addToCart
  }, [addToCart])

  // 主分類：NumberedArea 或 Classroom
  const [selectedMainCategory, setSelectedMainCategory] = useState<'NumberedArea' | 'Classroom'>('NumberedArea')
  // 編號區子分類 - 預設為 null（不選擇任何子分類，顯示全部地圖）
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null)
  // 當前選擇的區塊（尚未加入購物車）
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([])
  const [hasProjectPermission, setHasProjectPermission] = useState<boolean>(false)
  // 狀態篩選 - 添加 partial 狀態
  const [statusFilters, setStatusFilters] = useState<Set<'available' | 'unavailable' | 'partial'>>(
    new Set(['available', 'unavailable', 'partial'])
  )

  // Toggle status filter - 至少保持一個選中
  const toggleStatusFilter = (status: 'available' | 'unavailable' | 'partial') => {
    setStatusFilters(prev => {
      const newFilters = new Set(prev)
      // 如果要取消選擇，檢查是否至少還有一個其他選項被選中
      if (newFilters.has(status)) {
        // 只有在還有其他選項被選中時才允許取消
        if (newFilters.size > 1) {
          newFilters.delete(status)
        }
      } else {
        newFilters.add(status)
      }
      return newFilters
    })
  }

  // 從購物車導航過來時，自動選擇對應的區域
  useEffect(() => {
    const state = location.state as { selectedBlock?: string; selectedArea?: string } | null
    if (state?.selectedArea) {
      // Area 到 SubCategory 的映射
      const areaToSubCategoryMap: Record<string, string> = {
        'square': 'Square',
        'front-terrace': 'FrontTerrace',
        'back-terrace': 'BackTerrace',
        'glass-wall': 'GlassWall',
        'corridor': 'CasePermitArea',
        'pillar': 'CasePermitArea',
        'classroom': 'Classroom'
      }

      const subCategory = areaToSubCategoryMap[state.selectedArea]

      if (subCategory === 'Classroom') {
        setSelectedMainCategory('Classroom')
        setSelectedSubCategory(null)
      } else if (subCategory) {
        setSelectedMainCategory('NumberedArea')
        setSelectedSubCategory(subCategory)
      }
    }
  }, [location.state])

  // Toast 狀態
  const [toastInfo, setToastInfo] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastInfo({ show: true, message, type })
  }

  // 從購物車中取得已加入的區塊 ID
  const cartBlockIds = useMemo(() => {
    return cart
      .filter(item => item.category === 'space-block')
      .map(item => item.id)
  }, [cart])

  // 教室資料
  const classroomData = [
    { id: 'A503', name: 'A503 教室', enName: 'A503 Classroom', price: 5000, image: '/Images/A503.webp' },
    { id: 'A507', name: 'A507 教室', enName: 'A507 Classroom', price: 5000, image: '/Images/A507.webp' },
    { id: 'A508', name: 'A508 教室', enName: 'A508 Classroom', price: 5000, image: '/Images/A508.webp' },
  ]

  // 檢查教室是否在購物車中
  const isClassroomInCart = (id: string) => cart.some(item => item.id === id && item.category === 'classroom')

  // 篩選教室 - 根據 statusFilters 狀態
  const filteredClassrooms = useMemo(() => {
    if (statusFilters.size === 0 || statusFilters.size === 3) {
      // 顯示所有教室
      return classroomData
    }

    return classroomData.filter(classroom => {
      const inCart = isClassroomInCart(classroom.id)

      // Available: 不在購物車中
      if (statusFilters.has('available') && !inCart) return true
      // Unavailable: 在購物車中
      if (statusFilters.has('unavailable') && inCart) return true
      // Partial: 教室不適用此狀態，所以忽略

      return false
    })
  }, [statusFilters, cart])

  // 處理區塊選擇（只能選擇當前子分類的區塊）
  const handleBlockSelect = (blockId: string) => {
    // 如果該區塊已在購物車中，則移除
    if (cartBlockIds.includes(blockId)) {
      removeFromCart(blockId)
      showToast(`已從清單移除 ${blockId}`)
      return
    }

    // 尚未選日期前不開放選格子（格子的可借狀態取決於日期區間）
    if (!hasSelectedDates) {
      showToast('請先選擇租借日期', 'error')
      return
    }

    // 取消選取一律允許
    if (selectedBlocks.includes(blockId)) {
      setSelectedBlocks(prev => prev.filter(id => id !== blockId))
      return
    }

    // 個人租借：選取總押金不可超過每時段空間押金上限 5,000
    // （計入該時段購物車中既有的空間押金——區塊與教室共用同一個上限）
    if (isPersonalBooking) {
      const start = spaceDates.startDate!.toISOString()
      const end = spaceDates.endDate!.toISOString()
      const cartSpaceDeposit = cart
        .filter(item =>
          (item.category === 'space-block' || item.category === 'classroom') &&
          item.startDate === start && item.endDate === end
        )
        .reduce((sum, item) => sum + item.deposit * item.quantity, 0)
      const selectedDeposit = selectedBlocks.reduce((sum, id) => sum + getBlockDeposit(id), 0)

      if (cartSpaceDeposit + selectedDeposit + getBlockDeposit(blockId) > 5000) {
        showToast('個人租借每時段空間押金上限 NT$ 5,000，無法再選取更多區塊', 'error')
        return
      }
    }

    setSelectedBlocks(prev => [...prev, blockId])
  }

  // 處理子分類切換
  const handleSubCategoryChange = (newSubCategory: string | null) => {
    // 只切換子分類，保留當前選擇的區塊（即使是不同區域的）
    setSelectedSubCategory(newSubCategory)
    setHasProjectPermission(false)
  }

  // 處理回到 A5F 外層（清空未送出的選擇）
  const handleBackToNumberedArea = () => {
    setSelectedSubCategory(null)
    setSelectedBlocks([]) // 清空未加入購物車的選擇
    setHasProjectPermission(false)
  }

  // 計算單個區塊的押金（直接用資料庫的 deposit：後陽台 2000、其餘 1000）
  const getBlockDeposit = (blockId: string): number => {
    return spaceBlocks[blockId]?.deposit ?? 1000
  }

  // 計算總押金（帶上限）
  const calculateTotalDeposit = (blocks: string[]): number => {
    const total = blocks.reduce((sum, blockId) => sum + getBlockDeposit(blockId), 0)
    return Math.min(total, 5000) // 上限 NT$5,000
  }

  // 當前子分類尚可選取的區塊（該時段未被佔用、不在購物車）
  const availableBlockIds = useMemo(() => {
    const targetAreas = selectedSubCategory ? AREA_MAPPING[selectedSubCategory] : undefined
    if (!targetAreas) return []
    return Object.entries(spaceBlocks)
      .filter(([id, data]) =>
        targetAreas.includes(data.area) && !occupiedIds.includes(id) && !cartBlockIds.includes(id)
      )
      .map(([id]) => id)
  }, [selectedSubCategory, cartBlockIds, spaceBlocks, occupiedIds])

  // 可選區塊已全數選取（或根本無可選區塊）→ Select All 無事可做
  const allAvailableSelected = availableBlockIds.every(id => selectedBlocks.includes(id))

  // 全選當前區域的所有可用區塊（僅開放大量-團體；個人租借全選必超押金上限，
  // 且格子位置應由使用者自選，不代選「前 N 格」）
  const handleSelectAll = () => {
    if (!hasSelectedDates) {
      showToast('請先選擇租借日期', 'error')
      return
    }

    if (isPersonalBooking) {
      showToast('個人租借每時段空間押金上限 NT$ 5,000，無法全選，請手動選取或改用大量-團體', 'error')
      return
    }

    // 保留之前的選擇，只補上尚未選取的
    setSelectedBlocks(prev => [...prev, ...availableBlockIds.filter(id => !prev.includes(id))])
  }

  // 檢查加入所有選中的區塊後是否超過小量訂單 9 件限制
  const wouldExceedLightLimitForBlocks = useMemo(() => {
    if (!hasSelectedDates || selectedBlocks.length === 0) return false

    // 檢查第一個區塊，因為所有區塊都會被加入同一時段
    const firstBlockItem = {
      id: selectedBlocks[0],
      name: `區塊 ${selectedBlocks[0]}`,
      category: 'space-block',
      deposit: getBlockDeposit(selectedBlocks[0]),
      image: '/Area/A5F Area Booking.svg',
      quantity: selectedBlocks.length, // 加入的總數量
      startDate: spaceDates.startDate!.toISOString(),
      endDate: spaceDates.endDate!.toISOString(),
      bookingType: spaceDates.bookingType
    }

    return !checkLittleBookingLimit(firstBlockItem).allowed
  }, [selectedBlocks, spaceDates, hasSelectedDates, checkLittleBookingLimit])

  // 加入選取的區塊到購物車
  const handleAddBlocks = () => {
    // 檢查是否已選擇日期
    if (!hasSelectedDates) {
      showToast('請先選擇租借日期', 'error')
      return
    }

    // 檢查是否重複下單
    const validation = checkDuplicateOrder(
      currentUser?.studentId,
      spaceDates.startDate,
      spaceDates.endDate,
      spaceDates.bookingType
    )

    if (selectedBlocks.length === 0) {
      showToast('請先選擇區塊', 'error')
      return
    }

    if (hasCasePermitBlocks && !hasProjectPermission) {
      showToast('請先勾選專案許可確認', 'error')
      return
    }

    if (validation.isDuplicate) {
      showToast(validation.message, 'error')
      return
    }

    // 停權早退：在清空選取前擋下，保留使用者已選的區塊
    if (isSuspended) {
      showToast('帳號已停權（未完成清潔歸還），無法加入購物車，請聯絡系學會', 'error')
      return
    }

    // 複製一份要加入的區塊 ID，避免狀態清除後拿不到
    const blocksToAdd = [...selectedBlocks]

    // 清空選取狀態
    setSelectedBlocks([])

    // 使用遞迴方式依序加入，確保 React 狀態更新週期完成
    // 解決 forEach + setTimeout 可能因間隔太短導致的狀態覆蓋問題
    // Toast 移到全部加入完成後才顯示，並回報加入失敗的原因
    const addNext = (index: number, added: string[], failReason?: string) => {
      if (index >= blocksToAdd.length) {
        const failedCount = blocksToAdd.length - added.length
        const displayIds = added.slice(0, 3).join('、')
        if (added.length > 0 && failedCount > 0) {
          // 部分成功：同時回報加入數量與未加入的原因，避免使用者以為全部都加進去了
          showToast(
            `已加入 ${displayIds}${added.length > 3 ? ' 等' : ''} ${added.length} 件，其餘 ${failedCount} 件未加入：${failReason || '無法加入'}`,
            'error'
          )
        } else if (added.length > 0) {
          showToast(added.length > 3
            ? `已成功加入${displayIds}等編號到清單！`
            : `已成功加入${displayIds}到清單！`)
        } else if (failReason) {
          showToast(failReason, 'error')
        }
        return
      }

      const blockId = blocksToAdd[index]
      const result = addToCartRef.current({
        id: blockId,
        name: `區塊 ${blockId}`,
        category: 'space-block',
        deposit: getBlockDeposit(blockId), // 根據區域計算押金
        image: '/Area/A5F Area Booking.svg', // 區塊使用地圖圖片
        quantity: 1,
        startDate: spaceDates.startDate!.toISOString(),
        endDate: spaceDates.endDate!.toISOString(),
        bookingType: spaceDates.bookingType
      })

      const nextAdded = result.ok ? [...added, blockId] : added
      const nextFail = result.ok ? failReason : (result.reason || failReason)

      // 增加延遲至 100ms，確保上一次的狀態更新已寫入
      setTimeout(() => {
        addNext(index + 1, nextAdded, nextFail)
      }, 100)
    }

    addNext(0, [])
  }

  // A5F 編號區子分類
  const numberedAreaCategories = [
    { id: 'Square', en: 'Square', zh: '中庭' },
    { id: 'FrontTerrace', en: 'Front Terrace', zh: '前陽台' },
    { id: 'BackTerrace', en: 'Back Terrace', zh: '後陽台' },
    { id: 'GlassWall', en: 'Glass Wall', zh: '玻璃牆' },
    { id: 'CasePermitArea', en: 'Case Permit Area', zh: '專案許可區' }
  ]

  // 處理教室加入
  const handleClassroomAdd = (id: string) => {
    // 檢查是否已選擇日期
    if (!hasSelectedDates) {
      showToast('請先選擇租借日期', 'error')
      return
    }

    // A508 限大二以上（submit_orders 亦擋，此處為 UX 提前提示）
    if (id === 'A508' && !isSophomoreOrAbove(currentUser?.year)) {
      showToast('A508 教室僅限大二以上（含碩士）借用', 'error')
      return
    }

    // 檢查是否重複下單
    const validation = checkDuplicateOrder(
      currentUser?.studentId,
      spaceDates.startDate,
      spaceDates.endDate,
      spaceDates.bookingType
    )

    if (validation.isDuplicate) {
      showToast(validation.message, 'error')
      return
    }

    // 教室該時段已被其他訂單佔用
    if (occupiedIds.includes(id)) {
      showToast('該教室於此時段已被預約', 'error')
      return
    }

    const classroom = classroomData.find(c => c.id === id)
    if (classroom) {
      const result = addToCart({
        id: classroom.id,
        name: classroom.name,
        category: 'classroom',
        deposit: classroom.price,
        image: classroom.image,
        quantity: 1,
        startDate: spaceDates.startDate!.toISOString(),
        endDate: spaceDates.endDate!.toISOString(),
        bookingType: spaceDates.bookingType
      })
      if (result.ok) {
        showToast(`已成功加入 ${classroom.name} 到清單！`)
      } else {
        showToast(result.reason || '無法加入清單', 'error')
      }
    }
  }

  // 判斷編號區是否被選中（主分類是 NumberedArea）
  const isNumberedAreaSelected = selectedMainCategory === 'NumberedArea'

  // 排序選取的區塊 ID (A-Z, 1-10)
  const sortedSelectedBlocks = useMemo(() => {
    return sortBlockIds(selectedBlocks)
  }, [selectedBlocks])

  // 檢查是否有選中專案許可區的區塊
  const hasCasePermitBlocks = useMemo(() => {
    return selectedBlocks.some(blockId => {
      const blockData = spaceBlocks[blockId]
      return blockData && (blockData.area === 'corridor' || blockData.area === 'pillar')
    })
  }, [selectedBlocks, spaceBlocks])

  // Add 按鈕的阻擋條件（僅控制外觀；仍可點擊，點擊時 toast 提示缺什麼）
  const isAddBlocked = !selectedSubCategory || selectedBlocks.length === 0 || (hasCasePermitBlocks && !hasProjectPermission) || !hasSelectedDates || wouldExceedLightLimitForBlocks || isSuspended

  return (
    <div className="bg-black text-white h-screen flex flex-col overflow-hidden">
      <Header />

      <main className="flex-1 pt-20 flex flex-col overflow-hidden relative">
        {/* 麵包屑 - Fixed 在畫面上 */}
        <div className="container hidden md:block fixed top-20 left-0 right-0 z-10">
          <div className="text-left" style={{ paddingBottom: '1.08rem' }}>
            <nav className="breadcrumb-inline whitespace-nowrap">
              <Link to="/catalog" className="breadcrumb-item text-breadcrumb">
                &lt;
              </Link>
              <span> </span>
              <Link to="/catalog" className="breadcrumb-item text-breadcrumb">
                <span className="font-['Inter',_sans-serif]">Category</span> <span className="font-['Noto_Sans_TC',_sans-serif]">類別</span>
              </Link>
              <span className="breadcrumb-separator text-breadcrumb">/</span>
              <span className="breadcrumb-item text-breadcrumb">
                <span className="font-['Inter',_sans-serif]">Space</span> <span className="font-['Noto_Sans_TC',_sans-serif]">空間</span>
              </span>
            </nav>
          </div>
        </div>

        <div className="container hidden md:flex flex-1 gap-6 overflow-hidden items-stretch pb-20">
          {/* 左側欄位：20% */}
          <div className="w-[20%] flex-shrink-0 flex flex-col overflow-hidden relative">
            {/* 標題 - 加上 padding-top 避免被麵包屑遮擋 */}
            <div className="flex-shrink-0">
              <h1 className="font-['Inter',_sans-serif] text-white text-medium-title pt-12">
                Space
              </h1>
              <h1 className="font-['Noto_Sans_TC',_sans-serif] text-white text-medium-title mb-6">
                空間
              </h1>
            </div>

            {/* 中間區域：A5F 和 Classroom 選項 - 使用 flex-1 自動填充 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* A5F 編號區 - 主分類 */}
              <div className="flex-shrink-0 mt-8">
                <button
                  onClick={() => {
                    setSelectedMainCategory('NumberedArea')
                    // 點擊 A5F 編號區時，回到外層並清空未送出的選擇
                    handleBackToNumberedArea()
                  }}
                  className={`text-small-title transition-colors cursor-pointer text-left ${
                    isNumberedAreaSelected
                      ? 'text-white font-bold'
                      : 'text-gray-scale2 hover:!text-white'
                  }`}
                >
                  <span className="font-['Inter',_sans-serif] block">A5F Numbered Area</span>
                  <span className="font-['Noto_Sans_TC',_sans-serif] block">A5F編號區</span>
                </button>

                {/* 編號區子分類 - 只在編號區被選中時顯示 */}
                {isNumberedAreaSelected && (
                  <div className="flex flex-col gap-4 pl-4 mt-4">
                    {numberedAreaCategories.map((category) => {
                      // 專案許可區使用黃色
                      const isCasePermit = category.id === 'CasePermitArea'
                      const isSelected = selectedSubCategory === category.id
                      const activeColor = isCasePermit ? 'text-yellow' : 'text-white'
                      const hoverColor = isCasePermit ? 'permit-hover' : 'hover:!text-white'

                      return (
                        <div key={category.id} className="text-left">
                          <button
                            onClick={() => handleSubCategoryChange(
                              selectedSubCategory === category.id ? null : category.id
                            )}
                            className={`text-small-title transition-colors cursor-pointer text-left ${
                              isSelected
                                ? `${activeColor} font-bold`
                                : `text-gray-scale2 ${hoverColor}`
                            }`}
                          >
                            <span className="font-['Inter',_sans-serif] block">{category.en}</span>
                            <span className="font-['Noto_Sans_TC',_sans-serif] block">{category.zh}</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 教室 - 主分類，使用 mt-auto 推到底部 */}
              <div className="mt-4 flex-shrink-0">
                <button
                  onClick={() => {
                    setSelectedMainCategory('Classroom')
                    setSelectedBlocks([])
                  }}
                  className={`text-small-title transition-colors cursor-pointer text-left ${
                    selectedMainCategory === 'Classroom'
                      ? 'text-white font-bold'
                      : 'text-gray-scale2 hover:!text-white'
                  }`}
                >
                  <span className="font-['Inter',_sans-serif] block">Classroom</span>
                  <span className="font-['Noto_Sans_TC',_sans-serif] block">教室</span>
                </button>
              </div>
            </div>

            {/* 狀態篩選 Legend - 絕對定位在底部，只在 Classroom 選中時顯示 */}
            {selectedMainCategory === 'Classroom' && (
              <div className="absolute bottom-0 left-0 right-0 flex-shrink-0">
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => toggleStatusFilter('available')}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-3 h-3 bg-[#00ff80]"></div>
                    <span className={`text-tiny transition-colors ${
                      statusFilters.has('available') ? 'text-white' : 'text-gray-scale2 group-hover:text-white'
                    }`}>
                      <span className="font-['Inter',_sans-serif]">Available</span> <span className="font-['Noto_Sans_TC',_sans-serif]">全時段借用</span>
                    </span>
                  </button>

                  <button
                    onClick={() => toggleStatusFilter('unavailable')}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-3 h-3 bg-[#ff448a]"></div>
                    <span className={`text-tiny transition-colors ${
                      statusFilters.has('unavailable') ? 'text-white' : 'text-gray-scale2 group-hover:text-white'
                    }`}>
                      <span className="font-['Inter',_sans-serif]">Unavailable</span> <span className="font-['Noto_Sans_TC',_sans-serif]">不可借用</span>
                    </span>
                  </button>

                  <button
                    onClick={() => toggleStatusFilter('partial')}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-3 h-3 bg-[#ffa500]"></div>
                    <span className={`text-tiny transition-colors ${
                      statusFilters.has('partial') ? 'text-white' : 'text-gray-scale2 group-hover:text-white'
                    }`}>
                      <span className="font-['Inter',_sans-serif]">Partially Available</span> <span className="font-['Noto_Sans_TC',_sans-serif]">部分時段借用</span>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 右側欄位：80% */}
          <div className="w-[80%] min-w-0 flex-1 flex gap-12">
            {/* 編號區內容 */}
            {isNumberedAreaSelected && (
              <>
                {/* 左側：70% - 地圖區域 */}
                <div className="w-[70%] h-full flex items-center justify-center overflow-hidden">
                  <SpaceAreaMap
                    selectedSubCategory={selectedSubCategory}
                    onAreaClick={(subCategoryId) => handleSubCategoryChange(subCategoryId)}
                    selectedBlocks={selectedBlocks}
                    onBlockSelect={handleBlockSelect}
                    cartBlocks={cartBlockIds}
                    rentedBlocks={occupiedIds}
                  />
                </div>

                {/* 右側：30% - 借用資訊面板 */}
                <div className="w-[30%] h-full flex flex-col">
                  {/* 狀態篩選 Legend - 可點擊，提高 z-index 確保在麵包屑上方 */}
                  {/* 顏色與 numbered-area.css 的 SVG 格子顏色一致 */}
                  <div className="mb-6 flex flex-col gap-3 relative z-20">
                    <button
                      onClick={() => toggleStatusFilter('available')}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      {/* Available: 不透明淺綠色 rgb(0, 128, 64) */}
                      <div className="w-3 h-3 bg-[rgb(0,128,64)]"></div>
                      <span className={`text-tiny transition-colors ${
                        statusFilters.has('available') ? 'text-white' : 'text-gray-scale2 group-hover:text-white'
                      }`}>
                        <span className="font-['Inter',_sans-serif]">Available</span> <span className="font-['Noto_Sans_TC',_sans-serif]">可借用</span>
                      </span>
                    </button>

                    <button
                      onClick={() => toggleStatusFilter('unavailable')}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      {/* Unavailable: #ff448a - 與 SVG is-rented 一致 */}
                      <div className="w-3 h-3 bg-[#ff448a]"></div>
                      <span className={`text-tiny transition-colors ${
                        statusFilters.has('unavailable') ? 'text-white' : 'text-gray-scale2 group-hover:text-white'
                      }`}>
                        <span className="font-['Inter',_sans-serif]">Unavailable</span> <span className="font-['Noto_Sans_TC',_sans-serif]">不可借用</span>
                      </span>
                    </button>

                    <button
                      onClick={() => toggleStatusFilter('partial')}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      {/* Partial: #ffa500 橘色警告色 */}
                      <div className="w-3 h-3 bg-[#ffa500]"></div>
                      <span className={`text-tiny transition-colors ${
                        statusFilters.has('partial') ? 'text-white' : 'text-gray-scale2 group-hover:text-white'
                      }`}>
                        <span className="font-['Inter',_sans-serif]">Partially Available</span> <span className="font-['Noto_Sans_TC',_sans-serif]">部分時段可借用</span>
                      </span>
                    </button>

                    {/* Selected: #00ff80 - 與 SVG is-selected 一致 */}
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#00ff80]"></div>
                      <span className="text-tiny text-white">
                        <span className="font-['Inter',_sans-serif]">Selected</span> <span className="font-['Noto_Sans_TC',_sans-serif]">已選擇</span>
                      </span>
                    </div>
                  </div>

                  {/* 頂部區塊：選擇區塊 + 按鈕 */}
                  <div className="mb-6">
                    {/* 選擇區塊 */}
                    <div className="mb-4">
                      <div className="flex flex-col gap-1 mb-2">
                        <span className="text-tiny font-['Inter',_sans-serif] text-gray-scale2">Selected Area</span>
                        <span className="text-tiny font-['Noto_Sans_TC',_sans-serif] text-gray-scale2">選擇區塊</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar mb-4">
                        <span className="text-content font-['Inter',_sans-serif] font-normal break-words">
                          {sortedSelectedBlocks.length > 0 ? sortedSelectedBlocks.join(', ') : '--'}
                        </span>
                      </div>

                      {/* 全選和清除按鈕 - 靠左對齊 */}
                      <div className="flex gap-8">
                        {/* 可選區塊全數選完時 disable；未選日期／個人租借時保持可點，點擊 toast 說明原因 */}
                        <button
                          onClick={handleSelectAll}
                          disabled={!selectedSubCategory || allAvailableSelected}
                          className={`text-small-title font-['Inter',_sans-serif] font-medium transition-colors ${
                            !selectedSubCategory || allAvailableSelected || !hasSelectedDates || isPersonalBooking ? 'text-gray-scale4 cursor-not-allowed' : 'text-white hover:text-gray-scale2 cursor-pointer'
                          }`}
                        >
                          Select All 全選
                        </button>
                        <button
                          onClick={() => setSelectedBlocks([])}
                          disabled={!selectedSubCategory || selectedBlocks.length === 0}
                          className={`text-small-title font-['Inter',_sans-serif] font-medium transition-colors ${
                            !selectedSubCategory || selectedBlocks.length === 0 ? 'text-gray-scale4 cursor-not-allowed' : 'text-white hover:text-gray-scale2 cursor-pointer'
                          }`}
                        >
                          Clear 清除
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 底部區塊：押金 + 專案許可區 + Add 按鈕 - 靠底部對齊 */}
                  <div className="mt-auto">
                    {/* 押金金額 */}
                    <div className="mb-6">
                      <div className="flex flex-col gap-1 mb-2">
                        <span className="text-tiny font-['Inter',_sans-serif] text-gray-scale2">Deposit</span>
                        <span className="text-tiny font-['Noto_Sans_TC',_sans-serif] text-gray-scale2">押金</span>
                      </div>
                      <span className="text-large-title font-['Inter',_sans-serif] font-normal">
                        NT$ {calculateTotalDeposit(selectedBlocks).toLocaleString()}
                      </span>
                    </div>

                    {/* 專案許可區確認 Checkbox */}
                    {hasCasePermitBlocks && (
                      <div className="mb-6">
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <div className="relative flex items-center mt-0.5">
                            <input
                              type="checkbox"
                              checked={hasProjectPermission}
                              onChange={(e) => setHasProjectPermission(e.target.checked)}
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
                          <span className="text-tiny font-['Noto_Sans_TC',_sans-serif] text-white group-hover:text-gray-scale2 transition-colors leading-tight">
                            已與老師討論，確認老師知情並允許於此專案借用
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Add 按鈕 - 白底黑字框；被阻擋時仍可點擊，點擊會 toast 提示缺什麼 */}
                    <div className="flex">
                      <button
                        onClick={handleAddBlocks}
                        aria-disabled={isAddBlocked}
                        className={`px-6 py-3 rounded-lg text-small-title font-['Inter',_sans-serif] font-medium transition ${
                          isAddBlocked
                            ? 'bg-gray-scale4 text-gray-scale2 cursor-not-allowed'
                            : 'bg-white text-black hover:opacity-70 cursor-pointer'
                        }`}
                      >
                        Add 加入清單
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 教室內容 */}
            {selectedMainCategory === 'Classroom' && (
              <div className="w-full h-full flex flex-col">
                <ClassroomList
                  classrooms={filteredClassrooms}
                  onAdd={handleClassroomAdd}
                />
              </div>
            )}
          </div>
        </div>

        {/* 時間選擇欄 */}
        <DatePickerBar type="space" />
      </main>

      <Footer />

      {/* Toast 通知 */}
      {toastInfo.show && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(prev => ({ ...prev, show: false }))}
        />
      )}
    </div>
  )
}

export default SpacePage
