/**
 * 設備租借頁面 - React 新版
 * 對應原本的 equipment.html
 */

import { BTN, BTN_TOOL } from '@/components/common/btn'
import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Header from '../components/layouts/Header'
import Collapse from '../components/common/Collapse'
import BackButton from '../components/common/BackButton'
import { navItemCls } from '../components/common/navItem'
import Footer from '../components/layouts/Footer'
import EquipmentGrid from '../components/equipment/EquipmentGrid'
import DatePickerBar from '../components/DatePickerBar'
import { EQUIPMENT_CATEGORIES } from '../types/equipment'
import type { BookingType } from '../types/equipment'
import { useDateSelection } from '../contexts/DateSelectionContext'
import { useT } from '../stores/langStore'

const EquipmentPage: React.FC = () => {
  const t = useT()
  const location = useLocation()
  const { setEquipmentDates } = useDateSelection()

  // 初始化：如果 URL 有帶日期參數，則預先填入 (僅執行一次)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const bookingTypeStr = searchParams.get('bookingType')

    if (startDateStr && endDateStr) {
      // 'YYYY-MM-DD' 會被當 UTC 解析（台灣早上 8 點），歸零成本地午夜
      const start = new Date(startDateStr)
      const end = new Date(endDateStr)
      start.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        setEquipmentDates(start, end, (bookingTypeStr as BookingType) || 'little')
      }
    }
  }, []) // 空依賴陣列確保只在組件掛載時執行一次

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

  const [legendOpen, setLegendOpen] = useState(false) // lg 以下才有作用

  // 分類列表：全部＋固定分類（與後台設備管理共用 EQUIPMENT_CATEGORIES）＋收藏
  const categories = [
    { en: 'All', zh: '全部', icon: 'apps' },
    ...EQUIPMENT_CATEGORIES,
    { en: 'Favorites', zh: '收藏', icon: 'bookmark' }
  ]

  return (
    <div className="bg-black text-white h-dvh flex flex-col overflow-hidden">
      <Header />

      <main className="flex-1 pt-20 max-lg:pt-16 flex flex-col overflow-hidden relative">
        <div className="container flex flex-1 gap-6 overflow-hidden items-stretch pb-6 max-lg:flex-col max-lg:gap-3 max-lg:pb-3">
          {/* 左側欄位：20% */}
          <div className="w-[20%] max-lg:w-full flex-shrink-0 flex flex-col overflow-hidden">
            {/* 返回上一頁＋標題在箭頭下方 */}
            <div className="flex-shrink-0 max-lg:flex max-lg:items-center max-lg:gap-3">
              <BackButton />
              <h1 className="text-white text-xl mb-6 max-lg:mb-0 max-lg:text-md">{t('Equipment', '設備')}</h1>
              {/* lg 以下圖例收起來，這顆展開；有篩選時標粉點，收著也看得出來 */}
              <button
                type="button"
                onClick={() => setLegendOpen(o => !o)}
                aria-expanded={legendOpen}
                className={`lg:hidden ml-auto ${BTN_TOOL} ${legendOpen ? 'cursor-pointer' : BTN}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>filter_list</span>
                {t('Status', '狀態')}
                {!legendOpen && statusFilters.size < 3 && <span className="w-2 h-2 rounded-full bg-pink" />}
              </button>
            </div>

            {/* 下方區塊：分類 Filter + Legend */}
            <div className="flex-1 flex flex-col overflow-y-auto gap-6 max-lg:mt-3 max-lg:gap-0">
              {/* 分類 Filter - 頂部：膠囊選單（同空間頁／Profile），inline-flex＝各項同寬 */}
              <nav className="inline-flex flex-col gap-1 flex-shrink-0 self-start max-lg:flex-row max-lg:self-stretch max-lg:overflow-x-auto">
                {categories.map((category) => (
                  <button
                    key={category.en}
                    onClick={() => setSelectedCategory(category.zh)}
                    className={`${navItemCls(selectedCategory === category.zh)} max-lg:shrink-0 max-lg:whitespace-nowrap`}
                  >
                    <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '20px' }}>
                      {category.icon}
                    </span>
                    <span>{t(category.en, category.zh)}</span>
                  </button>
                ))}
              </nav>

              {/* 中間空白區域 - 自動填充 */}
              <div className="flex-1 max-lg:hidden"></div>

              {/* 狀態篩選 Legend - 底部 */}
              <div className="flex-shrink-0">
                <Collapse open={legendOpen} below="lg">
                <div className="flex flex-col gap-3 max-lg:flex-row max-lg:flex-wrap max-lg:gap-x-4 max-lg:gap-y-1 max-lg:pt-3">
                  <button
                    onClick={() => toggleStatusFilter('available')}
                    className={`flex items-center gap-2 ${BTN}`}
                  >
                    <div className="w-3 h-3 bg-green"></div>
                    <span className={`text-xs ${
                      statusFilters.has('available') ? 'text-white' : 'text-gray-light'
                    }`}>
                      {t('Available', '全時段借用')}
                    </span>
                  </button>

                  <button
                    onClick={() => toggleStatusFilter('unavailable')}
                    className={`flex items-center gap-2 ${BTN}`}
                  >
                    <div className="w-3 h-3 bg-pink"></div>
                    <span className={`text-xs ${
                      statusFilters.has('unavailable') ? 'text-white' : 'text-gray-light'
                    }`}>
                      {t('Unavailable', '不可借用')}
                    </span>
                  </button>

                  <button
                    onClick={() => toggleStatusFilter('partial')}
                    className={`flex items-center gap-2 ${BTN}`}
                  >
                    <div className="w-3 h-3 bg-orange"></div>
                    <span className={`text-xs ${
                      statusFilters.has('partial') ? 'text-white' : 'text-gray-light'
                    }`}>
                      {t('Partially Available', '部分時段借用')}
                    </span>
                  </button>
                </div>
                </Collapse>
              </div>
            </div>
          </div>

          {/* 右側欄位：80% - 可滾動 */}
          <div className="w-[80%] max-lg:w-full min-w-0 overflow-y-auto flex-1">
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
