/**
 * 後台 · 公休日（closed_dates）
 * 臨時公休日（週六日以外）——繳押金 24 工作時倒數與逾期天數會跳過這些日期。
 */

import React, { useEffect, useState } from 'react'
import { listClosedDates, addClosedDate, deleteClosedDate } from '../services/adminService'
import type { ClosedDate } from '../services/adminService'
import { PageTitle, actionBtn, inputCls } from '../components/admin/adminUi'

const th = 'px-3 py-2 font-normal whitespace-nowrap'
const td = 'px-3 py-3'

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

  return (
    <div>
      <PageTitle
        en="Closed Dates"
        zh="公休日"
        desc="臨時公休（週六日已自動排除，不用加）；倒數與逾期天數會跳過這些日期。"
      />

      {/* 新增列 */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input type="date" value={day} onChange={e => setDay(e.target.value)} className={`${inputCls} cursor-pointer`} />
        <input
          type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="原因（選填）" className={`${inputCls} font-chinese min-w-[12rem]`}
        />
        <button onClick={handleAdd} disabled={busy} className={actionBtn(!busy)}>
          {busy
            ? <span className="font-chinese">新增中…</span>
            : <span className="font-english">Add <span className="font-chinese">新增</span></span>}
        </button>
      </div>

      {loading ? (
        <div className="text-gray-scale2 text-tiny font-chinese">載入中…</div>
      ) : (
        <table className="text-tiny border-collapse min-w-[28rem]">
          <thead>
            <tr className="text-left text-gray-scale2 border-b border-gray-scale4">
              <th className={th}><span className="font-english">Date</span> <span className="font-chinese">日期</span></th>
              <th className={th}><span className="font-english">Reason</span> <span className="font-chinese">原因</span></th>
              <th className={th}><span className="font-english">Action</span> <span className="font-chinese">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.day} className="border-b border-gray-scale4 hover:bg-white/5">
                <td className={`${td} font-english whitespace-nowrap`}>{r.day}</td>
                <td className={`${td} font-chinese text-gray-scale2 min-w-[10rem]`}>{r.reason || '—'}</td>
                <td className={`${td} whitespace-nowrap`}>
                  <button
                    onClick={() => handleDelete(r.day)}
                    className="text-tiny cursor-pointer hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--color-error2)' }}
                  >
                    <span className="font-english">Delete</span> <span className="font-chinese">刪除</span>
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className={`${td} text-center text-gray-scale3 py-8 font-chinese`}>尚無公休日</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default AdminClosedDatesPage
