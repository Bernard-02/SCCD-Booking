/**
 * 空間租借頁面 - React 新版
 */

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'
import DatePickerBar from '../components/DatePickerBar'
import SpaceAreaMap, { mockAreaBlocksData } from '../components/space/SpaceAreaMap'
import ClassroomList from '../components/space/ClassroomList'
import { useCart } from '../hooks/useCart'
import { useDateSelection } from '../contexts/DateSelectionContext'
import Toast from '../components/common/Toast'
import { useAuth } from '../contexts/AuthContext'
import { checkDuplicateOrder } from '../utils/orderValidation'

const SpacePage: React.FC = () => {
  const { cart, addToCart, removeFromCart, checkLittleBookingLimit } = useCart()
  const { getCurrentSpaceDates } = useDateSelection()
  const { currentUser } = useAuth()
  const location = useLocation()

  // 獲取當前模式的日期
  const spaceDates = getCurrentSpaceDates()

  // 檢查是否已選擇日期
  const hasSelectedDates = spaceDates.startDate !== null && spaceDates.endDate !== null

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

    setSelectedBlocks(prev =>
      prev.includes(blockId)
        ? prev.filter(id => id !== blockId)
        : [...prev, blockId]
    )
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

  // 計算單個區塊的押金
  const getBlockDeposit = (blockId: string): number => {
    const blockData = mockAreaBlocksData[blockId]
    if (!blockData) return 1000 // 預設值

    // 後陽台 (L1-L6) 的押金是 2000，其他都是 1000
    return blockData.area === 'back-terrace' ? 2000 : 1000
  }

  // 計算總押金（帶上限）
  const calculateTotalDeposit = (blocks: string[]): number => {
    const total = blocks.reduce((sum, blockId) => sum + getBlockDeposit(blockId), 0)
    return Math.min(total, 5000) // 上限 NT$5,000
  }

  // 全選當前區域的所有可用區塊
  const handleSelectAll = () => {
    if (!selectedSubCategory) return

    // 修改：支援多個區域對應 (例如專案許可區包含 corridor 和 pillar)
    const areaMapping: Record<string, string[]> = {
      'Square': ['square'],
      'FrontTerrace': ['front-terrace'],
      'BackTerrace': ['back-terrace'],
      'GlassWall': ['glass-wall'],
      'CasePermitArea': ['corridor', 'pillar']
    }

    const targetAreas = areaMapping[selectedSubCategory]
    if (!targetAreas) return

    const availableBlocks = Object.entries(mockAreaBlocksData)
      .filter(([id, data]) => {
        const blockData = data as any
        return targetAreas.includes(blockData.area) && blockData.status !== 'rented' && !cartBlockIds.includes(id)
      })
      .map(([id]) => id)

    // 修正：保留之前的選擇，而不是清空
    setSelectedBlocks(prev => {
      const newBlocks = availableBlocks.filter(id => !prev.includes(id))
      return [...prev, ...newBlocks]
    })
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

    if (validation.isDuplicate) {
      showToast(validation.message, 'error')
      return
    }

    // 複製一份要加入的區塊 ID，避免狀態清除後拿不到
    const blocksToAdd = [...selectedBlocks]

    // 顯示加入購物車的 Toast
    if (blocksToAdd.length > 0) {
      const displayIds = blocksToAdd.slice(0, 3).join('、')
      const message = blocksToAdd.length > 3
        ? `已成功加入${displayIds}等編號到清單！`
        : `已成功加入${displayIds}到清單！`
      showToast(message)
    }

    // 清空選取狀態
    setSelectedBlocks([])

    // 使用遞迴方式依序加入，確保 React 狀態更新週期完成
    // 解決 forEach + setTimeout 可能因間隔太短導致的狀態覆蓋問題
    const addNext = (index: number) => {
      if (index >= blocksToAdd.length) return

      const blockId = blocksToAdd[index]
      addToCartRef.current({
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

      // 增加延遲至 100ms，確保上一次的狀態更新已寫入
      setTimeout(() => {
        addNext(index + 1)
      }, 100)
    }

    addNext(0)
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

    const classroom = classroomData.find(c => c.id === id)
    if (classroom) {
      addToCart({
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
      showToast(`已成功加入 ${classroom.name} 到清單！`)
    }
  }

  // 判斷編號區是否被選中（主分類是 NumberedArea）
  const isNumberedAreaSelected = selectedMainCategory === 'NumberedArea'

  // 排序選取的區塊 ID (A-Z, 1-10)
  const sortedSelectedBlocks = useMemo(() => {
    return [...selectedBlocks].sort((a, b) => {
      const matchA = a.match(/^([A-Z]+)(\d+)$/)
      const matchB = b.match(/^([A-Z]+)(\d+)$/)

      if (!matchA || !matchB) {
        return a.localeCompare(b)
      }

      const [, letterA, numA] = matchA
      const [, letterB, numB] = matchB

      if (letterA !== letterB) {
        return letterA.localeCompare(letterB)
      }

      return parseInt(numA, 10) - parseInt(numB, 10)
    })
  }, [selectedBlocks])

  // 檢查是否有選中專案許可區的區塊
  const hasCasePermitBlocks = useMemo(() => {
    return selectedBlocks.some(blockId => {
      const blockData = mockAreaBlocksData[blockId]
      return blockData && (blockData.area === 'corridor' || blockData.area === 'pillar')
    })
  }, [selectedBlocks])

  return (
    <div className="bg-black text-white h-screen flex flex-col overflow-hidden">
      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: white transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px !important;
          display: block !important;
        }
        .custom-scrollbar::-webkit-scrollbar-button {
          display: none;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: white;
          border-radius: 0;
        }
      `}</style>
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
                      const hoverColor = isCasePermit ? 'hover:!text-yellow' : 'hover:!text-white'

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
                        <button
                          onClick={handleSelectAll}
                          disabled={!selectedSubCategory}
                          className={`text-small-title font-['Inter',_sans-serif] font-medium transition-colors ${
                            !selectedSubCategory ? 'text-gray-scale4 cursor-not-allowed' : 'text-white hover:text-gray-scale2 cursor-pointer'
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

                    {/* Add 按鈕 - 靠左對齊 */}
                    <div className="flex">
                      <button
                        onClick={handleAddBlocks}
                        disabled={!selectedSubCategory || selectedBlocks.length === 0 || (hasCasePermitBlocks && !hasProjectPermission) || !hasSelectedDates || wouldExceedLightLimitForBlocks}
                        className={`text-small-title font-['Inter',_sans-serif] font-medium transition-colors ${
                          !selectedSubCategory || selectedBlocks.length === 0 || (hasCasePermitBlocks && !hasProjectPermission) || !hasSelectedDates || wouldExceedLightLimitForBlocks ? 'text-gray-scale4 cursor-not-allowed' : 'text-white hover:text-gray-scale2 cursor-pointer'
                        }`}
                      >
                        Add
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
