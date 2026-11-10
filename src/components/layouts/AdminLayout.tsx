/**
 * 後台外框：左側分類側欄 + 右側內容（<Outlet/>）。
 * 側欄樣式同前台 Profile 左選單：icon＋文字膠囊（navItemCls），選中白底黑字；後台只有中文。
 * 左上「SCCDSA／Booking 後台」兩行左右邊距＝前台 .container（css/common.css）；上緣 pt-10（不跟前台 Header 對齊，2026-10-24 定），
 * 各頁標題（PageTitle）同 pt-10，與它同高。側欄與內容區各自捲動（整頁 h-screen）；各頁要撐滿視窗用 h-full。
 */

import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { autoImportHolidays } from '../../services/adminService'
import { fetchBackendAccess } from '../../services/authService'
import { navItemCls, NAV_ITEM } from '../common/navItem'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { useLangStore, syncHtmlLang } from '../../stores/langStore'
import { readLoginData, isLoginExpired } from '../../utils/authStorage'
import { fetchDutyNotifications, markDutyNotificationsRead, type AppNotification } from '../../services/notificationsService'

/** 給子頁（Outlet context）：通知頁讀清單、「全部已讀」 */
export interface AdminOutletContext { notifs: AppNotification[]; markAllRead: () => void }

// 側欄分兩組、各有小字組名（2026-09-30 定案，防誤觸）：
// 值班＝天天用的查看與訂單操作；設定＝改主檔會影響全站的資料維護，只有最高權限看得到（2026-11-08）。
// 查看（A5F 編號區，原名空間地圖）與寫入（空間管理）刻意拆成不同頁。總覽 2026-10-24 拿掉：各狀態數量併到訂單頁上方。
interface AdminSection { to: string; label: string; icon: string }

