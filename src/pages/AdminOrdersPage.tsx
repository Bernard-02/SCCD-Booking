/**
 * 後台 · 訂單全覽（搜尋 + 租借時間／狀態／種類篩選 + 點表頭單欄排序 + 收押金／歸還）
 * 樣式沿用前台 Profile：狀態標籤語彙與顏色同 getStatusInfo、按鈕同 Extend 樣式。
 * 「收押金」「歸還」兩欄＝每張單都會走的兩步（2026-10-26）：還沒做是按鈕、做完顯示經手人，一眼看出走到哪、誰經手；
 * 其餘動作（點交／延期／取消訂單）在最右「操作」欄。所有動作都走 OrderActionDialog，必選值班經手人
 * （寫入 paid_by / picked_up_by / returned_by 供追溯）。
 * 搜尋列下方四個分類按鈕（2026-10-24）：全部／待繳押金／待取件／待歸還，各附筆數；點了切換下方表格內容。
 * 待歸還＝使用中＋未完成歸還（都是要收回來的）；已歸還／已取消只在「全部」裡看（搜尋得到）。
 */

import { BTN } from '@/components/common/btn'
import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchAllOrders, adminMarkPaid, adminMarkReturnedPartial, adminHandoverItems, adminCollectPenalty, adminCancelOrder, adminExtendOrder, adminUpdateOrderInfo, fetchClosedDates } from '../services/ordersService'
import type { AdminOrderRow, OrderInfo } from '../services/ordersService'
import { listStaff } from '../services/adminService'
import type { StaffMember } from '../services/adminService'
import { overduePenalty, overdueBusinessDays, pendingMsRemaining, isOnDuty, slotLabel, toDateKey, SUSPENSION_OVERDUE_DAYS } from '../utils/timeUtils'
import { ADMIN_HANDLER_KEY } from '../utils/storageKeys'
import { ORDER_KIND_META, orderKind, orderKindMeta, StatusChip, actionBtn, PageTitle, tableTh, tableTd, tableRowLine as rowLine, toolBtn, textBtn, SearchBox, CountTabs, SortTh, toggleSort, itemsSummary, usePager, Pager, Select, DateRangePicker, LoadError, isAwaitingPickup, isPickupLate } from '../components/admin/adminUi'
import type { Sort } from '../components/admin/adminUi'
import OrderActionDialog, { type AdminActionMode } from '../components/admin/OrderActionDialog'
import OrderInfoDialog from '../components/admin/OrderInfoDialog'
import { useToast } from '../hooks/useToast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const fmtDate = (d: string) => d?.slice(5).replace('-', '/') // 'YYYY-MM-DD' → 'MM/DD'
const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 可排序欄位（Notion 式：每一欄都能點表頭排序）
type SortField =
  | 'rental_number' | 'name' | 'student_id' | 'booking_type' | 'start_date'
  | 'deposit_total' | 'status' | 'items' | 'reason' | 'paid_by' | 'returned_by'
const sortVal = (o: AdminOrderRow, f: SortField): string | number => {
  switch (f) {
    case 'name': return o.students?.name ?? ''
    case 'student_id': return o.students?.student_id ?? ''
    case 'deposit_total': return o.deposit_total
    case 'items': return itemsSummary(o)
    case 'reason': return o.reason ?? ''
    case 'paid_by': return o.paid_by ?? ''
    case 'returned_by': return o.returned_by ?? ''
    case 'booking_type': return orderKind(o)
    default: return (o[f] ?? '') as string
  }
}

// w＝欄寬：表格 w-full＋自動排版下，有寬度的欄固定（內容更長才撐開，不會溢出），只有品項不給寬度、吃掉全部剩餘空間，
// 切換篩選／排序時表頭就不跳。狀態／原因／操作內容較長時換行，不要為此放大欄寬（螢幕約 1400px 時品項才有 200px 以上）
const COLUMNS: { field: SortField; zh: string; w?: string }[] = [
  { field: 'rental_number', zh: '單號', w: 'w-24' },
  { field: 'items', zh: '品項' },
  { field: 'start_date', zh: '時間', w: 'w-28' },
  { field: 'name', zh: '姓名', w: 'w-20' },
  { field: 'student_id', zh: '學號', w: 'w-24' },
  { field: 'booking_type', zh: '種類', w: 'w-20' },
  { field: 'status', zh: '狀態', w: 'w-32' },
  { field: 'deposit_total', zh: '押金', w: 'w-28' },
  { field: 'reason', zh: '原因', w: 'w-40' },
  { field: 'paid_by', zh: '收押金', w: 'w-28' },
  { field: 'returned_by', zh: '歸還', w: 'w-28' }
]

