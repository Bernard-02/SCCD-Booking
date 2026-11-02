/**
 * 後台 · 通知——學生送單／改品項／延期／取消發給 admin 的通知（supabase/admin-notifications.sql），整頁清單由上往下排。
 * 資料由 AdminLayout 抓（每分鐘跟著自動更新）經 Outlet context 傳進來；標題右「全部已讀」鈕，沒未讀時停用。
 * 有連結的那則整列可點，跳去該學生的訂單。
 */

import React from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { PageTitle, textBtn } from '../components/admin/adminUi'
import { NotificationList } from '../components/common/NotificationPanel'
import type { AdminOutletContext } from '../components/layouts/AdminLayout'

const AdminNotificationsPage: React.FC = () => {
  const navigate = useNavigate()
  const { notifs, markAllRead } = useOutletContext<AdminOutletContext>()
  const unread = notifs.filter(n => !n.read).length
  return (
    <div className="font-chinese">
      <PageTitle zh="通知">
        <button type="button" onClick={markAllRead} disabled={unread === 0} className={textBtn(false)}>
          <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">done_all</span>
          全部已讀
        </button>
      </PageTitle>
      {notifs.length === 0 ? (
        <p className="text-xs text-gray-light">目前沒有通知</p>
      ) : (
        <div className="border-b border-gray-mid">
          <NotificationList items={notifs} onSelect={n => { if (n.link) navigate(n.link) }} zhOnly />
        </div>
      )}
    </div>
  )
}

export default AdminNotificationsPage
