/**
 * 後台操作對話框：收押金／取件／歸還（逾期時含罰款確認）＋值班經手人選擇。
 * 經手人必選（追溯用）；樣式沿用 common/ConfirmDialog。
 * 大量設備預選了繳押金／取件時段（mass-pickup.sql）：收押金時可選「同時取件」，
 * 不勾＝只收押金（已繳待取件），之後再用 pickup 模式確認取件。
 */

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { suggestedDeposit, type AdminOrderRow } from '../../services/ordersService'
import { slotLabel, toDateKey } from '../../utils/timeUtils'

export type AdminActionMode = 'paid' | 'pickup' | 'return' | 'penalty' | 'cancel' | 'extend' | 'handover'
// pickup = 已預繳者取件；penalty = 收罰款（歸還時未當場繳清的欠款）；cancel = 代取消；extend = 代客延期；
// handover = 點交學生取件後新增的設備（modify-order.sql）

interface Props {
  order: AdminOrderRow
  mode: AdminActionMode
  staff: { name: string; onDuty: boolean }[] // 幹部（值班中排前面，選單來源）
  defaultHandler: string // 上次選擇的經手人（同班次免重選）
  estPenalty: number // 逾期試算罰款（overdue 時預填，可修改）
  onConfirm: (handler: string, penalty: number, itemIds: number[], penaltyPaid: boolean, days: number, pickup: boolean, depositTotal?: number) => void
  onCancel: () => void
}