// 搜尋列下方的分類按鈕：篩選條件＋筆數。待繳押金＝pending 未繳；待取件＝大量設備已繳待取（isAwaitingPickup）；
// 待歸還＝使用中＋未完成歸還
type TabKey = 'all' | 'deposit' | 'pickup' | 'return'
const TABS: { key: TabKey; zh: string; match: (o: AdminOrderRow) => boolean }[] = [
  { key: 'all', zh: '全部', match: () => true },
  { key: 'deposit', zh: '待繳押金', match: o => o.status === 'pending' && !o.deposit_paid_at },
  { key: 'pickup', zh: '待取件', match: isAwaitingPickup },
  { key: 'return', zh: '待歸還', match: o => o.status === 'in-progress' || o.status === 'overdue' }
]

// 表頭／儲存格樣式共用 adminUi 的 tableTh／tableTd（表頭 sticky、底線畫在儲存格上）
const th = tableTh
const td = tableTd

// 每欄的儲存格渲染：依 COLUMNS 順序查表（closed＝公休日，倒數／逾期天數用；act＝開操作對話框、busy＝處理中的單號）
type CellCtx = {
  closed: ReadonlySet<string>
  editInfo: (o: AdminOrderRow) => void
  act: (o: AdminOrderRow, mode: AdminActionMode) => void
  busy: string | null
}
// 收押金／歸還欄裡的動作鈕；該單處理中時改顯示文字（操作欄此時不顯示，免得兩格都寫處理中）。
// enabled=false＝這一步現在不能做（例：已取消的單）：按鈕照樣顯示但停用，每列欄位對齊、一眼看出走到哪
const actBtn = (o: AdminOrderRow, ctx: CellCtx, mode: AdminActionMode, zh: string, enabled = true) =>
  ctx.busy === o.rental_number
    ? <span className="text-gray-light">處理中…</span>
    : <button onClick={() => enabled && ctx.act(o, mode)} disabled={!enabled} className={actionBtn}>{zh}</button>
