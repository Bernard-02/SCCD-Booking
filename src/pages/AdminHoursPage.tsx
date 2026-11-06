/**
 * 後台 · 營業時間——規則與說明見 docs/admin-hours.md（週六日固定不營業）
 * 左：「假期 & 休息日」月曆（同前台日曆的大數字單月）整合 closed_dates（休息日＝黃、法定假日＝藍，自動匯入）與
 *   rental_blackouts（寒暑假＝灰）。點日期＝開在日期右側的小視窗：沒東西→新增休息日（日期唯讀、原因、其他才有說明欄）；
 *   已有→顯示內容可刪除。標題右「新增」下拉：休息日＝點月曆日期；寒暑假＝點起訖日（綠），下拉處變「確定」。
 * 右：值班時間表（staff_duties）：週一～五 × 午班／晚班（SHIFTS 寫死），每格 1～3 人（系學會名單）；
 *   按編輯才能改，確定一次寫入差異（移除的刪、新增的加），之後鎖定。
 * 休息日／法定假日：倒數與逾期跳過、歸還順延；新增休息日自動發公告＋通知受影響訂單。封鎖：擋新單、前台日曆灰化。
 */

import { BTN } from '@/components/common/btn'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import CloseButton from '../components/common/CloseButton'
import {
  listClosedDates, addClosedDate, deleteClosedDate, listBlackouts, addBlackout, deleteBlackout,
  notifyClosedDateAffected, notifyBlackoutAffected, announceClosedDate, autoImportHolidays, CLOSED_KIND_ZH,
  listStaff, addStaffDuty, deleteStaffDuties, updateStaffDuties
} from '../services/adminService'
import type { ClosedDate, ClosedKind, Blackout, StaffMember } from '../services/adminService'
import { toDateKey } from '../utils/timeUtils'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useToast } from '../hooks/useToast'
import {
  PageTitle, inputCls, textBtn, toolBtn, iconFillBtn, tableTh as th, tableTd as td, LoadError, Select, Field
} from '../components/admin/adminUi'

const MONTH_ZH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const WD = '日一二三四五六' // 同 JS getDay：0＝週日
const WEEKDAYS = [1, 2, 3, 4, 5]
// ponytail: 值班時段寫死兩班；學會要改時間再做成設定。舊資料依開始時間歸類（15:00 前＝午班）
const SHIFTS = [
  { key: 'noon', zh: '午班', start: '12:00', end: '13:00' },
  { key: 'evening', zh: '晚班', start: '17:00', end: '19:00' }
] as const
type ShiftKey = typeof SHIFTS[number]['key']
const shiftOf = (startTime: string): ShiftKey => (startTime.slice(0, 5) < '15:00' ? 'noon' : 'evening')
const cellKey = (weekday: number, shift: ShiftKey) => `${weekday}|${shift}`
const MAX_PER_SHIFT = 3

// 月曆顏色：休息日黃、法定假日藍（cyan，2026-11-02 從 error 粉紅改）、寒暑假灰（同前台不可選的灰）、寒暑假選取中綠（同前台起訖日）
const COLOR = { closed: 'var(--color-yellow)', holiday: 'var(--color-cyan)', blackout: 'var(--color-gray-mid)', range: 'var(--color-green)' }
const KIND_OPTIONS: ClosedKind[] = ['activity', 'review', 'other']
const fmtDay = (key: string) => `${key.replace(/-/g, '/')}（週${WD[new Date(`${key}T00:00:00`).getDay()]}）`

type Mode = 'idle' | 'closed' | 'blackout'
type Grid = Record<string, number[]> // cellKey → staff_members.id（編輯中 0＝尚未選）

