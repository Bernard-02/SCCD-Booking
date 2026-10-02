/**
 * 後台 · 營業時間管理（週六日固定不營業，不用列）。分兩組：
 * - 公休日（closed_dates，kind＝學會辦活動／大總評／其他）：學會自己的不營業日。新增後自動發
 *   全站公告 template（Facebook 請同步）＋通知受影響訂單（取件日撞公休／歸還期限順延）。
 * - 假期：法定假日（closed_dates kind＝holiday，進後台時自動匯入，見 autoImportHolidays）＋
 *   寒暑假封鎖（rental_blackouts，學會自己填；區間內學生不可租借，前台日曆灰化）。
 * 公休日與法定假日效果相同（同週末：倒數與逾期跳過、歸還期限順延）；封鎖則是擋新單。
 */

import React, { useEffect, useState } from 'react'
import {
  listClosedDates, addClosedDate, deleteClosedDate, listBlackouts, addBlackout, deleteBlackout,
  notifyClosedDateAffected, notifyBlackoutAffected, announceClosedDate, autoImportHolidays, CLOSED_KIND_ZH
} from '../services/adminService'
import type { ClosedDate, ClosedKind, Blackout } from '../services/adminService'
import { toDateKey } from '../utils/timeUtils'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useToast } from '../hooks/useToast'
import { PageTitle, actionBtn, inputCls, LoadError } from '../components/admin/adminUi'

const th = 'px-3 py-2 font-normal whitespace-nowrap'
const td = 'px-3 py-3'

const withWeekday = (day: string) => `${day}（${'日一二三四五六'[new Date(`${day}T00:00:00`).getDay()]}）`

const GroupTitle: React.FC<{ en: string; zh: string }> = ({ en, zh }) => (
  <h2 className="text-md text-white pb-3 mb-6 border-b border-gray-scale4">
    <span className="font-english">{en}</span> <span className="font-chinese">{zh}</span>
  </h2>
)

const SectionTitle: React.FC<{ en: string; zh: string; desc: string }> = ({ en, zh, desc }) => (
  <div className="mb-4">
    <h2 className="text-sm text-white">
      <span className="font-english">{en}</span> <span className="font-chinese">{zh}</span>
    </h2>
    <p className="mt-1 text-xs text-gray-scale2 font-chinese">{desc}</p>
  </div>
)

const AddBtn: React.FC<{ busy: boolean; onClick: () => void }> = ({ busy, onClick }) => (
  <button onClick={onClick} disabled={busy} className={actionBtn(!busy)}>
    {busy
      ? <span className="font-chinese">新增中…</span>
      : <span className="font-english">Add <span className="font-chinese">新增</span></span>}
  </button>
)

const DeleteBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="text-xs cursor-pointer hover:opacity-70 transition-opacity"
    style={{ color: 'var(--color-error2)' }}
  >
    <span className="font-english">Delete</span> <span className="font-chinese">刪除</span>
  </button>
)

