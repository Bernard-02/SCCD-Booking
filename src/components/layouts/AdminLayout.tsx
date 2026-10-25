/**
 * 後台外框：左側分類側欄 + 右側內容（<Outlet/>）。
 * 側欄樣式同前台 Profile 左選單：icon＋文字膠囊（navItemCls），選中白底黑字；後台只有中文。
 * 左上「SCCDSA Booking 後台」左右邊距＝前台 .container（css/common.css）；上緣 pt-10（不跟前台 Header 對齊，2026-10-24 定），
 * 各頁標題（PageTitle）同 pt-10，與它同高。側欄與內容區各自捲動（整頁 h-screen）；各頁要撐滿視窗用 h-full。
 */

import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { autoImportHolidays } from '../../services/adminService'
import { navItemCls, NAV_ITEM } from '../common/navItem'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

// 側欄分兩組、各有小字組名（2026-09-30 定案，防誤觸）：
// 值班＝天天用的查看與訂單操作；設定＝改主檔會影響全站的資料維護。
// 查看（A5F 編號區，原名空間地圖）與寫入（空間管理）刻意拆成不同頁。總覽 2026-10-24 拿掉：各狀態數量併到訂單頁上方。
interface AdminSection { to: string; label: string; icon: string }

const ADMIN_SECTION_GROUPS: { label: string; items: AdminSection[] }[] = [
  {
    label: '值班',
    items: [
      { to: '/admin/orders', label: '訂單', icon: 'receipt_long' },
      { to: '/admin/space-map', label: 'A5F 編號區', icon: 'map' }
    ]
  },
  {
    label: '設定',
    items: [
      { to: '/admin/equipment', label: '設備管理', icon: 'photo_camera' },
      { to: '/admin/spaces', label: '空間管理', icon: 'meeting_room' },
      { to: '/admin/members', label: '會員管理', icon: 'group' }, // 含系學會（經手人）名單
      { to: '/admin/hours', label: '營業時間', icon: 'schedule' } // 值班時間＋公休日＋法定假日＋寒暑假封鎖
    ]
  }
]

const WD = '日一二三四五六'
const pad = (n: number) => String(n).padStart(2, '0')
const fmtToday = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}（${WD[d.getDay()]}）`

// 左右邊距＝前台 .container 的 padding
const EDGE_L = 'pl-[clamp(1.2rem,2vw,2%)]'
const EDGE_R = 'pr-[clamp(1.2rem,2vw,2%)]'

const AdminLayout: React.FC = () => {
  const { logout } = useAuth()
  const navigate = useNavigate()
  // 今天日期：分頁整天開著，跨過午夜要換（借自動更新的每分鐘／切回分頁觸發）
  const [now, setNow] = useState(() => new Date())
  useAutoRefresh(() => setNow(new Date()))

  // 法定假日每年自動匯入一次（今年＋明年；已匯入就略過）——倒數／逾期計算靠它，掛在任何後台頁都會跑
  useEffect(() => { void autoImportHolidays() }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="h-screen bg-black text-white flex">
      {/* 側欄：固定滿高，項目多到超出時自己捲 */}
      {/* 寬度跟著內容（標題不換行，最長的是標題） */}
      <aside className={`shrink-0 flex flex-col items-start ${EDGE_L} pr-8 py-10 h-screen overflow-y-auto`}>
        {/* 同前台 Header logo 字樣：Inter 粗體 text-md */}
        <p className="font-['Inter',_sans-serif] font-bold text-white text-md whitespace-nowrap">SCCDSA Booking 後台</p>
        <p className="mt-1 text-xs text-gray-scale2 font-english">{fmtToday(now)}</p>

        {/* inline-flex＝各項同寬、以最長的為準（同 Profile）；組名小字對齊 icon 左緣（px-3＝膠囊 pl-3） */}
        <nav className="inline-flex flex-col mt-10 flex-1">
          {ADMIN_SECTION_GROUPS.map((group, gi) => (
            <div key={group.label} className={`flex flex-col gap-2 ${gi > 0 ? 'mt-8' : ''}`}>
              <p className="px-3 text-xs text-gray-scale3">{group.label}</p>
              {group.items.map(s => (
                <NavLink
                  key={s.to}
                  to={s.to}
                  className={({ isActive }) => navItemCls(isActive)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{s.icon}</span>
                  <span>{s.label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          {/* 登出放在 nav 裡才會和上面的項目同寬（flex-col stretch）；外層負責推到底＋最小間距，不把 padding 加進 hover 框 */}
          <div className="mt-auto pt-10 flex flex-col">
            {/* 登出：平常灰字同其他項目，hover 才變紅字淡紅底（error2）；灰字帶 !important，hover 要用 !text */}
            <button
              onClick={handleLogout}
              className={`${NAV_ITEM} pl-3 pr-4 text-gray-scale2 hover:!text-[var(--color-error2)] hover:bg-[rgba(255,134,152,0.15)]`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
              <span>登出</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* 內容區：自己捲動（捲軸貼視窗右緣，所以右邊距放在 main 內）；py-10 同側欄，頁標題與「SCCDSA Booking 後台」同高 */}
      <main className={`flex-1 min-w-0 h-screen overflow-y-auto pl-12 ${EDGE_R} py-10`}>
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
