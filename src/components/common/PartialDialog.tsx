/**
 * 部分時段可借 popup（2026-11-02）：你選的區間裡只有幾天夠（設備看卡片上填的數量、空間看有沒有被佔）。
 * 上面一條細的日期帶只是示意（綠＝夠、粉＝不夠、亮綠＝目前選的段，不能點），下面可借的連續段才是按鈕，依日期順序、預設第一段。
 * 不列每天剩幾件——學生只需要知道「我要的數量哪幾天借得到」，要換數量回卡片改，popup 會跟著重算。
 * 確認＝這一類（設備／空間）的日期改成那段、清單裡同類品項一起改（同類型限一單，不開第二張）；改日期與加入由呼叫端做。
 * 文字中英兩版（CLAUDE.md）；資料來源 supabase/partial-availability.sql。
 */
import React, { useEffect, useMemo, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { BTN } from './btn'
import { useT } from '../../stores/langStore'
import { contiguousRuns } from '../../utils/timeUtils'

interface PartialDialogProps {
  isOpen: boolean
  title: string
  titleEn: string
  days: string[] // 區間內每一天 'YYYY-MM-DD'
  okDays: ReadonlySet<string> // 夠的天
  what: 'equipment' | 'space'
  quantity?: number // 設備：卡片上填的數量（寫進說明文字）
  unitZh?: string // 數量單位：件（單件）／組（整組）
  confirmLabel?: 'add' | 'select' // 確認鈕：預設設備＝加入清單、空間＝選取；教室也是加入清單
  affectsOthers: boolean // 清單裡已有同類品項，會一起改日期
  onConfirm: (startDate: string, endDate: string) => void
  onCancel: () => void
}

// 'YYYY-MM-DD' → 'M/D'
const md = (k: string) => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`

const PartialDialog: React.FC<PartialDialogProps> = ({
  isOpen, title, titleEn, days, okDays, what, quantity = 1, unitZh = '件', confirmLabel, affectsOthers, onConfirm, onCancel
}) => {
  const label = confirmLabel ?? (what === 'equipment' ? 'add' : 'select')
  const t = useT()
  const runs = useMemo(() => contiguousRuns(okDays, days), [okDays, days])
  const [pick, setPick] = useState(0)
  useEffect(() => { if (isOpen) setPick(0) }, [isOpen])
  const seg = runs[pick] ?? runs[0]
  if (!seg || days.length === 0) return null

  const span = `${md(days[0])} – ${md(days[days.length - 1])}`
  const inSeg = (d: string) => d >= seg[0] && d <= seg[1]
  const lenOf = (r: [string, string]) => days.indexOf(r[1]) - days.indexOf(r[0]) + 1
  const othersZh = affectsOthers ? '，清單裡其他同類品項也會改用這段日期重新檢查' : ''
  const othersEn = affectsOthers ? ', and other items of the same type in your list will be rechecked' : ''
  const message = what === 'equipment'
    ? `你選的 ${span} 裡，綠色的天數夠 ${quantity} ${unitZh}，粉紅的不夠。選一段加入，設備的日期會改成那段${othersZh}。`
    : `你選的 ${span} 裡，綠色的天數沒人借，粉紅的已被借走。選一段，空間的日期會改成那段${othersZh}。`
  const messageEn = what === 'equipment'
    ? `Within ${span}, green days have ${quantity} available and pink days don’t. Pick a period — your equipment dates will change to it${othersEn}.`
    : `Within ${span}, green days are free and pink days are taken. Pick a period — your space dates will change to it${othersEn}.`

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={title}
      titleEn={titleEn}
      message={message}
      messageEn={messageEn}
      confirmText={label === 'add' ? 'Add' : 'Select'}
      confirmTextZh={label === 'add' ? '加入清單' : '選取'}
      onConfirm={() => onConfirm(seg[0], seg[1])}
      onCancel={onCancel}
    >
      {/* 日期帶（示意，不能點）：一天一個小圓角矩形、一排 10 天超過就換行，綠＝夠、粉＝不夠、亮綠＝目前選的段 */}
      <div className="mt-4">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(days.length, 10)}, minmax(0, 1fr))` }} aria-hidden="true">
          {days.map(d => (
            <div key={d} className={`h-3 rounded ${okDays.has(d) ? (inSeg(d) ? 'bg-green' : 'bg-green/50') : 'bg-pink'}`} />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-english text-2xs text-gray-light">
          <span>{md(days[0])}</span>
          <span>{md(days[days.length - 1])}</span>
        </div>
      </div>
      {/* 可借的連續段，依日期順序、預設第一段：同後台工具列分頁（灰底、選中白底）＋天數徽章 */}
      <p className="mt-4 text-xs text-gray-light">{t('Available periods', '可借的時段')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {runs.map((r, i) => (
          <button
            key={r[0]}
            type="button"
            onClick={() => setPick(i)}
            className={`h-9 pl-3 pr-2 rounded-lg text-xs inline-flex items-center gap-2 ${i === pick ? 'bg-white text-black cursor-pointer' : `bg-gray-dark text-white ${BTN}`}`}
            aria-label={`${md(r[0])} – ${md(r[1])}，${lenOf(r)} ${t('days', '天')}`}
          >
            <span className="font-english">{md(r[0])} – {md(r[1])}</span>
            <span className={`min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-lg text-2xs font-english ${i === pick ? 'bg-gray-light' : 'bg-white/10 opacity-70'}`}>
              {lenOf(r)}
            </span>
          </button>
        ))}
      </div>
    </ConfirmDialog>
  )
}

export default PartialDialog
