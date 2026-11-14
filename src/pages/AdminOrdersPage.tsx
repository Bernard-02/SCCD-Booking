/**
 * 後台 · 訂單全覽（搜尋 + 租借時間／狀態／種類篩選 + 點表頭單欄排序 + 收押金／取件／歸還）
 * 樣式沿用前台 Profile：狀態標籤語彙與顏色同 getStatusInfo、按鈕同 Extend 樣式。
 * 「收押金」「取件」「歸還」三欄＝每張單都會走的三步（2026-11-10 改版）：最高權限帳號（學會櫃檯共用）還沒做是經手人下拉，
 * 選了跳確認框、做完顯示經手人，選錯可直接換人；學會成員用自己的帳號是按鈕，經手人一律記本人。
 * 收押金與取件各記各的經手人（2026-11-14 學會：收押金的人不一定是交付設備的人）：收完押金、當下就能取件的單會接著跳取件確認框，
 * 另外選取件經手人（不預選），按取消＝晚點再取（單子留在「待取件」）。
 * 歸還＝退押金：整單一次歸還，整張單（根單＋子單）最後一張還完時在同一個確認框填罰金、退押金，超過押金的差額接「收罰款」（同樣記經手人），收清才算結束；
 * 期限內提早還一部分走 ⋯ 選單的「部分歸還」。已繳押金的取消單，退押金鈕也在歸還欄。
 * 其餘動作（點交／延期／通過或退回延期申請／取消訂單／部分歸還／大量設備的核對單）收在最右「操作」欄的 ⋯ 選單，釘在右邊，欄位再多往右捲都看得到。
 * 所有動作都走 OrderActionDialog（寫入 paid_by / picked_up_by / returned_by / refunded_by / penalty_collected_by 供追溯）。「名義」欄＝個人或老師名義＋證明檔（點了在畫面上開）。
 * 搜尋列下方七個分類按鈕：全部／待繳押金／待取件／待歸還／延期申請／待退押金／待繳罰款，各附筆數；點了切換下方表格內容。
 * 待歸還＝使用中＋未完成歸還（都是要收回來的）；已歸還／已取消只在「全部」裡看（搜尋得到）。
 * 姓名、學號點了跳會員管理查這個人。學期結束由最高權限按「清除已完成」把結束的單收進「已封存」（資料不刪）。
 */

import { BTN } from '@/components/common/btn'
import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchAllOrders, adminMarkPaid, adminMarkReturnedPartial, adminHandoverItems, adminCollectPenalty, adminCancelOrder, adminExtendOrder, adminApproveExtend, adminRejectExtend, adminArchiveOrders, adminUpdateOrderInfo, adminRefundDeposit, adminSetHandler, fetchClosedDates, proofUrl, penaltyOwed } from '../services/ordersService'
import type { AdminOrderRow, OrderInfo, HandlerField } from '../services/ordersService'
import { listStaff, createCheckSheet } from '../services/adminService'
import type { StaffMember } from '../services/adminService'
import { overduePenalty, overdueBusinessDays, pendingDeadline, dateTimeLabel, daysLabel, isOnDuty, slotEnd, slotLabel, toDateKey, SUSPENSION_OVERDUE_DAYS } from '../utils/timeUtils'
import { ADMIN_HANDLER_KEY } from '../utils/storageKeys'
import { ORDER_KIND_META, orderKind, orderKindMeta, StatusChip, actionBtn, PageTitle, tableTh, tableTd, tableRowLine as rowLine, toolBtn, textBtn, SearchBox, CountTabs, SortTh, toggleSort, itemsSummary, usePager, Pager, Select, DateRangePicker, LoadError, isAwaitingPickup } from '../components/admin/adminUi'
import type { Sort, SelectOption } from '../components/admin/adminUi'
import OrderActionDialog, { type AdminActionMode } from '../components/admin/OrderActionDialog'
import OrderInfoDialog from '../components/admin/OrderInfoDialog'
import CloseButton from '../components/common/CloseButton'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useToast } from '../hooks/useToast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useAuth } from '../contexts/AuthContext'

const fmtDate = (d: string) => d?.slice(5).replace('-', '/') // 'YYYY-MM-DD' → 'MM/DD'
const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 可排序欄位（Notion 式：每一欄都能點表頭排序）
type SortField =
  | 'rental_number' | 'name' | 'student_id' | 'booking_type' | 'start_date'
  | 'deposit_total' | 'status' | 'items' | 'reason' | 'paid_by' | 'picked_up_by' | 'returned_by' | 'as_teacher'
// 取件欄顯示的經手人：picked_up_by 欄位加上前的舊單沒記，已取件就當收押金的人
const pickedUpBy = (o: AdminOrderRow) =>
  o.picked_up_by ?? (['in-progress', 'overdue', 'returned'].includes(o.status) ? o.paid_by : null)
