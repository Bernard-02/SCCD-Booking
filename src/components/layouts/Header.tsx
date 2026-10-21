/**
 * Header 組件
 * 桌機：左 logo（回型錄）；右 Info（開 InfoDialog：教學／系學會／關於）、Cart、通知 三個 icon
 * Profile 與外部連結在 Footer
 */

import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../contexts/AuthContext'
import { fetchMyNotifications, markAllNotificationsRead } from '../../services/notificationsService'
import type { AppNotification as Notification } from '../../services/notificationsService'
import InfoDialog from '../common/InfoDialog'
import type { InfoTab } from '../common/InfoDialog'
import { useT } from '../../stores/langStore'

interface HeaderProps {
  hideNavigation?: boolean // 是否隱藏右側導航按鈕
}

const Header: React.FC<HeaderProps> = ({ hideNavigation = false }) => {
  const location = useLocation()
  const t = useT()
  const { cart } = useCart()
  const { isAuthenticated, currentUser } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [notificationMenuOpen, setNotificationMenuOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [infoTab, setInfoTab] = React.useState<InfoTab | null>(null) // null＝InfoDialog 關閉

  // 讀取通知（Supabase，7 天內；已讀狀態存資料庫）
  React.useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([])
      return
    }

    let mounted = true
    const load = () => {
      fetchMyNotifications()
        .then(list => { if (mounted) setNotifications(list) })
        .catch(err => console.error('讀取通知失敗:', err))
    }

    load()
    // 送單成功後（useOrderSubmission dispatch）即時刷新
    window.addEventListener('notificationUpdated', load)
    return () => {
      mounted = false
      window.removeEventListener('notificationUpdated', load)
    }
  }, [isAuthenticated, currentUser])

  // 計算未讀數量
  const unreadCount = notifications.filter(n => !n.read).length

  // 處理通知點擊
  const handleNotificationClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (notificationMenuOpen) {
      closeNotificationMenu()
    } else {
      setNotificationMenuOpen(true)
    }
  }

  // 關閉通知選單（X、點選單外、或再點一次鈴鐺）＝看過即全部已讀：本地樂觀更新 + 寫入資料庫
  const closeNotificationMenu = () => {
    setNotificationMenuOpen(false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    markAllNotificationsRead()
  }


  // 點擊外部關閉下拉選單
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // 處理 Notification Dropdown
      if (notificationMenuOpen && !target.closest('.notification-dropdown-container')) {
        closeNotificationMenu()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notificationMenuOpen])

  // 格式化日期：2026/01/24 4:14PM
  const formatNotificationDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    let hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    return `${year}/${month}/${day} ${hours}:${minutes}${ampm}`
  }

  // 格式化時間差距：Just Now, 3 Mins Ago, 3 Hours Ago, 3 Days Ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minuteMs = 60000
    const hourMs = 3600000
    const dayMs = 86400000

    if (diff < minuteMs) return 'Just Now'
    if (diff < hourMs) {
      const mins = Math.floor(diff / minuteMs)
      return `${mins} Min${mins > 1 ? 's' : ''} Ago`
    }
    if (diff < dayMs) {
      const hours = Math.floor(diff / hourMs)
      return `${hours} Hour${hours > 1 ? 's' : ''} Ago`
    }
    const days = Math.floor(diff / dayMs)
    return `${days} Day${days > 1 ? 's' : ''} Ago`
  }

  // 計算購物車項目總數
  // 設備：累加所有設備的數量，編號區：每個區塊算1個，教室：每間教室算1個
  const cartCount = React.useMemo(() => {
    const equipmentCount = cart
      .filter(item => item.category === 'equipment')
      .reduce((sum, item) => sum + item.quantity, 0)
    const spaceBlockCount = cart.filter(item => item.category === 'space-block').length
    const classroomCount = cart.filter(item => item.category === 'classroom').length
    return equipmentCount + spaceBlockCount + classroomCount
  }, [cart])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-transparent header-main">
        <div className="container">
          <div className="flex justify-between items-center">
            <Link to="/catalog" className="font-['Inter',_sans-serif] font-bold text-white text-md">
              SCCDSA Booking
            </Link>

            {/* 桌面版導航 - 如果 hideNavigation 為 true 則隱藏 */}
            {!hideNavigation && (
              <nav className="flex items-center desktop-nav gap-6">
                {/* Info：開 InfoDialog（左分頁、右內容） */}
                <button
                  type="button"
                  onClick={() => setInfoTab('guide')}
                  className="flex items-center text-white cursor-pointer"
                  aria-label="Info"
                >
                  <span className="material-symbols-outlined text-md">info</span>
                </button>

                {/* Cart：右上角數量徽章 */}
                <Link
                  to="/cart"
                  state={{ from: location.pathname === '/equipment' ? 'equipment' : location.pathname === '/space' ? 'space' : undefined }}
                  className="relative flex items-center text-white"
                  aria-label={`${t('Cart', '清單')} (${cartCount})`}
                >
                  <span className="material-symbols-outlined text-md">shopping_cart</span>
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-white text-black text-2xs leading-4 text-center">
                      {cartCount}
                    </span>
                  )}
                </Link>

                {/* 通知鈴鐺 */}
                <div className="notification-dropdown-container relative">
                  <Link
                    to="#"
                    onClick={handleNotificationClick}
                    className="relative flex items-center text-white cursor-pointer"
                    aria-label="Notification"
                  >
                    <span className="material-symbols-outlined text-md">
                      notifications
                    </span>
                    {/* 全域紅點：只有在選單關閉且有未讀訊息時顯示 */}
                    {unreadCount > 0 && !notificationMenuOpen && (
                      <span className="absolute top-0 right-0 bg-[#ff448a] rounded-full w-2 h-2"></span>
                    )}
                  </Link>

                  {/* Notification Dropdown */}
                  {notificationMenuOpen && (
                    <div
                      className="absolute top-full right-0 mt-6 w-[400px] bg-[#151515] border border-[#545454] rounded-2xl overflow-hidden"
                      style={{ zIndex: 1000 }}
                    >
                      {/* Header */}
                      <div className="flex justify-between items-center p-4 border-b border-[#545454]">
                        <h2 className="text-sm text-white">
                          {t('Notification', '通知')}
                        </h2>
                        <button
                          type="button"
                          onClick={closeNotificationMenu}
                          className="text-white hover:opacity-70 transition-opacity cursor-pointer flex items-center"
                          aria-label="Close"
                        >
                          <span className="material-icons text-lg">close</span>
                        </button>
                      </div>

                      {/* List */}
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <p className="text-xs text-gray-scale2">
                              目前沒有新通知
                            </p>
                          </div>
                        ) : (
                          notifications.map((n, index) => (
                            <React.Fragment key={n.id}>
                              <div className="p-4 transition-colors hover:bg-white/5">
                                {/* 內容＋右側未讀紅點 */}
                                <div className="flex gap-3 mb-2">
                                  <p className="flex-1 text-white text-xs leading-relaxed">
                                    {n.announcement && (
                                      <span className="inline-block mr-2 px-1.5 rounded border border-white text-[0.7rem] leading-4 align-[1px]">公告</span>
                                    )}
                                    {n.content}
                                  </p>
                                  {!n.read && <span className="mt-2 w-2 h-2 shrink-0 bg-[#ff448a] rounded-full" />}
                                </div>

                                {/* 底部資訊 */}
                                <div className="flex justify-between items-end">
                                  <span className="font-['Inter',_sans-serif] text-gray-scale2 text-xs">
                                    {formatNotificationDate(n.timestamp)}
                                  </span>
                                  <span className="font-['Inter',_sans-serif] text-gray-scale2 text-xs">
                                    {formatTimeAgo(n.timestamp)}
                                  </span>
                                </div>
                              </div>
                              {/* Separator */}
                              {index < notifications.length - 1 && (
                                <div className="h-[1px] bg-[#545454]"></div>
                              )}
                            </React.Fragment>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </nav>
            )}

            {/* 手機版導航 - 如果 hideNavigation 為 true 則隱藏 */}
            {!hideNavigation && (
              <nav className="flex items-center mobile-nav mobile-nav-gap">
                <Link
                  to="/cart"
                  state={{ from: location.pathname === '/equipment' ? 'equipment' : location.pathname === '/space' ? 'space' : undefined }}
                  className="font-['Inter',_sans-serif] font-bold uppercase transition-colors text-white flex items-center"
                >
                  <div className="menu-item-wrapper">
                    <span className="menu-text">
                      ((<span id="mobile-cart-count">{cartCount}</span>) CART)
                    </span>
                    <span className="menu-text-hidden">
                      ((<span className="mobile-cart-count-mirror">{cartCount}</span>) CART)
                    </span>
                  </div>
                </Link>
                <button
                  id="mobile-menu-btn"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="font-['Inter',_sans-serif] font-bold uppercase transition-colors text-white flex items-center"
                >
                  <div className="menu-item-wrapper">
                    <span className="menu-text">(MENU)</span>
                    <span className="menu-text-hidden">(MENU)</span>
                  </div>
                </button>
              </nav>
            )}
          </div>
        </div>
      </header>

      {/* 手機版選單 */}
      <div className={`mobile-menu md:hidden ${mobileMenuOpen ? 'open' : ''}`} id="mobile-menu">
        <div className="mobile-menu-content">
          <div className="flex flex-col items-start menu-gap flex-grow">
            <div className="menu-animate-enter">
              <div className="menu-animate-enter-content menu-delay-1">
                <Link
                  to="/catalog"
                  className="font-['Inter',_sans-serif] font-bold uppercase transition-colors text-white text-h3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="menu-item-wrapper">
                    <span className="menu-text">(BOOKING)</span>
                    <span className="menu-text-hidden">(BOOKING)</span>
                  </div>
                </Link>
              </div>
            </div>
            <div className="menu-animate-enter">
              <div className="menu-animate-enter-content menu-delay-2">
                <Link
                  to="/login"
                  className="font-['Inter',_sans-serif] font-bold uppercase transition-colors text-white text-h3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="menu-item-wrapper">
                    <span className="menu-text">(LOGIN)</span>
                    <span className="menu-text-hidden">(LOGIN)</span>
                  </div>
                </Link>
              </div>
            </div>
            <div className="menu-animate-enter">
              <div className="menu-animate-enter-content menu-delay-3">
                <a
                  href="https://sccd.usc.edu.tw/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-['Inter',_sans-serif] font-bold uppercase transition-colors text-white text-h3"
                >
                  <div className="menu-item-wrapper">
                    <span className="menu-text">(TO SCCD)</span>
                    <span className="menu-text-hidden">(TO SCCD)</span>
                  </div>
                </a>
              </div>
            </div>
            <div className="menu-animate-enter">
              <div className="menu-animate-enter-content menu-delay-4">
                <button
                  type="button"
                  className="font-['Inter',_sans-serif] font-bold uppercase transition-colors text-white text-h3"
                  onClick={() => { setMobileMenuOpen(false); setInfoTab('about') }}
                >
                  <div className="menu-item-wrapper">
                    <span className="menu-text">(ABOUT)</span>
                    <span className="menu-text-hidden">(ABOUT)</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Copyright 在底部 */}
          <div className="menu-animate-enter mobile-menu-content-bottom">
            <div className="menu-animate-enter-content menu-delay-5">
              <div className="copyright font-['Inter',_sans-serif] font-bold text-white text-left text-xl">
                <p>
                  <span className="copyright-original">
                    <span className="font-['Inter',_sans-serif] uppercase">Copyright © SCCDSA</span>
                    <span className="font-['Inter',_sans-serif]"> All rights reserved.</span>
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info lightbox：使用教學／系學會／關於 */}
      <InfoDialog tab={infoTab} onTabChange={setInfoTab} onClose={() => setInfoTab(null)} />
    </>
  )
}

export default Header
