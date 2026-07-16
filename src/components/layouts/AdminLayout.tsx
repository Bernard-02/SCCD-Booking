/**
 * 後台外框：左側分類側欄 + 右側內容（<Outlet/>）。
 * 側欄樣式沿用前台 Profile 左選單：純文字、英上中下、active 白粗體。
 */

import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

// 側欄分類（done=已可用，其餘為待實作佔位）
export const ADMIN_SECTIONS: { to: string; label: string; en: string; done?: boolean }[] = [
  { to: '/admin', label: '總覽', en: 'Overview', done: true },
  { to: '/admin/orders', label: '訂單', en: 'Orders', done: true },
  { to: '/admin/staff', label: '幹部名單', en: 'Staff', done: true },
  { to: '/admin/closed-dates', label: '公休日', en: 'Closed Dates', done: true },
  { to: '/admin/blackouts', label: '寒暑假封鎖', en: 'Blackouts', done: true }
]

const AdminLayout: React.FC = () => {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* 側欄 */}
      <aside className="w-64 shrink-0 flex flex-col px-8 py-10">
        <div>
          <p className="font-english text-small-title text-white">SCCD Admin</p>
          <p className="font-chinese text-tiny text-gray-scale2 mt-1">{currentUser?.name}</p>
        </div>

        <nav className="flex flex-col gap-6 mt-14 flex-1">
          {ADMIN_SECTIONS.map(s => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.to === '/admin'}
              className={({ isActive }) =>
                `text-small-title text-left transition-colors ${
                  isActive ? 'text-white font-bold' : 'text-gray-scale2 hover:text-white'
                }`
              }
            >
              <span className="font-english block">{s.en}</span>
              <span className="font-chinese block">
                {s.label}
                {!s.done && <span className="text-tiny text-gray-scale3 ml-2">待做</span>}
              </span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="text-left text-tiny text-gray-scale2 hover:text-white transition-colors cursor-pointer mt-10"
        >
          <span className="font-english">Logout</span> <span className="font-chinese">登出</span>
        </button>
      </aside>

      {/* 內容區 */}
      <main className="flex-1 min-w-0 px-6 py-10 md:px-12">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