// 現在能不能取件：有預選取件時段的（大量設備）不開放提前取件，到取件日才行；其他單收完押金就能取
const canPickupNow = (o: AdminOrderRow) => !o.pickup_slot || (o.pickup_date ?? o.start_date) <= toDateKey(new Date())
const sortVal = (o: AdminOrderRow, f: SortField): string | number => {
  switch (f) {
    case 'name': return o.students?.name ?? ''
    case 'student_id': return o.students?.student_id ?? ''
    case 'deposit_total': return o.deposit_total
    case 'items': return itemsSummary(o)
    case 'reason': return o.reason ?? ''
    case 'paid_by': return o.paid_by ?? ''
    case 'picked_up_by': return pickedUpBy(o) ?? ''
    case 'returned_by': return o.returned_by ?? ''
    case 'booking_type': return orderKind(o)
    case 'as_teacher': return o.as_teacher ? o.teacher ?? '' : ''
    default: return (o[f] ?? '') as string
  }
}

// w＝欄寬：表格 w-full＋自動排版下，有寬度的欄固定（內容更長才撐開，不會溢出），只有品項不給寬度、吃掉全部剩餘空間，
// 切換篩選／排序時表頭就不跳。狀態／原因內容較長時換行，不要為此放大欄寬
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
  { field: 'as_teacher', zh: '名義', w: 'w-28' },
  { field: 'paid_by', zh: '收押金', w: 'w-28' },
  { field: 'picked_up_by', zh: '取件', w: 'w-28' },
  { field: 'returned_by', zh: '歸還', w: 'w-28' }
]

// 搜尋列下方的分類按鈕：篩選條件＋筆數。待繳押金＝pending 未繳；待取件＝大量設備已繳待取（isAwaitingPickup）；
// 待歸還＝使用中＋未完成歸還；待退押金＝東西都回來、錢還沒結：整張單還完的根單（子單併到根單結），或已繳押金的取消單（含沒來取件自動取消）；
// 待繳罰款＝押金抵完還差的，收清這筆單才算結束
const awaitingRefund = (o: AdminOrderRow, openRoots: ReadonlySet<number>) =>
  o.refunded == null && !o.parent_order_id && (
    o.status === 'returned' ? !openRoots.has(o.id) : o.status === 'canceled' && !!o.deposit_paid_at && o.deposit_total > 0
  )
// 學生送出、等學會確認的延期申請（server 在逾期、歸還、歸還日變動時會自動清掉，這裡再擋一次狀態）
const extendRequest = (o: AdminOrderRow) => (o.status === 'in-progress' ? o.extend_request ?? null : null)
type TabKey = 'all' | 'deposit' | 'pickup' | 'return' | 'extend' | 'refund' | 'fine'
const TABS: { key: TabKey; zh: string; match: (o: AdminOrderRow, openRoots: ReadonlySet<number>) => boolean }[] = [
  { key: 'all', zh: '全部', match: () => true },
  { key: 'deposit', zh: '待繳押金', match: o => o.status === 'pending' && !o.deposit_paid_at },
  { key: 'pickup', zh: '待取件', match: isAwaitingPickup },
  { key: 'return', zh: '待歸還', match: o => o.status === 'in-progress' || o.status === 'overdue' },
  { key: 'extend', zh: '延期申請', match: o => !!extendRequest(o) },
  { key: 'refund', zh: '待退押金', match: awaitingRefund },
  { key: 'fine', zh: '待繳罰款', match: o => penaltyOwed(o) > 0 }
]

// 整張單＝根單＋子單（parent_order_id 一律指根單）：押金與罰金只在根單結一次
const familyOf = (o: AdminOrderRow, rows: AdminOrderRow[]) => rows.filter(x => x.id === o.id || x.parent_order_id === o.id)
const familyDeposit = (o: AdminOrderRow, rows: AdminOrderRow[]) => familyOf(o, rows).reduce((sum, x) => sum + x.deposit_total, 0)
const rootOf = (o: AdminOrderRow, rows: AdminOrderRow[]) => (o.parent_order_id && rows.find(x => x.id === o.parent_order_id)) || o
const OPEN = ['pending', 'in-progress', 'overdue']
// 這張還完，整張單就都回來了（同家族沒有其他沒還的）且還沒結：歸還時一起結算
const settlesOnReturn = (o: AdminOrderRow, rows: AdminOrderRow[]) => {
  const root = rootOf(o, rows)
  return root.refunded == null && !familyOf(root, rows).some(x => x.id !== o.id && OPEN.includes(x.status))
}
// 這張單完全結束了（學期結束可以清掉）：自己已歸還或已取消，整張單（根單＋子單）都沒有還在跑的，押金結清、罰款收清
const isFinished = (o: AdminOrderRow, rows: AdminOrderRow[], openRoots: ReadonlySet<number>) => {
  const root = rootOf(o, rows)
  return !OPEN.includes(o.status) && !familyOf(root, rows).some(x => OPEN.includes(x.status)) &&
    !awaitingRefund(root, openRoots) && penaltyOwed(root) === 0
}
// 結算預填的逾期試算：每段各算到實際歸還那天（正在還的這張算到今天），上限同 overduePenalty
const familyEstPenalty = (root: AdminOrderRow, rows: AdminOrderRow[], closed: ReadonlySet<string>, returningId?: number) => {
  const deposit = familyDeposit(root, rows)
  const sum = familyOf(root, rows).reduce((s, x) => {
    const at = x.returned_at ? new Date(x.returned_at) : x.id === returningId ? new Date() : null
    return s + (at ? overduePenalty(x.end_date, deposit, closed, at) : 0)
  }, 0)
  return Math.min(sum, deposit || 5000)
}

