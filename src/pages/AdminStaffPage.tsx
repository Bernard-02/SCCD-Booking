/**
 * 後台 · 幹部名單（staff_members + staff_duties）
 * 收押金／歸還時「值班經手人」下拉選單的來源。幹部連結學生名單：
 * 會長把名單貼上（一行一位：學號 職位；直接從試算表複製即可）批次匯入，
 * 附職位（自由文字）與值班時段（一人可多時段、同時段可多人）。
 * 值班時段設定後，經手人選單會把「當下值班」的幹部排最前，其餘照列（代班仍可選）。
 * 換屆直接刪除舊幹部即可——訂單上的經手人是姓名快照，不影響歷史紀錄。
 */

import React, { useEffect, useState } from 'react'
import {
  listStaff, lookupStudents, addStaffBulk, updateStaffPosition,
  addStaffDuty, deleteStaffDuty, deleteStaff
} from '../services/adminService'
import type { StaffMember } from '../services/adminService'
import { isOnDuty } from '../utils/timeUtils'
import { PageTitle, actionBtn, inputCls } from '../components/admin/adminUi'

const th = 'px-3 py-2 font-normal whitespace-nowrap'
const td = 'px-3 py-3'
const WD = ['日', '一', '二', '三', '四', '五', '六'] // 同 JS getDay：0=週日

const fmtSlot = (s: string) => s.slice(0, 5) // 'HH:MM:SS' → 'HH:MM'

