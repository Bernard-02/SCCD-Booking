/**
 * 後台 · 寒暑假封鎖（rental_blackouts，情境 11-a）
 * 封鎖區間內學生一律不可租借（admin／staff 不受限）；前端日曆會把封鎖日期灰化不可選。
 */

import React, { useEffect, useState } from 'react'
import { listBlackouts, addBlackout, deleteBlackout } from '../services/adminService'
import type { Blackout } from '../services/adminService'

const AdminBlackoutsPage: React.FC = () => {
  const [rows, setRows] = useState<Blackout[]>([])
  const [loading, setLoading] = useState(true)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => listBlackouts().then(r => { setRows(r); setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { void load() }, [])

  const handleAdd = async () => {
    if (!start || !end) { alert('請選擇起訖日'); return }
    if (end < start) { alert('結束日不可早於開始日'); return }
    setBusy(true)
    const res = await addBlackout(start, end, reason)
    setBusy(false)
    if (!res.ok) { alert(res.message ?? '新增失敗'); return }
    setStart(''); setEnd(''); setReason(''); await load()
  }

  const handleDelete = async (b: Blackout) => {
    if (!confirm(`刪除封鎖 ${b.start_date} ～ ${b.end_date}？`)) return
    const res = await deleteBlackout(b.id)
    if (!res.ok) { alert(res.message ?? '刪除失敗'); return }
    await load()
  }

  const input = 'bg-transparent border border-gray-scale4 rounded px-3 py-1.5 text-tiny text-white focus:border-white outline-none'
  const cell = 'border border-gray-scale4 px-3 py-1.5'

  return (
    <div>
      <h1 className="text-medium-title font-['Inter',_sans-serif] mb-2">
        Blackouts <span className="font-['Noto_Sans_TC',_sans-serif] text-content text-gray-scale2">寒暑假封鎖</span>
      </h1>
      <p className="text-tiny text-gray-scale2 font-['Noto_Sans_TC',_sans-serif] mb-6">
        區間內學生不可租借（admin／staff 不受限）；日曆會把封鎖日期灰化。
      </p>

      {/* 新增列 */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className={`${input} cursor-pointer`} />
        <span className="text-gray-scale2 text-tiny">～</span>
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={`${input} cursor-pointer`} />
        <input
          type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="原因（如：暑假）" className={`${input} min-w-[10rem]`}
        />
        <button
          onClick={handleAdd} disabled={busy}
          className="px-3 py-1.5 rounded border border-white text-white text-tiny cursor-pointer hover:bg-white hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-['Noto_Sans_TC',_sans-serif]"
        >
          {busy ? '新增中…' : '新增'}
        </button>
      </div>

      {loading ? (
        <div className="text-gray-scale2 text-tiny font-['Noto_Sans_TC',_sans-serif]">載入中…</div>
      ) : (
        <table className="text-tiny border-collapse border border-gray-scale4">
          <thead>
            <tr className="text-left text-gray-scale2 bg-white/5">
              <th className={`${cell} font-normal`}>開始</th>
              <th className={`${cell} font-normal`}>結束</th>
              <th className={`${cell} font-normal`}>原因</th>
              <th className={`${cell} font-normal`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.id} className="hover:bg-white/5">
                <td className={`${cell} font-['Inter',_sans-serif] whitespace-nowrap`}>{b.start_date}</td>
                <td className={`${cell} font-['Inter',_sans-serif] whitespace-nowrap`}>{b.end_date}</td>
                <td className={`${cell} font-['Noto_Sans_TC',_sans-serif] text-gray-scale2 min-w-[10rem]`}>{b.reason || '—'}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  <button
                    onClick={() => handleDelete(b)}
                    className="text-red-400 hover:text-red-300 cursor-pointer font-['Noto_Sans_TC',_sans-serif]"
                  >
                    刪除
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className={`${cell} text-center text-gray-scale3 py-6 font-['Noto_Sans_TC',_sans-serif]`}>尚無封鎖區間</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default AdminBlackoutsPage