// 表頭／儲存格樣式共用 adminUi 的 tableTh／tableTd（表頭 sticky、底線畫在儲存格上）
const th = tableTh
const td = tableTd
// 操作區（收押金／取件／歸還／操作）釘在右邊，左邊一條線跟捲過去的內容分開。sticky 要實色底蓋住捲過去的欄，
// hover 用同色漸層疊上去，才跟整列 white/10 一致。right＝右邊各欄寬加總（w-28＝7rem、操作 w-16＝4rem），改欄寬要一起改
const pinTd = 'sticky bg-black group-hover:bg-linear-to-r group-hover:from-white/10 group-hover:to-white/10'
const PIN: Partial<Record<SortField, string>> = { paid_by: 'right-72 max-md:right-auto border-l', picked_up_by: 'right-44 max-md:right-auto', returned_by: 'right-16 max-md:right-auto' }
// 一步一個經手人欄位：三欄各一步，收罰款（歸還欄裡，有欠繳才出現）也算一步
type StepField = 'paid_by' | 'picked_up_by' | 'returned_by' | 'penalty_collected_by'
const STEP_ZH: Record<StepField, string> = { paid_by: '收押金', picked_up_by: '取件', returned_by: '歸還', penalty_collected_by: '收罰款' }
const dash = <span className="text-gray-mid">—</span>
type RowAction = AdminActionMode | 'sheet' | 'reject' | '' // ⋯ 選單的選項；reject＝退回延期申請；'' ＝沒選（Select 的 value）

// 每欄的儲存格渲染：依 COLUMNS 順序查表（closed＝公休日，倒數／逾期天數用；act＝開操作對話框、busy＝處理中的單號）
type CellCtx = {
  closed: ReadonlySet<string>
  editInfo: (o: AdminOrderRow) => void
  openProof: (o: AdminOrderRow) => void
  openMember: (o: AdminOrderRow) => void // 姓名／學號點了跳會員管理查這個人
  act: (o: AdminOrderRow, mode: AdminActionMode, handler?: string) => void
  setHandler: (o: AdminOrderRow, field: StepField, name: string) => void
  busy: string | null
  openRoots: ReadonlySet<number> // 還有子單沒還完的根單
  isAdmin: boolean // 最高權限（櫃檯共用帳號）：步驟欄是經手人下拉；學會成員是按鈕、記本人
  staffOptions: SelectOption<string>[]
}
// 歸還欄裡的退押金鈕，與學會成員的步驟鈕。enabled=false＝這一步現在不能做，該單處理中時也一樣：
// 按鈕照樣顯示但停用，每列欄位對齊、一眼看出走到哪
const actBtn = (o: AdminOrderRow, ctx: CellCtx, mode: AdminActionMode, zh: string, enabled = true) =>
  <button onClick={() => enabled && ctx.act(o, mode)} disabled={!enabled || ctx.busy === o.rental_number} className={actionBtn}>{zh}</button>
// 姓名／學號：點了跳會員管理查這個人（文字連結，hover 變淡）
const memberLink = (o: AdminOrderRow, ctx: CellCtx, text: string) =>
  o.students ? <button onClick={() => ctx.openMember(o)} title="到會員管理查這位同學" className={BTN}>{text}</button> : '—'
// 收押金／取件／歸還／收罰款一步一格：還沒做＝經手人下拉，選了跳確認框；做完＝顯示經手人，選錯直接換人（不再確認）。
// 學會成員：還沒做是按鈕（經手人記本人），做完只顯示名字
const step = (o: AdminOrderRow, ctx: CellCtx, mode: AdminActionMode, field: StepField, done: string | null, enabled = true) => {
  const zh = STEP_ZH[field]
  const busy = ctx.busy === o.rental_number
  if (!ctx.isAdmin) return done ?? actBtn(o, ctx, mode, zh, enabled)
  // 已離任的經手人不在名單裡，補進選項才顯示得出來
  const options = !done || ctx.staffOptions.some(s => s.value === done) ? ctx.staffOptions : [...ctx.staffOptions, { value: done, label: done }]
  return (
    <Select<string>
      value={done ?? ''}
      placeholder={zh}
      options={options}
      size="xs"
      disabled={busy || (!done && !enabled)}
      onChange={name => { if (done) { if (name !== done) ctx.setHandler(o, field, name) } else ctx.act(o, mode, name) }}
      className="w-full font-chinese"
      aria-label={`${zh}經手人`}
    />
  )
}
const CELL: Record<SortField, (o: AdminOrderRow, ctx: CellCtx) => React.ReactNode> = {
  rental_number: o => <td key="rental_number" className={`${td} font-english`}>{o.rental_number}</td>,
  name: (o, ctx) => <td key="name" className={`${td} font-chinese`}>{memberLink(o, ctx, o.students?.name || '—')}</td>,
  student_id: (o, ctx) => <td key="student_id" className={`${td} text-gray-light font-english`}>{memberLink(o, ctx, o.students?.student_id ?? '')}</td>,
  booking_type: o => <td key="booking_type" className={`${td} font-chinese`}>{orderKindMeta(o).zh}</td>,
  start_date: o => <td key="start_date" className={`${td} font-english`}>{fmtDate(o.start_date)}–{fmtDate(o.end_date)}</td>,
  deposit_total: o => (
    <td key="deposit_total" className={`${td} font-english`}>
      NT$ {o.deposit_total.toLocaleString()}
      {(o.penalty_total ?? 0) > 0 && (
        <div className="mt-1" style={{ color: 'var(--color-error)' }}><span className="font-chinese">罰</span> NT$ {o.penalty_total!.toLocaleString()}</div>
      )}
    </td>
  ),
  // 大量設備預選時段：待繳押金時列出預約的繳押金／取件時段；取件日 19:00 沒來由排程自動取消。
  // 待繳押金另顯示 24 工作時倒數、逾期顯示逾期營業日（原總覽頁的提醒）
  status: (o, { closed }) => (
    <td key="status" className={`px-3 py-3 ${rowLine}`}>
      <StatusChip status={o.status} awaitingPickup={isAwaitingPickup(o)} />
      {penaltyOwed(o) > 0 && (
        <div className="mt-1 font-chinese" style={{ color: 'var(--color-pink)' }}>待繳 <span className="font-english">NT$ {penaltyOwed(o).toLocaleString()}</span></div>
      )}
      {o.status === 'pending' && !o.deposit_paid_at && (() => {
        // 顯示到期的時間點，不寫「剩幾小時」：倒數跳過週末與公休，週五關門後送的單期限是下週一，寫剩 24 小時會被當成隔天到期
        const deadline = pendingDeadline(o.created_at, closed, o.deposit_date && o.deposit_slot ? slotEnd(o.deposit_date, o.deposit_slot) : null)
        return deadline > new Date()
          ? <div className="mt-1 font-chinese" style={{ color: 'var(--color-yellow)' }}>期限 <span className="font-english">{dateTimeLabel(deadline)}</span></div>
          : <div className="mt-1 font-chinese text-gray-mid">已逾時，將自動取消</div>
      })()}
      {/* 學生送出的延期申請：同學到學會確認後，從 ⋯ 選單按「通過延期」才成立 */}
      {extendRequest(o) && (
        <div className="mt-1 font-chinese" style={{ color: 'var(--color-yellow)' }}>
          申請延期 <span className="font-english">{extendRequest(o)!.days}</span> 天{extendRequest(o)!.all ? '' : '（部分）'}
        </div>
      )}
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
          <div>取 {slotLabel({ date: o.pickup_date ?? o.start_date, slot: o.pickup_slot })}</div>
        </div>
      )}
    </td>
  ),
  // 品項與原因較長，允許換行；一項一行，最多顯示三行（3lh，換行也算），超過在格子內捲動。學生改單（情境 3）：取件後新增＝待點交、送單後改過＝已更動
  items: o => (
    <td key="items" className={`px-3 py-3 font-chinese ${rowLine}`}>
      <div className="max-h-[3lh] overflow-y-auto pr-2 custom-scrollbar">
        {o.order_items.map(i => (
          <div key={i.id}>
            {i.name}{i.item_type === 'equipment' && <span className="font-english"> ×{i.quantity}</span>}
            {/* 分時段的設備（雷切機）：借的是哪幾天 */}
            {i.days && <span className="font-english text-gray-light">（{daysLabel(i.days)}）</span>}
            {i.pickup_pending
              ? <span className="ml-1" style={{ color: 'var(--color-yellow)' }}>待點交</span>
              : i.changed_at && <span className="ml-1 text-gray-light">已更動</span>}
          </div>
        ))}
      </div>
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
  // 收押金：待繳＝收押金；收完顯示經手人。沒繳就取消的、系秘（免押金，送出即待取件、沒人收押金）＝—
  paid_by: (o, ctx) => (
    <td key="paid_by" className={`${td} ${pinTd} ${PIN.paid_by} font-chinese`}>
      {o.status === 'pending' && !o.deposit_paid_at ? step(o, ctx, 'paid', 'paid_by', null)
        : o.paid_by ? step(o, ctx, 'paid', 'paid_by', o.paid_by)
        : dash}
    </td>
  ),
  // 取件：收完押金才能按，經手人另外選（不帶收押金的人）。大量設備有預選取件時段，不開放提前取件，到取件日才能選
  picked_up_by: (o, ctx) => (
    <td key="picked_up_by" className={`${td} ${pinTd} ${PIN.picked_up_by} font-chinese`}>
      {pickedUpBy(o) ? step(o, ctx, 'pickup', 'picked_up_by', pickedUpBy(o))
        : isAwaitingPickup(o) ? step(o, ctx, 'pickup', 'picked_up_by', null, canPickupNow(o))
        : o.status === 'pending' ? step(o, ctx, 'pickup', 'picked_up_by', null, false)
        : dash}
    </td>
  ),
  // 歸還＝退押金：借用中／逾期＝歸還（最後一張順便結算）；還完顯示經手人＋退了多少，還有差額接「收罰款」
  // （跟前三步同一套：最高權限選經手人、學會成員按鈕；收完顯示誰收的）。已繳押金的取消單、舊資料沒結到的，退押金鈕也在這裡
  returned_by: (o, ctx) => {
    if (o.status === 'in-progress' || o.status === 'overdue') return <td key="returned_by" className={`${td} ${pinTd} ${PIN.returned_by} font-chinese`}>{step(o, ctx, 'return', 'returned_by', null)}</td>
    if (o.status === 'pending') return <td key="returned_by" className={`${td} ${pinTd} ${PIN.returned_by} font-chinese`}>{step(o, ctx, 'return', 'returned_by', null, false)}</td>
    const parts = [
      o.returned_by && <div key="by">{step(o, ctx, 'return', 'returned_by', o.returned_by)}</div>,
      o.refunded != null && <div key="refunded" className="text-gray-light">退 <span className="font-english">NT$ {o.refunded.toLocaleString()}</span></div>,
      o.refunded == null && ctx.openRoots.has(o.id) && <div key="open" className="text-gray-light">子單未還</div>,
      awaitingRefund(o, ctx.openRoots) && <div key="refund">{actBtn(o, ctx, 'refund', o.deposit_total > 0 ? '退押金' : '結算')}</div>,
      penaltyOwed(o) > 0 && <div key="penalty">{step(o, ctx, 'penalty', 'penalty_collected_by', null)}</div>,
      o.penalty_collected_by && (
        <div key="collected">
          <div className="text-gray-light">罰款已收</div>
          {step(o, ctx, 'penalty', 'penalty_collected_by', o.penalty_collected_by)}
        </div>
      )
    ].filter(Boolean)
    return (
      <td key="returned_by" className={`${td} ${pinTd} ${PIN.returned_by} font-chinese`}>
        {parts.length ? <div className="flex flex-col gap-1 leading-5">{parts}</div> : dash}
      </td>
    )
  },
  // 名義：個人／老師名義；有證明檔（老師名義、雷切機一年級）多一個鈕開檔案，符不符合由學會看
  as_teacher: (o, { openProof }) => (
    <td key="as_teacher" className={`${td} font-chinese`}>
      <div>{o.as_teacher ? <>老師・{o.teacher}</> : <span className="text-gray-light">個人</span>}</div>
      {o.proof_path && <button onClick={() => openProof(o)} className={`mt-1 ${actionBtn}`}>證明</button>}
    </td>
  ),
}


