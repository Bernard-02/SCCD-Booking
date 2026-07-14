/**
 * 後台 · 訂單全覽（唯讀列表 + 狀態篩選 + 欄位排序）
 * 之後逐步加動作按鈕（收押金 → 歸還 → 拆單…）與軟性欄位就地編輯。
 */

import React, { useEffect, useMemo, useState } from 'react'
import { fetchAllOrders, adminMarkPaid, adminMarkReturned, fetchClosedDates } from '../services/ordersService'
import type { AdminOrderRow, OrderStatus } from '../services/ordersService'
import { overduePenalty } from '../utils/timeUtils'

// 狀態的中文標籤與顏色（與前台 Profile 一致的語彙）
const STATUS_META: Record<OrderStatus, { zh: string; color: string }> = {
  pending: { zh: '待繳押金', color: '#eab308' },
  'in-progress': { zh: '租借中', color: '#22c55e' },
  overdue: { zh: '逾期', color: '#ef4444' },
  returned: { zh: '已歸還', color: '#6b7280' },
  canceled: { zh: '已取消', color: '#6b7280' }
}

const BOOKING_TYPE_ZH: Record<string, string> = {
  little: '小量',
  'mass-personal': '大量',
  'mass-group': '團體'
}

const FILTERS: { key: 'all' | OrderStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待繳押金' },
  { key: 'in-progress', label: '租借中' },
  { key: 'overdue', label: '逾期' },
  { key: 'returned', label: '已歸還' },
  { key: 'canceled', label: '已取消' }
]

const fmtDate = (d: string) => d?.slice(5).replace('-', '/') // 'YYYY-MM-DD' → 'MM/DD'