const AdminStaffPage: React.FC = () => {
  const [rows, setRows] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // 貼上匯入：一行一位「學號 職位」（職位可省略；從試算表複製多行直接貼）
  const [bulk, setBulk] = useState('')
  const [report, setReport] = useState<string | null>(null)

  // 值班時段小表單（一次只開一列）
  const [dutyForm, setDutyForm] = useState<{ staffId: number; weekday: number; start: string; end: string } | null>(null)

  const load = () => listStaff().then(r => { setRows(r); setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { void load() }, [])

  const handleImport = async () => {
    // 每行拆「學號＋其餘＝職位」；分隔符容忍空白／tab／逗號（Excel、Google Sheets 複製皆可）
    const parsed = bulk
      .split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => {
        const [sid, ...rest] = l.split(/[\s,，、\t]+/)
        return { sid: sid.toUpperCase(), position: rest.join(' ') }
      })
    if (parsed.length === 0) { alert('請先貼上名單（一行一位：學號 職位）'); return }

    setBusy(true); setReport(null)
    try {
      const students = await lookupStudents(parsed.map(p => p.sid))
      const bySid = new Map(students.map(s => [s.student_id.toUpperCase(), s]))
      const existing = new Set(rows.map(m => m.studentNo.toUpperCase()))

      const misses: string[] = []
      const dups: string[] = []
      const inserts: { student_id: string; position: string }[] = []
      for (const p of parsed) {
        const s = bySid.get(p.sid)
        if (!s) { misses.push(p.sid); continue }
        if (existing.has(p.sid)) { dups.push(`${p.sid} ${s.name}`); continue }
        existing.add(p.sid) // 名單內重複行也只加一次
        // 容忍「學號 姓名 職位」格式：職位開頭若是本人姓名就去掉
        const position = p.position.startsWith(s.name) ? p.position.slice(s.name.length).trim() : p.position
        inserts.push({ student_id: s.id, position })
      }

      if (inserts.length > 0) {
        const res = await addStaffBulk(inserts)
        if (!res.ok) { alert(res.message ?? '匯入失敗'); return }
      }
      setReport(
        [
          `已加入 ${inserts.length} 位`,
          misses.length > 0 ? `找不到學號：${misses.join('、')}` : '',
          dups.length > 0 ? `已在名單（略過）：${dups.join('、')}` : ''
        ].filter(Boolean).join('；')
      )
      if (misses.length === 0) setBulk('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const savePosition = async (id: number, value: string) => {
    const res = await updateStaffPosition(id, value)
    if (!res.ok) { alert(res.message ?? '更新失敗'); return }
    await load()
  }

  const handleAddDuty = async () => {
    if (!dutyForm) return
    const { staffId, weekday, start, end } = dutyForm
    if (!start || !end || end <= start) { alert('請輸入有效時段（結束需晚於開始）'); return }
    const res = await addStaffDuty(staffId, weekday, start, end)
    if (!res.ok) { alert(res.message ?? '新增失敗'); return }
    setDutyForm(null)
    await load()
  }

  const handleDeleteDuty = async (id: number) => {
    const res = await deleteStaffDuty(id)
    if (!res.ok) { alert(res.message ?? '刪除失敗'); return }
    await load()
  }

  const handleDelete = async (m: StaffMember) => {
    if (!confirm(`刪除幹部「${m.name}」？（歷史訂單上的經手紀錄不受影響）`)) return
    const res = await deleteStaff(m.id)
    if (!res.ok) { alert(res.message ?? '刪除失敗'); return }
    await load()
  }

  const smallField =
    'bg-black border border-gray-scale4 rounded px-2 py-1 text-tiny text-white focus:border-white outline-none'

  return (
    <div>
      <PageTitle
        en="Staff"
        zh="幹部名單"
        desc="收押金／歸還時的值班經手人選單。把幹部名單貼上批次加入（一行一位：學號 職位，從試算表直接複製即可）；設定值班時段後，經手人選單會把當下值班的幹部排在最前（其餘照列，代班仍可選）。換屆直接刪除舊幹部，歷史訂單的經手紀錄不受影響。"
      />

      {/* 貼上匯入：一行一位「學號 職位」，姓名由學生名單帶入 */}
      <div className="flex flex-wrap items-start gap-3 mb-8">
        <textarea
          value={bulk}
          onChange={e => setBulk(e.target.value)}
          rows={4}
          placeholder={'一行一位：學號 職位（職位可省略，之後可就地補）\nA112144001 會長\nA111144048 器材長'}
          className={`${inputCls} font-chinese min-w-[24rem] resize-y leading-6`}
        />
        <button onClick={handleImport} disabled={busy || !bulk.trim()} className={actionBtn(!busy && !!bulk.trim())}>
          {busy
            ? <span className="font-chinese">匯入中…</span>
            : <span className="font-english">Import <span className="font-chinese">加入名單</span></span>}
        </button>
        {report && <p className="text-tiny font-chinese text-gray-scale2 w-full">{report}</p>}
      </div>

      {loading ? (
        <div className="text-gray-scale2 text-tiny font-chinese">載入中…</div>
      ) : (
        <table className="text-tiny border-collapse min-w-[44rem]">
          <thead>
            <tr className="text-left text-gray-scale2 border-b border-gray-scale4">
              <th className={th}><span className="font-english">ID</span> <span className="font-chinese">學號</span></th>
              <th className={th}><span className="font-english">Name</span> <span className="font-chinese">姓名</span></th>
              <th className={th}><span className="font-english">Position</span> <span className="font-chinese">職位</span></th>
              <th className={th}><span className="font-english">Duty</span> <span className="font-chinese">值班時段</span></th>
              <th className={th}><span className="font-english">Action</span> <span className="font-chinese">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(m => (
              <tr key={m.id} className="border-b border-gray-scale4 hover:bg-white/5">
                <td className={`${td} font-english whitespace-nowrap text-gray-scale2`}>{m.studentNo}</td>
                <td className={`${td} font-chinese whitespace-nowrap`}>
                  {m.name}
                  {isOnDuty(m.duties) && (
                    <span className="font-chinese ml-2" style={{ color: 'var(--color-success)' }}>值班中</span>
                  )}
                </td>
                {/* 職位就地編輯：改完離開欄位（或 Enter）即儲存 */}
                <td className={`${td} whitespace-nowrap`}>
                  <input
                    key={`${m.id}-${m.position}`}
                    type="text" defaultValue={m.position} placeholder="—"
                    onBlur={e => { const v = e.target.value.trim(); if (v !== m.position) void savePosition(m.id, v) }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className={`${smallField} font-chinese w-28`}
                  />
                </td>
                <td className={td}>
                  <div className="flex flex-wrap items-center gap-2">
                    {m.duties.map(d => (
                      <span
                        key={d.id}
                        className="inline-flex items-center gap-1.5 border border-gray-scale4 rounded px-2 py-0.5 whitespace-nowrap"
                      >
                        <span className="font-chinese">{WD[d.weekday]}</span>
                        <span className="font-english">{fmtSlot(d.start_time)}–{fmtSlot(d.end_time)}</span>
                        <button
                          onClick={() => handleDeleteDuty(d.id)}
                          className="text-gray-scale3 hover:text-white transition-colors cursor-pointer"
                          aria-label="刪除時段"
                        >×</button>
                      </span>
                    ))}
                    {dutyForm?.staffId === m.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <select
                          value={dutyForm.weekday}
                          onChange={e => setDutyForm({ ...dutyForm, weekday: Number(e.target.value) })}
                          className={`${smallField} font-chinese cursor-pointer`}
                        >
                          {[1, 2, 3, 4, 5, 6, 0].map(w => <option key={w} value={w}>週{WD[w]}</option>)}
                        </select>
                        <input
                          type="time" value={dutyForm.start}
                          onChange={e => setDutyForm({ ...dutyForm, start: e.target.value })}
                          className={`${smallField} font-english`}
                        />
                        <span className="text-gray-scale3">–</span>
                        <input
                          type="time" value={dutyForm.end}
                          onChange={e => setDutyForm({ ...dutyForm, end: e.target.value })}
                          className={`${smallField} font-english`}
                        />
                        <button onClick={handleAddDuty} className="text-white hover:opacity-70 cursor-pointer font-chinese">確認</button>
                        <button onClick={() => setDutyForm(null)} className="text-gray-scale3 hover:text-white cursor-pointer font-chinese">取消</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDutyForm({ staffId: m.id, weekday: 1, start: '', end: '' })}
                        className="text-gray-scale2 hover:text-white transition-colors cursor-pointer"
                        aria-label="新增時段"
                      >＋</button>
                    )}
                  </div>
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <button
                    onClick={() => handleDelete(m)}
                    className="text-tiny cursor-pointer hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--color-error2)' }}
                  >
                    <span className="font-english">Delete</span> <span className="font-chinese">刪除</span>
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className={`${td} text-center text-gray-scale3 py-8 font-chinese`}>尚無幹部，請貼上名單加入</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default AdminStaffPage
