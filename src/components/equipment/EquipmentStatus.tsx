/**
 * 設備現況（前台，2026-11-14；設備頁「清單／現況」切換的另一面）：把時間跟設備拆開看——
 * 一列一個設備、一欄一天，格子裡是當天還能借幾個：沒人借＝灰字、被借走一部分＝橘底、借完＝粉底。兩週一頁，可往後翻。
 * 資料用現成的逐日佔用（equipment_reserved_daily，supabase/partial-availability.sql）：只有數量、沒有個資，訪客也看得到。
 * 誰借走的不顯示：前台連訪客都能看，要顯示得另開 RPC，等 Bernard 決定給誰看。
 * 版面是第一版，Bernard 會再說怎麼調。
 */

import React, { useEffect, useMemo, useState } from 'react'
import { BTN_INVERT, BTN_TOOL } from '@/components/common/btn'
import { useEquipmentData, useItemName, fetchEquipmentReservedDaily } from '../../services/equipmentService'
import { useBookmarkStore } from '../../stores/bookmarkStore'
import { dayKeysBetween, fromDateKey, toDateKey } from '../../utils/timeUtils'
import { useT } from '../../stores/langStore'

const DAYS = 14
const WD_ZH = '日一二三四五六'
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const shiftDays = (key: string, n: number) => {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

const EquipmentStatus: React.FC<{ selectedCategory: string }> = ({ selectedCategory }) => {
  const t = useT()
  const itemName = useItemName()
  const equipmentData = useEquipmentData()
  const bookmarkStore = useBookmarkStore()
  const today = toDateKey(new Date())
  const [start, setStart] = useState(today)
  // 設備 id → { 日期: 當天被借走幾個 }；null＝還在讀
  const [reserved, setReserved] = useState<Record<string, Record<string, number>> | null>(null)
  const [failed, setFailed] = useState(false)

  const days = useMemo(() => dayKeysBetween(fromDateKey(start), fromDateKey(shiftDays(start, DAYS - 1))), [start])

  useEffect(() => {
    let alive = true
    setFailed(false)
    fetchEquipmentReservedDaily(days[0], days[DAYS - 1])
      .then(map => { if (alive) setReserved(map) })
      .catch(err => { console.error('讀取設備現況失敗:', err); if (alive) setFailed(true) })
    return () => { alive = false }
  }, [days])

  // 分類同清單：全部／各分類／收藏
  const rows = useMemo(() => {
    const bookmarked = new Set(bookmarkStore.getAllBookmarks())
    return Object.values(equipmentData).filter(e =>
      selectedCategory === '全部' || (selectedCategory === '收藏' ? bookmarked.has(e.id) : e.category === selectedCategory)
    )
  }, [equipmentData, selectedCategory, bookmarkStore])

  const navBtn = `${BTN_TOOL} ${BTN_INVERT}`
  // 第一欄（設備名稱）橫向捲動時釘在左邊；表頭釘在上面
  const head = 'sticky top-0 z-10 bg-black py-3 font-normal text-gray-light border-b border-gray-mid'
  const nameCol = 'sticky left-0 bg-black w-56 max-lg:w-36 pr-3 text-left'

  return (
    <div className="w-full h-full flex flex-col">
      {/* 上方：往前後翻一週、回到今天＋圖例。桌機高度同清單表頭上方的留白（60px），右邊留給「清單／現況」切換鈕 */}
      <div className="flex flex-wrap items-center gap-2 lg:h-[60px] max-lg:mb-3 flex-shrink-0 lg:pr-48">
        <button onClick={() => setStart(s => shiftDays(s, -7))} disabled={start <= today} className={`${navBtn} !px-2`} aria-label={t('Previous week', '往前一週')}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
        </button>
        <button onClick={() => setStart(today)} disabled={start === today} className={`${navBtn} !pl-3`}>{t('Today', '今天')}</button>
        <button onClick={() => setStart(s => shiftDays(s, 7))} className={`${navBtn} !px-2`} aria-label={t('Next week', '往後一週')}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
        </button>
        <div className="ml-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-light">
          <span>{t('Numbers = how many you can borrow that day', '數字＝當天還能借幾個')}</span>
          <span className="inline-flex items-center gap-2"><span className="w-3 h-3 bg-orange" />{t('Partly booked', '部分借出')}</span>
          <span className="inline-flex items-center gap-2"><span className="w-3 h-3 bg-pink" />{t('Fully booked', '已借完')}</span>
        </div>
      </div>

      {failed ? (
        <p className="py-16 text-center text-sm text-gray-light">{t('Couldn’t load the availability. Please try again later.', '現況讀取失敗，請稍後再試')}</p>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-light">{t('No Equipment Found', '找不到符合條件的設備')}</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          {/* table-fixed：名稱與總數量給寬度，其餘平均分給 14 天；視窗窄就左右捲 */}
          <table className="w-full min-w-[60rem] max-lg:min-w-[48rem] table-fixed text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={`${head} ${nameCol} !z-20`}>{t('Equipment', '設備')}</th>
                <th className={`${head} w-16 text-center`}>{t('Total', '總數量')}</th>
                {days.map(d => {
                  const date = fromDateKey(d)
                  const off = [0, 6].includes(date.getDay())
                  return (
                    <th key={d} className={`${head} text-center ${d === today ? '!text-white' : off ? '!text-gray-mid' : ''}`}>
                      <div className="font-english">{date.getMonth() + 1}/{date.getDate()}</div>
                      <div>{d === today ? t('Today', '今天') : t(WD_EN[date.getDay()], WD_ZH[date.getDay()])}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(e => (
                <tr key={e.id}>
                  <td className={`${nameCol} py-2 text-white border-b border-gray-mid`}>{itemName(e.id, e.name)}</td>
                  <td className="py-2 text-center font-english text-white border-b border-gray-mid">{e.originalQuantity}</td>
                  {days.map(d => {
                    const left = Math.max(0, e.originalQuantity - (reserved?.[e.id]?.[d] ?? 0))
                    return (
                      <td key={d} className="p-0.5 border-b border-gray-mid">
                        <div className={`h-8 rounded-lg flex items-center justify-center font-english ${
                          !reserved ? 'text-gray-mid' : left === 0 ? 'bg-pink text-black' : left < e.originalQuantity ? 'bg-orange text-black' : 'text-gray-light'
                        }`}>
                          {reserved ? left : '·'}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default EquipmentStatus
