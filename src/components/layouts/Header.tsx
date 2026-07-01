/**
 * Header 組件
 * 從 index-old.html 遷移
 */

import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../contexts/AuthContext'
import { readNotificationsKey } from '../../utils/storageKeys'

interface HeaderProps {
  hideNavigation?: boolean // 是否隱藏右側導航按鈕
}

interface Notification {
  id: string
  content: string
  timestamp: number
  read: boolean
}

const Header: React.FC<HeaderProps> = ({ hideNavigation = false }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { cart } = useCart()
  const { logout, isAuthenticated, currentUser } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false)
  const [notificationMenuOpen, setNotificationMenuOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState<Notification[]>([])

  // 初始化模擬通知數據
  React.useEffect(() => {
    const now = Date.now()
    const dayMs = 86400000
    const hourMs = 3600000
    const minuteMs = 60000

    // 模擬數據：包含各種狀態，分佈在不同時間
    const mockNotifications: Notification[] = [
      {
        id: '1',
        content: '您的訂單 #2026005 已通過審核',
        timestamp: now - 5 * minuteMs, // 5分鐘前
        read: false
      },
      {
        id: '2',
        content: '您的訂單 #2026006 已送出，請及時至系學會繳交押金',
        timestamp: now - 2 * hourMs, // 2小時前
        read: false
      },
      {
        id: '3',
        content: '您的訂單 #2026004 剩3天到期，請及時至系學會完成清潔歸還',
        timestamp: now - 1 * dayMs, // 1天前
        read: true // 已讀
      },
      {
        id: '4',
        content: '系學會工作時間異動：2026/02/28 12:00-13:00 暫不開放',
        timestamp: now - 3 * dayMs, // 3天前
        read: false
      },
      {
        id: '5',
        content: '您的訂單 #2026003 已完成清潔歸還',
        timestamp: now - 5 * dayMs, // 5天前
        read: true
      },
      {
        id: '6',
        content: '您的訂單 #2026002 已逾期',
        timestamp: now - 8 * dayMs, // 8天前 (應該被過濾掉)
        read: false
      }
    ]

    // 過濾掉超過7天的通知，並按時間倒序排列
    const validNotifications = mockNotifications
      .filter(n => now - n.timestamp < 7 * dayMs)
      .sort((a, b) => b.timestamp - a.timestamp)

    // 讀取本地存儲的已讀狀態
    // 使用用戶 ID 作為 key 的一部分，區分不同用戶的已讀狀態
    const storageKey = readNotificationsKey(currentUser?.studentId)
    const readIds = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[]

    // 合併已讀狀態
    const finalNotifications = validNotifications.map(n => ({
      ...n,
      read: n.read || readIds.includes(n.id)
    }))

    setNotifications(finalNotifications)
  }, [currentUser])

  // 計算未讀數量
  const unreadCount = notifications.filter(n => !n.read).length

  // 固定旋轉角度
  const rotationAngles: Record<string, number> = {
    '/guide': 1,
    '/sa': -3,
    '/catalog': -1,
    '/rental-list': 3,
    '/profile': -5
  }

  // 獲取固定角度
  const getAngle = (path: string): number => {
    return rotationAngles[path] || 0
  }

  // 處理登出
  const handleLogout = async () => {
    await logout()
    setProfileDropdownOpen(false)
    navigate('/login', { replace: true })
  }

  // 處理通知點擊
  const handleNotificationClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (notificationMenuOpen) {
      closeNotificationMenu()
    } else {
      setNotificationMenuOpen(true)
      setProfileDropdownOpen(false) // 關閉其他選單
    }
  }

  // 關閉通知選單（並標記所有為已讀）
  const closeNotificationMenu = () => {
    setNotificationMenuOpen(false)
    // 關閉時將所有通知標記為已讀
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      // 保存已讀 ID 到 localStorage
      const readIds = updated.map(n => n.id)
      const storageKey = readNotificationsKey(currentUser?.studentId)
      localStorage.setItem(storageKey, JSON.stringify(readIds))
      return updated
    })
  }

  // 處理 Profile 按鈕點擊
  const handleProfileClick = (e: React.MouseEvent) => {
    if (location.pathname === '/profile') {
      e.preventDefault()
      setProfileDropdownOpen(!profileDropdownOpen)
      setNotificationMenuOpen(false) // 關閉其他選單
    }
  }

  // 點擊外部關閉下拉選單
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // 處理 Profile Dropdown
      if (profileDropdownOpen && !target.closest('.profile-dropdown-container')) {
        setProfileDropdownOpen(false)
      }
      
      // 處理 Notification Dropdown
      if (notificationMenuOpen && !target.closest('.notification-dropdown-container')) {
        closeNotificationMenu()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profileDropdownOpen, notificationMenuOpen])

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

  // 檢查是否為當前頁面
  const isActive = (path: string) => {
    // 如果在訂單頁面，Profile 也應該是 active 狀態
    if (path === '/profile' && location.pathname === '/order') {
      return true
    }
    // Catalog 頁面及其子頁面 (Equipment, Space)
    if (path === '/catalog' && (location.pathname === '/equipment' || location.pathname === '/space')) {
      return true
    }
    return location.pathname === path
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-transparent header-main">
        <div className="container">
          <div className="flex justify-between items-center">
            <div className="flex items-center" style={{ gap: '1.5rem' }}>
              <Link
                to={isAuthenticated ? "/catalog" : "/"}
                className="font-['Inter',_sans-serif] font-medium text-white text-header"
              >
                SCCDSA Booking
              </Link>

              {/* Guide - 放在 logo 右邊 */}
              {!hideNavigation && (
                <Link
                  to="/guide"
                  className={`font-['Inter',_sans-serif] font-medium transition-colors text-white flex items-center text-header header-nav-link ${isActive('/guide') ? 'active' : ''}`}
                  style={{ '--rotation-angle': `${getAngle('/guide')}deg` } as React.CSSProperties}
                >
                  <span>Guide</span>
                  <span className="chinese-label">&nbsp;教學</span>
                </Link>
              )}
            </div>

            {/* 桌面版導航 - 如果 hideNavigation 為 true 則隱藏 */}
            {!hideNavigation && (
              <nav className="flex items-center header-menu desktop-nav nav-gap relative">
                <Link
                  to="/sa"
                  className={`font-['Inter',_sans-serif] font-medium transition-colors text-white flex items-center text-header header-nav-link ${isActive('/sa') ? 'active' : ''}`}
                  style={{ '--rotation-angle': `${getAngle('/sa')}deg` } as React.CSSProperties}
                >
                  <span>SA</span>
                  <span className="chinese-label">&nbsp;系學會</span>
                </Link>
                <Link
                  to="/catalog"
                  className={`font-['Inter',_sans-serif] font-medium transition-colors text-white flex items-center text-header header-nav-link ${isActive('/catalog') ? 'active' : ''}`}
                  style={{ '--rotation-angle': `${getAngle('/catalog')}deg` } as React.CSSProperties}
                >
                  <span>Catalog</span>
                  <span className="chinese-label">&nbsp;型錄</span>
                </Link>
                <Link
                  to="/rental-list"
                  state={{ from: location.pathname === '/equipment' ? 'equipment' : location.pathname === '/space' ? 'space' : undefined }}
                  className={`font-['Inter',_sans-serif] font-medium transition-colors text-white flex items-center text-header header-nav-link ${isActive('/rental-list') ? 'active' : ''}`}
                  style={{ '--rotation-angle': `${getAngle('/rental-list')}deg` } as React.CSSProperties}
                >
                  <span>Cart<span className="chinese-label">&nbsp;清單</span> (<span id="cart-count">{cartCount}</span>)</span>
                </Link>
                <div className="profile-dropdown-container relative">
                  <Link
                    to="/profile"
                    onClick={handleProfileClick}
                    className={`font-['Inter',_sans-serif] font-medium transition-colors text-white flex items-center text-header header-nav-link ${isActive('/profile') ? 'active' : ''}`}
                    style={{ '--rotation-angle': `${getAngle('/profile')}deg` } as React.CSSProperties}
                  >
                    <span>Profile</span>
                    <span className="chinese-label">&nbsp;我的</span>
                  </Link>

                  {/* Dropdown Menu */}
                  {profileDropdownOpen && location.pathname === '/profile' && (
                    <div
                      className="absolute top-full right-0 mt-6 bg-[#151515] border border-[#545454] overflow-hidden"
                      style={{ zIndex: 1000 }}
                    >
                      {/* Content */}
                      <div className="flex justify-between items-center p-4 gap-4">
                        <button
                          onClick={handleLogout}
                          className="text-white hover:opacity-70 transition-opacity cursor-pointer whitespace-nowrap"
                        >
                          <span className="font-['Inter',_sans-serif] text-tiny">Log Out</span>{' '}
                          <span className="font-['Noto_Sans_TC',_sans-serif] text-tiny">登出</span>
                        </button>
                        <button
                          onClick={() => setProfileDropdownOpen(false)}
                          className="text-white hover:opacity-70 transition-opacity cursor-pointer flex items-center"
                          aria-label="Close"
                        >
                          <span className="material-icons text-[24px]">close</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {/* 通知鈴鐺 Container - 移到 Profile 右邊 */}
                <div className="notification-dropdown-container">
                  <Link
                    to="#"
                    onClick={handleNotificationClick}
                    className="relative flex items-center text-white hover:opacity-70 transition-opacity cursor-pointer"
                    style={{ '--rotation-angle': `${getAngle('/notifications')}deg` } as React.CSSProperties}
                  >
                    <span className="material-symbols-outlined text-header">
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
                      className="absolute top-full right-0 mt-6 w-[450px] bg-[#151515] border border-[#545454] rounded-2xl overflow-hidden"
                      style={{ zIndex: 1000 }}
                    >
                      {/* Header */}
                      <div className="flex justify-between items-center px-6 py-4 border-b border-[#545454]">
                        <h2 className="text-small-title text-white">
                          <span className="font-['Inter',_sans-serif]">Notification</span>{' '}
                          <span className="font-['Noto_Sans_TC',_sans-serif]">通知</span>
                        </h2>
                        <button
                          onClick={closeNotificationMenu}
                          className="text-white hover:opacity-70 transition-opacity cursor-pointer flex items-center"
                          aria-label="Close"
                        >
                          <span className="material-icons text-[24px]">close</span>
                        </button>
                      </div>

                      {/* List */}
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="px-6 py-8 text-center">
                            <p className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-gray-scale2">
                              目前沒有新通知
                            </p>
                          </div>
                        ) : (
                          notifications.map((n, index) => (
                            <React.Fragment key={n.id}>
                              <div className="px-6 py-4 relative transition-colors hover:bg-white/5">
                                {/* 右上角紅點 (未讀) */}
                                {!n.read && (
                                  <div className="absolute top-6 right-6 w-2 h-2 bg-[#ff448a] rounded-full"></div>
                                )}

                                {/* 內容 */}
                                <p className="font-['Noto_Sans_TC',_sans-serif] text-white text-tiny mb-2 pr-4 leading-relaxed">
                                  {n.content}
                                </p>

                                {/* 底部資訊 */}
                                <div className="flex justify-between items-end">
                                  <span className="font-['Inter',_sans-serif] text-gray-scale2 text-tiny">
                                    {formatNotificationDate(n.timestamp)}
                                  </span>
                                  <span className="font-['Inter',_sans-serif] text-gray-scale2 text-tiny">
                                    {formatTimeAgo(n.timestamp)}
                                  </span>
                                </div>
                              </div>
                              {/* Separator */}
                              {index < notifications.length - 1 && (
                                <div className="h-[1px] bg-[#545454] mx-6"></div>
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
                  to="/rental-list"
                  state={{ from: location.pathname === '/equipment' ? 'equipment' : location.pathname === '/space' ? 'space' : undefined }}
                  className="font-['Inter',_sans-serif] font-medium uppercase transition-colors text-white flex items-center"
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
                  className="font-['Inter',_sans-serif] font-medium uppercase transition-colors text-white flex items-center"
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
                  to="/booking"
                  className="font-['Inter',_sans-serif] font-medium uppercase transition-colors text-white text-h3"
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
                  className="font-['Inter',_sans-serif] font-medium uppercase transition-colors text-white text-h3"
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
                  className="font-['Inter',_sans-serif] font-medium uppercase transition-colors text-white text-h3"
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
                <Link
                  to="/about"
                  className="font-['Inter',_sans-serif] font-medium uppercase transition-colors text-white text-h3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="menu-item-wrapper">
                    <span className="menu-text">(ABOUT)</span>
                    <span className="menu-text-hidden">(ABOUT)</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Copyright 在底部 */}
          <div className="menu-animate-enter mobile-menu-content-bottom">
            <div className="menu-animate-enter-content menu-delay-5">
              <div className="copyright font-['Inter',_sans-serif] font-medium text-white text-left text-button">
                <p>
                  <span className="copyright-original">
                    <span className="font-['Inter',_sans-serif] uppercase">Copyright © 2025 111</span>
                    屆系學會
                    <span className="font-['Inter',_sans-serif]">All rights reserved.</span>
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Header
