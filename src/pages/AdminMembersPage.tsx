/**
 * 後台 · 會員管理（設定段）——規則、欄位與身份／狀態定義見 docs/admin-members.md
 * 版面同設備管理：計數分頁 全部／學生／系學會；標題列右側「＋ 新增會員」「匯入」；搜尋列（搜尋、年級、租借狀態篩選）；
 * 表格（選取模式同設備頁：按「選取」出現勾選欄；勾選的列身份／狀態欄變下拉，改一個套用到全部勾選；會費用工具列按鈕批次標；表頭可排序）；修改走對話框（班級不在後台改）。
 * 已畢業預設隱藏（工具列「已畢業」切換），還有未完成的單的例外會列。
 * 新增會員＝預先登記 login_allowlist（清單顯示「未啟用」），本人第一次 Google 登入時 trigger 套用登記的姓名／身份
 * （members-v2.sql）。租借歷史改到訂單頁看：「總租借」數字可點，帶學號過去當篩選（搜尋列旁顯示學生 chip）。
 * 違規／租借狀態由訂單即時算不入庫；系學會＝staff_members（經手人名單）。寫入走 RLS "students: admin update"。
 */

import { BTN, CHIP } from '@/components/common/btn'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listMembers, updateMember, updateMembersMany, listStaff, addStaffBulk, updateStaffPosition, deleteStaff, deleteStaffMany,
  unsuspendStudent, deleteMember, listAllowlist, addAllowlist, removeAllowlist
} from '../services/adminService'
import type { Member, StaffMember, AllowEntry } from '../services/adminService'
import { fetchAllOrders } from '../services/ordersService'
import type { AdminOrderRow } from '../services/ordersService'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useToast } from '../hooks/useToast'
import { classLabel, parseClassLabel } from '../utils/gradeUtils'
import MemberImportDialog from '../components/admin/MemberImportDialog'
import {
  PageTitle, inputCls, textBtn, toolBtn, iconFillBtn, SearchBox, CountTabs, SelectControls, tableTh as th, tableTd as td,
  SortTh, toggleSort, sortRows, usePager, Pager, LoadError, Select, FormDialog, Field
} from '../components/admin/adminUi'
import type { Sort } from '../components/admin/adminUi'

// 身份單選（優先序：管理員＞系秘＞系學會＞轉學生＞學生）
type Identity = 'student' | 'transfer' | 'sa' | 'secretary' | 'admin'
const IDENTITY_ZH: Record<Identity, string> = { student: '學生', transfer: '轉學生', sa: '系學會', secretary: '系秘', admin: '管理員' }
const IDENTITY_OPTIONS: Exclude<Identity, 'admin'>[] = ['student', 'transfer', 'sa', 'secretary'] // 管理員不在後台設

// 狀態 chip（優先序：已畢業＞休學＞違規＞在學；未啟用＝預先登記）
type Status = 'active' | 'on_leave' | 'violation' | 'graduated' | 'pending'
const STATUS_META: Record<Status, { zh: string; color: string }> = {
  active: { zh: '在學', color: 'var(--color-green)' },
  on_leave: { zh: '休學', color: 'var(--color-yellow)' },
  violation: { zh: '違規', color: 'var(--color-error)' },
  graduated: { zh: '已畢業', color: 'var(--color-gray-light)' },
  pending: { zh: '未啟用', color: 'var(--color-gray-light)' }
}
// 租借狀態 chip（優先序：停權＞逾期中＞欠罰款＞進行中＞可租借）
type Rental = 'ok' | 'in_progress' | 'unpaid' | 'overdue' | 'suspended'
const RENTAL_META: Record<Rental, { zh: string; color: string }> = {
  ok: { zh: '未租借', color: 'var(--color-gray-light)' },
  in_progress: { zh: '進行中', color: 'var(--color-cyan)' },
  unpaid: { zh: '欠罰款', color: 'var(--color-pink)' },
  overdue: { zh: '逾期中', color: 'var(--color-error)' },
  suspended: { zh: '停權', color: 'var(--color-error)' }
}
const RENTAL_FILTERS: { value: Rental | 'all'; label: string }[] = [
  { value: 'all', label: '全部租借狀態' },
  ...(Object.keys(RENTAL_META) as Rental[]).map(k => ({ value: k, label: RENTAL_META[k].zh }))
]
// 年級篩選固定八級＋其他（空白或格式外的，人少）；grade 舊格式 '1'-'6' 視同大一～大六（同 gradeUtils 慣例）
const GRADE_ORDER = ['大一', '大二', '大三', '大四', '大五', '大六', '碩一', '碩二']
const normGrade = (g: string | null): string => {
  const v = (g ?? '').trim()
  if (/^[1-6]$/.test(v)) return `大${['一', '二', '三', '四', '五', '六'][Number(v) - 1]}`
  return GRADE_ORDER.includes(v) ? v : 'other'
}