const itemsSummary = (o: AdminOrderRow) =>
  o.order_items.map(i => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join('、')

// 可排序欄位
type SortField = 'rental_number' | 'name' | 'student_id' | 'booking_type' | 'start_date' | 'deposit_total' | 'status'
const sortVal = (o: AdminOrderRow, f: SortField): string | number => {
  switch (f) {
    case 'name': return o.students?.name ?? ''
    case 'student_id': return o.students?.student_id ?? ''
    case 'deposit_total': return o.deposit_total
    default: return (o[f] ?? '') as string
  }
}

const COLUMNS: { field: SortField; label: string; align?: 'right' }[] = [
  { field: 'rental_number', label: '單號' },
  { field: 'name', label: '姓名' },
  { field: 'student_id', label: '學號' },
  { field: 'booking_type', label: '種類' },
  { field: 'start_date', label: '起訖' },
  { field: 'deposit_total', label: '押金', align: 'right' },
  { field: 'status', label: '狀態' }
]

const cell = 'border border-gray-scale4 px-3 py-1.5 whitespace-nowrap'

const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | OrderStatus>('all')
  const [sortField, setSortField] = useState<SortField>('rental_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [busy, setBusy] = useState<string | null>(null) // 正在操作的單號
  const [closedDates, setClosedDates] = useState<ReadonlySet<string>>(new Set())

  const load = () =>
    fetchAllOrders()
      .then(rows => { setOrders(rows); setLoading(false) })
      .catch(err => { setError(err.message ?? '讀取失敗'); setLoading(false) })

  useEffect(() => {
    void load()
    fetchClosedDates().then(setClosedDates)
  }, [])

  // 確認收押金：pending → in-progress，成功後重讀列表
  const handleMarkPaid = async (rentalNumber: string) => {
    setBusy(rentalNumber)
    const res = await adminMarkPaid(rentalNumber)
    setBusy(null)
    if (!res.ok) { alert(res.message ?? '操作失敗'); return }
    await load()
  }

  // 歸還：in-progress 直接確認（罰款 0）；overdue 先詢問確認罰款（預填系統試算）
  const handleReturn = async (o: AdminOrderRow) => {
    let penalty = 0
    if (o.status === 'overdue') {
      const est = overduePenalty(o.end_date, o.deposit_total, closedDates)
      const input = window.prompt(
        `「${o.rental_number}」逾期歸還，確認罰款金額（系統試算 NT$ ${est}，可修改）：`,
        String(est)
      )
      if (input === null) return // 取消
      penalty = parseInt(input, 10)
      if (Number.isNaN(penalty) || penalty < 0) { alert('金額無效'); return }
    } else if (!window.confirm(`確認「${o.rental_number}」已歸還？`)) {
      return
    }
    setBusy(o.rental_number)
    const res = await adminMarkReturned(o.rental_number, penalty)
    setBusy(null)
    if (!res.ok) { alert(res.message ?? '操作失敗'); return }
    await load()
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length }
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1
    return c
  }, [orders])

  const visible = useMemo(() => {
    const rows = filter === 'all' ? orders : orders.filter(o => o.status === filter)
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = sortVal(a, sortField)
      const vb = sortVal(b, sortField)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }, [orders, filter, sortField, sortDir])

  const toggleSort = (f: SortField) => {
    if (f === sortField) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(f); setSortDir('asc') }
  }

  return (
    <div>
      {/* 標題 */}
      <h1 className="text-medium-title font-['Inter',_sans-serif] mb-4">
        Orders <span className="font-['Noto_Sans_TC',_sans-serif] text-content text-gray-scale2">訂單全覽</span>
      </h1>

      {/* 狀態篩選 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-lg border text-tiny whitespace-nowrap cursor-pointer transition-colors ${
              filter === f.key
                ? 'border-white bg-white text-black'
                : 'border-gray-scale3 text-gray-scale2 hover:border-white hover:text-white'
            }`}
          >
            {f.label}
            <span className="ml-1 opacity-60">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-scale2 text-tiny font-['Noto_Sans_TC',_sans-serif]">載入中…</div>}
      {error && <div className="text-red-400 text-tiny font-['Noto_Sans_TC',_sans-serif]">讀取失敗：{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="text-tiny border-collapse border border-gray-scale4">
            <thead>
              <tr className="text-left text-gray-scale2 bg-white/5">
                {COLUMNS.map(col => (
                  <th
                    key={col.field}
                    onClick={() => toggleSort(col.field)}
                    className={`${cell} font-normal cursor-pointer select-none hover:text-white ${col.align === 'right' ? 'text-right' : ''}`}
                  >
                    {col.label}
                    <span className="ml-1 opacity-70">{sortField === col.field ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                  </th>
                ))}
                <th className={`${cell} font-normal`}>品項</th>
                <th className={`${cell} font-normal`}>借用原因</th>
                <th className={`${cell} font-normal`}>操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(o => (
                <tr key={o.id} className="hover:bg-white/5">
                  <td className={`${cell} font-['Inter',_sans-serif]`}>{o.rental_number}</td>
                  <td className={`${cell} font-['Noto_Sans_TC',_sans-serif]`}>{o.students?.name ?? '—'}</td>
                  <td className={`${cell} text-gray-scale2 font-['Inter',_sans-serif]`}>{o.students?.student_id ?? ''}</td>
                  <td className={`${cell} font-['Noto_Sans_TC',_sans-serif]`}>{BOOKING_TYPE_ZH[o.booking_type] ?? o.booking_type}</td>
                  <td className={`${cell} font-['Inter',_sans-serif]`}>{fmtDate(o.start_date)}–{fmtDate(o.end_date)}</td>
                  <td className={`${cell} text-right font-['Inter',_sans-serif]`}>NT$ {o.deposit_total.toLocaleString()}</td>
                  <td className={cell}>
                    <span
                      className="px-2 py-0.5 rounded font-['Noto_Sans_TC',_sans-serif]"
                      style={{ backgroundColor: STATUS_META[o.status].color, color: '#000' }}
                    >
                      {STATUS_META[o.status].zh}
                    </span>
                  </td>
                  {/* 品項與原因較長，允許換行 */}
                  <td className="border border-gray-scale4 px-3 py-1.5 font-['Noto_Sans_TC',_sans-serif] min-w-[10rem] max-w-[18rem]">{itemsSummary(o)}</td>
                  <td className="border border-gray-scale4 px-3 py-1.5 font-['Noto_Sans_TC',_sans-serif] text-gray-scale2 min-w-[8rem] max-w-[16rem]">{o.reason || '—'}</td>
                  <td className={cell}>
                    {o.status === 'pending' ? (
                      <button
                        onClick={() => handleMarkPaid(o.rental_number)}
                        disabled={busy === o.rental_number}
                        className="px-2 py-1 rounded border border-white text-white text-tiny whitespace-nowrap cursor-pointer hover:bg-white hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-['Noto_Sans_TC',_sans-serif]"
                      >
                        {busy === o.rental_number ? '處理中…' : '確認收押金'}
                      </button>
                    ) : o.status === 'in-progress' || o.status === 'overdue' ? (
                      <button
                        onClick={() => handleReturn(o)}
                        disabled={busy === o.rental_number}
                        className="px-2 py-1 rounded border border-white text-white text-tiny whitespace-nowrap cursor-pointer hover:bg-white hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-['Noto_Sans_TC',_sans-serif]"
                      >
                        {busy === o.rental_number ? '處理中…' : '歸還'}
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
            <div className="text-gray-scale3 text-tiny py-8 text-center font-['Noto_Sans_TC',_sans-serif]">沒有符合的訂單</div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminOrdersPage
