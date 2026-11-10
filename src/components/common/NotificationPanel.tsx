/**
 * 通知下拉面板（前台 Header 鈴鐺）：標題列＋X、清單（未讀紅點、日期與相對時間）。
 * 定位交給呼叫端（className／style）。清單本體 NotificationList 另外 export 給後台「通知」頁整頁用。
 * onSelect 給了且該則有 link → 整列是按鈕（後台點了跳頁）。zhOnly＝後台：不隨前台語言切換。
 * 公休撞到取件時段的通知（link 帶 pickup=單號）多一顆「修改取件日」：帶去 Profile 直接開修改視窗。
 */

import { BTN_OUTLINE } from '@/components/common/btn'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import CloseButton from './CloseButton'
import type { AppNotification } from '../../services/notificationsService'
import { useT } from '../../stores/langStore'

const pad = (n: number) => String(n).padStart(2, '0')
// 2026/01/24 4:14PM
const formatDate = (ts: number) => {
  const d = new Date(ts)
  const h = d.getHours() % 12 || 12
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${h}:${pad(d.getMinutes())}${d.getHours() >= 12 ? 'PM' : 'AM'}`
}

const useZh = (zhOnly?: boolean) => {
  const tt = useT()
  return zhOnly ? <T,>(_en: T, zh: T): T => zh : tt
}

export const NotificationList: React.FC<{
  items: AppNotification[]
  onSelect?: (n: AppNotification) => void
  onAction?: () => void
  zhOnly?: boolean
}> = ({ items, onSelect, onAction, zhOnly }) => {
  const t = useZh(zhOnly)
  const navigate = useNavigate()

  // 剛剛／3分鐘前／3小時前／3天前
  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60000) return t('Just Now', '剛剛')
    if (diff < 3600000) { const m = Math.floor(diff / 60000); return t(`${m} Min${m > 1 ? 's' : ''} Ago`, `${m}分鐘前`) }
    if (diff < 86400000) { const h = Math.floor(diff / 3600000); return t(`${h} Hour${h > 1 ? 's' : ''} Ago`, `${h}小時前`) }
    const d = Math.floor(diff / 86400000)
    return t(`${d} Day${d > 1 ? 's' : ''} Ago`, `${d}天前`)
  }

  const body = (n: AppNotification) => (
    <>
      <div className="flex gap-3 mb-2">
        <p className="flex-1 min-w-0 text-white text-xs leading-relaxed">{n.content}</p>
        {!n.read && <span className="mt-2 w-2 h-2 shrink-0 bg-pink rounded-full" />}
      </div>
      {n.link?.includes('pickup=') && (
        <button
          type="button"
          onClick={() => { navigate(n.link!); onAction?.() }}
          className={`mb-2 px-3 py-1 rounded-lg text-xs ${BTN_OUTLINE}`}
        >
          {t('Change pickup date', '修改取件日')}
        </button>
      )}
      <div className="flex justify-between items-end">
        <span className="font-english text-gray-light text-xs">{formatDate(n.timestamp)}</span>
        <span className="font-english text-gray-light text-xs">{timeAgo(n.timestamp)}</span>
      </div>
    </>
  )

  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-xs text-gray-light">{t('No new notifications', '目前沒有新通知')}</p>
      </div>
    )
  }
  return (
    <>
      {items.map((n, i) => (
        <React.Fragment key={n.id}>
          {onSelect && n.link ? (
            <button type="button" onClick={() => onSelect(n)} className="block w-full text-left p-4 hover:bg-white/10 cursor-pointer">
              {body(n)}
            </button>
          ) : (
            <div className="p-4 hover:bg-white/10">{body(n)}</div>
          )}
          {i < items.length - 1 && <div className="h-[1px] bg-gray-mid" />}
        </React.Fragment>
      ))}
    </>
  )
}

const NotificationPanel: React.FC<{
  items: AppNotification[]
  onClose: () => void
  onSelect?: (n: AppNotification) => void
  zhOnly?: boolean
  className?: string
  style?: React.CSSProperties
}> = ({ items, onClose, onSelect, zhOnly, className = '', style }) => {
  const t = useZh(zhOnly)
  return (
    <div className={`w-[400px] max-w-[calc(100vw-3rem)] bg-gray-darker border border-gray-mid rounded-2xl overflow-hidden ${className}`} style={style}>
      <div className="flex justify-between items-center p-4 border-b border-gray-mid">
        <h2 className="text-sm text-white">{t('Notification', '通知')}</h2>
        <CloseButton onClick={onClose} label={t('Close', '關閉')} />
      </div>
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        <NotificationList items={items} onSelect={onSelect} onAction={onClose} zhOnly={zhOnly} />
      </div>
    </div>
  )
}

export default NotificationPanel