const OrderActionDialog: React.FC<Props> = ({
  order,
  mode,
  staff,
  defaultHandler,
  estPenalty,
  onConfirm,
  onCancel
}) => {
  const isOverdue = order.status === 'overdue'
  const [handler, setHandler] = useState(staff.some(s => s.name === defaultHandler) ? defaultHandler : '')
  const [penalty, setPenalty] = useState(String(isOverdue ? estPenalty : 0))
  // 已標 overdue 的單可能是「19:00 前已交還、按鈕晚按」——下拉區分準時（免罰）／逾期（計罰款）
  const [returnKind, setReturnKind] = useState<'late' | 'ontime'>('late')
  const chargePenalty = mode === 'return' && isOverdue && returnKind === 'late'
  // 罰款是否當場繳清（情境 13）：未繳清 → 欠繳記錄，學生不能再下單直到後台收罰款
  const [paidNow, setPaidNow] = useState(true)
  // 代客延期天數（1-7；更長分次延）
  const [days, setDays] = useState('1')
  // 收押金時是否同時取件：有預選取件時段（大量設備）才可選，預設＝已到起租日；其他單一律同時
  const hasPickupSlot = !!order.pickup_slot
  const [pickupNow, setPickupNow] = useState(!hasPickupSlot || order.start_date <= toDateKey(new Date()))

  // 部分歸還（情境 5-①）：勾「已歸還」品項，預設全勾；部分勾＝未還品項拆子單續租
  const [returnIds, setReturnIds] = useState<Set<number>>(
    () => new Set(order.order_items.map(i => i.id))
  )
  const toggleReturnItem = (id: number) => {
    setReturnIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const isPartialReturn = mode === 'return' && returnIds.size < order.order_items.length

  // 押金現場計算、系統記錄：點交新增設備，或已繳待取件的單繳押金後被學生改過品項 → 取件時一併記錄
  const pendingItems = order.order_items.filter(i => i.pickup_pending)
  const needDeposit =
    mode === 'handover' ||
    (mode === 'pickup' && !!order.items_updated_at && !!order.deposit_paid_at &&
      new Date(order.items_updated_at) > new Date(order.deposit_paid_at))
  // 建議值＝最新品項小計 cap 5,000；助教直借（押金 0）維持 0
  const suggested = order.deposit_total === 0 ? 0 : suggestedDeposit(order.order_items)
  const [deposit, setDeposit] = useState(String(suggested))
  const depositNum = parseInt(deposit, 10)
  const depositValid = !needDeposit || (!Number.isNaN(depositNum) && depositNum >= 0)

  // 按 ESC 鍵關閉
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])

  const penaltyNum = parseInt(penalty, 10)
  const penaltyValid = !chargePenalty || (!Number.isNaN(penaltyNum) && penaltyNum >= 0)
  const daysNum = parseInt(days, 10)
  const daysValid = mode !== 'extend' || (!Number.isNaN(daysNum) && daysNum >= 1 && daysNum <= 7)
  const canConfirm =
    handler !== '' && penaltyValid && daysValid && depositValid && (mode !== 'return' || returnIds.size > 0)

  const title =
    mode === 'paid' ? { en: 'Deposit', zh: '確認收押金' }
    : mode === 'pickup' ? { en: 'Pick up', zh: '確認取件' }
    : mode === 'penalty' ? { en: 'Penalty', zh: '收罰款' }
    : mode === 'cancel' ? { en: 'Cancel Order', zh: '代取消訂單' }
    : mode === 'extend' ? { en: 'Extend', zh: '代客延期' }
    : mode === 'handover' ? { en: 'Handover', zh: '點交新增設備' }
    : { en: 'Return', zh: '確認歸還' }

  // 代客延期的新歸還日預覽
  const newEndDate = (() => {
    if (mode !== 'extend' || !daysValid) return null
    const d = new Date(order.end_date)
    d.setDate(d.getDate() + daysNum)
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
  })()
  const field =
    'bg-black border border-gray-scale4 rounded-lg px-3 py-1.5 text-xs text-white focus:border-white outline-none w-full'

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onCancel}
    >
      <div
        className="bg-[#151515] border border-[#545454] max-w-lg w-full mx-4 rounded-lg"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 標題區 */}
        <div className="px-6 pt-6">
          <h2 className="font-english text-sm text-white font-normal">
            {title.en} <span className="font-chinese">{title.zh}</span>
          </h2>
          <p className="font-english text-xs text-gray-scale2 mt-1">
            {order.rental_number} · <span className="font-chinese">{order.students?.name ?? '—'}</span>
            {' '}· NT$ {order.deposit_total.toLocaleString()}
          </p>
        </div>

        {/* 內容區 */}
        <div className="px-6 py-5 flex flex-col gap-5">
          {/* 代取消：說明退押金與否 */}
          {mode === 'cancel' && (
            <p className="text-tiny text-white font-chinese">
              {order.status === 'pending' && !order.deposit_paid_at
                ? '此單尚未繳押金，取消後直接作廢、佔用釋放。'
                : <>已繳押金 <span className="font-english">NT$ {order.deposit_total.toLocaleString()}</span>，請當場退還現金後再按確認。</>}
            </p>
          )}

          {/* 代客延期：天數輸入＋新歸還日預覽（不受僅乙次／前三天限制；撞期照擋） */}
          {mode === 'extend' && (
            <div>
              <label className="text-gray-scale2 text-tiny block mb-2">
                <span className="font-english">Days</span> <span className="font-chinese">延期天數（1-7，更長分次延）</span>
              </label>
              <input
                type="number"
                min="1"
                max="7"
                value={days}
                onChange={e => setDays(e.target.value)}
                className={`${field} font-english`}
              />
              <p className="text-tiny text-gray-scale2 font-chinese mt-2">
                原歸還日 <span className="font-english">{order.end_date}</span>
                {newEndDate && <>，延期後為 <span className="font-english">{newEndDate}</span></>}
                {order.status === 'overdue' && '；逾期單延期後將回到「租借中」。'}
              </p>
            </div>
          )}

          {/* 收押金（大量設備有預選時段）：顯示學生預約的時段＋是否同時取件 */}
          {mode === 'paid' && hasPickupSlot && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-scale2 font-chinese">
                學生預約：繳押金 {order.deposit_date && order.deposit_slot
                  ? slotLabel({ date: order.deposit_date, slot: order.deposit_slot }) : '—'}
                ；取件 {slotLabel({ date: order.start_date, slot: order.pickup_slot! })}
              </p>
              <label className="flex items-center gap-3 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  className="custom-checkbox flex-shrink-0"
                  checked={pickupNow}
                  onChange={e => setPickupNow(e.target.checked)}
                />
                <span className="font-chinese">同時取件（設備當場交付，租借開始；不勾＝只收押金，之後再取件）</span>
              </label>
            </div>
          )}

          {/* 取件（已預繳）：押金已收，交付設備後確認 */}
          {mode === 'pickup' && (
            <p className="text-xs text-white font-chinese">
              押金已於 <span className="font-english">{order.deposit_paid_at?.slice(5, 10).replace('-', '/')}</span> 收取
              {order.paid_by && <>（經手 {order.paid_by}）</>}，設備交付後按確認，租借開始。
            </p>
          )}

          {/* 點交：學生取件後新增、尚未交付的設備 */}
          {mode === 'handover' && (
            <div className="text-xs text-white font-chinese">
              <p className="text-gray-scale2 mb-2">學生取件後新增的設備，交付後按確認：</p>
              {pendingItems.map(i => (
                <div key={i.id}>{i.name} <span className="font-english text-gray-scale2">×{i.quantity}</span></div>
              ))}
            </div>
          )}

          {/* 押金（現場計算，系統只記錄）：預填最新品項的建議值，可修改 */}
          {needDeposit && (
            <div>
              <label className="text-gray-scale2 text-xs block mb-2">
                <span className="font-english">Deposit</span> <span className="font-chinese">押金總額（現場計算後填入）</span>
              </label>
              <input
                type="number"
                min="0"
                value={deposit}
                onChange={e => setDeposit(e.target.value)}
                className={`${field} font-english`}
              />
              <p className="text-xs text-gray-scale2 font-chinese mt-2">
                目前已收 <span className="font-english">NT$ {order.deposit_total.toLocaleString()}</span>
                ，依最新品項建議 <span className="font-english">NT$ {suggested.toLocaleString()}</span>
                {depositValid && depositNum !== order.deposit_total && (
                  <>（{depositNum > order.deposit_total ? '補收' : '退還'}{' '}
                    <span className="font-english">NT$ {Math.abs(depositNum - order.deposit_total).toLocaleString()}</span>）</>
                )}
              </p>
            </div>
          )}

          {/* 收罰款：顯示欠繳金額 */}
          {mode === 'penalty' && (
            <p className="text-xs text-white font-chinese">
              未繳罰款 <span className="font-english">NT$ {(order.penalty_total ?? 0).toLocaleString()}</span>
              ，收款後學生即可恢復預約。
            </p>
          )}

          {/* 值班經手人 */}
          <div>
            <label className="text-gray-scale2 text-xs block mb-2">
              <span className="font-english">Handled by</span> <span className="font-chinese">值班經手人</span>
            </label>
            {staff.length === 0 ? (
              <p className="text-xs font-chinese" style={{ color: 'var(--color-error2)' }}>
                尚無系學會成員，請先到「會員管理 Members」把幹部的身分設為系學會
              </p>
            ) : (
              <select
                value={handler}
                onChange={e => setHandler(e.target.value)}
                className={`${field} font-chinese cursor-pointer`}
              >
                <option value="" disabled>請選擇</option>
                {/* 值班中的幹部排前面並分組標示；沒人值班時就是一般清單（代班都選得到） */}
                {staff.some(s => s.onDuty) ? (
                  <>
                    <optgroup label="值班中 On duty">
                      {staff.filter(s => s.onDuty).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </optgroup>
                    <optgroup label="其他 Others">
                      {staff.filter(s => !s.onDuty).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </optgroup>
                  </>
                ) : (
                  staff.map(s => <option key={s.name} value={s.name}>{s.name}</option>)
                )}
              </select>
            )}
          </div>

          {/* 歸還品項勾選（情境 5-①）：預設全勾＝整單歸還；部分勾＝未還品項拆子單續租 */}
          {mode === 'return' && (
            <div>
              <label className="text-gray-scale2 text-xs block mb-2">
                <span className="font-english">Returned items</span>{' '}
                <span className="font-chinese">已歸還品項（未勾選者拆為子單繼續租借）</span>
              </label>
              <div className="flex flex-col gap-2">
                {order.order_items.map(item => (
                  <label key={item.id} className="flex items-center gap-3 text-xs text-white cursor-pointer">
                    <input
                      type="checkbox"
                      className="custom-checkbox flex-shrink-0"
                      checked={returnIds.has(item.id)}
                      onChange={() => toggleReturnItem(item.id)}
                    />
                    <span className="font-chinese">{item.name}</span>
                    {item.quantity > 1 && <span className="font-english text-gray-scale2">×{item.quantity}</span>}
                  </label>
                ))}
              </div>
              {isPartialReturn && (
                <p className="text-xs text-gray-scale2 font-chinese mt-2">
                  部分歸還：未勾選品項將拆為子單（歸還日不變），續走逾期／延期／罰款流程。
                </p>
              )}
            </div>
          )}

          {/* 已標逾期的單：下拉區分準時歸還（免罰）／逾期歸還（計罰款）——情境 6 定案 2026-09-26 */}
          {isOverdue && (
            <div>
              <label className="text-gray-scale2 text-xs block mb-2">
                <span className="font-english">Return type</span> <span className="font-chinese">歸還認定</span>
              </label>
              <select
                value={returnKind}
                onChange={e => setReturnKind(e.target.value as 'late' | 'ontime')}
                className={`${field} font-chinese cursor-pointer`}
              >
                <option value="late">逾期歸還（計罰款）</option>
                <option value="ontime">準時歸還（免罰，19:00 前已交還）</option>
              </select>
            </div>
          )}

          {/* 罰款金額（僅認定為逾期歸還時） */}
          {chargePenalty && (
            <div>
              <label className="text-gray-scale2 text-xs block mb-2">
                <span className="font-english">Penalty</span> <span className="font-chinese">罰款金額</span>
                <span className="font-chinese ml-2">
                  （系統試算 NT$ {estPenalty.toLocaleString()}，可修改）
                </span>
              </label>
              <input
                type="number"
                min="0"
                value={penalty}
                onChange={e => setPenalty(e.target.value)}
                className={`${field} font-english`}
              />
              {/* 未當場繳清 → 記欠繳，學生不能再下單直到收罰款（情境 13） */}
              {penaltyNum > 0 && (
                <label className="flex items-center gap-3 text-xs text-white cursor-pointer mt-3">
                  <input
                    type="checkbox"
                    className="custom-checkbox flex-shrink-0"
                    checked={paidNow}
                    onChange={e => setPaidNow(e.target.checked)}
                  />
                  <span className="font-chinese">罰款已當場繳清（未勾＝記欠繳，繳清前不可再預約）</span>
                </label>
              )}
            </div>
          )}
          {mode === 'return' && !isOverdue && (
            <p className="text-xs text-gray-scale2 font-chinese">準時歸還，無罰款。</p>
          )}
        </div>

        {/* 橫線 */}
        <div className="px-6">
          <div className="border-t border-[#545454]"></div>
        </div>

        {/* 按鈕區 */}
        <div className="px-6 py-4 flex justify-end gap-6">
          <button onClick={onCancel} className="text-gray-scale2 hover:!text-white transition-colors cursor-pointer">
            <span className="font-english text-xs">
              Cancel <span className="font-chinese">取消</span>
            </span>
          </button>
          <button
            onClick={() =>
              canConfirm &&
              onConfirm(
                handler,
                chargePenalty ? penaltyNum : 0,
                [...returnIds],
                chargePenalty && penaltyNum > 0 ? paidNow : true,
                mode === 'extend' ? daysNum : 0,
                mode === 'pickup' || pickupNow,
                needDeposit ? depositNum : undefined
              )
            }
            disabled={!canConfirm}
            className={`transition-opacity ${
              canConfirm ? 'text-white hover:opacity-70 cursor-pointer' : 'text-gray-scale3 cursor-not-allowed'
            }`}
          >
            <span className="font-english text-xs">
              Confirm <span className="font-chinese">確認</span>
            </span>
          </button>
        </div>
      </div>

      {/* 淡入動畫 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body
  )
}

export default OrderActionDialog