const AdminHoursPage: React.FC = () => {
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast, toastElement } = useToast()
  const [closed, setClosed] = useState<ClosedDate[]>([])
  const [blackouts, setBlackouts] = useState<Blackout[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // ---- 月曆 ----
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [mode, setMode] = useState<Mode>('idle')
  const [range, setRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null }) // 寒暑假起訖
  const [hover, setHover] = useState<string | null>(null)
  // 日期小視窗：開在被點的格子右側（靠右的格子改開左側）
  const [pop, setPop] = useState<{ day: string; left: number; top: number; flip: boolean } | null>(null)
  const [form, setForm] = useState<{ kind: ClosedKind; reason: string }>({ kind: 'activity', reason: '' })
  const calRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // ---- 值班 ----
  const [draft, setDraft] = useState<Grid | null>(null) // null＝鎖定（非編輯）

  const load = () => Promise.all([listClosedDates(), listBlackouts(), listStaff()])
    .then(([c, b, s]) => { setClosed(c); setBlackouts(b); setStaff(s); setLoadError(null) })
    .catch(e => setLoadError(e?.message ?? '未知錯誤'))
    .finally(() => setLoading(false))
  // 法定假日先自動匯入再載入
  useEffect(() => { void autoImportHolidays().catch(() => {}).finally(load) }, [])

  const closedByDay = useMemo(() => new Map(closed.map(c => [c.day, c])), [closed])
  const blackoutOf = (key: string) => blackouts.find(b => b.start_date <= key && key <= b.end_date)

  // 小視窗：Esc／點外面關
  useEffect(() => {
    if (!pop) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element
      // Select 的清單是 portal 到 body、確認框也是：都不算「外面」
      if (popRef.current?.contains(t) || t.closest?.('[role="listbox"], [role="dialog"]')) return
      setPop(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [pop])

  const exitMode = () => { setMode('idle'); setRange({ start: null, end: null }) }

  // 寒暑假起訖也可以直接 key：接受 2026/10/26、2026-10-26、20261026；打完一個合法日期就套用並翻到那個月
  const [typed, setTyped] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const parseTyped = (v: string): string | null => {
    const d = v.replace(/\D/g, '')
    if (d.length !== 8) return null
    const y = +d.slice(0, 4), mo = +d.slice(4, 6), da = +d.slice(6, 8)
    const dt = new Date(y, mo - 1, da)
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === da ? toDateKey(dt) : null
  }
  const onTyped = (which: 'start' | 'end', v: string) => {
    setTyped(t => ({ ...t, [which]: v }))
    const key = parseTyped(v)
    if (!key) return
    setRange(r => (which === 'start'
      ? { start: key, end: r.end && r.end >= key ? r.end : null }
      : { start: r.start && r.start <= key ? r.start : key, end: r.start && r.start <= key ? key : null }))
    setMonth(new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, 1))
  }
  // 月曆點選後輸入框跟著顯示
  useEffect(() => { setTyped({ start: range.start?.replace(/-/g, '/') ?? '', end: range.end?.replace(/-/g, '/') ?? '' }) }, [range])

  const onDayClick = (key: string, el: HTMLElement) => {
    if (mode === 'blackout') {
      // 第一下起日、第二下訖日（早於起日＝重選起日）
      if (!range.start || range.end) setRange({ start: key, end: null })
      else setRange(key >= range.start ? { start: range.start, end: key } : { start: key, end: null })
      return
    }
    const cal = calRef.current
    if (!cal) return
    const r = el.getBoundingClientRect(), cr = cal.getBoundingClientRect()
    const flip = r.left - cr.left > cr.width * 0.6
    setPop({ day: key, left: flip ? r.left - cr.left - 8 : r.right - cr.left + 8, top: r.top - cr.top, flip })
    setForm({ kind: 'activity', reason: '' })
    if (mode === 'closed') setMode('idle')
  }

  const handleAddClosed = async () => {
    if (!pop) return
    const day = pop.day
    if (form.kind === 'other' && !form.reason.trim()) { showToast('請填寫休息原因'); return }
    const reasonText = form.kind === 'other' ? form.reason.trim() : CLOSED_KIND_ZH[form.kind]
    setBusy(true)
    const res = await addClosedDate(day, form.kind, form.kind === 'other' ? reasonText : null)
    if (!res.ok) { setBusy(false); showToast(res.message ?? '新增失敗'); return }
    // 今天以後的休息日：自動發全站公告 template＋通知受影響訂單（補登過去的日期不發）
    if (day >= toDateKey(new Date())) {
      const [a, n] = await Promise.all([announceClosedDate(day, reasonText), notifyClosedDateAffected(day, reasonText)])
      if (!a.ok || !n.ok) showToast(`已新增休息日 ${day}，但${!a.ok ? '全站公告' : '受影響訂單通知'}發送失敗：${(!a.ok ? a : n).message}`)
      else showToast(`已新增休息日 ${day}，已發全站公告（Facebook 請同步發布）${n.count > 0 ? `，並通知 ${n.count} 筆受影響的訂單` : ''}`, 'success')
    } else {
      showToast(`已補登休息日 ${day}`, 'success')
    }
    setBusy(false)
    setPop(null)
    await load()
  }

  const handleDeleteClosed = async (c: ClosedDate) => {
    setPop(null) // 先關小視窗再開確認框
    const holiday = c.kind === 'holiday'
    const ok = await confirm({
      title: holiday ? '刪除法定假日' : '刪除休息日',
      message: holiday
        ? `刪除 ${c.day}（${c.reason}）？刪除＝學會當天照常營業，之後不會再被自動補回。`
        : `刪除休息日 ${c.day}？（已發出的公告不會收回）`,
      confirmTextZh: '刪除', variant: 'danger'
    })
    if (!ok) return
    const res = await deleteClosedDate(c.day)
    if (!res.ok) { showToast(res.message ?? '刪除失敗'); return }
    showToast(`已刪除 ${c.day}${holiday ? '，當天照常營業' : ''}`, 'success')
    setPop(null)
    await load()
  }

  const handleConfirmBlackout = async () => {
    if (!range.start || !range.end) return
    const { start, end } = range
    setBusy(true)
    const res = await addBlackout(start, end, '寒暑假')
    if (!res.ok) { setBusy(false); showToast(res.message ?? '新增失敗'); return }
    const n = await notifyBlackoutAffected(start, end, '寒暑假')
    setBusy(false)
    if (!n.ok) showToast(`已新增寒暑假 ${start} ～ ${end}，但通知受影響同學失敗：${n.message}`)
    else showToast(`已新增寒暑假 ${start} ～ ${end}${n.count > 0 ? `，已通知 ${n.count} 筆重疊的訂單` : ''}`, 'success')
    exitMode()
    await load()
  }

  const handleDeleteBlackout = async (b: Blackout) => {
    setPop(null)
    const ok = await confirm({ title: '刪除寒暑假', message: `刪除封鎖 ${b.start_date} ～ ${b.end_date}？`, confirmTextZh: '刪除', variant: 'danger' })
    if (!ok) return
    const res = await deleteBlackout(b.id)
    if (!res.ok) { showToast(res.message ?? '刪除失敗'); return }
    showToast(`已刪除 ${b.start_date} ～ ${b.end_date}`, 'success')
    setPop(null)
    await load()
  }

  // ---- 月曆格子 ----
  const year = month.getFullYear(), m = month.getMonth()
  const todayKey = toDateKey(new Date())
  const goToday = () => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)) }
  const firstDow = new Date(year, m, 1).getDay()
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const rows = Math.max(6, Math.ceil((firstDow + daysInMonth) / 7)) // 固定 6 行，翻月高度不跳
  // 同前台日曆：大數字、Inter 粗體、靠左；hover 數字上滑由 booking.css 的 .cursor-pointer 規則處理
  const cellCls = "text-left text-[2.5rem] font-bold font-english tracking-tighter leading-none py-1 min-w-0"
  const inRange = (key: string) => {
    if (mode !== 'blackout' || !range.start) return false
    const end = range.end ?? (hover && hover >= range.start ? hover : range.start)
    return key >= range.start && key <= end
  }
  const cells: JSX.Element[] = []
  for (let i = 0; i < rows * 7; i++) {
    const n = i - firstDow + 1
    if (n < 1 || n > daysInMonth) { cells.push(<div key={`e${i}`} className={cellCls} aria-hidden />); continue }
    const key = toDateKey(new Date(year, m, n))
    const c = closedByDay.get(key), b = blackoutOf(key)
    const color = inRange(key) ? COLOR.range : c ? (c.kind === 'holiday' ? COLOR.holiday : COLOR.closed) : b ? COLOR.blackout : 'white'
    cells.push(
      <div
        key={key}
        data-date={key}
        className={`${cellCls} cursor-pointer relative`}
        style={{ color }}
        onClick={e => onDayClick(key, e.currentTarget)}
        onMouseEnter={() => setHover(key)}
        onMouseLeave={() => setHover(null)}
        title={c ? (c.kind === 'holiday' ? `法定假日：${c.reason ?? ''}` : `休息日：${c.reason ?? CLOSED_KIND_ZH[c.kind ?? 'other']}`) : b ? `寒暑假 ${b.start_date} ～ ${b.end_date}` : undefined}
      >
        <div className="date-number-wrapper">
          <span className="date-number-text">{n}</span>
          <span className="date-number-hidden">{n}</span>
        </div>
        {/* 今天：數字下方一個小點（跟著數字顏色） */}
        {key === todayKey && <span className="absolute left-0.5 bottom-0 w-1.5 h-1.5 rounded-full bg-current" aria-label="今天" />}
      </div>
    )
  }

  // 小視窗內容：那天有什麼就顯示什麼，沒有＝新增休息日。標題列右上：垃圾桶（有東西才有）＋X 關閉
  const popDay = pop ? closedByDay.get(pop.day) : undefined
  const popBlackout = pop ? blackoutOf(pop.day) : undefined
  const iconBtnCls = `flex items-center text-gray-light ${BTN}`
  const popHeader = (title: string, onDelete?: () => void) => (
    <div className="flex items-center justify-between gap-4">
      <h3 className="text-sm text-white">{title}</h3>
      <div className="flex items-center gap-2">
        {onDelete && (
          <button onClick={onDelete} title="刪除" aria-label="刪除" className={iconBtnCls}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
          </button>
        )}
        <CloseButton onClick={() => setPop(null)} />
      </div>
    </div>
  )

  // ---- 值班表 ----
  const current = useMemo(() => {
    const g: Grid = {}
    for (const w of WEEKDAYS) for (const s of SHIFTS) g[cellKey(w, s.key)] = []
    for (const st of staff) for (const d of st.duties) {
      const k = cellKey(d.weekday, shiftOf(d.start_time))
      if (k in g && !g[k].includes(st.id)) g[k].push(st.id)
    }
    return g
  }, [staff])
  const nameOf = (id: number) => staff.find(s => s.id === id)?.name ?? '—'
  const staffOptions = staff.map(s => ({ value: s.id, label: s.name }))
  const setCell = (k: string, ids: number[]) => setDraft(d => (d ? { ...d, [k]: ids } : d))

  const handleSaveDuties = async () => {
    if (!draft) return
    const toDelete: number[] = []
    const toAdd: { staffId: number; weekday: number; shift: typeof SHIFTS[number] }[] = []
    const toFix: Record<ShiftKey, number[]> = { noon: [], evening: [] } // 保留的列但時間和班表不同（例：舊晚班 18:00 結束）→ 改成班表時間
    for (const w of WEEKDAYS) for (const s of SHIFTS) {
      const k = cellKey(w, s.key)
      const desired = [...new Set(draft[k].filter(id => id > 0))]
      if (desired.length === 0) { showToast(`週${WD[w]}${s.zh}至少要排一人`); return }
      // 既有列（一人一筆）：不在名單的刪、同一人重複的只留一筆
      const seen = new Set<number>()
      for (const st of staff) for (const d of st.duties) {
        if (d.weekday !== w || shiftOf(d.start_time) !== s.key) continue
        if (!desired.includes(st.id) || seen.has(st.id)) toDelete.push(d.id)
        else if (d.start_time.slice(0, 5) !== s.start || d.end_time.slice(0, 5) !== s.end) toFix[s.key].push(d.id)
        seen.add(st.id)
      }
      for (const id of desired) if (!seen.has(id)) toAdd.push({ staffId: id, weekday: w, shift: s })
    }
    setBusy(true)
    const results = [
      toDelete.length > 0 ? await deleteStaffDuties(toDelete) : { ok: true },
      ...(await Promise.all(SHIFTS.filter(sh => toFix[sh.key].length > 0).map(sh => updateStaffDuties(toFix[sh.key], sh.start, sh.end)))),
      ...(await Promise.all(toAdd.map(a => addStaffDuty(a.staffId, a.weekday, a.shift.start, a.shift.end))))
    ]
    setBusy(false)
    const failed = results.find(r => !r.ok)
    if (failed) { showToast(failed.message ?? '儲存失敗'); await load(); return }
    showToast('值班表已更新', 'success')
    setDraft(null)
    await load()
  }

  return (
    // 撐滿內容區（AdminLayout main 固定 h-screen）
    <div className="h-full flex flex-col">
      <PageTitle zh="營業時間" />

      {loading ? (
        <div className="text-gray-light text-xs font-chinese">載入中…</div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={() => { setLoading(true); void load() }} />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto flex gap-12">
          {/* ===== 左：假期 & 休息日 ===== */}
          <section className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4 mb-6 h-9">
              <h2 className="text-sm text-white">假期 &amp; 休息日</h2>
              {mode === 'blackout' ? (
                <div className="flex items-center gap-2">
                  {/* 起訖日：同前台日期列顯示兩個日期，可點月曆也可直接 key */}
                  {(['start', 'end'] as const).map(which => (
                    <label key={which} className="flex items-center gap-2 text-xs text-gray-light font-chinese">
                      {which === 'start' ? '開始' : '結束'}
                      <input
                        value={typed[which]}
                        onChange={e => onTyped(which, e.target.value)}
                        placeholder="YYYY/MM/DD"
                        inputMode="numeric"
                        className="h-9 w-[6.5rem] px-2 text-center rounded-lg bg-gray-dark focus:bg-gray-mid text-xs text-white font-english placeholder:text-gray-mid outline-none"
                      />
                    </label>
                  ))}
                  <button onClick={exitMode} className={textBtn(false)}>
                    <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">undo</span>
                    取消
                  </button>
                  <button
                    onClick={handleConfirmBlackout}
                    disabled={!range.end || busy}
                    className={`${toolBtn(true)} px-3 font-chinese`}
                  >
                    確定
                  </button>
                </div>
              ) : mode === 'closed' ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-light font-chinese mr-1">點月曆日期新增休息日</span>
                  <button onClick={exitMode} className={textBtn(false)}>
                    <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">undo</span>
                    取消
                  </button>
                </div>
              ) : (
                <Select<Mode | ''>
                  value=""
                  placeholder="新增"
                  icon="add"
                  filled
                  options={[{ value: 'closed', label: '休息日' }, { value: 'blackout', label: '寒暑假' }]}
                  onChange={v => { if (v) { setPop(null); setRange({ start: null, end: null }); setMode(v) } }}
                  className="font-chinese"
                  aria-label="新增"
                />
              )}
            </div>

            {/* 月份導航同前台：箭頭靠左、標題靠右；後台翻月不限 */}
            <div className="flex justify-between items-center pb-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setMonth(new Date(year, m - 1, 1))} className={`text-white text-xl select-none ${BTN}`} aria-label="上個月">&lt;</button>
                <button onClick={() => setMonth(new Date(year, m + 1, 1))} className={`text-white text-xl select-none ${BTN}`} aria-label="下個月">&gt;</button>
                {/* 回到今天那個月；已在本月時停用 */}
                <button
                  onClick={goToday}
                  disabled={todayKey.startsWith(toDateKey(month).slice(0, 7))}
                  className={`${toolBtn(false)} px-3 font-chinese`}
                >
                  今天
                </button>
              </div>
              <div className="text-white text-xl font-normal font-english pr-6">{year} {MONTH_ZH[m]}</div>
            </div>

            {/* 月曆本體：relative 讓日期小視窗以格子位置定位 */}
            <div ref={calRef} className="relative">
              <div className="grid grid-cols-7 w-full">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className={`${cellCls} text-white`}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 w-full" style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}>
                {cells}
              </div>

              {pop && (
                <div
                  ref={popRef}
                  className="absolute z-20 w-72 p-4 bg-gray-darker border border-gray-mid rounded-2xl text-xs flex flex-col gap-4"
                  style={{ left: pop.left, top: pop.top, transform: pop.flip ? 'translateX(-100%)' : undefined }}
                >
                  {popDay ? (
                    <>
                      {popHeader(popDay.kind === 'holiday' ? '法定假日' : '休息日', () => handleDeleteClosed(popDay))}
                      <div className="flex flex-col gap-1 font-chinese">
                        <span className="font-english text-white">{fmtDay(popDay.day)}</span>
                        <span className="text-gray-light">
                          {popDay.kind === 'holiday' ? popDay.reason : `${CLOSED_KIND_ZH[popDay.kind ?? 'other']}${popDay.reason ? `・${popDay.reason}` : ''}`}
                        </span>
                      </div>
                    </>
                  ) : popBlackout ? (
                    <>
                      {popHeader('寒暑假', () => handleDeleteBlackout(popBlackout))}
                      <span className="font-english text-white">{popBlackout.start_date} ～ {popBlackout.end_date}</span>
                    </>
                  ) : (
                    <>
                      {popHeader('新增休息日')}
                      <Field zh="日期">
                        <span className={`${inputCls} w-full font-english text-gray-light border-transparent px-0`}>{fmtDay(pop.day)}</span>
                      </Field>
                      <Field zh="原因" required>
                        <Select<ClosedKind>
                          value={form.kind}
                          onChange={kind => setForm(f => ({ ...f, kind }))}
                          options={KIND_OPTIONS.map(k => ({ value: k, label: CLOSED_KIND_ZH[k] }))}
                          className="font-chinese w-full"
                        />
                      </Field>
                      {form.kind === 'other' && (
                        <Field zh="說明" required>
                          <input
                            value={form.reason} autoFocus placeholder="會寫進公告：系學會因「說明」公休"
                            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                            className={`${inputCls} w-full font-chinese`}
                          />
                        </Field>
                      )}
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddClosed}
                          disabled={busy}
                          className={`text-white ${BTN}`}
                        >
                          {busy ? '處理中…' : '新增'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 圖例 */}
            <div className="flex flex-wrap gap-5 mt-4 text-xs font-chinese text-white">
              {[['休息日', COLOR.closed], ['法定假日', COLOR.holiday], ['寒暑假', COLOR.blackout]].map(([zh, color]) => (
                <span key={zh} className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3" style={{ backgroundColor: color }} />{zh}
                </span>
              ))}
            </div>
          </section>

          {/* ===== 右：值班時間（深灰卡片，和左邊月曆分開；表頭的 sticky 黑底在卡片裡改透明） ===== */}
          <section className="w-[30rem] shrink-0 self-start bg-gray-dark rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4 mb-6 h-9">
              <h2 className="text-sm text-white">值班時間</h2>
              {draft ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setDraft(null)} className={textBtn(false)}>
                    <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">undo</span>
                    取消
                  </button>
                  <button
                    onClick={handleSaveDuties}
                    disabled={busy}
                    className={`${toolBtn(true)} px-3 font-chinese`}
                  >
                    {busy ? '處理中…' : '確定'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDraft(Object.fromEntries(Object.entries(current).map(([k, v]) => [k, v.length ? [...v] : [0]])))}
                  title="編輯" aria-label="編輯" className={iconFillBtn}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                </button>
              )}
            </div>

            {/* table-fixed：兩個班欄平分卡片寬度，下拉用 flex-1 縮放，不會撐破卡片 */}
            <table className="w-full table-fixed text-xs border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-gray-light">
                  <th className={`${th} !bg-transparent w-14`}>日期</th>
                  {SHIFTS.map(s => (
                    <th key={s.key} className={`${th} !bg-transparent`}>
                      {s.zh} <span className="font-english opacity-70">{s.start}–{s.end}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map(w => (
                  <tr key={w}>
                    {/* 編輯中：文字置中對齊第一列下拉（h-9） */}
                    <td className={`${td} font-chinese align-top`}><div className={draft ? 'h-9 flex items-center' : ''}>週{WD[w]}</div></td>
                    {SHIFTS.map(s => {
                      const k = cellKey(w, s.key)
                      const ids = draft ? draft[k] : current[k]
                      return (
                        <td key={s.key} className={`${td} align-top`}>
                          {draft ? (
                            <div className="flex flex-col gap-2">
                              {ids.map((id, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <Select<number>
                                    value={id}
                                    placeholder="選擇"
                                    options={staffOptions}
                                    onChange={v => setCell(k, ids.map((x, j) => (j === i ? v : x)))}
                                    className="font-chinese flex-1 min-w-0"
                                    aria-label={`週${WD[w]}${s.zh}第 ${i + 1} 位`}
                                  />
                                  {/* 每格至少一人：只剩一列時垃圾桶停用（全站規則：不能按的一律 not-allowed） */}
                                  <button
                                    type="button"
                                    onClick={() => setCell(k, ids.filter((_, j) => j !== i))}
                                    disabled={ids.length <= 1}
                                    title="移除" aria-label="移除"
                                    className={`${iconBtnCls}`}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                                  </button>
                                  {/* ＋只在最後一列、未滿 3 人時出現，省一列空間 */}
                                  {i === ids.length - 1 && ids.length < MAX_PER_SHIFT && (
                                    <button type="button" onClick={() => setCell(k, [...ids, 0])} title="加人" aria-label="加人" className={iconBtnCls}>
                                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : ids.length > 0 ? (
                            <span className="font-chinese">{ids.map(nameOf).join('、')}</span>
                          ) : (
                            <span className="text-gray-mid font-chinese">未排</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {staff.length === 0 && (
              <p className="mt-4 text-xs text-gray-mid font-chinese">還沒有系學會成員：先到會員管理把身份設為系學會。</p>
            )}
          </section>
        </div>
      )}
      <ConfirmDialog />
      {toastElement}
    </div>
  )
}

export default AdminHoursPage
