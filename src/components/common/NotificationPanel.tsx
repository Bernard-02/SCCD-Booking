/**
 * 通知下拉面板（前台 Header 鈴鐺）：標題列＋X、清單（未讀紅點、日期時間；依時間分組：剛剛／3天前／一個星期前／更早）。
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

  // 依時間分四組，組名放在該組上方，每則只留日期時間：剛剛（3 天內）／3天前／一個星期前／更早
  const group = (ts: number) => {
    const d = (Date.now() - ts) / 86400000
    return d < 3 ? 0 : d < 7 ? 1 : d < 14 ? 2 : 3
  }
  const GROUPS = [t('Recent', '剛剛'), t('3 Days Ago', '3天前'), t('A Week Ago', '一個星期前'), t('Earlier', '更早')]

  const body = (n: AppNotification) => (
    <>
      <div className="flex gap-3 mb-2">
        <p className="flex-1 min-w-0 text-white text-xs leading-relaxed">{n.content}</p>
        {/* 紅點的位置固定留著：已讀也佔位，文字右緣每則一致 */}
        <span className={`mt-2 w-2 h-2 shrink-0 rounded-full ${n.read ? '' : 'bg-pink'}`} />
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
          {/* 橫線只在同組的兩則之間，頭尾沒有；換組不畫線，用較大的間距隔開 */}
          {i === 0 || group(n.timestamp) !== group(items[i - 1].timestamp) ? (
            <p className={`p-4 pb-2 text-xs text-gray-light ${i > 0 ? 'pt-10' : ''}`}>{GROUPS[group(n.timestamp)]}</p>
          ) : (
            <div className="h-[1px] bg-gray-mid" />
          )}
          {onSelect && n.link ? (
            <button type="button" onClick={() => onSelect(n)} className="block w-full text-left p-4 hover:bg-white/10 cursor-pointer">
              {body(n)}
            </button>
          ) : (
            <div className="p-4 hover:bg-white/10">{body(n)}</div>
          )}
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
