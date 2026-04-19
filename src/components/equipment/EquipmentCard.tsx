/**
 * 設備卡片組件
 * 完全複製舊版的 UI
 */

import React, { useState, useEffect } from 'react'
import type { Equipment } from '../../types/equipment'
import { useBookmarkStore } from '../../stores/bookmarkStore'

interface EquipmentCardProps {
  equipment: Equipment
}

const EquipmentCard: React.FC<EquipmentCardProps> = ({ equipment }) => {
  const bookmarkStore = useBookmarkStore()
  const [isBookmarked, setIsBookmarked] = useState(bookmarkStore.isBookmarked(equipment.id))

  // 監聽 bookmark 變化
  useEffect(() => {
    const handleBookmarkUpdate = () => {
      setIsBookmarked(bookmarkStore.isBookmarked(equipment.id))
    }
    window.addEventListener('bookmarkUpdated', handleBookmarkUpdate)
    return () => window.removeEventListener('bookmarkUpdated', handleBookmarkUpdate)
  }, [bookmarkStore, equipment.id])

  const handleAddToCart = () => {
    console.log('Add to cart:', equipment.name)
    // TODO: 整合購物車邏輯
  }

  const handleToggleBookmark = () => {
    // 檢查登入狀態
    if (bookmarkStore.currentUserId === null) {
      alert('請先登入以使用收藏功能')
      // TODO: 重定向到登入頁面
      return
    }

    // 切換收藏狀態
    bookmarkStore.toggleBookmark(equipment.id)
    console.log('Toggle bookmark:', equipment.name)
  }

  const isAvailable = equipment.availableQuantity > 0

  return (
    <div className="equipment-card bg-zinc-900 rounded-lg overflow-hidden hover:bg-zinc-800 transition-colors duration-300">
      {/* 圖片區域 */}
      <div className="relative aspect-[4/3] bg-zinc-800">
        <img
          src={equipment.mainImage}
          alt={equipment.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* 收藏按鈕 */}
        <button
          onClick={handleToggleBookmark}
          className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
          aria-label={isBookmarked ? '取消收藏' : '加入收藏'}
        >
          <svg
            className="w-5 h-5"
            fill={isBookmarked ? '#ffffff' : 'none'}
            stroke="#ffffff"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21z" />
          </svg>
        </button>

        {/* 狀態標籤 */}
        <div className="absolute bottom-4 left-4">
          <span
            className={`font-chinese text-sm px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full ${
              isAvailable ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {equipment.status}
          </span>
        </div>
      </div>

      {/* 內容區域 */}
      <div className="p-6">
        {/* 分類 */}
        <p className="font-english text-zinc-400 text-xs uppercase tracking-wider mb-2">
          {equipment.category}
        </p>

        {/* 名稱 */}
        <h3 className="font-chinese text-white text-lg mb-3 line-clamp-2">
          {equipment.name}
        </h3>

        {/* 描述 */}
        <p className="font-chinese text-zinc-400 text-sm mb-4 line-clamp-3">
          {equipment.description}
        </p>

        {/* 數量信息 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-english text-zinc-400 text-xs">可借數量</p>
            <p className="font-english text-white text-lg font-medium">
              {equipment.availableQuantity} / {equipment.originalQuantity}
            </p>
          </div>
          <div className="text-right">
            <p className="font-english text-zinc-400 text-xs">押金</p>
            <p className="font-english text-white text-lg font-medium">
              NT$ {equipment.deposit}
            </p>
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-3">
          <a
            href={`/equipment-detail?id=${equipment.id}`}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-chinese text-sm py-3 px-4 rounded-lg transition-colors text-center"
          >
            查看詳情
          </a>
          <button
            onClick={handleAddToCart}
            disabled={!isAvailable}
            className={`flex-1 font-chinese text-sm py-3 px-4 rounded-lg transition-colors ${
              isAvailable
                ? 'bg-white hover:bg-zinc-200 text-black'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {isAvailable ? '加入購物車' : '已借完'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EquipmentCard
