/**
 * 後台 · 訂單全覽（搜尋 + 狀態／種類篩選 + 全欄排序 + 收押金／歸還）
 * 樣式沿用前台 Profile：狀態標籤語彙與顏色同 getStatusInfo、按鈕同 Extend 樣式。
 * 收押金／歸還走 OrderActionDialog，必選值班經手人（寫入 paid_by / returned_by 供追溯）。
 * 支援 ?status= 進頁預設篩選（總覽 dashboard 點擊統計跳轉用）。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchAllOrders, adminMarkPaid, adminMarkReturned, fetchClosedDates } from '../services/ordersService'
import type { AdminOrderRow, OrderStatus } from '../services/ordersService'
import { listStaff } from '../services/adminService'
import type { StaffMember } from '../services/adminService'
import { overduePenalty, isOnDuty } from '../utils/timeUtils'
import { ADMIN_HANDLER_KEY, ADMIN_ORDER_COLS_KEY } from '../utils/storageKeys'
import { STATUS_META, STATUS_ORDER, BOOKING_TYPE_META, StatusChip, actionBtn, inputCls, PageTitle } from '../components/admin/adminUi'
import OrderActionDialog from '../components/admin/OrderActionDialog'

const FILTERS: { key: 'all' | OrderStatus; en: string; zh: string }[] = [
  { key: 'all', en: 'All', zh: '全部' },
  ...STATUS_ORDER.map(s => ({ key: s, en: STATUS_META[s].en, zh: STATUS_META[s].zh }))
]

const fmtDate = (d: string) => d?.slice(5).replace('-', '/') // 'YYYY-MM-DD' → 'MM/DD'

const itemsSummary = (o: AdminOrderRow) =>
  o.order_items.map(i => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join('、')

// 可排序欄位（Notion 式：每一欄都能點表頭排序）
type SortField =
  | 'rental_number' | 'name' | 'student_id' | 'booking_type' | 'start_date'
  | 'deposit_total' | 'status' | 'items' | 'reason' | 'paid_by'
const sortVal = (o: AdminOrderRow, f: SortField): string | number => {
  switch (f) {
    case 'name': return o.students?.name ?? ''
    case 'student_id': return o.students?.student_id ?? ''
    case 'deposit_total': return o.deposit_total
    case 'items': return itemsSummary(o)
    case 'reason': return o.reason ?? ''
    case 'paid_by': return o.paid_by ?? ''
    default: return (o[f] ?? '') as string
  }
}

const COLUMNS: { field: SortField; en: string; zh: string }[] = [
  { field: 'rental_number', en: 'No.', zh: '單號' },
  { field: 'name', en: 'Name', zh: '姓名' },
  { field: 'student_id', en: 'ID', zh: '學號' },
  { field: 'booking_type', en: 'Type', zh: '種類' },
  { field: 'start_date', en: 'Dates', zh: '起訖' },
  { field: 'deposit_total', en: 'Deposit', zh: '押金' },
  { field: 'status', en: 'Status', zh: '狀態' },
  { field: 'items', en: 'Items', zh: '品項' },
  { field: 'reason', en: 'Reason', zh: '借用原因' },
  { field: 'paid_by', en: 'Handler', zh: '經手' }
]

const th = 'px-3 py-2 font-normal whitespace-nowrap'
const td = 'px-3 py-3 whitespace-nowrap'

// 每欄的儲存格渲染：依 colOrder 查表，讓表頭拖曳換位時列內容跟著換
const CELL: Record<SortField, (o: AdminOrderRow) => React.ReactNode> = {
  rental_number: o => <td key="rental_number" className={`${td} font-english`}>{o.rental_number}</td>,
  name: o => <td key="name" className={`${td} font-chinese`}>{o.students?.name ?? '—'}</td>,
  student_id: o => <td key="student_id" className={`${td} text-gray-scale2 font-english`}>{o.students?.student_id ?? ''}</td>,
  booking_type: o => <td key="booking_type" className={`${td} font-chinese`}>{BOOKING_TYPE_META[o.booking_type]?.zh ?? o.booking_type}</td>,
  start_date: o => <td key="start_date" className={`${td} font-english`}>{fmtDate(o.start_date)}–{fmtDate(o.end_date)}</td>,
  deposit_total: o => <td key="deposit_total" className={`${td} font-english`}>NT$ {o.deposit_total.toLocaleString()}</td>,
  status: o => <td key="status" className={td}><StatusChip status={o.status} /></td>,
  // 品項與原因較長，允許換行
  items: o => <td key="items" className="px-3 py-3 font-chinese min-w-[10rem] max-w-[18rem]">{itemsSummary(o)}</td>,
  reason: o => <td key="reason" className="px-3 py-3 font-chinese text-gray-scale2 min-w-[8rem] max-w-[16rem]">{o.reason || '—'}</td>,
  paid_by: o => (
    <td key="paid_by" className={td}>
      {o.paid_by || o.returned_by ? (
        <div className="font-chinese leading-5">
          {o.paid_by && <div><span className="text-gray-scale2">收</span> {o.paid_by}</div>}
          {o.returned_by && <div><span className="text-gray-scale2">還</span> {o.returned_by}</div>}
        </div>
      ) : (
        <span className="text-gray-scale3">—</span>
      )}
    </td>
  )
}

// 工具列 icon 按鈕（active = 展開中或有生效的篩選）
const iconBtn = (active: boolean) =>
  `w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
    active ? 'text-white bg-white/10' : 'text-gray-scale2 hover:text-white hover:bg-white/10'
  }`

const AdminOrdersPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const urlStatus = searchParams.get('status')
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | OrderStatus>(
    urlStatus && urlStatus in STATUS_META ? (urlStatus as OrderStatus) : 'all'
  )
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showFilters, setShowFilters] = useState(urlStatus !== null) // 從 dashboard 帶篩選進來時展開
  const [showSort, setShowSort] = useState(false)
  // 排序規則拖曳：改用 Pointer Events（原生 HTML5 DnD 在整列塞滿 <select> 時會被表單控制吃掉
  // mousedown、拖曳根本不啟動）。dragIndex 只用於畫面淡化；dragRef 同步追蹤即時位置避免 setState 時序問題。
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // 多重排序（Notion 式）：依序比較，前面的規則優先。
  // ponytail: 不做拖曳調順序——移除再加即可；要拖曳再說。
  const [sorts, setSorts] = useState<{ field: SortField; dir: 'asc' | 'desc' }[]>([
    { field: 'rental_number', dir: 'desc' }
  ])
  const [busy, setBusy] = useState<string | null>(null) // 正在操作的單號
  const [closedDates, setClosedDates] = useState<ReadonlySet<string>>(new Set())
  const [staff, setStaff] = useState<StaffMember[]>([]) // 幹部（經手人選單，值班中優先）
  const [action, setAction] = useState<{ order: AdminOrderRow; mode: 'paid' | 'return' } | null>(null)

  const load = () =>
    fetchAllOrders()
      .then(rows => { setOrders(rows); setLoading(false) })
      .catch(err => { setError(err.message ?? '讀取失敗'); setLoading(false) })

  useEffect(() => {
    void load()
    fetchClosedDates().then(setClosedDates)
    listStaff().then(setStaff).catch(() => setStaff([]))
  }, [])

  // 對話框確認：收押金／歸還（經手人記住供下次預選）
  const handleAction = async (handler: string, penalty: number) => {
    if (!action) return
    const { order, mode } = action
    setAction(null)
    localStorage.setItem(ADMIN_HANDLER_KEY, handler)
    setBusy(order.rental_number)
    const res =
      mode === 'paid'
        ? await adminMarkPaid(order.rental_number, handler)
        : await adminMarkReturned(order.rental_number, penalty, handler)
    setBusy(null)
    if (!res.ok) { alert(res.message ?? '操作失敗'); return }
    await load()
  }

  // 搜尋＋種類篩選後的基底（狀態數字也跟著變，跟 Notion 的 filter 邏輯一致）
  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter(o => {
      if (typeFilter !== 'all' && o.booking_type !== typeFilter) return false
      if (!q) return true
      return [
        o.rental_number,
        o.students?.name ?? '',
        o.students?.student_id ?? '',
        itemsSummary(o),
        o.reason ?? '',
        o.paid_by ?? '',
        o.returned_by ?? ''
      ].some(v => v.toLowerCase().includes(q))
    })
  }, [orders, search, typeFilter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: base.length }
    for (const o of base) c[o.status] = (c[o.status] ?? 0) + 1
    return c
  }, [base])

  const visible = useMemo(() => {
    const rows = filter === 'all' ? base : base.filter(o => o.status === filter)
    if (sorts.length === 0) return rows // 無排序規則＝維持建立時間新→舊（fetch 預設）
    return [...rows].sort((a, b) => {
      for (const s of sorts) {
        const va = sortVal(a, s.field)
        const vb = sortVal(b, s.field)
        if (va < vb) return s.dir === 'asc' ? -1 : 1
        if (va > vb) return s.dir === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [base, filter, sorts])

  // 表頭點擊＝快速單一排序：同欄再點切換升降冪，換欄則重設為該欄升冪
  const toggleSort = (f: SortField) => {
    setSorts(prev =>
      prev.length === 1 && prev[0].field === f
        ? [{ field: f, dir: prev[0].dir === 'asc' ? 'desc' : 'asc' }]
        : [{ field: f, dir: 'asc' }]
    )
  }

  const updateSort = (i: number, patch: Partial<{ field: SortField; dir: 'asc' | 'desc' }>) =>
    setSorts(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const removeSort = (i: number) => setSorts(prev => prev.filter((_, idx) => idx !== i))
  const addSort = () => {
    const unused = COLUMNS.map(c => c.field).find(f => !sorts.some(s => s.field === f))
    if (unused) setSorts(prev => [...prev, { field: unused, dir: 'asc' }])
  }
  const moveSort = (from: number, to: number) =>
    setSorts(prev => {
      if (from === to) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })

  // 拖曳把手：按下即抓住該列，移動時依游標 Y 與各列中線即時重排（WYSIWYG，像 Notion）
  const onGripDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    dragRef.current = i
    setDragIndex(i)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onGripMove = (e: React.PointerEvent) => {
    const from = dragRef.current
    if (from === null || !listRef.current) return
    const rows = Array.from(listRef.current.querySelectorAll<HTMLElement>('[data-sort-row]'))
    let to = rows.length - 1
    for (let k = 0; k < rows.length; k++) {
      const r = rows[k].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) { to = k; break }
    }
    if (to !== from) { moveSort(from, to); dragRef.current = to; setDragIndex(to) }
  }
  const onGripUp = () => { dragRef.current = null; setDragIndex(null) }

  // 欄位順序（拖曳表頭換位；Action 欄固定在最後）。原生 HTML5 DnD：
  // 拖進別的表頭（dragEnter）就即時換位，WYSIWYG，不需 drop。順序記在 localStorage，
  // 載入時過濾掉已不存在的欄位、補上新增的欄位（COLUMNS 日後增減也不會壞）。
  const [colOrder, setColOrder] = useState<SortField[]>(() => {
    const all = COLUMNS.map(c => c.field)
    try {
      const saved: SortField[] = JSON.parse(localStorage.getItem(ADMIN_ORDER_COLS_KEY) ?? '')
      return [...saved.filter(f => all.includes(f)), ...all.filter(f => !saved.includes(f))]
    } catch { return all }
  })
  useEffect(() => {
    localStorage.setItem(ADMIN_ORDER_COLS_KEY, JSON.stringify(colOrder))
  }, [colOrder])
  const dragColRef = useRef<SortField | null>(null)
  const moveCol = (target: SortField) => {
    const from = dragColRef.current
    if (!from || from === target) return
    setColOrder(prev => {
      const next = prev.filter(f => f !== from)
      next.splice(prev.indexOf(target) > prev.indexOf(from) ? next.indexOf(target) + 1 : next.indexOf(target), 0, from)
      return next
    })
  }

  const hasFilter = filter !== 'all' || typeFilter !== 'all'

  return (
    <div>
      <PageTitle en="Orders" zh="訂單全覽" />

      {/* 工具列（Notion 式 compact）：左筆數、右搜尋／篩選 icon */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-tiny text-gray-scale2 font-chinese mr-auto">{visible.length} 筆</span>
        {showSearch ? (
          <input
            type="search"
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); setShowSearch(false) } }}
            onBlur={() => { if (!search.trim()) setShowSearch(false) }}
            placeholder="搜尋單號／姓名／學號／品項／原因／經手人"
            className={`${inputCls} font-chinese w-80`}
          />
        ) : (
          <button onClick={() => setShowSearch(true)} className={iconBtn(false)} title="搜尋 Search" aria-label="搜尋">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>search</span>
          </button>
        )}
        <button
          onClick={() => setShowSort(v => !v)}
          className={iconBtn(showSort || sorts.length > 1)}
          title="排序 Sort"
          aria-label="排序"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>swap_vert</span>
        </button>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={iconBtn(showFilters || hasFilter)}
          title="篩選 Filter"
          aria-label="篩選"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>filter_list</span>
        </button>
      </div>

      {/* 排序面板（Notion 式多重排序：由上而下依序比較） */}
      {showSort && (
        <div ref={listRef} className="flex flex-col items-start gap-3 mb-6">
          {sorts.map((s, i) => (
            <div
              key={s.field}
              data-sort-row
              className={`group flex items-center gap-2 transition-opacity ${dragIndex === i ? 'opacity-40' : ''}`}
            >
              {/* 拖曳把手（唯一抓握點：整列塞滿 select，把手才是可靠的抓取區）；按住上下拖即時重排 */}
              <span
                onPointerDown={onGripDown(i)}
                onPointerMove={onGripMove}
                onPointerUp={onGripUp}
                style={{ touchAction: 'none' }}
                className="flex items-center text-gray-scale3 hover:text-white cursor-grab active:cursor-grabbing select-none"
                aria-label="拖曳排序"
                title="拖曳調整優先順序"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>drag_indicator</span>
              </span>
              <select
                value={s.field}
                onChange={e => updateSort(i, { field: e.target.value as SortField })}
                className="bg-black border border-gray-scale4 rounded-lg px-3 py-1.5 text-tiny text-white focus:border-white outline-none font-chinese cursor-pointer"
              >
                {COLUMNS.filter(c => c.field === s.field || !sorts.some(x => x.field === c.field)).map(c => (
                  <option key={c.field} value={c.field}>{c.en} {c.zh}</option>
                ))}
              </select>
              <select
                value={s.dir}
                onChange={e => updateSort(i, { dir: e.target.value as 'asc' | 'desc' })}
                className="bg-black border border-gray-scale4 rounded-lg px-3 py-1.5 text-tiny text-white focus:border-white outline-none font-chinese cursor-pointer"
              >
                <option value="asc">Ascending 升冪</option>
                <option value="desc">Descending 降冪</option>
              </select>
              <button
                onClick={() => removeSort(i)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-scale2 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="移除排序"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
            </div>
          ))}
          {sorts.length < COLUMNS.length && (
            <button
              onClick={addSort}
              className="text-tiny text-gray-scale2 hover:text-white transition-colors cursor-pointer"
            >
              ＋ <span className="font-english">Add sort</span> <span className="font-chinese">新增排序</span>
            </button>
          )}
        </div>
      )}

      {/* 篩選列（filter icon 展開）：狀態＋種類 */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-6">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-tiny whitespace-nowrap transition-colors cursor-pointer ${
                filter === f.key ? 'text-white font-bold' : 'text-gray-scale2 hover:text-white'
              }`}
            >
              <span className="font-english">{f.en}</span> <span className="font-chinese">{f.zh}</span>
              <span className="font-english ml-1 opacity-60">{counts[f.key] ?? 0}</span>
            </button>
          ))}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-black border border-gray-scale4 rounded-lg px-3 py-1.5 text-tiny text-white focus:border-white outline-none font-chinese cursor-pointer"
          >
            <option value="all">全部種類</option>
            {Object.entries(BOOKING_TYPE_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.zh}</option>
            ))}
          </select>
        </div>
      )}

      {loading && <div className="text-gray-scale2 text-tiny font-chinese">載入中…</div>}
      {error && (
        <div className="text-tiny font-chinese" style={{ color: 'var(--color-error2)' }}>讀取失敗：{error}</div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-tiny border-collapse">
            <thead>
              <tr className="text-left text-gray-scale2 border-b border-gray-scale4">
                {colOrder.map(f => COLUMNS.find(c => c.field === f)!).map(col => (
                  <th
                    key={col.field}
                    draggable
                    onDragStart={() => { dragColRef.current = col.field }}
                    onDragEnter={() => moveCol(col.field)}
                    onDragOver={e => e.preventDefault()}
                    onDragEnd={() => { dragColRef.current = null }}
                    onClick={() => toggleSort(col.field)}
                    className={`${th} cursor-pointer select-none hover:text-white`}
                  >
                    <span className="font-english">{col.en}</span> <span className="font-chinese">{col.zh}</span>
                    {/* 固定寬度佔位：箭頭出現／移動時欄寬不變；多重排序時附優先順序 */}
                    <span className="inline-block w-4 ml-0.5 text-[10px] opacity-70 whitespace-nowrap">
                      {(() => {
                        const i = sorts.findIndex(s => s.field === col.field)
                        if (i === -1) return ''
                        return `${sorts[i].dir === 'asc' ? '↑' : '↓'}${sorts.length > 1 ? i + 1 : ''}`
                      })()}
                    </span>
                  </th>
                ))}
                <th className={th}><span className="font-english">Action</span> <span className="font-chinese">操作</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(o => (
                <tr key={o.id} className="border-b border-gray-scale4 hover:bg-white/5">
                  {colOrder.map(f => CELL[f](o))}
                  <td className={td}>
                    {o.status === 'pending' ? (
                      <button
                        onClick={() => setAction({ order: o, mode: 'paid' })}
                        disabled={busy === o.rental_number}
                        className={actionBtn(busy !== o.rental_number)}
                      >
                        {busy === o.rental_number
                          ? <span className="font-chinese">處理中…</span>
                          : <span className="font-english">Deposit <span className="font-chinese">收押金</span></span>}
                      </button>
                    ) : o.status === 'in-progress' || o.status === 'overdue' ? (
                      <button
                        onClick={() => setAction({ order: o, mode: 'return' })}
                        disabled={busy === o.rental_number}
                        className={actionBtn(busy !== o.rental_number)}
                      >
                        {busy === o.rental_number
                          ? <span className="font-chinese">處理中…</span>
                          : <span className="font-english">Return <span className="font-chinese">歸還</span></span>}
                      </button>
                    ) : (
                      <span className="text-gray-scale3">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {visible.length === 0 && (
            <div className="text-gray-scale3 text-tiny py-8 text-center font-chinese">沒有符合的訂單</div>
          )}
        </div>
      )}

      {/* 收押金／歸還對話框（必選經手人） */}
      {action && (
        <OrderActionDialog
          order={action.order}
          mode={action.mode}
          staff={staff
            .map(m => ({ name: m.name, onDuty: isOnDuty(m.duties) }))
            .sort((a, b) => Number(b.onDuty) - Number(a.onDuty))}
          defaultHandler={localStorage.getItem(ADMIN_HANDLER_KEY) ?? ''}
          estPenalty={
            action.order.status === 'overdue'
              ? overduePenalty(action.order.end_date, action.order.deposit_total, closedDates)
              : 0
          }
          onConfirm={handleAction}
          onCancel={() => setAction(null)}
        />
      )}
    </div>
  )
}

export default AdminOrdersPage
