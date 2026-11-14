/**
 * 分時段設備（雷切機）選時段 popup（2026-11-14 Bernard 定）：型錄只有一張卡片，按加入清單才開這個視窗。
 * 一天一列、午班／晚班各一格，要哪幾格點哪幾格——可以跨天，每天選不同的班。
 * 那一班休息、已被借走，或今天已經結束（只能借之後的）的格子不能點。
 * 清單裡已經選過的會先點好，再開一次＝改選，確認時整個換掉。
 * 結果存在清單品項的 days（只借這幾天），送單後是 order_items.days（supabase/orders-rpc.sql）。
 */
import React, { useState } from 'react'
import ConfirmDialog from '../common/ConfirmDialog'
import { BTN, BTN_INVERT } from '../common/btn'
import { useT } from '../../stores/langStore'
import { fromDateKey } from '../../utils/timeUtils'

export type Shift = 'noon' | 'evening'
/** 可借／已被借走／那一班沒開／今天那一班已經結束 */
export type SlotState = 'free' | 'taken' | 'closed' | 'past'

interface ShiftDialogProps {
  title: string
  titleEn: string
  days: string[] // 租借區間的每一天 'YYYY-MM-DD'
  stateOf: (shift: Shift, day: string) => SlotState
  initial: Record<Shift, string[]> // 清單裡已經選的
  deposit: number
  onConfirm: (picked: Record<Shift, string[]>) => void
  onCancel: () => void
}

const SHIFTS: Shift[] = ['noon', 'evening']
const WD_ZH = '日一二三四五六'
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ShiftDialog: React.FC<ShiftDialogProps> = ({ title, titleEn, days, stateOf, initial, deposit, onConfirm, onCancel }) => {
  const t = useT()
  const key = (s: Shift, d: string) => `${s}:${d}`
  const free = days.flatMap(d => SHIFTS.filter(s => stateOf(s, d) === 'free').map(s => key(s, d)))
  // 先點好清單裡選過、現在還借得到的
  const [picked, setPicked] = useState(() => new Set(SHIFTS.flatMap(s => initial[s].map(d => key(s, d))).filter(k => free.includes(k))))
  const toggle = (k: string) => setPicked(prev => {
    const next = new Set(prev)
    if (!next.delete(k)) next.add(k)
    return next
  })
  const all = free.every(k => picked.has(k))
  const name = (s: Shift) => (s === 'noon' ? t('Noon', '午班') : t('Evening', '晚班'))
  // 不能點的原因
  const why = (state: SlotState) =>
    state === 'taken' ? t('Booked', '已借出') : state === 'closed' ? t('Closed', '休息') : state === 'past' ? t('Passed', '已過') : ''

  return (
    <ConfirmDialog
      isOpen
      title={title}
      titleEn={titleEn}
      message={`點要借的時段，${days.length > 1 ? '可以跨天、每天選不同的班' : '午班、晚班可以都選'}。押金 NT$ ${deposit.toLocaleString()}，借幾個時段都只收一份。`}
      messageEn={`Tap the slots you need — ${days.length > 1 ? 'you can pick different shifts on different days' : 'you can pick both shifts'}. The deposit is NT$ ${deposit.toLocaleString()} no matter how many slots you book.`}
      confirmText="Add"
      confirmTextZh="加入清單"
      confirmDisabled={picked.size === 0}
      onConfirm={() => onConfirm({
        noon: days.filter(d => picked.has(key('noon', d))),
        evening: days.filter(d => picked.has(key('evening', d)))
      })}
      onCancel={onCancel}
    >
      {/* pr-2 同下面的清單（留給捲軸），「全選」才會對齊格子右緣 */}
      <div className="mt-4 pr-2 flex items-center justify-between text-xs text-gray-light">
        <span>{t(`${picked.size} selected`, `已選 ${picked.size} 個時段`)}</span>
        {free.length > 2 && (
          <button type="button" onClick={() => setPicked(new Set(all ? [] : free))} className={`underline underline-offset-4 ${BTN}`}>
            {all ? t('Clear', '清除') : t('Select all', '全選')}
          </button>
        )}
      </div>
      <div className="mt-3 max-h-[45dvh] overflow-y-auto pr-2 custom-scrollbar space-y-2">
        {days.map(d => {
          const date = fromDateKey(d)
          return (
            <div key={d} className="grid grid-cols-[5.5rem_1fr_1fr] items-center gap-2">
              <span className="text-xs text-white whitespace-nowrap">
                <span className="font-english">{date.getMonth() + 1}/{date.getDate()}</span>
                <span className="text-gray-light">{t(` ${WD_EN[date.getDay()]}`, `（${WD_ZH[date.getDay()]}）`)}</span>
              </span>
              {SHIFTS.map(s => {
                const state = stateOf(s, d)
                const on = picked.has(key(s, d))
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={state !== 'free'}
                    aria-pressed={on}
                    // 不能點的格子只寫原因（左午班、右晚班，位置看得出是哪一班）；讀螢幕的人聽得到完整的
                    aria-label={`${name(s)}${why(state) && `・${why(state)}`}`}
                    onClick={() => toggle(key(s, d))}
                    className={`h-9 max-md:h-11 rounded-lg text-xs ${on ? 'bg-white text-black cursor-pointer' : `bg-gray-dark text-white ${BTN_INVERT}`}`}
                  >
                    {why(state) || name(s)}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </ConfirmDialog>
  )
}

export default ShiftDialog
