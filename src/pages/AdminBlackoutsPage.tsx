/**
 * 後台 · 寒暑假封鎖（rental_blackouts，情境 11-a）
 * 封鎖區間內學生一律不可租借（admin／staff 不受限）；前端日曆會把封鎖日期灰化不可選。
 */

import React, { useEffect, useState } from 'react'
import { listBlackouts, addBlackout, deleteBlackout } from '../services/adminService'
import type { Blackout } from '../services/adminService'
import { PageTitle, actionBtn, inputCls } from '../components/admin/adminUi'

const th = 'px-3 py-2 font-normal whitespace-nowrap'
const td = 'px-3 py-3'

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

  return (
    <div>
      <PageTitle
        en="Blackouts"
        zh="寒暑假封鎖"
        desc="區間內學生不可租借（admin／staff 不受限）；日曆會把封鎖日期灰化。"
      />

      {/* 新增列 */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className={`${inputCls} cursor-pointer`} />
        <span className="text-gray-scale2 text-tiny">～</span>
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={`${inputCls} cursor-pointer`} />
        <input
          type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="原因（如：暑假）" className={`${inputCls} font-chinese min-w-[10rem]`}
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
        <table className="text-tiny border-collapse min-w-[32rem]">
          <thead>
            <tr className="text-left text-gray-scale2 border-b border-gray-scale4">
              <th className={th}><span className="font-english">From</span> <span className="font-chinese">開始</span></th>
              <th className={th}><span className="font-english">To</span> <span className="font-chinese">結束</span></th>
              <th className={th}><span className="font-english">Reason</span> <span className="font-chinese">原因</span></th>
              <th className={th}><span className="font-english">Action</span> <span className="font-chinese">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.id} className="border-b border-gray-scale4 hover:bg-white/5">
                <td className={`${td} font-english whitespace-nowrap`}>{b.start_date}</td>
                <td className={`${td} font-english whitespace-nowrap`}>{b.end_date}</td>
                <td className={`${td} font-chinese text-gray-scale2 min-w-[10rem]`}>{b.reason || '—'}</td>
                <td className={`${td} whitespace-nowrap`}>
                  <button
                    onClick={() => handleDelete(b)}
                    className="text-tiny cursor-pointer hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--color-error2)' }}
                  >
                    <span className="font-english">Delete</span> <span className="font-chinese">刪除</span>
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className={`${td} text-center text-gray-scale3 py-8 font-chinese`}>尚無封鎖區間</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default AdminBlackoutsPage
