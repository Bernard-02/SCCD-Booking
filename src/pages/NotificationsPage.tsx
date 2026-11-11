/**
 * 通知頁（2026-11-11）：手機上 Header 鈴鐺不開下拉面板，改進這頁、返回鈕回上一頁；桌機仍是下拉面板（直接開網址也能看）。
 * 進來抓清單後隨即全部標已讀（畫面上的未讀點留到離開），回上一頁 Header 重抓就沒紅點。
 */

import React from 'react'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'
import BackButton from '../components/common/BackButton'
import { NotificationList } from '../components/common/NotificationPanel'
import { useAuth } from '../contexts/AuthContext'
import { fetchMyNotifications, markAllNotificationsRead } from '../services/notificationsService'
import type { AppNotification } from '../services/notificationsService'
import { useT } from '../stores/langStore'

const NotificationsPage: React.FC = () => {
  const t = useT()
  const { isAuthenticated } = useAuth()
  const [items, setItems] = React.useState<AppNotification[] | null>(null) // null＝讀取中，不先閃「沒有通知」

  React.useEffect(() => {
    if (!isAuthenticated) { setItems([]); return }
    fetchMyNotifications()
      .then(list => {
        setItems(list)
        if (list.some(n => !n.read)) markAllNotificationsRead()
      })
      .catch(err => { console.error('讀取通知失敗:', err); setItems([]) })
  }, [isAuthenticated])

  return (
    <div className="bg-black text-white h-dvh overflow-hidden flex flex-col">
      <Header />
      <main className="flex-1 pt-[calc(var(--gutter)+4rem)] max-md:pt-[calc(var(--gutter)+3rem)] overflow-hidden flex flex-col">
        <div className="container">
          <BackButton />
        </div>
        <div className="container flex-1 min-h-0 overflow-y-auto">
          <h1 className="text-white text-xl mb-6 max-lg:mt-4 max-lg:text-md">{t('Notification', '通知')}</h1>
          {items && (
            // 整頁版：每則不留左右 padding，文字對齊橫線（下拉面板才需要內距）；hover 底色也拿掉
            <div className="[&>.p-4]:px-0 [&>.p-4:hover]:bg-transparent">
              <NotificationList items={items} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default NotificationsPage
