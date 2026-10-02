/**
 * 後台外框：左側分類側欄 + 右側內容（<Outlet/>）。
 * 側欄樣式沿用前台 Profile 左選單：純文字、英上中下、active 白粗體。
 */

import React, { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { autoImportHolidays } from '../../services/adminService'

// 側欄分兩段、橫線隔開（2026-09-30 定案，防誤觸）：
// 上段＝值班（天天用的查看與訂單操作）；下段＝設定（改主檔會影響全站的資料維護）。
// 查看（空間地圖）與寫入（空間管理）刻意拆成不同頁。
interface AdminSection { to: string; label: string; en: string; done?: boolean }

export const ADMIN_SECTION_GROUPS: AdminSection[][] = [
  [
    { to: '/admin', label: '總覽', en: 'Overview', done: true },
    { to: '/admin/orders', label: '訂單', en: 'Orders', done: true },
    { to: '/admin/space-map', label: '空間地圖', en: 'Space Map', done: true }
  ],
  [
    { to: '/admin/equipment', label: '設備管理', en: 'Equipment', done: true },
    { to: '/admin/spaces', label: '空間管理', en: 'Spaces', done: true },
    { to: '/admin/members', label: '會員管理', en: 'Members', done: true }, // 含系學會（經手人）名單
    { to: '/admin/hours', label: '營業時間', en: 'Business Hours', done: true } // 公休日＋法定假日＋寒暑假封鎖
  ]
]

const AdminLayout: React.FC = () => {
  const { logout } = useAuth()
  const navigate = useNavigate()

  // 法定假日每年自動匯入一次（今年＋明年；已匯入就略過）——倒數／逾期計算靠它，掛在任何後台頁都會跑
  useEffect(() => { void autoImportHolidays() }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* 側欄：sticky 固定滿高（dashboard 慣例），內容長時只有右側捲動；側欄項目多到超出時自己捲 */}
      <aside className="w-64 shrink-0 flex flex-col px-8 py-10 sticky top-0 h-screen overflow-y-auto">
        <p className="font-english text-sm text-white">SCCD Admin</p>

        <nav className="flex flex-col mt-10 flex-1">
          {ADMIN_SECTION_GROUPS.map((group, gi) => (
            // 分隔線上下間距＝項目間距（gap-6），視覺節奏一致
            <div key={gi} className={`flex flex-col gap-6 ${gi > 0 ? 'mt-6 pt-6 border-t border-gray-scale4' : ''}`}>
              {group.map(s => (
                <NavLink
                  key={s.to}
                  to={s.to}
                  end={s.to === '/admin'}
                  className={({ isActive }) =>
                    `text-sm text-left transition-colors ${
                      isActive ? 'text-white font-bold' : 'text-gray-scale2 hover:!text-white hover:font-bold'
                    }`
                  }
                >
                  <span className="font-english block">{s.en}</span>
                  <span className="font-chinese block">
                    {s.label}
                    {!s.done && <span className="text-xs text-gray-scale3 ml-2">待做</span>}
                  </span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="text-left text-xs text-gray-scale2 hover:!text-white transition-colors cursor-pointer mt-10"
        >
          <span className="font-english">Logout</span> <span className="font-chinese">登出</span>
        </button>
      </aside>

      {/* 內容區：頁標題頂端與側欄「SCCD Admin」同高（兩邊都是 py-10） */}
      <main className="flex-1 min-w-0 px-6 py-10 md:px-12">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
