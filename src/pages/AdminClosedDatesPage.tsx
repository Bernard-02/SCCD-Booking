/**
 * 後台 · 公休日（closed_dates）
 * 臨時公休日（週六日以外）——繳押金 24 工作時倒數與逾期天數會跳過這些日期。
 */

import React, { useEffect, useState } from 'react'
import { listClosedDates, addClosedDate, deleteClosedDate } from '../services/adminService'
import type { ClosedDate } from '../services/adminService'

const AdminClosedDatesPage: React.FC = () => {
  const [rows, setRows] = useState<ClosedDate[]>([])
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => listClosedDates().then(r => { setRows(r); setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { void load() }, [])

  const handleAdd = async () => {
    if (!day) { alert('請選擇日期'); return }
    setBusy(true)
    const res = await addClosedDate(day, reason)
    setBusy(false)
    if (!res.ok) { alert(res.message ?? '新增失敗'); return }
    setDay(''); setReason(''); await load()
  }

  const handleDelete = async (d: string) => {
    if (!confirm(`刪除公休日 ${d}？`)) return
    const res = await deleteClosedDate(d)
    if (!res.ok) { alert(res.message ?? '刪除失敗'); return }
    await load()
  }

  const input = 'bg-transparent border border-gray-scale4 rounded px-3 py-1.5 text-tiny text-white focus:border-white outline-none'
  const cell = 'border border-gray-scale4 px-3 py-1.5'

  return (
    <div>
      <h1 className="text-medium-title font-['Inter',_sans-serif] mb-2">
        Closed Dates <span className="font-['Noto_Sans_TC',_sans-serif] text-content text-gray-scale2">公休日</span>
      </h1>
      <p className="text-tiny text-gray-scale2 font-['Noto_Sans_TC',_sans-serif] mb-6">
        臨時公休（週六日已自動排除，不用加）；倒數與逾期天數會跳過這些日期。
      </p>

      {/* 新增列 */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <input type="date" value={day} onChange={e => setDay(e.target.value)} className={`${input} cursor-pointer`} />
        <input
          type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="原因（選填）" className={`${input} min-w-[12rem]`}
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
              <th className={`${cell} font-normal`}>日期</th>
              <th className={`${cell} font-normal`}>原因</th>
              <th className={`${cell} font-normal`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.day} className="hover:bg-white/5">
                <td className={`${cell} font-['Inter',_sans-serif] whitespace-nowrap`}>{r.day}</td>
                <td className={`${cell} font-['Noto_Sans_TC',_sans-serif] text-gray-scale2 min-w-[10rem]`}>{r.reason || '—'}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  <button
                    onClick={() => handleDelete(r.day)}
                    className="text-red-400 hover:text-red-300 cursor-pointer font-['Noto_Sans_TC',_sans-serif]"
                  >
                    刪除
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className={`${cell} text-center text-gray-scale3 py-6 font-['Noto_Sans_TC',_sans-serif]`}>尚無公休日</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default AdminClosedDatesPage
