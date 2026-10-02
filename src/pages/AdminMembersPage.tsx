/**
 * 後台 · 會員管理
 * 全體學生帳號：搜尋＋身分／違規篩選，點列展開該帳號的租借歷史，鉛筆編輯班級與身分。
 * 身分四選一（優先序）：管理員（role=admin）＞系秘（role=staff，免押金直借）＞系學會（staff_members）
 * ＞學生。另有標記：轉學生（純標記）、休學（擋新借，submit_orders 檢查）。
 * 系學會＝收押金／歸還的值班經手人名單（原「幹部名單」頁併入，2026-10-01）：身分選「系學會」即加入
 * staff_members，展開列可設值班時段；換屆用「匯入系學會名單」貼上（一行一位：學號 職位），
 * 舊幹部改回學生即移出——訂單上的經手人是姓名快照，不影響歷史紀錄。
 * 班級「日媒四乙」＝ grade＋class_name 組合顯示（gradeUtils.classLabel）。
 * 違規＝停權／逾期中／欠罰款，由訂單即時算不入庫。
 * 欄位見 supabase/members.sql；寫入走 RLS "students: admin update"。
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  listMembers, updateMember, listStaff, lookupStudents, addStaffBulk, updateStaffPosition,
  deleteStaff, addStaffDuty, deleteStaffDuty
} from '../services/adminService'
import type { Member, StaffMember } from '../services/adminService'
import { isOnDuty } from '../utils/timeUtils'
import { fetchAllOrders } from '../services/ordersService'
import type { AdminOrderRow } from '../services/ordersService'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useToast } from '../hooks/useToast'
import { classLabel, parseClassLabel } from '../utils/gradeUtils'
import {
  PageTitle, inputCls, actionBtn, listHeadCls, listRowCls, HeadCell, EditIconBtn, StatusChip,
  orderKindMeta, itemsSummary, usePager, Pager, LoadError, isAwaitingPickup
} from '../components/admin/adminUi'

type Identity = 'student' | 'sa' | 'secretary' | 'admin'
const IDENTITY_ZH: Record<Identity, string> = { student: '學生', sa: '系學會', secretary: '系秘', admin: '管理員' }

type FilterKey = 'all' | Identity | 'violation' | 'on_leave' | 'transfer'
const FILTERS: { key: FilterKey; en: string; zh: string }[] = [
  { key: 'all', en: 'All', zh: '全部' },
  { key: 'student', en: 'Student', zh: '學生' },
  { key: 'sa', en: 'SA', zh: '系學會' },
  { key: 'secretary', en: 'Secretary', zh: '系秘' },
  { key: 'admin', en: 'Admin', zh: '管理員' },
  { key: 'violation', en: 'Violations', zh: '違規' },
  { key: 'on_leave', en: 'On Leave', zh: '休學' },
  { key: 'transfer', en: 'Transfer', zh: '轉學生' }
]

// 編輯班級的建議值：日媒一甲…日媒四乙、碩媒一甲…碩媒二乙
const CLASS_OPTIONS = [
  ...['一', '二', '三', '四'].flatMap(y => ['甲', '乙'].map(c => `日媒${y}${c}`)),
  ...['一', '二'].flatMap(y => ['甲', '乙'].map(c => `碩媒${y}${c}`))
]

// 學號／姓名／班級／身分／違規／租借／操作
const cols = 'grid-cols-[110px_110px_100px_minmax(10rem,1.5fr)_minmax(9rem,1.2fr)_110px_70px]'
const th = 'px-3 py-2 font-normal whitespace-nowrap'
const td = 'px-3 py-2'

const fmtDate = (d: string) => d.replace(/-/g, '/')
const WD = ['日', '一', '二', '三', '四', '五', '六'] // 同 JS getDay：0=週日
const fmtSlot = (s: string) => s.slice(0, 5) // 'HH:MM:SS' → 'HH:MM'
const smallField = 'bg-black border border-gray-scale4 rounded px-2 py-1 text-xs text-white focus:border-white outline-none'

const Tag: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => (
  <span
    className="px-2 py-0.5 rounded-md border text-[0.75rem] whitespace-nowrap font-chinese"
    style={{ borderColor: color ?? 'var(--color-gray-scale4)', color: color ?? 'white' }}
  >
    {children}
  </span>
)

const AdminMembersPage: React.FC = () => {
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast, toastElement } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([]) // 系學會（staff_members）
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [openId, setOpenId] = useState<string | null>(null) // 展開租借歷史的帳號
  const [editingId, setEditingId] = useState<string | null>(null)
  // 班級以「日媒四乙」字串編輯，儲存時拆回 grade＋class_name；身分系學會時附職位
  const [draft, setDraft] = useState({
    classText: '', identity: 'student' as Identity, position: '', on_leave: false, is_transfer: false
  })
  const [busy, setBusy] = useState(false)
  // 值班時段小表單（一次只開一位）
  const [dutyForm, setDutyForm] = useState<{ staffId: number; weekday: number; start: string; end: string } | null>(null)
  // 換屆匯入：一行一位「學號 職位」（從試算表複製多行直接貼）
  const [showImport, setShowImport] = useState(false)
  const [bulk, setBulk] = useState('')
  const [report, setReport] = useState<string | null>(null)

  const reloadStaff = () => listStaff().then(setStaff)
  const load = () =>
    Promise.all([listMembers(), fetchAllOrders(), listStaff()])
      .then(([m, o, s]) => {
        setMembers(m)
        setOrders(o)
        setStaff(s)
        setError(null)
        setLoading(false)
      })
      .catch(err => { setError(err.message ?? '讀取失敗'); setLoading(false) })
  useEffect(() => { void load() }, [])

  const staffBySid = useMemo(() => Object.fromEntries(staff.map(s => [s.studentNo, s])), [staff])

  // 每個帳號的訂單（fetchAllOrders 已新→舊）
  const ordersBy = useMemo(() => {
    const map: Record<string, AdminOrderRow[]> = {}
    for (const o of orders) (map[o.student_id] ??= []).push(o)
    return map
  }, [orders])

  // 違規：停權（sticky）／逾期中／欠罰款（同 submit_orders 欠繳擋單條件）
  const violation = (m: Member) => {
    const os = ordersBy[m.id] ?? []
    return {
      suspended: m.account_level >= 5,
      overdue: os.filter(o => o.status === 'overdue').length,
      unpaid: os.reduce((sum, o) => sum + (o.penalty_paid === false ? o.penalty_total ?? 0 : 0), 0)
    }
  }

  // 身分四選一，優先序：管理員＞系秘＞系學會（staff_members）＞學生
  const identityOf = (m: Member): Identity =>
    m.role === 'admin' ? 'admin' : m.role === 'staff' ? 'secretary' : m.student_id in staffBySid ? 'sa' : 'student'

  const matches = (m: Member, f: FilterKey): boolean => {
    switch (f) {
      case 'all': return true
      case 'violation': { const v = violation(m); return v.suspended || v.overdue > 0 || v.unpaid > 0 }
      case 'on_leave': return !!m.on_leave
      case 'transfer': return !!m.is_transfer
      default: return identityOf(m) === f
    }
  }

  const q = search.trim().toLowerCase()
  const base = q
    ? members.filter(m =>
        [m.student_id, m.name, classLabel(m.grade, m.class_name, m.student_id), m.email, m.phone ?? ''].some(v => v.toLowerCase().includes(q))
      )
    : members
  const visible = base.filter(m => matches(m, filter))
  const { pageRows, pager } = usePager(visible, [search, filter])

  const startEdit = (m: Member) => {
    setEditingId(m.id)
    setOpenId(m.id)
    setDraft({
      classText: classLabel(m.grade, m.class_name, m.student_id),
      identity: identityOf(m),
      position: staffBySid[m.student_id]?.position ?? '',
      on_leave: !!m.on_leave,
      is_transfer: !!m.is_transfer
    })
  }

  const handleSave = async (m: Member) => {
    // 班級沒改就原值寫回（舊資料格式不符也不會被擋）
    const cls = draft.classText.trim() === classLabel(m.grade, m.class_name, m.student_id)
      ? { grade: m.grade, class_name: m.class_name }
      : parseClassLabel(draft.classText)
    if (!cls) { showToast('班級格式：日媒四乙、碩媒一甲'); return }

    // 身分拆成兩個事實：role（系秘＝staff）＋是否在 staff_members（系學會）；管理員兩者都不動
    const isAdmin = m.role === 'admin'
    const role: Member['role'] = isAdmin ? 'admin' : draft.identity === 'secretary' ? 'staff' : 'student'
    const row = staffBySid[m.student_id]
    const toSa = !isAdmin && draft.identity === 'sa'

    // 影響借用權限／經手人名單的變更先確認（設定段寫入一律確認）
    const changes: string[] = []
    if (role !== m.role) changes.push(role === 'staff' ? '設為系秘（免押金、送出即租借中）' : '取消系秘身分')
    if (toSa && !row) changes.push('加入系學會（收押金／歸還的經手人選單）')
    if (!isAdmin && !toSa && row) changes.push('移出系學會（從經手人選單移除；歷史經手紀錄不受影響）')
    if (draft.on_leave !== !!m.on_leave) changes.push(draft.on_leave ? '標記休學（無法送出新預約）' : '取消休學（恢復租借）')
    if (changes.length > 0) {
      const ok = await confirm({
        title: '確認變更', titleEn: 'Confirm Changes',
        message: `${m.name}（${m.student_id}）\n${changes.join('\n')}\n\n確定儲存？`,
        confirmText: 'Save', confirmTextZh: '儲存'
      })
      if (!ok) return
    }

    setBusy(true)
    try {
      const position = draft.position.trim()
      const results = [await updateMember(m.id, { role, on_leave: draft.on_leave, is_transfer: draft.is_transfer, ...cls })]
      if (toSa && !row) results.push(await addStaffBulk([{ student_id: m.id, position }]))
      else if (toSa && row.position !== position) results.push(await updateStaffPosition(row.id, position))
      else if (!isAdmin && !toSa && row) results.push(await deleteStaff(row.id))
      const failed = results.find(r => !r.ok)
      if (failed) { showToast(failed.message ?? '儲存失敗'); return }
      showToast(`已更新 ${m.name} 的資料`, 'success')
      setEditingId(null)
    } finally {
      setBusy(false)
      await load() // 失敗也重載，畫面反映已寫入的部分
    }
  }

  // ---- 值班時段（系學會）----
  const handleAddDuty = async () => {
    if (!dutyForm) return
    const { staffId, weekday, start, end } = dutyForm
    if (!start || !end || end <= start) { showToast('請輸入有效時段（結束需晚於開始）'); return }
    const res = await addStaffDuty(staffId, weekday, start, end)
    if (!res.ok) { showToast(res.message ?? '新增失敗'); return }
    showToast('已新增值班時段', 'success')
    setDutyForm(null)
    await reloadStaff()
  }

  const handleDeleteDuty = async (id: number) => {
    const res = await deleteStaffDuty(id)
    if (!res.ok) { showToast(res.message ?? '刪除失敗'); return }
    showToast('已刪除值班時段', 'success')
    await reloadStaff()
  }

  // ---- 換屆匯入系學會名單 ----
  const handleImport = async () => {
    // 每行拆「學號＋其餘＝職位」；分隔符容忍空白／tab／逗號（Excel、Google Sheets 複製皆可）
    const parsed = bulk
      .split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => {
        const [sid, ...rest] = l.split(/[\s,，、\t]+/)
        return { sid: sid.toUpperCase(), position: rest.join(' ') }
      })
    if (parsed.length === 0) { showToast('請先貼上名單（一行一位：學號 職位）'); return }

    setBusy(true); setReport(null)
    try {
      const students = await lookupStudents(parsed.map(p => p.sid))
      const bySid = new Map(students.map(s => [s.student_id.toUpperCase(), s]))
      const existing = new Set(staff.map(s => s.studentNo.toUpperCase()))

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
        if (!res.ok) { showToast(res.message ?? '匯入失敗'); return }
      }
      setReport(
        [
          `已加入 ${inserts.length} 位`,
          misses.length > 0 ? `找不到學號：${misses.join('、')}` : '',
          dups.length > 0 ? `已在系學會（略過）：${dups.join('、')}` : ''
        ].filter(Boolean).join('；')
      )
      if (misses.length === 0) setBulk('')
      await reloadStaff()
    } finally {
      setBusy(false)
    }
  }

  return (
    // 撐滿視窗（扣 AdminLayout main 的 py-10 上下各 2.5rem）：標題／工具列／分頁固定，只有清單區捲動
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      <PageTitle
        en="Members"
        zh="會員管理"
        desc="點列展開租借歷史；鉛筆可改班級與身分。系學會＝收押金／歸還的經手人名單（展開列設值班時段，當下值班者在經手人選單排最前）；系秘免押金直借；休學＝擋新借（已借的照常歸還）；轉學生僅標記。換屆：匯入新名單、舊幹部改回學生，歷史經手紀錄不受影響。"
      />

      <datalist id="member-classes">
        {CLASS_OPTIONS.map(c => <option key={c} value={c} />)}
      </datalist>

      {/* 搜尋＋篩選 */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-6">
        <input
          type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋學號／姓名／班級／Email／電話" className={`${inputCls} font-chinese w-72`}
        />
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs whitespace-nowrap transition-colors cursor-pointer ${
              filter === f.key ? 'text-white font-bold' : 'text-gray-scale2 hover:!text-white'
            }`}
          >
            <span className="font-english">{f.en}</span> <span className="font-chinese">{f.zh}</span>
            <span className="font-english ml-1 opacity-60">{base.filter(m => matches(m, f.key)).length}</span>
          </button>
        ))}
        <button
          onClick={() => setShowImport(v => !v)}
          className={`ml-auto text-xs whitespace-nowrap transition-colors cursor-pointer ${showImport ? 'text-white' : 'text-gray-scale2 hover:!text-white'}`}
        >
          ＋ <span className="font-english">Import SA</span> <span className="font-chinese">匯入系學會名單</span>
        </button>
      </div>

      {/* 換屆匯入：一行一位「學號 職位」，姓名由學生名單帶入 */}
      {showImport && (
        <div className="flex flex-wrap items-start gap-3 mb-6">
          <textarea
            value={bulk}
            onChange={e => setBulk(e.target.value)}
            rows={4}
            placeholder={'一行一位：學號 職位（職位可省略，之後可再補）\nA112144001 會長\nA111144048 器材長'}
            className={`${inputCls} font-chinese min-w-[24rem] resize-y leading-6`}
          />
          <button onClick={handleImport} disabled={busy || !bulk.trim()} className={actionBtn(!busy && !!bulk.trim())}>
            {busy
              ? <span className="font-chinese">匯入中…</span>
              : <span className="font-english">Import <span className="font-chinese">加入系學會</span></span>}
          </button>
          {report && <p className="text-xs font-chinese text-gray-scale2 w-full">{report}</p>}
        </div>
      )}

      {loading && <div className="text-gray-scale2 text-xs font-chinese">載入中…</div>}
      {!loading && error && <LoadError message={error} onRetry={() => { setLoading(true); void load() }} />}

      {!loading && !error && (
        // 清單區自己捲（直向＋過窄時橫向）；表頭黏頂、分頁固定在畫面底部（同訂單／設備頁）
        <div className="flex-1 min-h-0 overflow-auto">
          <div className={`${listHeadCls} ${cols} min-w-[64rem] sticky top-0 z-10 bg-black`}>
            <HeadCell en="ID" zh="學號" />
            <HeadCell en="Name" zh="姓名" />
            <HeadCell en="Class" zh="班級" />
            <HeadCell en="Identity" zh="身分" />
            <HeadCell en="Violations" zh="違規" />
            <HeadCell en="Rentals" zh="租借" center />
            <HeadCell en="Action" zh="操作" center />
          </div>

          {pageRows.map(m => {
            const v = violation(m)
            const os = ordersBy[m.id] ?? []
            const active = os.filter(o => o.status === 'pending' || o.status === 'in-progress' || o.status === 'overdue').length
            const open = openId === m.id
            const editing = editingId === m.id
            const identity = identityOf(m)
            const sa = staffBySid[m.student_id] // 系學會資料（職位／值班時段）
            const tags = [
              <Tag key="identity">
                {IDENTITY_ZH[identity]}{identity === 'sa' && sa.position ? `・${sa.position}` : ''}
              </Tag>,
              identity === 'sa' && isOnDuty(sa.duties) && <Tag key="duty" color="var(--color-success)">值班中</Tag>,
              m.is_transfer && <Tag key="transfer">轉學生</Tag>,
              m.on_leave && <Tag key="leave" color="var(--color-error2)">休學</Tag>
            ]
            const flags = [
              v.suspended && <Tag key="suspended" color="var(--color-error2)">停權</Tag>,
              v.overdue > 0 && <Tag key="overdue" color="var(--color-error2)">逾期中 {v.overdue}</Tag>,
              v.unpaid > 0 && <Tag key="unpaid" color="var(--color-yellow)">欠罰款 NT$ {v.unpaid.toLocaleString()}</Tag>
            ].filter(Boolean)

            return (
              <div key={m.id}>
                <div
                  onClick={() => setOpenId(open ? null : m.id)}
                  className={`${listRowCls} ${cols} min-w-[64rem] text-sm cursor-pointer hover:bg-white/5`}
                >
                  <div className="font-english">{m.student_id}</div>
                  <div className="font-chinese">{m.name || '—'}</div>
                  <div className="font-chinese">{classLabel(m.grade, m.class_name, m.student_id) || '—'}</div>
                  <div className="flex flex-wrap gap-1.5">{tags}</div>
                  <div className="flex flex-wrap gap-1.5">{flags.length > 0 ? flags : <span className="text-gray-scale3">—</span>}</div>
                  <div className="text-center whitespace-nowrap">
                    <span className="font-english">{os.length}</span>
                    {active > 0 && <span className="text-xs text-gray-scale2 font-chinese ml-1">（{active} 進行中）</span>}
                  </div>
                  <div className="flex justify-center items-center gap-2" onClick={e => e.stopPropagation()}>
                    <EditIconBtn onClick={() => startEdit(m)} />
                    <button
                      onClick={() => setOpenId(open ? null : m.id)}
                      aria-label={open ? '收合租借歷史' : '展開租借歷史'}
                      className="flex items-center text-gray-scale2 hover:!text-white transition-colors cursor-pointer"
                    >
                      <span className={`material-symbols-outlined transition-transform ${open ? 'rotate-180' : ''}`} style={{ fontSize: '20px' }}>
                        expand_more
                      </span>
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="py-4 pl-4 border-b border-[#7c7c7c] min-w-[64rem] text-xs">
                    {editing && (
                      <div className="flex flex-wrap items-center gap-5 mb-5">
                        <label className="flex items-center gap-2 text-gray-scale2 font-chinese">
                          班級
                          <input
                            list="member-classes" value={draft.classText} placeholder="日媒四乙"
                            onChange={e => setDraft(d => ({ ...d, classText: e.target.value }))}
                            className={`${inputCls} w-28 font-chinese`}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-gray-scale2 font-chinese">
                          身分
                          {/* 管理員不在這裡改（避免把自己鎖在後台外） */}
                          <select
                            value={draft.identity} disabled={m.role === 'admin'}
                            onChange={e => setDraft(d => ({ ...d, identity: e.target.value as Identity }))}
                            className="bg-black border border-gray-scale4 rounded-lg px-3 py-1.5 text-xs text-white focus:border-white outline-none font-chinese cursor-pointer disabled:cursor-not-allowed"
                          >
                            {m.role === 'admin' && <option value="admin">管理員</option>}
                            <option value="student">學生</option>
                            <option value="sa">系學會</option>
                            <option value="secretary">系秘</option>
                          </select>
                        </label>
                        {draft.identity === 'sa' && (
                          <label className="flex items-center gap-2 text-gray-scale2 font-chinese">
                            職位
                            <input
                              value={draft.position} placeholder="會長、器材長…"
                              onChange={e => setDraft(d => ({ ...d, position: e.target.value }))}
                              className={`${inputCls} w-28 font-chinese`}
                            />
                          </label>
                        )}
                        <label className="flex items-center gap-2 text-white font-chinese cursor-pointer">
                          <input type="checkbox" checked={!!draft.on_leave}
                            onChange={e => setDraft(d => ({ ...d, on_leave: e.target.checked }))} />
                          休學（擋新借）
                        </label>
                        <label className="flex items-center gap-2 text-white font-chinese cursor-pointer">
                          <input type="checkbox" checked={!!draft.is_transfer}
                            onChange={e => setDraft(d => ({ ...d, is_transfer: e.target.checked }))} />
                          轉學生
                        </label>
                        <button onClick={() => handleSave(m)} disabled={busy} className={actionBtn(!busy)}>
                          <span className="font-english">Save <span className="font-chinese">儲存</span></span>
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-gray-scale2 hover:!text-white transition-colors cursor-pointer">
                          <span className="font-english">Cancel <span className="font-chinese">取消</span></span>
                        </button>
                      </div>
                    )}

                    <div className="text-gray-scale2 font-english mb-3">
                      {m.email}{m.phone && <> · {m.phone}</>}
                    </div>

                    {/* 系學會：值班時段（一人可多時段；經手人選單把當下值班者排最前） */}
                    {identity === 'sa' && (
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="text-gray-scale2 font-chinese mr-1">值班時段</span>
                        {sa.duties.map(d => (
                          <span key={d.id} className="inline-flex items-center gap-1.5 border border-gray-scale4 rounded px-2 py-0.5 whitespace-nowrap">
                            <span className="font-chinese">{WD[d.weekday]}</span>
                            <span className="font-english">{fmtSlot(d.start_time)}–{fmtSlot(d.end_time)}</span>
                            <button
                              onClick={() => handleDeleteDuty(d.id)}
                              className="text-gray-scale3 hover:!text-white transition-colors cursor-pointer"
                              aria-label="刪除時段"
                            >×</button>
                          </span>
                        ))}
                        {dutyForm?.staffId === sa.id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <select
                              value={dutyForm.weekday}
                              onChange={e => setDutyForm({ ...dutyForm, weekday: Number(e.target.value) })}
                              className={`${smallField} font-chinese cursor-pointer`}
                            >
                              {[1, 2, 3, 4, 5, 6, 0].map(w => <option key={w} value={w}>週{WD[w]}</option>)}
                            </select>
                            <input type="time" value={dutyForm.start}
                              onChange={e => setDutyForm({ ...dutyForm, start: e.target.value })}
                              className={`${smallField} font-english`} />
                            <span className="text-gray-scale3">–</span>
                            <input type="time" value={dutyForm.end}
                              onChange={e => setDutyForm({ ...dutyForm, end: e.target.value })}
                              className={`${smallField} font-english`} />
                            <button onClick={handleAddDuty} className="text-white hover:opacity-70 cursor-pointer font-chinese">確認</button>
                            <button onClick={() => setDutyForm(null)} className="text-gray-scale3 hover:!text-white cursor-pointer font-chinese">取消</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDutyForm({ staffId: sa.id, weekday: 1, start: '', end: '' })}
                            className="text-gray-scale2 hover:!text-white transition-colors cursor-pointer"
                            aria-label="新增時段"
                          >＋</button>
                        )}
                      </div>
                    )}

                    {os.length === 0 ? (
                      <div className="text-gray-scale3 font-chinese">尚無租借紀錄</div>
                    ) : (
                      <table className="border-collapse">
                        <thead>
                          <tr className="text-left text-gray-scale2">
                            <th className={th}><span className="font-english">No.</span> <span className="font-chinese">單號</span></th>
                            <th className={th}><span className="font-english">Dates</span> <span className="font-chinese">起訖</span></th>
                            <th className={th}><span className="font-english">Type</span> <span className="font-chinese">種類</span></th>
                            <th className={th}><span className="font-english">Status</span> <span className="font-chinese">狀態</span></th>
                            <th className={th}><span className="font-english">Items</span> <span className="font-chinese">品項</span></th>
                            <th className={th}><span className="font-english">Deposit</span> <span className="font-chinese">押金</span></th>
                            <th className={th}><span className="font-english">Penalty</span> <span className="font-chinese">罰款</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {os.map(o => (
                            <tr key={o.id} className="border-t border-gray-scale4 align-top">
                              <td className={`${td} font-english whitespace-nowrap`}>{o.rental_number}</td>
                              <td className={`${td} font-english whitespace-nowrap`}>{fmtDate(o.start_date)}–{fmtDate(o.end_date)}</td>
                              <td className={`${td} font-chinese whitespace-nowrap`}>{orderKindMeta(o).zh}</td>
                              <td className={td}><StatusChip status={o.status} awaitingPickup={isAwaitingPickup(o)} /></td>
                              <td className={`${td} font-chinese whitespace-pre-line min-w-[10rem]`}>{itemsSummary(o)}</td>
                              <td className={`${td} font-english whitespace-nowrap`}>NT$ {o.deposit_total.toLocaleString()}</td>
                              <td className={`${td} font-chinese whitespace-nowrap`}>
                                {(o.penalty_total ?? 0) > 0
                                  ? <>NT$ {o.penalty_total!.toLocaleString()}{o.penalty_paid ? '（已繳）' : <span style={{ color: 'var(--color-yellow)' }}>（未繳）</span>}</>
                                  : <span className="text-gray-scale3">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {visible.length === 0 && (
            <div className="text-gray-scale3 text-xs py-8 text-center font-chinese">沒有符合的帳號</div>
          )}
        </div>
      )}

      {!loading && !error && <Pager {...pager} />}
      <ConfirmDialog />
      {toastElement}
    </div>
  )
}

export default AdminMembersPage
