/**
 * 教室列表組件
 * 以列表形式顯示教室，類似設備列表
 */

import React, { useState } from 'react'
import { useDateSelection } from '../../contexts/DateSelectionContext'
import { useCart } from '../../hooks/useCart'

interface Classroom {
  id: string
  name: string
  enName: string
  price: number
  image: string
}

interface ClassroomListProps {
  classrooms: Classroom[]
  onAdd: (id: string) => void
}

const ClassroomList: React.FC<ClassroomListProps> = ({ classrooms, onAdd }) => {
  const { getCurrentSpaceDates } = useDateSelection()
  const { cart, checkLittleBookingLimit, isSuspended } = useCart()
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  // 獲取當前模式的日期
  const spaceDates = getCurrentSpaceDates()

  // 檢查是否已選擇日期
  const hasSelectedDates = spaceDates.startDate !== null && spaceDates.endDate !== null

  // 檢查教室是否在購物車中
  const isInCart = (id: string) => cart.some(item => item.id === id && item.category === 'classroom')

  // 檢查加入教室後是否超過小量訂單 9 件限制
  const wouldExceedLightLimit = (classroom: Classroom): boolean => {
    if (!hasSelectedDates) return false

    const tempItem = {
      id: classroom.id,
      name: classroom.name,
      category: 'classroom',
      deposit: classroom.price,
      image: classroom.image,
      quantity: 1,
      startDate: spaceDates.startDate!.toISOString(),
      endDate: spaceDates.endDate!.toISOString(),
      bookingType: spaceDates.bookingType
    }

    return !checkLittleBookingLimit(tempItem).allowed
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

  return (
    <div className="w-full h-full flex flex-col pt-[60px]">
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
            alt="教室圖片"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 表頭 - 固定不滾動 - 始終顯示 */}
      <div className="grid grid-cols-[6px_80px_1fr_100px_100px_100px_120px_80px] gap-6 pb-3 border-b border-[#7c7c7c] flex-shrink-0">
        {/* 狀態指示器列 */}
        <div></div>

        {/* 圖片列 */}
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2"></div>

        {/* 教室名稱列 - 空白（不顯示標簽） */}
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2"></div>

        {/* 總數量列 */}
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-center">
          Total Qty<br />總數量
        </div>

        {/* 可借數量列 */}
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-center">
          Available Qty<br />可借數量
        </div>

        {/* 保留中數量列 */}
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-center flex items-center justify-center gap-1">
          <div>
            On Hold<br />待繳押金
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

        {/* 押金列 */}
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-center">
          Deposit<br />押金
        </div>

        {/* 操作列 - 空白（不顯示標簽） */}
        <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2 text-center"></div>
      </div>

      {classrooms.length > 0 ? (
        // 教室列表 - 可滾動
        <div className="flex-1 overflow-y-auto">
          {classrooms.map(classroom => {
            const inCart = isInCart(classroom.id)
            const isAvailable = !inCart
            const statusColor = inCart ? 'var(--color-error)' : 'var(--color-success)'
            const wouldExceedLimit = wouldExceedLightLimit(classroom)

            return (
              <div
                key={classroom.id}
                className="grid grid-cols-[6px_80px_1fr_100px_100px_100px_120px_80px] gap-6 py-3 border-b border-[#7c7c7c] items-center transition-colors"
              >
                {/* 狀態指示器 - 獨立的 grid 列 */}
                <div
                  className="h-full w-full"
                  style={{
                    backgroundColor: statusColor
                  }}
                />

                {/* 教室圖片 */}
                <div
                  className="w-[80px] h-[80px] flex-shrink-0 cursor-pointer overflow-hidden rounded-lg"
                  onClick={(e) => handleImageClick(e, classroom.image)}
                >
                  <img
                    src={classroom.image}
                    alt={classroom.name}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                  />
                </div>

                {/* 教室名稱 - 英文在上，中文在下 */}
                <div className={`flex flex-col ${!isAvailable ? 'text-[#545454]' : 'text-white'}`}>
                  <span className="font-['Inter',_sans-serif] text-small-title">
                    {classroom.enName}
                  </span>
                  <span className="font-['Noto_Sans_TC',_sans-serif] text-small-title">
                    {classroom.name}
                  </span>
                </div>

                {/* 總數量 - 教室固定為 1 */}
                <div className={`font-['Inter',_sans-serif] text-small-title text-center ${
                  !isAvailable ? 'text-[#545454]' : 'text-white'
                }`}>
                  1
                </div>

                {/* 可借數量 - 在購物車中為 0，否則為 1 */}
                <div className={`font-['Inter',_sans-serif] text-small-title text-center ${
                  !isAvailable ? 'text-[#545454]' : 'text-white'
                }`}>
                  {isAvailable ? 1 : 0}
                </div>

                {/* 保留中數量 - 暫時顯示假數據 */}
                <div className={`font-['Inter',_sans-serif] text-small-title text-center ${
                  !isAvailable ? 'text-[#545454]' : 'text-white'
                }`}>
                  0
                </div>

                {/* 押金 */}
                <div className={`font-['Inter',_sans-serif] text-small-title text-center ${
                  !isAvailable ? 'text-[#545454]' : 'text-white'
                }`}>
                  NT$ {classroom.price.toLocaleString()}
                </div>

                {/* Add 按鈕 */}
                <div className="flex justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAdd(classroom.id)
                    }}
                    disabled={!isAvailable || !hasSelectedDates || wouldExceedLimit}
                    className={`font-['Inter',_sans-serif] text-small-title ${
                      isAvailable && hasSelectedDates && !wouldExceedLimit && !isSuspended
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
          <p className="font-['Inter',_sans-serif] text-gray-scale2 text-small-title">No Classroom Found</p>
          <p className="font-['Noto_Sans_TC',_sans-serif] text-gray-scale2 text-small-title">找不到符合條件的教室</p>
        </div>
      )}
    </div>
  )
}

export default ClassroomList