const ClosedDatesSection: React.FC = () => {
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast, toastElement } = useToast()
  const [rows, setRows] = useState<ClosedDate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [day, setDay] = useState('')
  const [kind, setKind] = useState<Exclude<ClosedKind, 'holiday'>>('activity')
  const [reason, setReason] = useState('') // 只有「其他」要填
  const [busy, setBusy] = useState(false)

  const load = () => listClosedDates()
    .then(r => { setRows(r.filter(c => c.kind !== 'holiday')); setLoadError(null) })
    .catch(e => setLoadError(e?.message ?? '未知錯誤'))
    .finally(() => setLoading(false))
  useEffect(() => { void load() }, [])

  const handleAdd = async () => {
    if (!day) { showToast('請選擇日期'); return }
    if (kind === 'other' && !reason.trim()) { showToast('請填寫公休原因'); return }
    const reasonText = kind === 'other' ? reason.trim() : CLOSED_KIND_ZH[kind]
    setBusy(true)
    const res = await addClosedDate(day, kind, kind === 'other' ? reasonText : null)
    if (!res.ok) { setBusy(false); showToast(res.message ?? '新增失敗'); return }
    // 今天以後的公休：自動發全站公告 template＋通知受影響訂單（補登過去的日期不發）
    if (day >= toDateKey(new Date())) {
      const [a, n] = await Promise.all([announceClosedDate(day, reasonText), notifyClosedDateAffected(day, reasonText)])
      if (!a.ok || !n.ok) {
        showToast(`已新增公休日 ${day}，但${!a.ok ? '全站公告' : '受影響訂單通知'}發送失敗：${(!a.ok ? a : n).message}`)
      } else {
        showToast(
          `已新增公休日 ${day}，已發全站公告（Facebook 請同步發布）${n.count > 0 ? `，並通知 ${n.count} 筆受影響的訂單` : ''}`,
          'success'
        )
      }
    } else {
      showToast(`已補登公休日 ${day}`, 'success')
    }
    setBusy(false)
    setDay(''); setReason(''); await load()
  }

  const handleDelete = async (d: string) => {
    const ok = await confirm({
      title: '刪除公休日', titleEn: 'Delete',
      message: `刪除公休日 ${d}？（已發出的公告不會收回）`,
      confirmText: 'Delete', confirmTextZh: '刪除', variant: 'danger'
    })
    if (!ok) return
    const res = await deleteClosedDate(d)
    if (!res.ok) { showToast(res.message ?? '刪除失敗'); return }
    showToast(`已刪除公休日 ${d}`, 'success')
    await load()
  }

  return (
    <section>
      <p className="mb-4 text-xs text-gray-scale2 font-chinese">
        學會自己的不營業日；倒數與逾期天數會跳過、當天到期的歸還順延到下一個營業日。
        新增後自動發全站公告（「10/16（週五）系學會因大總評公休，…」，Facebook 請同步發布），並通知當天取件或歸還期限因此順延的同學。
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input type="date" value={day} onChange={e => setDay(e.target.value)} className={`${inputCls} cursor-pointer`} />
        <select
          value={kind}
          onChange={e => setKind(e.target.value as typeof kind)}
          className="bg-black border border-gray-scale4 rounded-lg px-3 py-1.5 text-xs text-white focus:border-white outline-none font-chinese cursor-pointer"
        >
          {(['activity', 'review', 'other'] as const).map(k => <option key={k} value={k}>{CLOSED_KIND_ZH[k]}</option>)}
        </select>
        {kind === 'other' && (
          <input
            type="text" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="原因（會寫進公告）" className={`${inputCls} font-chinese min-w-[12rem]`}
          />
        )}
        <AddBtn busy={busy} onClick={handleAdd} />
      </div>

      {loading ? (
        <div className="text-gray-scale2 text-xs font-chinese">載入中…</div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={() => { setLoading(true); void load() }} />
      ) : (
        <table className="text-xs border-collapse min-w-[28rem]">
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
                <td className={`${td} font-english whitespace-nowrap`}>{withWeekday(r.day)}</td>
                <td className={`${td} font-chinese text-gray-scale2 min-w-[10rem]`}>
                  {/* 舊資料沒有 kind＝其他 */}
                  {r.kind && r.kind !== 'other' ? CLOSED_KIND_ZH[r.kind] : `其他${r.reason ? `：${r.reason}` : ''}`}
                </td>
                <td className={`${td} whitespace-nowrap`}><DeleteBtn onClick={() => handleDelete(r.day)} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className={`${td} text-center text-gray-scale3 py-8 font-chinese`}>尚無公休日</td></tr>
            )}
          </tbody>
        </table>
      )}
      <ConfirmDialog />
      {toastElement}
    </section>
  )
}

// 法定假日：自動匯入（今年＋明年，每年一次），只列今天以後；刪除＝學會當天照常營業，不會再被補回
const HolidaysSection: React.FC = () => {
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast, toastElement } = useToast()
  const [rows, setRows] = useState<ClosedDate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = () => listClosedDates()
    .then(r => {
      const today = toDateKey(new Date())
      setRows(r.filter(c => c.kind === 'holiday' && c.day >= today))
      setLoadError(null)
    })
    .catch(e => setLoadError(e?.message ?? '未知錯誤'))
    .finally(() => setLoading(false))
  // 先補匯入（AdminLayout 也會觸發；重複匯入無害）再讀
  useEffect(() => { void autoImportHolidays().finally(load) }, [])

  const handleDelete = async (r: ClosedDate) => {
    const ok = await confirm({
      title: '刪除法定假日', titleEn: 'Delete',
      message: `刪除 ${r.day}（${r.reason}）？刪除＝學會當天照常營業，之後不會再被自動補回。`,
      confirmText: 'Delete', confirmTextZh: '刪除', variant: 'danger'
    })
    if (!ok) return
    const res = await deleteClosedDate(r.day)
    if (!res.ok) { showToast(res.message ?? '刪除失敗'); return }
    showToast(`已刪除 ${r.day}，當天照常營業`, 'success')
    await load()
  }

  return (
    <section>
      <SectionTitle
        en="National Holidays"
        zh="法定假日"
        desc="自動匯入政府辦公日曆表的平日放假日（含補假，今年與明年，每年一次），學會原則上不營業；效果同公休日。若當天照常營業，刪除即可（不會再被補回）。"
      />
      {loading ? (
        <div className="text-gray-scale2 text-xs font-chinese">載入中…</div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={() => { setLoading(true); void load() }} />
      ) : (
        <table className="text-xs border-collapse min-w-[28rem]">
          <thead>
            <tr className="text-left text-gray-scale2 border-b border-gray-scale4">
              <th className={th}><span className="font-english">Date</span> <span className="font-chinese">日期</span></th>
              <th className={th}><span className="font-english">Holiday</span> <span className="font-chinese">假日</span></th>
              <th className={th}><span className="font-english">Action</span> <span className="font-chinese">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.day} className="border-b border-gray-scale4 hover:bg-white/5">
                <td className={`${td} font-english whitespace-nowrap`}>{withWeekday(r.day)}</td>
                <td className={`${td} font-chinese text-gray-scale2 min-w-[10rem]`}>{r.reason || '—'}</td>
                <td className={`${td} whitespace-nowrap`}><DeleteBtn onClick={() => handleDelete(r)} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className={`${td} text-center text-gray-scale3 py-8 font-chinese`}>
                  尚無法定假日（需先執行 supabase/closed-date-kinds.sql）
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      <ConfirmDialog />
      {toastElement}
    </section>
  )
}