const TABS = [{ key: 'all', zh: '全部' }, { key: 'student', zh: '學生' }, { key: 'sa', zh: '系學會' }] as const
type Tab = typeof TABS[number]['key']
type SortField = 'student_id' | 'name' | 'classText' | 'orders'

// 清單列：真帳號（students）或預先登記（login_allowlist，未啟用）
interface Row {
  key: string
  member: Member | null // null＝未啟用
  entry: AllowEntry | null
  student_id: string
  name: string
  email: string
  classText: string
  grade: string | null
  phone: string | null
  identity: Identity
  position: string
  status: Status
  rental: Rental
  rentalLabel: string
  orders: number
  dues: boolean
}

const Chip: React.FC<{ meta: { color: string }; children: React.ReactNode }> = ({ meta, children }) => (
  <span className={`${CHIP} font-chinese text-black`} style={{ backgroundColor: meta.color }}>{children}</span>
)

// 唯讀欄位（同輸入框高度，無框）
const readOnly = `${inputCls} w-full text-gray-light border-transparent !px-0`

type EditDialog = { row: Row; identity: Identity; position: string; status: 'active' | 'on_leave' | 'graduated'; dues: boolean }
// original：修改未啟用的登記時，原本的學號（沒有＝新增）
type NewDialog = { sid: string; name: string; email: string; emailTouched: boolean; identity: Exclude<Identity, 'admin'>; position: string; classText: string; dues: boolean; original?: string }
const NEW_EMPTY: NewDialog = { sid: '', name: '', email: '', emailTouched: false, identity: 'student', position: '', classText: '', dues: false }
const DUES_OPTIONS = [{ value: 'paid', label: '已繳' }, { value: 'unpaid', label: '未繳' }]
const emailFor = (sid: string) => (sid ? `${sid.toLowerCase()}@gm.usc.edu.tw` : '')