const AdminOrdersPage: React.FC = () => {
  const { showToast, toastElement } = useToast()
  const { currentUser } = useAuth()
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
  // noDefault＝確認框不預選上次的經手人（收完押金接著跳的取件：不能自動帶收押金的人）
  const [action, setAction] = useState<{ order: AdminOrderRow; mode: AdminActionMode; handler?: string; noDefault?: boolean } | null>(null)
  const isAdmin = currentUser?.role === 'admin'
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  // 已封存＝學期結束清掉的單：預設不列，按工具列「已封存」只看這些
  const [showArchived, setShowArchived] = useState(false)
  // 經手人選單：值班中的幹部排前面並分組標示；沒人值班時就是一般清單（代班都選得到）
  const staffList = useMemo(
    () => staff.map(m => ({ name: m.name, onDuty: isOnDuty(m.duties) })).sort((a, b) => Number(b.onDuty) - Number(a.onDuty)),
    [staff]
  )
  const staffOptions = useMemo<SelectOption<string>[]>(() => {
    const anyOnDuty = staffList.some(s => s.onDuty)
    return staffList.map(s => ({ value: s.name, label: s.name, group: anyOnDuty ? (s.onDuty ? '值班中' : '其他') : undefined }))
  }, [staffList])

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

  // 歸還：整單收回；整張單最後一張就接著結算（2026-11-10 歸還＝退押金）。兩支 RPC 分開跑：退押金失敗時東西已收回，
  // 單子會留在「待退押金」，歸還欄有退押金鈕可以補
  const returnOrder = async (o: AdminOrderRow, itemIds: number[], handler: string, penalty: number, settle: boolean) => {
    const res = await adminMarkReturnedPartial(o.rental_number, itemIds, handler)
    if (!res.ok || !settle) return res
    const refund = await adminRefundDeposit(rootOf(o, orders).rental_number, penalty, handler)
    return refund.ok ? refund : { ok: false, message: `已歸還，但退押金失敗（${refund.message}），請在歸還欄按「退押金」補做` }
  }

  // 對話框確認：收押金／取件／歸還／部分歸還／收罰款／代取消／代延期（經手人記住供下次預選）
  const handleAction = async (handler: string, penalty: number, itemIds: number[], days: number, pickup: boolean, depositTotal?: number) => {
    if (!action) return
    const { order, mode } = action
    const settle = mode === 'return' && settlesOnReturn(order, orders)
    setAction(null)
    localStorage.setItem(ADMIN_HANDLER_KEY, handler)
    setBusy(order.rental_number)
    const res =
      mode === 'return' || mode === 'partial'
        ? await returnOrder(order, itemIds, handler, penalty, settle)
        : mode === 'paid' || mode === 'pickup'
        ? await adminMarkPaid(order.rental_number, handler, pickup, depositTotal)
        : mode === 'handover'
          ? await adminHandoverItems(order.rental_number, handler, depositTotal ?? order.deposit_total)
        : mode === 'penalty'
          ? await adminCollectPenalty(order.rental_number, handler)
          : mode === 'cancel'
            ? await adminCancelOrder(order.rental_number, handler)
            : mode === 'extend'
              ? await adminExtendOrder(order.rental_number, days, handler)
              : mode === 'approve'
                ? await adminApproveExtend(order.rental_number, handler)
                : await adminRefundDeposit(order.rental_number, penalty, handler)
    setBusy(null)
    if (!res.ok) { showToast(res.message ?? '操作失敗'); await load(); return }
    const rn = order.rental_number
    const owes = penalty > familyDeposit(rootOf(order, orders), orders)
    showToast(
      mode === 'handover' ? `已點交 ${rn} 新增的設備`
      : mode === 'pickup' ? `已完成取件 ${rn}，租借開始`
      : mode === 'paid' ? `已收押金 ${rn}，待取件`
      : mode === 'penalty' ? `已收罰款 ${rn}`
      : mode === 'cancel' ? `已取消 ${rn}`
      : mode === 'extend' ? `已將 ${rn} 延期 ${days} 天`
      : mode === 'approve' ? `已通過 ${rn} 的延期申請`
      : mode === 'refund' ? (owes ? `已結算 ${rn}，差額待同學繳清` : `已結算 ${rn} 的押金`)
      : mode === 'partial' ? `已部分歸還 ${rn}，未還品項已拆成子單續租`
      : settle ? (owes ? `已歸還 ${rn}，差額待同學繳清` : `已歸還 ${rn} 並結算押金`)
      : `已歸還 ${rn}，押金等子單還完一起結`,
      'success'
    )
    // 收完押金、當下就能取件：接著跳取件確認框，取件經手人另外選（不預選收押金的人）。
    // 設備交出去卻忘了按取件，單子會一直停在「待取件」（大量設備還會在取件日 19:00 被當成沒來取而自動取消），所以直接帶到下一步；按取消＝晚點再取
    if (mode === 'paid' && canPickupNow(order)) {
      setAction({ order: { ...order, deposit_paid_at: new Date().toISOString(), paid_by: handler }, mode: 'pickup', noDefault: true })
    }
    await load()
  }

  // 最高權限選錯經手人：直接換，不再確認（2026-11-10）。同一步一起記的欄位跟著換：歸還時一起結的退押金經手人
  const changeHandler = async (o: AdminOrderRow, field: StepField, name: string) => {
    const fields: Partial<Record<HandlerField, string>> = { [field]: name }
    if (field === 'returned_by' && o.refunded_by === o.returned_by) fields.refunded_by = name
    setBusy(o.rental_number)
    const res = await adminSetHandler(o.rental_number, fields)
    setBusy(null)
    if (!res.ok) { showToast(res.message ?? '更換失敗'); return }
    showToast(`已將 ${o.rental_number} 的${STEP_ZH[field]}經手人改為 ${name}`, 'success')
    await load()
  }

  // 證明檔在私有 bucket，開的時候才簽短效網址；直接在畫面上開（圖片＝img、PDF＝iframe），不另開分頁
  const [proof, setProof] = useState<{ url: string; pdf: boolean; title: string } | null>(null)
  const openProof = async (o: AdminOrderRow) => {
    const url = await proofUrl(o.proof_path!)
    if (url) setProof({ url, pdf: /\.pdf$/i.test(o.proof_path!), title: `${o.rental_number} 證明文件` })
    else showToast('讀取證明文件失敗')
  }
  useEffect(() => {
    if (!proof) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setProof(null) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [proof])

  // 退回學生的延期申請：同學照原歸還日歸還，延期權不扣
  const rejectExtend = async (o: AdminOrderRow) => {
    const ok = await confirm({
      title: '退回延期申請',
      message: `退回 ${o.rental_number}（${o.students?.name ?? ''}）的延期申請？同學照原歸還日 ${o.end_date} 歸還。`,
      confirmTextZh: '退回', variant: 'danger'
    })
    if (!ok) return
    setBusy(o.rental_number)
    const res = await adminRejectExtend(o.rental_number, currentUser?.name ?? '')
    setBusy(null)
    showToast(res.ok ? `已退回 ${o.rental_number} 的延期申請` : res.message ?? '操作失敗', res.ok ? 'success' : 'error')
    await load()
  }

  // 學期結束（最高權限）：把已經完全結束的單從訂單頁清掉＝封存，資料不刪，按「已封存」還看得到。
  // 還在跑的、押金沒結清、罰款沒收清的不動
  const archiveFinished = async () => {
    const ids = orders.filter(o => !o.archived_at && isFinished(o, orders, openRoots)).map(o => o.id)
    if (ids.length === 0) { showToast('沒有可以清除的訂單（已歸還並結清、已取消的才會清）'); return }
    const ok = await confirm({
      title: '清除已完成的訂單',
      message: `把 ${ids.length} 筆已完成的訂單（已歸還並結清、已取消）從訂單頁清除？\n還沒結束的單不受影響。資料不會刪除，之後按「已封存」可以回頭看。`,
      confirmTextZh: '清除', variant: 'danger'
    })
    if (!ok) return
    const res = await adminArchiveOrders(ids)
    showToast(res.ok ? `已清除 ${ids.length} 筆已完成的訂單` : res.message ?? '清除失敗', res.ok ? 'success' : 'error')
    await load()
  }

  // 大量設備單的核對單：在學會 Drive 建一份試算表
  const exportSheet = (o: AdminOrderRow) => {
    setBusy(o.rental_number) // 按下就鎖住，連點不會建兩份
    createCheckSheet(o).then(r => { setBusy(null); showToast(r.message, r.ok ? 'success' : 'error') })
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
      if (!!o.archived_at !== showArchived) return false
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
        o.teacher ?? '',
        o.paid_by ?? '',
        o.returned_by ?? ''
      ].some(v => v.toLowerCase().includes(q))
    })
  }, [orders, search, typeFilter, range, studentFilter, showArchived])
  const studentName = studentFilter ? orders.find(o => o.students?.student_id === studentFilter)?.students?.name ?? '' : ''

  // 還有子單沒還完的根單：押金要等全部還完才結（看全部訂單，不受搜尋影響）
  const openRoots = useMemo(
    () => new Set(orders.filter(o => o.parent_order_id && ['pending', 'in-progress', 'overdue'].includes(o.status)).map(o => o.parent_order_id!)),
    [orders]
  )

  // 各籤筆數跟著搜尋／時間／種類篩選變（同 Notion：filter 後再分籤）
  const counts = useMemo(
    () => Object.fromEntries(TABS.map(t => [t.key, base.filter(o => t.match(o, openRoots)).length])) as Record<TabKey, number>,
    [base, openRoots]
  )

  const visible = useMemo(() => {
    const { match } = TABS.find(t => t.key === tab)!
    const rows = base.filter(o => match(o, openRoots))
    if (!sort) return rows // 維持建立時間新→舊（fetch 預設）
    const { field, dir } = sort
    return [...rows].sort((a, b) => {
      const va = sortVal(a, field), vb = sortVal(b, field)
      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [base, tab, sort, openRoots])

  const { pageRows, pager } = usePager(visible, [search, tab, typeFilter, range, sort, showArchived])
  const sortProps = { sort, onSort: (f: SortField) => setSort(s => toggleSort(s, f)) }

  const hasRange = !!(range.from || range.to)
  const cellCtx: CellCtx = {
    closed: closedDates, editInfo: setInfoOrder, openProof: o => void openProof(o),
    openMember: o => navigate(`/admin/members?q=${encodeURIComponent(o.students?.student_id ?? '')}`),
    act: (order, mode, handler) => setAction({ order, mode, handler }),
    setHandler: (o, field, name) => void changeHandler(o, field, name),
    busy, openRoots, isAdmin, staffOptions
  }

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
        {/* 學期結束清掉已完成的單（只有最高權限；封存不刪除） */}
        {isAdmin && (
          <button onClick={() => void archiveFinished()} className={textBtn(false)} title="把已歸還並結清、已取消的訂單收進「已封存」">
            <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">archive</span>
            清除已完成
          </button>
        )}
      </PageTitle>

      {/* 工具列：左搜尋框（常駐）；右＝租借時間、種類 */}
      <div className="flex max-md:flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 mr-auto max-md:w-full max-md:flex-wrap">
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
        <button onClick={() => setShowArchived(v => !v)} className={textBtn(showArchived)} title={showArchived ? '回到目前的訂單' : '只看已封存（學期結束清掉）的訂單'}>
          <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">inventory_2</span>
          已封存
        </button>
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
        <div className="flex max-md:flex-wrap items-center gap-2 mb-6 text-xs text-gray-light font-chinese">
          <span className="mr-1">租借時間</span>
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
      )}

      {loading && <div className="text-gray-light text-xs font-chinese">載入中…</div>}
      {!loading && error && <LoadError message={error} onRetry={() => { setLoading(true); void load() }} />}

      {!loading && !error && (
        <div className="flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
          {/* min-w＝固定欄總和（1376px）＋品項至少 360px（最寬的一欄，長品名加「待點交」也一行放得下）：塞不下時橫向捲動，不然 Chrome 會按比例壓縮所有欄、表頭又會跳 */}
          <table className="w-full min-w-[1736px] text-xs border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-gray-light">
                {COLUMNS.map(col => <SortTh key={col.field} zh={col.zh} field={col.field} className={`${col.w ?? ''} ${PIN[col.field] ? `${PIN[col.field]} z-20` : ''}`} {...sortProps} />)}
                <th className={`${th} w-16 right-0 max-md:right-auto z-20`}>操作</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(o => (
                <tr key={o.id} className="group hover:bg-white/10">
                  {COLUMNS.map(c => CELL[c.field](o, cellCtx))}
                  <td className={`${td} ${pinTd} right-0 max-md:right-auto`}>
                    {(() => {
                      // 收押金／取件／歸還／收罰款在各自的欄；這裡是其餘動作（情境 9／13），收進 ⋯ 選單：
                      // 學生取件後新增設備 → 前面多一個「點交」；期限內提早還一部分 → 部分歸還（兩件以上才有）；
                      // 沒有動作時這裡留白，該單處理中時選單停用
                      const handover: { mode: AdminActionMode; zh: string }[] =
                        o.order_items.some(i => i.pickup_pending) ? [{ mode: 'handover', zh: '點交' }] : []
                      // 部分歸還以「品項列」為單位拆單，所以這張單要有兩種以上的品項才有（同一種借很多個不能只還幾個）
                      const partial: { mode: AdminActionMode; zh: string }[] =
                        o.order_items.length > 1 ? [{ mode: 'partial', zh: '部分歸還' }] : []
                      // 學生送了延期申請：通過（跳確認框記經手人）或退回，排最前面
                      const request: { mode: RowAction; zh: string }[] =
                        extendRequest(o) ? [{ mode: 'approve', zh: '通過延期' }, { mode: 'reject', zh: '退回延期' }] : []
                      // 取消只給還沒取件的單（pending）；取件後東西在學生手上，只能歸還
                      const acts: { mode: RowAction; zh: string }[] =
                        o.status === 'pending'
                          ? [{ mode: 'cancel', zh: '取消訂單' }]
                          : o.status === 'in-progress'
                            ? [...request, ...handover, { mode: 'extend', zh: '延期' }, ...partial]
                            : o.status === 'overdue'
                              ? [...handover, { mode: 'extend', zh: '延期' }, ...partial]
                              : []
                      const menu: SelectOption<RowAction>[] = acts.map(a => ({ value: a.mode, label: a.zh }))
                      if (orderKind(o) === 'equipment-mass-personal' && o.status !== 'canceled') {
                        menu.push({ value: 'sheet', label: <span title="在學會 Google Drive 建立試算表">核對單</span> })
                      }
                      if (menu.length === 0) return null
                      return (
                        <Select<RowAction>
                          value=""
                          more
                          filled
                          disabled={busy === o.rental_number}
                          options={menu}
                          onChange={v => {
                            if (v === 'sheet') exportSheet(o)
                            else if (v === 'reject') void rejectExtend(o)
                            else if (v) setAction({ order: o, mode: v })
                          }}
                          aria-label="操作"
                        />
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

      {/* 動作確認框：欄位裡選好的經手人（最高權限）或本人（學會成員）直接帶入；⋯ 選單、退押金、收罰款進來的才在框裡選 */}
      {action && (
        <OrderActionDialog
          order={action.order}
          mode={action.mode}
          staff={staffList}
          defaultHandler={action.noDefault ? '' : localStorage.getItem(ADMIN_HANDLER_KEY) ?? ''}
          lockedHandler={action.handler ?? (isAdmin ? undefined : currentUser?.name)}
          settleOnReturn={action.mode === 'return' && settlesOnReturn(action.order, orders)}
          estPenalty={
            action.mode === 'refund' ? familyEstPenalty(action.order, orders, closedDates)
            : action.mode === 'return' ? familyEstPenalty(rootOf(action.order, orders), orders, closedDates, action.order.id)
            : 0
          }
          familyDeposit={familyDeposit(rootOf(action.order, orders), orders)}
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
      {/* 證明文件：直接在畫面上看（點外面或 Esc 關閉）；手機的瀏覽器不一定能在頁面裡顯示 PDF，留一個另開分頁的連結 */}
      {proof && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-black/80 p-6" onClick={() => setProof(null)}>
          <div className="w-full max-w-4xl flex items-center gap-4 text-xs text-white" onClick={e => e.stopPropagation()}>
            <span className="font-chinese mr-auto">{proof.title}</span>
            <a href={proof.url} target="_blank" rel="noopener noreferrer" className="font-chinese underline underline-offset-4 hover:opacity-50">另開分頁</a>
            <CloseButton onClick={() => setProof(null)} />
          </div>
          {proof.pdf
            ? <iframe src={proof.url} title={proof.title} className="w-full max-w-4xl flex-1 min-h-0 rounded-xl bg-white" />
            : <img src={proof.url} alt={proof.title} className="max-w-full flex-1 min-h-0 object-contain rounded-xl" onClick={e => e.stopPropagation()} />}
        </div>,
        document.body
      )}
      <ConfirmDialog />
      {toastElement}
    </div>
  )
}

export default AdminOrdersPage