const BlackoutsSection: React.FC = () => {
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast, toastElement } = useToast()
  const [rows, setRows] = useState<Blackout[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => listBlackouts()
    .then(r => { setRows(r); setLoadError(null) })
    .catch(e => setLoadError(e?.message ?? '未知錯誤'))
    .finally(() => setLoading(false))
  useEffect(() => { void load() }, [])

  const handleAdd = async () => {
    if (!start || !end) { showToast('請選擇起訖日'); return }
    if (end < start) { showToast('結束日不可早於開始日'); return }
    setBusy(true)
    const res = await addBlackout(start, end, reason)
    if (!res.ok) { setBusy(false); showToast(res.message ?? '新增失敗'); return }
    const n = await notifyBlackoutAffected(start, end, reason)
    setBusy(false)
    if (!n.ok) showToast(`已新增封鎖 ${start} ～ ${end}，但通知受影響同學失敗：${n.message}`)
    else showToast(`已新增封鎖 ${start} ～ ${end}${n.count > 0 ? `，已通知 ${n.count} 筆重疊的訂單` : ''}`, 'success')
    setStart(''); setEnd(''); setReason(''); await load()
  }

  const handleDelete = async (b: Blackout) => {
    const ok = await confirm({
      title: '刪除封鎖區間', titleEn: 'Delete',
      message: `刪除封鎖 ${b.start_date} ～ ${b.end_date}？`,
      confirmText: 'Delete', confirmTextZh: '刪除', variant: 'danger'
    })
    if (!ok) return
    const res = await deleteBlackout(b.id)
    if (!res.ok) { showToast(res.message ?? '刪除失敗'); return }
    showToast(`已刪除封鎖 ${b.start_date} ～ ${b.end_date}`, 'success')
    await load()
  }

  return (
    <section>
      <SectionTitle
        en="Blackouts"
        zh="寒暑假封鎖"
        desc="學會自己填寒暑假區間：區間內學生不可租借（admin／staff 不受限），日曆會把封鎖日期灰化。新增後自動通知訂單與封鎖期重疊的同學。"
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className={`${inputCls} cursor-pointer`} />
        <span className="text-gray-scale2 text-xs">～</span>
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={`${inputCls} cursor-pointer`} />
        <input
          type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="原因（如：暑假）" className={`${inputCls} font-chinese min-w-[10rem]`}
        />
        <AddBtn busy={busy} onClick={handleAdd} />
      </div>

      {loading ? (
        <div className="text-gray-scale2 text-xs font-chinese">載入中…</div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={() => { setLoading(true); void load() }} />
      ) : (
        <table className="text-xs border-collapse min-w-[32rem]">
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
                <td className={`${td} whitespace-nowrap`}><DeleteBtn onClick={() => handleDelete(b)} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className={`${td} text-center text-gray-scale3 py-8 font-chinese`}>尚無封鎖區間</td></tr>
            )}
          </tbody>
        </table>
      )}
      <ConfirmDialog />
      {toastElement}
    </section>
  )
}

const AdminHoursPage: React.FC = () => (
  <div>
    <PageTitle en="Business Hours" zh="營業時間管理" desc="週六日固定不營業，不用列。" />
    <div className="flex flex-col gap-16">
      <div>
        <GroupTitle en="Closed Days" zh="公休日" />
        <ClosedDatesSection />
      </div>
      <div>
        <GroupTitle en="Holidays" zh="假期" />
        <div className="flex flex-col gap-12">
          <HolidaysSection />
          <BlackoutsSection />
        </div>
      </div>
    </div>
  </div>
)

export default AdminHoursPage
