/**
 * 後台外框：左側分類側欄 + 右側內容（<Outlet/>）。
 * 訂單只是其中一區；公告／公休日／寒暑假等各自成區，逐步實作。
 */

import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

// 側欄分類（done=已可用，其餘為待實作佔位）
export const ADMIN_SECTIONS: { to: string; label: string; en: string; done?: boolean }[] = [
  { to: '/admin', label: '總覽', en: 'Overview', done: true },
  { to: '/admin/orders', label: '訂單', en: 'Orders', done: true },
  { to: '/admin/announcements', label: '公告', en: 'Announcements' },
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
      <aside className="w-52 shrink-0 border-r border-gray-scale4 flex flex-col">
        <div className="px-5 py-6 border-b border-gray-scale4">
          <div className="font-['Inter',_sans-serif] text-content">SCCD Admin</div>
          <div className="text-tiny text-gray-scale2 font-['Noto_Sans_TC',_sans-serif] mt-1">
            {currentUser?.name}
          </div>
        </div>

        <nav className="flex-1 py-3">
          {ADMIN_SECTIONS.map(s => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.to === '/admin'}
              className={({ isActive }) =>
                `flex items-baseline gap-2 px-5 py-2 text-tiny transition-colors ${
                  isActive ? 'bg-white/10 text-white border-l-2 border-white' : 'text-gray-scale2 hover:text-white border-l-2 border-transparent'
                }`
              }
            >
              <span className="font-['Noto_Sans_TC',_sans-serif]">{s.label}</span>
              <span className="font-['Inter',_sans-serif] text-[10px] opacity-40">{s.en}</span>
              {!s.done && <span className="ml-auto text-[10px] text-gray-scale3">待做</span>}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="px-5 py-4 text-left text-tiny text-gray-scale2 hover:text-white cursor-pointer border-t border-gray-scale4 font-['Noto_Sans_TC',_sans-serif]"
        >
          登出
        </button>
      </aside>

      {/* 內容區 */}
      <main className="flex-1 min-w-0 px-6 py-8 md:px-10">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
