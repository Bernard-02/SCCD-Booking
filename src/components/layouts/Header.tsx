/**
 * Header 組件
 * 左 logo（回型錄）；右 Info（開 InfoDialog：教學／系學會／關於）、Cart、通知 三個 icon
 * Profile 與外部連結在 Footer
 */

import { BTN, TAP } from '@/components/common/btn'
import React from 'react'
import NotificationPanel from '../common/NotificationPanel'
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
  const t = useT()
  const { pathname } = useLocation()
  const { cart } = useCart()
  const { isAuthenticated, currentUser } = useAuth()
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
            <Link to="/catalog" className="font-english font-bold text-white text-md whitespace-nowrap">
              SCCDSA Booking
            </Link>

            {/* 右側導航 - 如果 hideNavigation 為 true 則隱藏 */}
            {!hideNavigation && (
              <nav className="flex items-center gap-6 max-md:gap-4">
                {/* Info：開 InfoDialog（左分頁、右內容） */}
                <button
                  type="button"
                  onClick={() => setInfoTab('guide')}
                  className={`flex items-center text-white ${TAP} ${BTN}`}
                  aria-label="Info"
                >
                  <span className="material-symbols-outlined text-md">info</span>
                </button>

                {/* Cart：右上角數量徽章 */}
                <Link
                  to="/cart"
                  className={`relative flex items-center text-white ${TAP} ${pathname === '/cart' ? '' : 'hover:opacity-50'}`}
                  aria-label={`${t('Cart', '清單')} (${cartCount})`}
                >
                  <span className="material-symbols-outlined text-md">shopping_cart</span>
                  {cartCount > 0 && (
                    <span className="font-english absolute top-1 right-0 min-w-4 h-4 px-1 rounded-full bg-white text-black text-2xs leading-4 text-center">
                      {cartCount}
                    </span>
                  )}
                </Link>

                {/* 通知鈴鐺 */}
                <div className="notification-dropdown-container relative">
                  <Link
                    to="#"
                    onClick={handleNotificationClick}
                    className={`relative flex items-center text-white ${TAP} ${notificationMenuOpen ? 'cursor-pointer' : BTN}`}
                    aria-label="Notification"
                  >
                    <span className="material-symbols-outlined text-md">
                      notifications
                    </span>
                    {/* 全域紅點：只有在選單關閉且有未讀訊息時顯示 */}
                    {unreadCount > 0 && !notificationMenuOpen && (
                      <span className="absolute top-2.5 right-2.5 bg-pink rounded-full w-2 h-2"></span>
                    )}
                  </Link>

                  {/* Notification Dropdown */}
                  {notificationMenuOpen && (
                    <NotificationPanel
                      items={notifications}
                      onClose={closeNotificationMenu}
                      className="absolute top-full right-0 mt-6"
                      style={{ zIndex: 1000 }}
                    />
                  )}
                </div>
              </nav>
            )}

          </div>
        </div>
      </header>

      {/* Info lightbox：使用教學／系學會／關於 */}
      <InfoDialog tab={infoTab} onTabChange={setInfoTab} onClose={() => setInfoTab(null)} />
    </>
  )
}

export default Header