const CELL: Record<SortField, (o: AdminOrderRow, ctx: CellCtx) => React.ReactNode> = {
  rental_number: o => <td key="rental_number" className={`${td} font-english`}>{o.rental_number}</td>,
  name: o => <td key="name" className={`${td} font-chinese`}>{o.students?.name ?? '—'}</td>,
  student_id: o => <td key="student_id" className={`${td} text-gray-light font-english`}>{o.students?.student_id ?? ''}</td>,
  booking_type: o => <td key="booking_type" className={`${td} font-chinese`}>{orderKindMeta(o).zh}</td>,
  start_date: o => <td key="start_date" className={`${td} font-english`}>{fmtDate(o.start_date)}–{fmtDate(o.end_date)}</td>,
  deposit_total: o => <td key="deposit_total" className={`${td} font-english`}>NT$ {o.deposit_total.toLocaleString()}</td>,
  // 大量設備預選時段：待繳押金時列出預約的繳押金／取件時段；已繳待取件逾起租日 → 紅字提醒（學會手動處理）。
  // 待繳押金另顯示 24 工作時倒數、逾期顯示逾期營業日（原總覽頁的提醒）
  status: (o, { closed }) => (
    <td key="status" className={`px-3 py-3 ${rowLine}`}>
      <StatusChip status={o.status} awaitingPickup={isAwaitingPickup(o)} />
      {o.status === 'pending' && !o.deposit_paid_at && (() => {
        const ms = pendingMsRemaining(o.created_at, new Date(), closed)
        return ms > 0
          ? <div className="mt-1 font-chinese" style={{ color: 'var(--color-yellow)' }}>剩 {Math.ceil(ms / 3_600_000)} 小時</div>
          : <div className="mt-1 font-chinese text-gray-mid">已逾時，將自動取消</div>
      })()}
      {o.status === 'overdue' && (() => {
        const days = overdueBusinessDays(o.end_date, closed)
        return (
          <div className="mt-1 font-chinese" style={{ color: 'var(--color-error)' }}>
            逾期 {days} 營業日{days >= SUSPENSION_OVERDUE_DAYS ? '（達停權門檻）' : ''}
          </div>
        )
      })()}
      {o.status === 'pending' && o.pickup_slot && (
        <div className="mt-1 font-chinese text-gray-light leading-5">
          {!o.deposit_paid_at && o.deposit_date && o.deposit_slot && (
            <div>繳 {slotLabel({ date: o.deposit_date, slot: o.deposit_slot })}</div>
          )}
          <div>取 {slotLabel({ date: o.start_date, slot: o.pickup_slot })}</div>
        </div>
      )}
      {isPickupLate(o, toDateKey(new Date())) && (
        <div className="mt-1 font-chinese" style={{ color: 'var(--color-error)' }}>逾時未取件</div>
      )}
    </td>
  ),
  // 品項與原因較長，允許換行；一項一行。學生改單（情境 3）：取件後新增＝待點交、送單後改過＝已更動
  items: o => (
    <td key="items" className={`px-3 py-3 font-chinese ${rowLine}`}>
      {o.order_items.map(i => (
        <div key={i.id}>
          {i.name}{i.item_type === 'equipment' && <span className="font-english"> ×{i.quantity}</span>}
          {i.pickup_pending
            ? <span className="ml-1" style={{ color: 'var(--color-yellow)' }}>待點交</span>
            : i.changed_at && <span className="ml-1 text-gray-light">已更動</span>}
        </div>
      ))}
      {o.items_updated_at && (
        <div className="text-gray-light mt-1">改於 <span className="font-english">{fmtDateTime(o.items_updated_at)}</span></div>
      )}
    </td>
  ),
  // 借用資訊（原因／班級／老師）任何狀態都可代改，修學生打錯字：文字在左，鉛筆推到欄位最右（各列對齊）
  reason: (o, { editInfo }) => (
    <td key="reason" className={`px-3 py-3 font-chinese text-gray-light ${rowLine}`}>
      <div className="flex items-start justify-between gap-3">
        <span>{o.reason || '—'}</span>
        <button
          onClick={() => editInfo(o)}
          title="修改借用資訊"
          aria-label="修改借用資訊"
          className={`shrink-0 flex text-gray-light ${BTN}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
        </button>
      </div>
    </td>
  ),
  // 收押金：待繳＝「收押金」鈕；收完顯示經手人。大量設備先繳後取：收完接「取件」鈕（情境 2），取完經手人不同時多一行「取 某人」
  paid_by: (o, ctx) => (
    <td key="paid_by" className={`${td} font-chinese`}>
      {o.status === 'pending' && !o.deposit_paid_at ? actBtn(o, ctx, 'paid', '收押金')
        : !o.paid_by ? actBtn(o, ctx, 'paid', '收押金', false)
        : (
          <div className="leading-5">
            <div>{o.paid_by}</div>
            {o.picked_up_by && o.picked_up_by !== o.paid_by && <div><span className="text-gray-light">取</span> {o.picked_up_by}</div>}
            {isAwaitingPickup(o) && <div className="mt-1">{actBtn(o, ctx, 'pickup', '取件')}</div>}
          </div>
        )}
    </td>
  ),
  // 歸還：借用中／逾期＝「歸還」鈕（逾期含罰款確認）；還完顯示經手人，欠繳罰款再接「收罰款」鈕（收清才解除擋單）
  returned_by: (o, ctx) => (
    <td key="returned_by" className={`${td} font-chinese`}>
      {o.status === 'in-progress' || o.status === 'overdue' ? actBtn(o, ctx, 'return', '歸還')
        : !o.returned_by ? actBtn(o, ctx, 'return', '歸還', false)
        : (
          <div className="leading-5">
            <div>{o.returned_by}</div>
            {o.status === 'returned' && (o.penalty_total ?? 0) > 0 && o.penalty_paid === false && (
              <div className="mt-1">{actBtn(o, ctx, 'penalty', '收罰款')}</div>
            )}
          </div>
        )}
    </td>
  )
}


const AdminOrdersPage: React.FC = () => {
  const { showToast, toastElement } = useToast()
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  // 會員頁「總租借」帶學號過來（/admin/orders?student=學號）＝該帳號的租借歷史：是篩選不是搜尋，搜尋列旁顯示學生 chip、點 ✕ 清除
  const [searchParams, setSearchParams] = useSearchParams()
  const studentFilter = searchParams.get('student') ?? ''
  const [search, setSearch] = useState('')
  // 租借時間區間（與起訖重疊即符合；空字串＝不限）
  const [range, setRange] = useState({ from: '', to: '' })
  const [showRange, setShowRange] = useState(false)
  // 單欄排序（點表頭，同設備／空間／會員頁）：預設單號新→舊；多重排序面板 2026-10-27 拿掉
  const [sort, setSort] = useState<Sort<SortField>>({ field: 'rental_number', dir: 'desc' })
  const [busy, setBusy] = useState<string | null>(null) // 正在操作的單號
  const [closedDates, setClosedDates] = useState<ReadonlySet<string>>(new Set())
  const [staff, setStaff] = useState<StaffMember[]>([]) // 幹部（經手人選單，值班中優先）
  const [action, setAction] = useState<{ order: AdminOrderRow; mode: AdminActionMode } | null>(null)

  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = () =>
    fetchAllOrders()
      .then(rows => { setOrders(rows); setError(null); setUpdatedAt(new Date()); setLoading(false) })
      .catch(err => { setError(err.message ?? '讀取失敗'); setLoading(false) })

  // 更新：失敗不蓋掉現有列表（背景下次再試；「更新於」時間停住即代表資料可能過時），手動按才跳提示
  const refresh = (manual = false) => {
    setRefreshing(true)
    return fetchAllOrders()
      .then(rows => { setOrders(rows); setError(null); setUpdatedAt(new Date()) })
      .catch(() => { if (manual) showToast('更新失敗，請檢查網路後再試') })
      .finally(() => setRefreshing(false))
  }
  useAutoRefresh(() => refresh())

  useEffect(() => {
    void load()
    fetchClosedDates().then(setClosedDates)
    listStaff().then(setStaff).catch(() => setStaff([]))
  }, [])

  // 對話框確認：收押金／歸還／收罰款／代取消／代延期（經手人記住供下次預選；
  // 歸還支援部分歸還——全勾整單、部分勾拆子單）
  const handleAction = async (handler: string, penalty: number, itemIds: number[], penaltyPaid: boolean, days: number, pickup: boolean, depositTotal?: number) => {
    if (!action) return
    const { order, mode } = action
    setAction(null)
    localStorage.setItem(ADMIN_HANDLER_KEY, handler)
    setBusy(order.rental_number)
    const res =
      mode === 'paid' || mode === 'pickup'
        ? await adminMarkPaid(order.rental_number, handler, pickup, depositTotal)
        : mode === 'handover'
          ? await adminHandoverItems(order.rental_number, handler, depositTotal ?? order.deposit_total)
        : mode === 'penalty'
          ? await adminCollectPenalty(order.rental_number, handler)
          : mode === 'cancel'
            ? await adminCancelOrder(order.rental_number, handler)
            : mode === 'extend'
              ? await adminExtendOrder(order.rental_number, days, handler)
              : await adminMarkReturnedPartial(order.rental_number, itemIds, penalty, handler, penaltyPaid)
    setBusy(null)
    if (!res.ok) { showToast(res.message ?? '操作失敗'); return }
    const rn = order.rental_number
    const penaltyNote = penalty > 0 ? `，罰款 NT$ ${penalty}${penaltyPaid ? '已繳清' : '記為欠繳'}` : ''
    showToast(
      mode === 'handover' ? `已點交 ${rn} 新增的設備`
      : mode === 'pickup' ? `已完成取件 ${rn}，租借開始`
      : mode === 'paid' && !pickup ? `已收押金 ${rn}，待取件`
      : mode === 'paid' ? `已確認收押金 ${rn}`
      : mode === 'penalty' ? `已收罰款 ${rn}`
      : mode === 'cancel' ? `已取消 ${rn}`
      : mode === 'extend' ? `已將 ${rn} 延期 ${days} 天`
      : itemIds.length < order.order_items.length ? `已部分歸還 ${rn}，未還品項已拆成子單續租${penaltyNote}`
      : `已完成歸還 ${rn}${penaltyNote}`,
      'success'
    )
    await load()
  }

  // 修改借用資訊（軟性欄位）：失敗時對話框保留，內容不丟
  const [infoOrder, setInfoOrder] = useState<AdminOrderRow | null>(null)
  const [infoSaving, setInfoSaving] = useState(false)
  const handleInfoSave = async (info: OrderInfo) => {
    if (!infoOrder) return
    setInfoSaving(true)
    const res = await adminUpdateOrderInfo(infoOrder.rental_number, info)
    setInfoSaving(false)
    if (!res.ok) { showToast(res.message ?? '儲存失敗'); return }
    setInfoOrder(null)
    showToast(`已更新 ${infoOrder.rental_number} 的借用資訊`, 'success')
    await load()
  }

  // 搜尋＋種類篩選後的基底（狀態數字也跟著變，跟 Notion 的 filter 邏輯一致）
  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter(o => {
      if (studentFilter && (o.students?.student_id ?? '') !== studentFilter) return false
      if (typeFilter !== 'all' && orderKind(o) !== typeFilter) return false
      if (range.from && o.end_date < range.from) return false
      if (range.to && o.start_date > range.to) return false
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
  }, [orders, search, typeFilter, range, studentFilter])
  const studentName = studentFilter ? orders.find(o => o.students?.student_id === studentFilter)?.students?.name ?? '' : ''

  // 各籤筆數跟著搜尋／時間／種類篩選變（同 Notion：filter 後再分籤）
  const counts = useMemo(
    () => Object.fromEntries(TABS.map(t => [t.key, base.filter(t.match).length])) as Record<TabKey, number>,
    [base]
  )

  const visible = useMemo(() => {
    const rows = base.filter(TABS.find(t => t.key === tab)!.match)
    if (!sort) return rows // 維持建立時間新→舊（fetch 預設）
    const { field, dir } = sort
    return [...rows].sort((a, b) => {
      const va = sortVal(a, field), vb = sortVal(b, field)
      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [base, tab, sort])

  const { pageRows, pager } = usePager(visible, [search, tab, typeFilter, range, sort])
  const sortProps = { sort, onSort: (f: SortField) => setSort(s => toggleSort(s, f)) }

  const hasRange = !!(range.from || range.to)
  const cellCtx: CellCtx = { closed: closedDates, editInfo: setInfoOrder, act: (order, mode) => setAction({ order, mode }), busy }

  return (
    // 撐滿內容區（AdminLayout main 固定 h-screen）：標題／工具列／分頁固定，只有表格區捲動
    <div className="h-full flex flex-col">
      {/* 標題右邊：資料更新時間＋重新整理（每分鐘自動更新，時間停住＝資料可能過時） */}
      <PageTitle zh="訂單全覽">
        {updatedAt && (
          <span className="text-xs text-gray-mid font-chinese">
            更新於 <span className="font-english">{updatedAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          </span>
        )}
        {/* 同其他頁標題列的「＋ 新增」鈕：灰底 icon＋文字 */}
        <button
          onClick={() => refresh(true)}
          disabled={refreshing}
          className={`${textBtn(false)}`}
          title="每分鐘自動更新"
        >
          <span className={`material-symbols-outlined opacity-70 ${refreshing ? 'animate-spin' : ''}`} style={{ fontSize: '18px' }} aria-hidden="true">refresh</span>
          重新整理
        </button>
      </PageTitle>

      {/* 工具列：左搜尋框（常駐）；右＝租借時間、種類 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 mr-auto">
          <SearchBox value={search} onChange={setSearch} className="w-72" />
          {studentFilter && (
            <button
              onClick={() => setSearchParams({})}
              title="清除學生篩選"
              className={`${toolBtn(true)} inline-flex items-center pl-2 pr-1.5 gap-1.5 font-chinese`}
            >
              <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">person</span>
              {studentName && <span>{studentName}</span>}
              <span className="font-english opacity-70">{studentFilter}</span>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">close</span>
            </button>
          )}
        </div>
        <button onClick={() => setShowRange(v => !v)} className={textBtn(showRange || hasRange)} aria-expanded={showRange}>
          <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">date_range</span>
          租借時間
        </button>
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          options={[{ value: 'all', label: '全部種類' }, ...Object.entries(ORDER_KIND_META).map(([key, meta]) => ({ value: key, label: meta.zh }))]}
          icon="category"
          filled
          className="font-chinese"
        />
      </div>

      {/* 分類分頁（搜尋列下方） */}
      <CountTabs tabs={TABS} value={tab} onChange={setTab} counts={counts} />

      {/* 租借時間區間（date range icon 展開）：與訂單起訖有重疊即列出 */}
      {showRange && (
        <div className="flex items-center gap-2 mb-6 text-xs text-gray-light font-chinese">
          <span className="mr-1">租借時間</span>
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
      )}

      {loading && <div className="text-gray-light text-xs font-chinese">載入中…</div>}
      {!loading && error && <LoadError message={error} onRetry={() => { setLoading(true); void load() }} />}

      {!loading && !error && (
        <div className="flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
          {/* min-w＝固定欄總和（1248px）＋品項至少 170px：塞不下時橫向捲動，不然 Chrome 會按比例壓縮所有欄、表頭又會跳 */}
          <table className="w-full min-w-[1420px] text-xs border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-gray-light">
                {COLUMNS.map(col => <SortTh key={col.field} zh={col.zh} field={col.field} className={col.w ?? ''} {...sortProps} />)}
                <th className={`${th} w-40`}>操作</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(o => (
                <tr key={o.id} className="hover:bg-white/10">
                  {COLUMNS.map(c => CELL[c.field](o, cellCtx))}
                  <td className={td}>
                    {(() => {
                      // 收押金／取件／歸還／收罰款在各自的欄；這裡是其餘動作（情境 9／13）：
                      // 學生取件後新增設備 → 前面多一個「點交」；處理中由收押金／歸還欄顯示，這裡留白
                      const handover: { mode: AdminActionMode; zh: string }[] =
                        o.order_items.some(i => i.pickup_pending) ? [{ mode: 'handover', zh: '點交' }] : []
                      const acts: { mode: AdminActionMode; zh: string }[] =
                        o.status === 'pending'
                          ? [{ mode: 'cancel', zh: '取消訂單' }]
                          : o.status === 'in-progress'
                            ? [...handover, { mode: 'extend', zh: '延期' }, { mode: 'cancel', zh: '取消訂單' }]
                            : o.status === 'overdue'
                              ? [...handover, { mode: 'extend', zh: '延期' }]
                              : []
                      if (busy === o.rental_number) return null
                      return (
                        <div className="flex flex-wrap items-center gap-3">
                          {acts.map(a => (
                            <button
                              key={a.mode}
                              onClick={() => setAction({ order: o, mode: a.mode })}
                              className={actionBtn}
                            >
                              {a.zh}
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {visible.length === 0 && (
            <div className="text-gray-mid text-xs py-8 text-center font-chinese">沒有符合的訂單</div>
          )}
        </div>
      )}

      {/* 分頁：放在 overflow 容器外，表格橫捲時不跟著跑 */}
      {!loading && !error && <Pager {...pager} />}

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
      {infoOrder && (
        <OrderInfoDialog
          order={infoOrder}
          busy={infoSaving}
          onSave={handleInfoSave}
          onCancel={() => setInfoOrder(null)}
        />
      )}
      {toastElement}
    </div>
  )
}

export default AdminOrdersPage