const AdminMembersPage: React.FC = () => {
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast, toastElement } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([]) // 系學會（staff_members）
  const [allowlist, setAllowlist] = useState<AllowEntry[]>([]) // 預先登記
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [rentalFilter, setRentalFilter] = useState<Rental | 'all'>('all')
  const [sort, setSort] = useState<Sort<SortField>>(null)
  const [showGraduated, setShowGraduated] = useState(false) // 已畢業預設隱藏（還有未完成的單才顯示）
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set()) // students.id
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<EditDialog | null>(null)
  const [draft, setDraft] = useState<NewDialog | null>(null)
  const [showImport, setShowImport] = useState(false)

  const load = () =>
    // 預先登記表讀不到（members-v2.sql 沒跑／cache 沒更新）只提示，不要讓整頁死掉
    Promise.all([
      listMembers(), fetchAllOrders(), listStaff(),
      listAllowlist().catch((e: Error) => { showToast(`預先登記名單讀取失敗：${e.message}`); return [] as AllowEntry[] })
    ])
      .then(([m, o, s, a]) => {
        setMembers(m); setOrders(o); setStaff(s); setAllowlist(a)
        setError(null)
        setLoading(false)
      })
      .catch(err => { setError(err.message ?? '讀取失敗'); setLoading(false) })
  useEffect(() => { void load() }, [])

  const staffBySid = useMemo(() => Object.fromEntries(staff.map(s => [s.studentNo, s])), [staff])
  const ordersBy = useMemo(() => {
    const map: Record<string, AdminOrderRow[]> = {}
    for (const o of orders) (map[o.student_id] ??= []).push(o)
    return map
  }, [orders])

  const rows = useMemo<Row[]>(() => {
    const real = members.map((m): Row => {
      const os = ordersBy[m.id] ?? []
      const overdue = os.filter(o => o.status === 'overdue').length
      const inProgress = os.filter(o => o.status === 'pending' || o.status === 'in-progress').length
      // 欠罰款同 submit_orders 的擋單條件（penalty_paid=false）
      const unpaid = os.reduce((sum, o) => sum + (o.penalty_paid === false ? o.penalty_total ?? 0 : 0), 0)
      const suspended = m.account_level >= 5
      const sa = staffBySid[m.student_id]
      const identity: Identity =
        m.role === 'admin' ? 'admin' : m.role === 'staff' ? 'secretary' : sa ? 'sa' : m.is_transfer ? 'transfer' : 'student'
      const violation = suspended || overdue > 0 || unpaid > 0
      const rental: Rental = suspended ? 'suspended' : overdue > 0 ? 'overdue' : unpaid > 0 ? 'unpaid' : inProgress > 0 ? 'in_progress' : 'ok'
      const rentalLabel =
        rental === 'overdue' ? `逾期中 ${overdue}`
          : rental === 'unpaid' ? `欠罰款 NT$ ${unpaid.toLocaleString()}`
            : rental === 'in_progress' ? `進行中 ${inProgress}`
              : RENTAL_META[rental].zh
      return {
        key: m.id, member: m, entry: null,
        student_id: m.student_id, name: m.name, email: m.email,
        // 管理員不是學生，沒有班級（資料有值也不顯示，年級篩選也不算）
        classText: identity === 'admin' ? '' : classLabel(m.grade, m.class_name),
        grade: identity === 'admin' ? null : m.grade,
        phone: m.phone,
        identity, position: sa?.position ?? '',
        status: m.graduated ? 'graduated' : m.on_leave ? 'on_leave' : violation ? 'violation' : 'active',
        rental, rentalLabel, orders: os.length, dues: !!m.dues_paid
      }
    })
    // 預先登記但本人還沒登入過的：未啟用（已建帳號的登記列只是紀錄，不重複列）
    const have = new Set(members.map(m => m.student_id.toUpperCase()))
    const pending = allowlist
      .filter(e => !have.has(e.student_id.toUpperCase()))
      .map((e): Row => ({
        key: `pending:${e.student_id}`, member: null, entry: e,
        student_id: e.student_id, name: e.name ?? '', email: e.email ?? '',
        classText: classLabel(e.grade, e.class_name), grade: e.grade ?? null, phone: null,
        identity: e.role === 'admin' ? 'admin' : e.role === 'staff' ? 'secretary' : e.is_sa ? 'sa' : e.is_transfer ? 'transfer' : 'student',
        position: e.position ?? '',
        status: 'pending', rental: 'ok', rentalLabel: '—', orders: 0, dues: !!e.dues_paid
      }))
    return [...real, ...pending]
  }, [members, ordersBy, staffBySid, allowlist])

  // 已畢業的預設不列（人會越積越多）；還有未完成的單（進行中／逾期／欠罰款／停權）的例外，處理完才消失
  const baseRows = useMemo(
    () => (showGraduated ? rows : rows.filter(r => r.status !== 'graduated' || r.rental !== 'ok')),
    [rows, showGraduated]
  )
  const counts = useMemo(() => ({
    all: baseRows.length,
    student: baseRows.filter(r => r.identity === 'student' || r.identity === 'transfer').length,
    sa: baseRows.filter(r => r.identity === 'sa').length
  }), [baseRows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return baseRows.filter(r =>
      (tab === 'all' || (tab === 'sa' ? r.identity === 'sa' : r.identity === 'student' || r.identity === 'transfer')) &&
      (!q || [r.student_id, r.name, r.classText, r.email, r.phone ?? ''].some(v => v.toLowerCase().includes(q))) &&
      (gradeFilter === 'all' || normGrade(r.grade) === gradeFilter) &&
      (rentalFilter === 'all' || r.rental === rentalFilter)
    )
  }, [baseRows, tab, search, gradeFilter, rentalFilter])
  const sorted = useMemo(() => (sort ? sortRows(filtered, sort.dir, r => r[sort.field]) : filtered), [filtered, sort])
  const { pageRows, pager } = usePager(sorted, [tab, search, gradeFilter, rentalFilter, sort])

  // 選取模式（同設備／空間頁）：按「選取」才出現勾選欄；只有真帳號能勾（未啟用的沒東西可標）；全選＝目前篩選結果；切分頁即退出
  const selectable = filtered.filter(r => r.member)
  const selectedCount = selectable.filter(r => selected.has(r.key)).length
  const allSelected = selectable.length > 0 && selectedCount === selectable.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map(r => r.key)))
  const toggleOne = (key: string) => setSelected(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()) }
  useEffect(exitSelect, [tab])

  const bulk = async (zh: string, fields: { on_leave?: boolean; graduated?: boolean; dues_paid?: boolean }) => {
    const ids = selectable.filter(r => selected.has(r.key)).map(r => r.key)
    if (ids.length === 0) return
    const ok = await confirm({ title: zh, message: `將選取的 ${ids.length} 位${zh}？`, confirmTextZh: '確定', variant: fields.graduated || fields.on_leave ? 'danger' : 'default' })
    if (!ok) return
    setBusy(true)
    const res = await updateMembersMany(ids, fields)
    setBusy(false)
    if (!res.ok) { showToast(res.message ?? '更新失敗'); return }
    showToast(`已${zh} ${ids.length} 位`, 'success')
    setSelected(new Set())
    await load()
  }

  // 批次設為身份（勾選的列身份欄變下拉，改一個套用到全部勾選；換屆：新幹部設系學會、舊幹部改回學生）：管理員略過；職位之後補
  const bulkSetIdentity = async (identity: Exclude<Identity, 'admin'>) => {
    const targets = selectable.filter(r => selected.has(r.key) && r.identity !== 'admin')
    if (targets.length === 0) { showToast('沒有可改的對象（管理員不在這裡改）'); return }
    const toSa = identity === 'sa'
    const addSa = toSa ? targets.filter(r => !staffBySid[r.student_id]) : []
    const removeSa = toSa ? [] : targets.filter(r => staffBySid[r.student_id]).map(r => staffBySid[r.student_id].id)
    const notes = [
      identity === 'secretary' ? '系秘免押金、送出即租借中' : '',
      addSa.length > 0 ? `${addSa.length} 位加入經手人選單` : '',
      removeSa.length > 0 ? `${removeSa.length} 位從經手人選單移除（歷史經手紀錄不受影響）` : ''
    ].filter(Boolean).join('；')
    const ok = await confirm({
      title: `設為${IDENTITY_ZH[identity]}`,
      message: `將選取的 ${targets.length} 位設為「${IDENTITY_ZH[identity]}」？${notes ? `\n${notes}` : ''}`,
      confirmTextZh: '確定'
    })
    if (!ok) return
    setBusy(true)
    try {
      const results = [
        await updateMembersMany(targets.map(r => r.key), { role: identity === 'secretary' ? 'staff' : 'student', is_transfer: identity === 'transfer' }),
        await deleteStaffMany(removeSa)
      ]
      if (addSa.length > 0) results.push(await addStaffBulk(addSa.map(r => ({ student_id: r.key, position: '' }))))
      const failed = results.find(r => !r.ok)
      if (failed) { showToast(failed.message ?? '更新失敗'); return }
      showToast(`已將 ${targets.length} 位設為${IDENTITY_ZH[identity]}`, 'success')
      setSelected(new Set())
    } finally {
      setBusy(false)
      await load()
    }
  }

  // 批次設狀態（勾選的列狀態欄變下拉）：在學＝清掉休學與畢業；休學／已畢業互斥
  const bulkSetStatus = (status: EditDialog['status']) =>
    status === 'active' ? bulk('恢復在學', { graduated: false, on_leave: false })
      : status === 'on_leave' ? bulk('標記休學（擋新借）', { on_leave: true, graduated: false })
        : bulk('標記已畢業（停用帳號）', { graduated: true, on_leave: false })

  // ---- 修改（對話框）----
  const openEdit = (row: Row) => setEdit({
    row,
    identity: row.identity,
    position: row.position,
    status: row.status === 'graduated' ? 'graduated' : row.status === 'on_leave' ? 'on_leave' : 'active',
    dues: row.dues
  })

  const handleSaveEdit = async () => {
    if (!edit?.row.member) return
    const m = edit.row.member
    const isAdmin = m.role === 'admin'
    // 身份拆成三個事實：role（系秘＝staff）、是否在 staff_members（系學會）、is_transfer；管理員不動 role
    const role: Member['role'] = isAdmin ? 'admin' : edit.identity === 'secretary' ? 'staff' : 'student'
    const toSa = !isAdmin && edit.identity === 'sa'
    const isTransfer = !isAdmin && edit.identity === 'transfer'
    const onLeave = edit.status === 'on_leave'
    const graduated = edit.status === 'graduated'
    const saRow = staffBySid[m.student_id]
    const position = edit.position.trim()

    // 影響借用權限／經手人名單的變更先確認（設定段寫入一律確認）
    const changes: string[] = []
    if (role !== m.role) changes.push(role === 'staff' ? '設為系秘（免押金、送出即租借中）' : '取消系秘身分')
    if (toSa && !saRow) changes.push('加入系學會（收押金／歸還的經手人選單）')
    if (!isAdmin && !toSa && saRow) changes.push('移出系學會（從經手人選單移除；歷史經手紀錄不受影響）')
    if (onLeave !== !!m.on_leave) changes.push(onLeave ? '標記休學（無法送出新預約）' : '取消休學（恢復租借）')
    if (graduated !== !!m.graduated) {
      changes.push(graduated ? '標記已畢業（帳號停用：無法登入；還有東西沒歸還的可登入到歸還為止）' : '取消畢業標記（恢復帳號）')
    }
    if (changes.length > 0) {
      const ok = await confirm({ title: '確認變更', message: `${m.name}（${m.student_id}）\n${changes.join('\n')}\n\n確定儲存？`, confirmTextZh: '儲存' })
      if (!ok) return
    }

    setBusy(true)
    try {
      const results = [await updateMember(m.id, { role, on_leave: onLeave, is_transfer: isTransfer, graduated, grade: m.grade, class_name: m.class_name, dues_paid: edit.dues })]
      if (toSa && !saRow) results.push(await addStaffBulk([{ student_id: m.id, position }]))
      else if (toSa && saRow.position !== position) results.push(await updateStaffPosition(saRow.id, position))
      else if (!isAdmin && !toSa && saRow) results.push(await deleteStaff(saRow.id))
      const failed = results.find(r => !r.ok)
      if (failed) { showToast(failed.message ?? '儲存失敗'); return }
      showToast(`已更新 ${m.name} 的資料`, 'success')
      setEdit(null)
    } finally {
      setBusy(false)
      await load() // 失敗也重載，畫面反映已寫入的部分
    }
  }

  // 停權（情境 7 sticky）的人工解鎖：罰款繳清／老師通融
  const handleUnsuspend = async (m: Member) => {
    const ok = await confirm({
      title: '解除停權',
      message: `解除 ${m.name}（${m.student_id}）的停權？請確認罰款已繳清或老師已通融。`,
      confirmTextZh: '解除'
    })
    if (!ok) return
    const res = await unsuspendStudent(m.student_id)
    if (!res.ok) { showToast(res.message ?? '解除失敗'); return }
    showToast(`已解除 ${m.name} 的停權`, 'success')
    setEdit(null)
    await load()
  }

  // 沒有訂單的帳號才能刪（key 錯、測試用）；有訂單的要留紀錄，server 端同樣擋
  const handleDeleteMember = async (m: Member) => {
    const ok = await confirm({ title: '刪除帳號', message: `刪除 ${m.name}（${m.student_id}）的帳號和登記？要重新登記才能再登入。`, confirmTextZh: '刪除', variant: 'danger' })
    if (!ok) return
    const res = await deleteMember(m.id)
    if (!res.ok) { showToast(res.message ?? '刪除失敗'); return }
    showToast(`已刪除 ${m.student_id} 的帳號`, 'success')
    setEdit(null)
    await load()
  }

  // ---- 新增會員＝預先登記 ----
  const openPending = (row: Row) => setDraft({
    sid: row.student_id, name: row.name, email: row.email, emailTouched: true,
    // ponytail: 後台與匯入都建不出 admin 登記，不另處理
    identity: row.identity === 'admin' ? 'student' : row.identity,
    position: row.position, classText: row.classText, dues: row.dues, original: row.student_id
  })

  const handleAdd = async () => {
    if (!draft) return
    const sid = draft.sid.trim().toUpperCase()
    const email = draft.email.trim().toLowerCase()
    if (!sid) { showToast('請輸入學號'); return }
    if (!/^\S+@\S+\.\S+$/.test(email)) { showToast('Email 格式不正確'); return }
    if (members.some(m => m.student_id.toUpperCase() === sid)) { showToast('此學號已有帳號'); return }
    const klass = parseClassLabel(draft.classText)
    if (!klass) { showToast('班級格式不正確（例：日媒四乙、碩媒一甲）'); return }
    setBusy(true)
    let res = await addAllowlist([{
      student_id: sid, note: null, name: draft.name.trim(), email,
      grade: klass.grade, class_name: klass.class_name, dues_paid: draft.dues,
      role: draft.identity === 'secretary' ? 'staff' : 'student',
      is_transfer: draft.identity === 'transfer',
      is_sa: draft.identity === 'sa',
      position: draft.identity === 'sa' ? draft.position.trim() : null
    }])
    // 改學號＝換主鍵：新的寫好才刪舊的
    if (res.ok && draft.original && draft.original !== sid) res = await removeAllowlist(draft.original)
    setBusy(false)
    if (!res.ok) { showToast(res.message ?? '儲存失敗'); return }
    showToast(draft.original ? `已更新 ${sid} 的登記` : `已登記 ${sid}，本人第一次登入後即啟用`, 'success')
    setDraft(null)
    await load()
  }

  const handleRemovePending = async () => {
    if (!draft?.original) return
    const sid = draft.original
    const ok = await confirm({ title: '刪除登記', message: `刪除 ${sid}${draft.name ? `（${draft.name}）` : ''} 的預先登記？`, confirmTextZh: '刪除', variant: 'danger' })
    if (!ok) return
    const res = await removeAllowlist(sid)
    if (!res.ok) { showToast(res.message ?? '刪除失敗'); return }
    showToast(`已刪除 ${sid} 的登記`, 'success')
    setDraft(null)
    await load()
  }

  const sortProps = { sort, onSort: (f: SortField) => setSort(s => toggleSort(s, f)) }
  const identityLabel = (r: Row) => `${IDENTITY_ZH[r.identity]}${r.identity === 'sa' && r.position ? `・${r.position}` : ''}`

  return (
    // 撐滿內容區（AdminLayout main 固定 h-screen）：標題／分頁／搜尋固定，只有表格區捲動
    <div className="h-full flex flex-col">
      <PageTitle zh="會員管理">
        <button onClick={() => setDraft(NEW_EMPTY)} className={textBtn(false)}>
          <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">add</span>
          新增會員
        </button>
        <button onClick={() => setShowImport(true)} className={textBtn(false)}>
          <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">input</span>
          匯入
        </button>
      </PageTitle>

      {/* 搜尋列（分頁上方，同訂單頁）：左搜尋；選取模式（批次標記畢業／休學／在學）；右＝年級、租借狀態篩選 */}
      <div className="flex items-center gap-2 mb-4">
        <SearchBox value={search} onChange={setSearch} className="w-72 mr-auto" />
        <SelectControls
          mode={selectMode}
          count={selectedCount}
          onEnter={() => setSelectMode(true)}
          onExit={exitSelect}
          actions={[
            { zh: '標記已繳會費', onClick: () => void bulk('標記已繳會費', { dues_paid: true }) },
            { zh: '標記未繳會費', onClick: () => void bulk('標記未繳會費', { dues_paid: false }) }
          ]}
        />
        <button
          onClick={() => setShowGraduated(v => !v)}
          className={textBtn(showGraduated)}
          title={showGraduated ? '隱藏已畢業' : '顯示已畢業（還有未完成的單的本來就會列）'}
        >
          <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">history_edu</span>
          已畢業
        </button>
        <Select
          value={gradeFilter}
          onChange={setGradeFilter}
          options={[{ value: 'all', label: '全部年級' }, ...GRADE_ORDER.map(g => ({ value: g, label: g })), { value: 'other', label: '其他' }]}
          icon="school"
          filled
          className="font-chinese"
        />
        <Select<Rental | 'all'>
          value={rentalFilter}
          onChange={setRentalFilter}
          options={RENTAL_FILTERS}
          icon="filter_list"
          filled
          className="font-chinese"
        />
      </div>

      <CountTabs tabs={TABS} value={tab} onChange={setTab} counts={counts} />

      {loading ? (
        <div className="text-gray-light text-xs font-chinese">載入中…</div>
      ) : error ? (
        <LoadError message={error} onRetry={() => { setLoading(true); void load() }} />
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
            {/* border-separate：表頭 sticky 時底線才跟著走；欄位多，min-w 讓窄視窗橫向捲而不壓欄 */}
            <table className="w-full min-w-[1280px] text-xs border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-gray-light">
                  {selectMode && (
                    <th className={`${th} w-10`}>
                      <input type="checkbox" className="custom-checkbox block" checked={allSelected} onChange={toggleAll} aria-label="全選" disabled={selectable.length === 0} />
                    </th>
                  )}
                  <SortTh zh="學號" field="student_id" className="w-32" {...sortProps} />
                  <SortTh zh="姓名" field="name" className="w-28" {...sortProps} />
                  <SortTh zh="班級" field="classText" className="w-28" {...sortProps} />
                  <th className={th}>Email</th>
                  <th className={`${th} w-32`}>手機號碼</th>
                  <th className={`${th} w-32`}>身份</th>
                  <th className={`${th} w-24`}>狀態</th>
                  <th className={`${th} w-20`}>會費</th>
                  <th className={`${th} w-36`}>租借狀態</th>
                  <SortTh zh="總租借" field="orders" className="w-24 text-center" {...sortProps} />
                  <th className={`${th} w-20 text-center`}>操作</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => (
                  <tr key={r.key} className="hover:bg-white/10">
                    {selectMode && (
                      <td className={td}>
                        <input
                          type="checkbox" className="custom-checkbox block" checked={selected.has(r.key)} disabled={!r.member}
                          onChange={() => toggleOne(r.key)} aria-label={`選取 ${r.name || r.student_id}`}
                        />
                      </td>
                    )}
                    <td className={`${td} font-english`}>{r.student_id}</td>
                    <td className={`${td} font-chinese`}>{r.name || '—'}</td>
                    <td className={`${td} font-chinese`}>{r.classText || '—'}</td>
                    <td className={`${td} font-english text-gray-light`}>{r.email || '—'}</td>
                    <td className={`${td} font-english`}>{r.phone || <span className="text-gray-mid">—</span>}</td>
                    <td className={`${td} font-chinese`}>
                      {/* 選取模式下勾選的列：身份變下拉，改一個＝套用到所有勾選的人（管理員除外） */}
                      {selectMode && selected.has(r.key) && r.identity !== 'admin' ? (
                        <Select<Exclude<Identity, 'admin'>>
                          value={r.identity}
                          onChange={v => { if (v !== r.identity) void bulkSetIdentity(v) }}
                          options={IDENTITY_OPTIONS.map(i => ({ value: i, label: IDENTITY_ZH[i] }))}
                          disabled={busy}
                          filled
                          className="font-chinese"
                          aria-label={`設定 ${r.name || r.student_id} 的身份（套用到所有勾選）`}
                        />
                      ) : identityLabel(r)}
                    </td>
                    <td className={td}>
                      {/* 選取模式下勾選的列：狀態變下拉（在學／休學／已畢業），改一個＝套用到所有勾選的人；違規是算出來的不能選 */}
                      {selectMode && selected.has(r.key) ? (
                        <Select<EditDialog['status']>
                          value={r.status === 'graduated' || r.status === 'on_leave' ? r.status : 'active'}
                          onChange={v => void bulkSetStatus(v)}
                          options={[{ value: 'active', label: '在學' }, { value: 'on_leave', label: '休學' }, { value: 'graduated', label: '已畢業' }]}
                          disabled={busy}
                          filled
                          className="font-chinese"
                          aria-label={`設定 ${r.name || r.student_id} 的狀態（套用到所有勾選）`}
                        />
                      ) : <Chip meta={STATUS_META[r.status]}>{STATUS_META[r.status].zh}</Chip>}
                    </td>
                    <td className={`${td} font-chinese`}>
                      {r.identity === 'student' || r.identity === 'transfer' || r.identity === 'sa'
                        ? (r.dues ? '已繳' : <span style={{ color: 'var(--color-error)' }}>未繳</span>)
                        : <span className="text-gray-mid">—</span>}
                    </td>
                    <td className={td}>
                      {r.member ? <Chip meta={RENTAL_META[r.rental]}>{r.rentalLabel}</Chip> : <span className="text-gray-mid">—</span>}
                    </td>
                    <td className={`${td} text-center`}>
                      {/* 租借歷史在訂單頁：帶學號過去搜尋 */}
                      {r.member ? (
                        <button
                          onClick={() => navigate(`/admin/orders?student=${encodeURIComponent(r.student_id)}`)}
                          title="到訂單頁看租借歷史"
                          className={`min-w-7 h-7 px-2 inline-flex items-center justify-center rounded-lg bg-gray-dark font-english ${BTN}`}
                        >
                          {r.orders}
                        </button>
                      ) : <span className="text-gray-mid">—</span>}
                    </td>
                    <td className={`${td} text-center`}>
                      <button onClick={() => (r.member ? openEdit(r) : openPending(r))} title="修改" aria-label="修改" className={iconFillBtn}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="py-16 text-center text-xs text-gray-light font-chinese">沒有符合的帳號</div>
            )}
          </div>

          {/* 分頁：放在捲動區外，固定在底部 */}
          <Pager {...pager} />
        </>
      )}

      {/* 修改：學號／姓名／班級／Email／手機唯讀（班級不在後台改）；身份、狀態可改；停權在這裡解除 */}
      {edit && edit.row.member && (
        <FormDialog title="修改會員" confirmZh="確定修改" busy={busy} onConfirm={handleSaveEdit} onCancel={() => setEdit(null)} wide>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field zh="學號"><span className={`${readOnly} font-english`}>{edit.row.student_id}</span></Field>
            <Field zh="姓名"><span className={`${readOnly} font-chinese`}>{edit.row.name || '—'}</span></Field>
            <Field zh="班級"><span className={`${readOnly} font-chinese`}>{edit.row.classText || '—'}</span></Field>
            <Field zh="手機號碼"><span className={`${readOnly} font-english`}>{edit.row.phone || '—'}</span></Field>
            <div className="col-span-2">
              <Field zh="Email"><span className={`${readOnly} font-english`}>{edit.row.email}</span></Field>
            </div>
            <Field zh="身份">
              {/* 管理員不在這裡改（避免把自己鎖在後台外） */}
              <Select<Identity>
                value={edit.identity}
                disabled={edit.row.identity === 'admin'}
                onChange={identity => setEdit(e => (e ? { ...e, identity } : e))}
                options={[
                  ...(edit.row.identity === 'admin' ? [{ value: 'admin' as const, label: IDENTITY_ZH.admin }] : []),
                  ...IDENTITY_OPTIONS.map(i => ({ value: i, label: IDENTITY_ZH[i] }))
                ]}
                className="font-chinese w-full"
              />
            </Field>
            <Field zh="狀態">
              <Select<EditDialog['status']>
                value={edit.status}
                onChange={status => setEdit(e => (e ? { ...e, status } : e))}
                options={[{ value: 'active', label: '在學' }, { value: 'on_leave', label: '休學（擋新借）' }, { value: 'graduated', label: '已畢業（停用帳號）' }]}
                className="font-chinese w-full"
              />
            </Field>
            <Field zh="系學會費">
              <Select
                value={edit.dues ? 'paid' : 'unpaid'}
                onChange={v => setEdit(e => (e ? { ...e, dues: v === 'paid' } : e))}
                options={DUES_OPTIONS}
                className="font-chinese w-full"
              />
            </Field>
            {edit.identity === 'sa' && (
              <Field zh="職位">
                <input
                  value={edit.position} placeholder="會長、器材長…"
                  onChange={e => setEdit(d => (d ? { ...d, position: e.target.value } : d))}
                  className={`${inputCls} w-full font-chinese`}
                />
              </Field>
            )}
            {edit.row.rental === 'suspended' && (
              <div className="col-span-2 flex items-center justify-between gap-4 text-xs font-chinese">
                <span style={{ color: 'var(--color-error)' }}>已停權（逾期滿 6 營業日），不能送新單</span>
                <button onClick={() => handleUnsuspend(edit.row.member!)} className={`${toolBtn(false)} px-3 font-chinese`}>解除停權</button>
              </div>
            )}
            {edit.row.identity !== 'admin' && (
              <div className="col-span-2 flex items-center justify-between gap-4 text-xs font-chinese">
                <span className="text-gray-light">{edit.row.orders > 0 ? '有訂單紀錄，不能刪除帳號' : '沒有訂單紀錄，可以刪除帳號'}</span>
                <button disabled={edit.row.orders > 0} onClick={() => handleDeleteMember(edit.row.member!)} className={`${toolBtn(false)} px-3 font-chinese`}>刪除帳號</button>
              </div>
            )}
          </div>
        </FormDialog>
      )}

      {/* 新增會員＝預先登記；Email 依學號自動帶，可改。未啟用的登記也用這個對話框修改或刪除 */}
      {draft && (
        <FormDialog title={draft.original ? '修改登記' : '新增會員'} confirmZh={draft.original ? '確定修改' : '新增'} busy={busy} onConfirm={handleAdd} onCancel={() => setDraft(null)}>
          <Field zh="學號" required>
            <input
              value={draft.sid} autoFocus placeholder="A111144001"
              onChange={e => {
                const sid = e.target.value.replace(/[^A-Za-z0-9]/g, '')
                setDraft(d => (d ? { ...d, sid, email: d.emailTouched ? d.email : emailFor(sid) } : d))
              }}
              className={`${inputCls} w-full font-english`}
            />
          </Field>
          <Field zh="姓名">
            <input value={draft.name} onChange={e => setDraft(d => (d ? { ...d, name: e.target.value } : d))} className={`${inputCls} w-full font-chinese`} />
          </Field>
          <Field zh="Email" required>
            <input
              type="email" value={draft.email} placeholder="學號@gm.usc.edu.tw"
              onChange={e => setDraft(d => (d ? { ...d, email: e.target.value, emailTouched: true } : d))}
              className={`${inputCls} w-full font-english`}
            />
          </Field>
          <Field zh="班級">
            <input
              value={draft.classText} placeholder="日媒四乙、碩媒一甲；空白＝由學號推"
              onChange={e => setDraft(d => (d ? { ...d, classText: e.target.value } : d))}
              className={`${inputCls} w-full font-chinese`}
            />
          </Field>
          <Field zh="系學會費">
            <Select
              value={draft.dues ? 'paid' : 'unpaid'}
              onChange={v => setDraft(d => (d ? { ...d, dues: v === 'paid' } : d))}
              options={DUES_OPTIONS}
              className="font-chinese w-full"
            />
          </Field>
          <Field zh="身份">
            <Select<NewDialog['identity']>
              value={draft.identity}
              onChange={identity => setDraft(d => (d ? { ...d, identity } : d))}
              options={IDENTITY_OPTIONS.map(i => ({ value: i, label: IDENTITY_ZH[i] }))}
              className="font-chinese w-full"
            />
          </Field>
          {draft.identity === 'sa' && (
            <Field zh="職位">
              <input value={draft.position} placeholder="會長、器材長…" onChange={e => setDraft(d => (d ? { ...d, position: e.target.value } : d))} className={`${inputCls} w-full font-chinese`} />
            </Field>
          )}
          <p className="text-2xs text-gray-mid font-chinese">帳號在本人第一次用學校 Google 帳號登入時建立，登記前顯示為「未啟用」。</p>
          {draft.original && (
            <button onClick={handleRemovePending} className={`${toolBtn(false)} px-3 self-start font-chinese`}>刪除登記</button>
          )}
        </FormDialog>
      )}

      {/* 匯入：.xlsx 批次預先登記（預覽驗證後寫 login_allowlist，MemberImportDialog） */}
      {showImport && (
        <MemberImportDialog
          existingSids={new Set(members.map(m => m.student_id.toUpperCase()))}
          showToast={showToast}
          onCancel={() => setShowImport(false)}
          onDone={async n => {
            setShowImport(false)
            showToast(`已登記 ${n} 筆，本人第一次登入後即啟用`, 'success')
            await load()
          }}
        />
      )}
      <ConfirmDialog />
      {toastElement}
    </div>
  )
}

export default AdminMembersPage
