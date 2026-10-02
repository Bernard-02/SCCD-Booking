/**
 * 設備租借頁面 - React 新版
 * 對應原本的 equipment.html
 */

import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'
import EquipmentGrid from '../components/equipment/EquipmentGrid'
import DatePickerBar from '../components/DatePickerBar'
import { EQUIPMENT_CATEGORIES } from '../types/equipment'
import type { BookingType } from '../types/equipment'
import { useDateSelection } from '../contexts/DateSelectionContext'

const EquipmentPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { setEquipmentDates } = useDateSelection()

  // 判斷是否從購物車過來 (用於顯示 Back to Cart)
  const fromCart = location.state?.from === 'cart'

  // 初始化：如果 URL 有帶日期參數，則預先填入 (僅執行一次)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const bookingTypeStr = searchParams.get('bookingType')

    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr)
      const end = new Date(endDateStr)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        setEquipmentDates(start, end, (bookingTypeStr as BookingType) || 'little')
      }
    }
  }, []) // 空依賴陣列確保只在組件掛載時執行一次

  // 處理麵包屑返回
  const handleBreadcrumbBack = (e: React.MouseEvent) => {
    e.preventDefault()
    if (fromCart) {
      // 鎖定模式：直接返回購物車
      navigate('/cart')
    } else {
      // 正常模式：返回上一頁
      navigate(-1)
    }
  }

  const [selectedCategory, setSelectedCategory] = useState<string>('全部')
  const [statusFilters, setStatusFilters] = useState<Set<'available' | 'unavailable' | 'partial'>>(
    new Set(['available', 'unavailable', 'partial'])
  )

  // 狀態篩選多選：全亮時點第一下只留那個，之後點其他的累加、點已選中的取消；全取消則恢復顯示全部
  const toggleStatusFilter = (status: 'available' | 'unavailable' | 'partial') => {
    setStatusFilters(prev => {
      const all: ('available' | 'unavailable' | 'partial')[] = ['available', 'unavailable', 'partial']
      if (prev.size === all.length) return new Set([status])
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next.size === 0 ? new Set(all) : next
    })
  }

  // 分類列表：全部＋固定分類（與後台設備管理共用 EQUIPMENT_CATEGORIES）＋收藏
  const categories = [
    { en: 'All', zh: '全部', icon: 'apps' },
    ...EQUIPMENT_CATEGORIES,
    { en: 'Favorites', zh: '收藏', icon: 'bookmark' }
  ]

  return (
    <div className="bg-black text-white h-screen flex flex-col overflow-hidden">
      <Header />

      <main className="flex-1 pt-20 flex flex-col overflow-hidden relative">
        {/* 麵包屑 - Fixed 在畫面上 */}
        <div className="container hidden md:block fixed top-20 left-0 right-0 z-10">
          <div className="text-left" style={{ paddingBottom: '1.08rem' }}>
            <nav className="breadcrumb-inline whitespace-nowrap">
              <a onClick={handleBreadcrumbBack} className="breadcrumb-item text-xs cursor-pointer">
                &lt;
              </a>
              <span> </span>
              <a onClick={handleBreadcrumbBack} className="breadcrumb-item text-xs cursor-pointer">
                {fromCart ? (
                  <>
                    <span className="font-['Inter',_sans-serif]">Cart</span> <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">購物車</span>
                  </>
                ) : (
                  <>
                    <span className="font-['Inter',_sans-serif]">Category</span> <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">類別</span>
                  </>
                )}
              </a>
              <span className="breadcrumb-separator text-xs">/</span>
              <span className="breadcrumb-item text-xs">
                <span className="font-['Inter',_sans-serif]">Equipment</span> <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">設備</span>
              </span>
            </nav>
          </div>
        </div>

        <div className="container hidden md:flex flex-1 gap-6 overflow-hidden items-stretch pb-20">
          {/* 左側欄位：20% */}
          <div className="w-[20%] flex-shrink-0 flex flex-col overflow-hidden">
            {/* 標題 - 加上 padding-top 避免被麵包屑遮擋 */}
            <div className="flex-shrink-0">
              <h1 className="font-['Inter',_sans-serif] text-white text-xl pt-12">
                Equipment
              </h1>
              <h1 className="font-['Inter','Noto_Sans_TC',_sans-serif] text-white text-xl mb-6">
                設備
              </h1>
            </div>

            {/* 下方區塊：分類 Filter + Legend */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 分類 Filter - 頂部 */}
              <div className="flex flex-col gap-4 flex-shrink-0">
                {categories.map((category) => (
                  <div key={category.en} className="text-left">
                    <button
                      onClick={() => setSelectedCategory(category.zh)}
                      className={`text-sm font-bold transition-colors cursor-pointer inline-flex items-center gap-2 ${
                        selectedCategory === category.zh
                          ? 'text-white'
                          : 'text-gray-scale2 hover:!text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px' }}>
                        {category.icon}
                      </span>
                      <span>
                        <span className="font-['Inter',_sans-serif]">{category.en}</span> <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">{category.zh}</span>
                      </span>
                    </button>
                  </div>
                ))}
              </div>

              {/* 中間空白區域 - 自動填充 */}
              <div className="flex-1"></div>

              {/* 狀態篩選 Legend - 底部 */}
              <div className="flex-shrink-0">
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => toggleStatusFilter('available')}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-3 h-3 bg-[#00ff80]"></div>
                    <span className={`text-xs transition-colors ${
                      statusFilters.has('available') ? 'text-white' : 'text-gray-scale2 group-hover:!text-white'
                    }`}>
                      <span className="font-['Inter',_sans-serif]">Available</span> <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">全時段借用</span>
                    </span>
                  </button>

                  <button
                    onClick={() => toggleStatusFilter('unavailable')}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-3 h-3 bg-[#ff448a]"></div>
                    <span className={`text-xs transition-colors ${
                      statusFilters.has('unavailable') ? 'text-white' : 'text-gray-scale2 group-hover:!text-white'
                    }`}>
                      <span className="font-['Inter',_sans-serif]">Unavailable</span> <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">不可借用</span>
                    </span>
                  </button>

                  <button
                    onClick={() => toggleStatusFilter('partial')}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-3 h-3 bg-[#ffa500]"></div>
                    <span className={`text-xs transition-colors ${
                      statusFilters.has('partial') ? 'text-white' : 'text-gray-scale2 group-hover:!text-white'
                    }`}>
                      <span className="font-['Inter',_sans-serif]">Partially Available</span> <span className="font-['Inter','Noto_Sans_TC',_sans-serif]">部分時段借用</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 右側欄位：80% - 可滾動 */}
          <div className="w-[80%] min-w-0 overflow-y-auto flex-1">
            <EquipmentGrid
              selectedCategory={selectedCategory}
              statusFilters={statusFilters}
            />
          </div>
        </div>

        {/* 時間選擇欄 */}
        <DatePickerBar
          type="equipment"
        />
      </main>

      <Footer />
    </div>
  )
}

export default EquipmentPage