const ADMIN_SECTION_GROUPS: { label: string; items: AdminSection[] }[] = [
  {
    label: '值班',
    items: [
      { to: '/admin/orders', label: '訂單', icon: 'receipt_long' },
      { to: '/admin/space-map', label: 'A5F 編號區', icon: 'map' },
      { to: '/admin/notifications', label: '通知', icon: 'notifications' } // 2026-11-02 從左上鈴鐺改成獨立頁；有未讀時文字右邊粉紅數字徽章，頁內「全部已讀」才消
    ]
  },
  {
    label: '設定',
    items: [
      { to: '/admin/equipment', label: '設備管理', icon: 'photo_camera' },
      { to: '/admin/spaces', label: '空間管理', icon: 'meeting_room' },
      { to: '/admin/members', label: '會員管理', icon: 'group' }, // 含系學會（經手人）名單
      { to: '/admin/hours', label: '營業時間', icon: 'schedule' }, // 值班時間＋公休日＋法定假日＋寒暑假封鎖
      { to: '/admin/content', label: '文字內容', icon: 'edit_note' } // 使用教學／系學會／關於／聯絡方式／延期規則的說明文字
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
  const { logout, currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin' // 否則是學會成員（AdminRoute 已擋其他人）
  const navigate = useNavigate()
  // 今天日期：分頁整天開著，跨過午夜要換（借自動更新的每分鐘／切回分頁觸發）
  const [now, setNow] = useState(() => new Date())

  // 後台通知（supabase/admin-notifications.sql：學生送單／改品項／延期／取消 → 發給 admin，值班的人共用一份）：跟著每分鐘自動更新一起重抓，
  // 清單經 Outlet context 給通知頁（/admin/notifications）
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const loadNotifs = () => fetchDutyNotifications().then(setNotifs).catch(() => {})
  useEffect(() => { void loadNotifs() }, [])
  useAutoRefresh(async () => {
    // 分頁開著也要到期（共用電腦開過夜）：直接整頁重載，由 AuthContext 啟動時清憑證——
    // 不等 logout()，signOut 在分頁暫停過後可能卡住不回，畫面就留著了
    const login = readLoginData()
    if (login && isLoginExpired(login)) { window.location.replace('/?expired=1'); return }
    setNow(new Date())
    void loadNotifs()
    // 權限沒了（到期、在別處改密碼、被移出系學會）：本機資料還在，要先 logout 清掉，不然重載又會判定已登入、跳回後台。離線查不到（null）不動作
    const access = await fetchBackendAccess()
    if (access && access !== 'admin' && access !== 'operator') { await logout(); window.location.replace('/?expired=1&redirect_url=/admin/orders') }
  })
  const unread = notifs.filter(n => !n.read).length
  // 通知頁的「全部已讀」鈕
  const markAllRead = () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    void markDutyNotificationsRead()
  }

  // 法定假日每年自動匯入一次（今年＋明年；已匯入就略過）——倒數／逾期計算靠它，寫入要最高權限，掛在任何後台頁都會跑
  useEffect(() => { if (isAdmin) void autoImportHolidays() }, [isAdmin])
  // 後台只有中文：<html lang> 固定 zh-TW（EN 模式的全域英文字距才不會套到後台），離開時還原
  useEffect(() => {
    document.documentElement.lang = 'zh-TW'
    return () => syncHtmlLang(useLangStore.getState().lang)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="h-screen max-md:h-dvh bg-black text-white flex max-md:flex-col">
      {/* 側欄：固定滿高，項目多到超出時自己捲 */}
      {/* 寬度跟著內容（標題拆兩行、各行不換行，寬度由最長的選單項決定） */}
      <aside className={`shrink-0 flex flex-col items-start ${EDGE_L} pr-8 py-10 h-screen overflow-y-auto max-md:h-auto max-md:pt-6 max-md:pb-0 max-md:pr-[clamp(1.2rem,2vw,2%)]`}>
        {/* 同前台 Header logo 字樣（Inter 粗體 text-md）＋今天 */}
        <div>
          <p className="font-english font-bold text-white text-md whitespace-nowrap leading-tight">SCCDSA<br />Booking 後台</p>
          <p className="mt-1 text-xs text-gray-light font-english">{fmtToday(now)}</p>
        </div>

        {/* inline-flex＝各項同寬、以最長的為準（同 Profile）；組名小字對齊 icon 左緣（px-3＝膠囊 pl-3） */}
        <nav className="inline-flex flex-col mt-10 flex-1 max-md:flex max-md:flex-row max-md:items-center max-md:gap-2 max-md:mt-4 max-md:w-full max-md:overflow-x-auto">
          {ADMIN_SECTION_GROUPS.filter(g => isAdmin || g.label === '值班').map((group, gi) => (
            <div key={group.label} className={`flex flex-col gap-2 max-md:flex-row ${gi > 0 ? 'mt-8 max-md:mt-0' : ''}`}>
              <p className="px-3 text-xs text-gray-mid max-md:hidden">{group.label}</p>
              {group.items.map(s => (
                <NavLink
                  key={s.to}
                  to={s.to}
                  className={({ isActive }) => `${navItemCls(isActive)} max-md:shrink-0 max-md:whitespace-nowrap ${s.to === '/admin/notifications' && unread > 0 ? '!pr-2' : ''}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{s.icon}</span>
                  <span>{s.label}</span>
                  {/* 未讀數：同 CountTabs 的計數徽章（20px、圓角 8px），底色換未讀的粉紅；在通知頁上也顯示，按「全部已讀」才消 */}
                  {s.to === '/admin/notifications' && unread > 0 && (
                    <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-lg text-2xs font-english font-normal bg-pink text-black">
                      {unread}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          {/* 登出放在 nav 裡才會和上面的項目同寬（flex-col stretch）；外層負責推到底＋最小間距，不把 padding 加進 hover 框 */}
          <div className="mt-auto pt-10 flex flex-col gap-2 max-md:mt-0 max-md:pt-0 max-md:ml-auto max-md:flex-row">
            {/* 學會成員也是學生，要回得去前台借東西 */}
            {!isAdmin && (
              <NavLink to="/catalog" className={`${navItemCls(false)} max-md:shrink-0 max-md:whitespace-nowrap`}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
                <span>回前台</span>
              </NavLink>
            )}
            {/* 登出：平常灰字同其他項目，hover 才變 error 字＋gray-dark 底（同 NAV_HOVER） */}
            <button
              onClick={handleLogout}
              className={`${NAV_ITEM} pl-3 pr-4 text-gray-light hover:text-error hover:bg-gray-dark max-md:shrink-0 max-md:whitespace-nowrap`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
              <span>登出</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* 內容區：自己捲動（捲軸貼視窗右緣，所以右邊距放在 main 內）；py-10 同側欄，頁標題與「SCCDSA Booking 後台」同高 */}
      <main className={`flex-1 min-w-0 h-screen overflow-y-auto pl-12 ${EDGE_R} py-10 max-md:h-auto max-md:min-h-0 max-md:pl-[clamp(1.2rem,2vw,2%)]`}>
        <Outlet context={{ notifs, markAllRead } satisfies AdminOutletContext} />
      </main>
    </div>
  )
}

export default AdminLayout
