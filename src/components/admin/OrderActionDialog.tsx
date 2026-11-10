/**
 * 後台操作對話框：收押金／取件／歸還（最後一張順便結算：填罰金、退押金）／退押金＋值班經手人選擇。
 * 經手人必選（追溯用）；訂單頁欄位裡已選好經手人時（lockedHandler）這裡只顯示、當作確認。樣式沿用 common/ConfirmDialog。
 * 大量設備預選了繳押金／取件時段（mass-pickup.sql）：收押金時可選「同時取件」，
 * 不勾＝只收押金（已繳待取件），之後再用 pickup 模式確認取件。
 * 歸還一律整單（2026-11-10）；提早還一部分走 ⋯ 選單的 partial，勾先還的品項，沒勾的拆子單。
 */

import { BTN } from '@/components/common/btn'
import CloseButton from '../common/CloseButton'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { penaltyOwed, suggestedDeposit, type AdminOrderRow } from '../../services/ordersService'
import { useBundles } from '../../services/equipmentService'
import { slotLabel, toDateKey } from '../../utils/timeUtils'
import { Select } from './adminUi'

export type AdminActionMode = 'paid' | 'pickup' | 'return' | 'partial' | 'penalty' | 'cancel' | 'extend' | 'handover' | 'refund'
// pickup = 已預繳者取件；penalty = 收罰款（押金抵完還差的）；cancel = 代取消；extend = 代客延期；
// handover = 點交學生取件後新增的設備（modify-order.sql）；refund = 退押金＝結算（填罰金；取消單沒有罰金）；
// partial = 部分歸還（期限內提早還一部分）

interface Props {
  order: AdminOrderRow
  mode: AdminActionMode
  staff: { name: string; onDuty: boolean }[] // 幹部（值班中排前面，選單來源）
  defaultHandler: string // 上次選擇的經手人（同班次免重選）
  estPenalty: number // 逾期試算罰金（退押金時預填，可修改）
  familyDeposit?: number // 整張單（根單＋子單）的押金，退押金用
  lockedHandler?: string // 已決定的經手人：學會成員＝本人（server 也會強制）、最高權限＝在訂單頁欄位選好的
  settleOnReturn?: boolean // 歸還的是整張單最後一張：同時填罰金、退押金
  onConfirm: (handler: string, penalty: number, itemIds: number[], days: number, pickup: boolean, depositTotal?: number) => void
  onCancel: () => void
}

const OrderActionDialog: React.FC<Props> = ({
  order,
  mode,
  staff,
  defaultHandler,
  estPenalty,
  familyDeposit = order.deposit_total,
  lockedHandler,
  settleOnReturn = false,
  onConfirm,
  onCancel
}) => {
  const [handler, setHandler] = useState(lockedHandler ?? (staff.some(s => s.name === defaultHandler) ? defaultHandler : ''))
  const [penalty, setPenalty] = useState(String(estPenalty))
  // 代客延期天數（1-7；更長分次延）
  const [days, setDays] = useState('1')
  // 收押金時是否同時取件：有預選取件時段（大量設備）才可選，不開放提前取件，到取件日才勾得到；其他單一律同時
  const hasPickupSlot = !!order.pickup_slot
  const pickupDay = order.pickup_date ?? order.start_date
  const canPickupNow = !hasPickupSlot || pickupDay <= toDateKey(new Date())
  const [pickupNow, setPickupNow] = useState(canPickupNow)

  // 部分歸還（情境 5-①）：勾先還的品項，預設全勾；整單歸還（return）不顯示勾選，一律全部
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
  const isPartialReturn = mode === 'partial' && returnIds.size > 0 && returnIds.size < order.order_items.length

  // 押金現場計算、系統記錄：點交新增設備，或已繳待取件的單繳押金後被學生改過品項 → 取件時一併記錄
  const pendingItems = order.order_items.filter(i => i.pickup_pending)
  const needDeposit =
    mode === 'handover' ||
    (mode === 'pickup' && !!order.items_updated_at && !!order.deposit_paid_at &&
      new Date(order.items_updated_at) > new Date(order.deposit_paid_at))
  // 建議值＝最新品項小計（套用設備組合）cap 5,000；系秘直借、老師名義（押金 0）維持 0
  const bundles = useBundles()
  const suggested = order.deposit_total === 0 ? 0 : suggestedDeposit(order.order_items, bundles)
  const [deposit, setDeposit] = useState(String(suggested))
  // 組合非同步載入：載到後更新預填值（通常在學會開始輸入前）
  useEffect(() => { setDeposit(String(suggested)) }, [suggested])
  const depositNum = parseInt(deposit, 10)
  const depositValid = !needDeposit || (!Number.isNaN(depositNum) && depositNum >= 0)

  // 按 ESC 鍵關閉
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])

  // 退押金＝結算（2026-11-08）：罰金由學會填（逾期、損壞、遺失，系統不知道狀況），從押金扣，超過的差額要學生繳清。
  // 2026-11-10 起整張單最後一張歸還時就一起結（settleOnReturn），退押金鈕只剩取消單與補結用
  const settling = (mode === 'refund' && order.status === 'returned') || (mode === 'return' && settleOnReturn)
  const penaltyNum = parseInt(penalty, 10)
  const penaltyValid = !settling || (!Number.isNaN(penaltyNum) && penaltyNum >= 0)
  const daysNum = parseInt(days, 10)
  const daysValid = mode !== 'extend' || (!Number.isNaN(daysNum) && daysNum >= 1 && daysNum <= 7)
  const canConfirm =
    handler !== '' && penaltyValid && daysValid && depositValid && (mode !== 'partial' || isPartialReturn)

  const title =
    mode === 'paid' ? '確認收押金'
    : mode === 'pickup' ? '確認取件'
    : mode === 'penalty' ? '收罰款'
    : mode === 'cancel' ? '代取消訂單'
    : mode === 'extend' ? '代客延期'
    : mode === 'handover' ? '點交新增設備'
    : mode === 'refund' ? (familyDeposit > 0 ? '退押金' : '結算')
    : mode === 'partial' ? '部分歸還'
    : settling && familyDeposit > 0 ? '確認歸還並退押金'
    : '確認歸還'

  // 代客延期的新歸還日預覽
  const newEndDate = (() => {
    if (mode !== 'extend' || !daysValid) return null
    const d = new Date(order.end_date)
    d.setDate(d.getDate() + daysNum)
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
  })()
  const field =
    'bg-black border border-gray-mid rounded-lg px-3 py-1.5 text-xs text-white focus:border-white outline-none w-full'

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onCancel}
    >
      <div
        className="relative bg-gray-darker border border-gray-mid max-w-lg w-full mx-4 rounded-2xl max-md:max-h-[calc(100dvh-2rem)] max-md:overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        <CloseButton onClick={onCancel} className="absolute top-6 right-6" />
        {/* 標題區 */}
        <div className="px-6 pt-6 pr-14">
          <h2 className="text-sm text-white font-normal">{title}</h2>
          <p className="font-english text-xs text-gray-light mt-1">
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

          {/* 整單歸還但還有子單沒還：押金先不結 */}
          {mode === 'return' && !settleOnReturn && (
            <p className="text-xs text-white font-chinese">這張單的東西全部收回。還有子單沒還，押金等全部還完再一起結。</p>
          )}

          {/* 退押金：取消單整筆退；歸還的單填罰金，扣完退還，超過押金的差額要同學繳 */}
          {(mode === 'refund' || settling) && (
            <p className="text-xs text-white font-chinese">
              押金 <span className="font-english">NT$ {familyDeposit.toLocaleString()}</span>{!settling && '，退還現金後按確認。'}
            </p>
          )}
          {settling && (
            <div>
              <label className="text-gray-light text-xs block mb-2">
                罰金（逾期、損壞或遺失，沒有就填 0）
                {estPenalty > 0 && <span className="font-chinese ml-2">逾期試算 NT$ {estPenalty.toLocaleString()}</span>}
              </label>
              <input
                type="number"
                min="0"
                value={penalty}
                onChange={e => setPenalty(e.target.value)}
                className={`${field} font-english`}
              />
              {penaltyValid && (
                <p className="text-xs text-white font-chinese mt-2">
                  退還 <span className="font-english">NT$ {Math.max(familyDeposit - penaltyNum, 0).toLocaleString()}</span>
                  {penaltyNum > familyDeposit && (
                    <>，同學還要繳 <span className="font-english">NT$ {(penaltyNum - familyDeposit).toLocaleString()}</span>，繳清這筆單才算結束</>
                  )}
                </p>
              )}
            </div>
          )}

          {/* 老師名義：押金 0，核對證明才算數 */}
          {mode === 'paid' && order.as_teacher && (
            <p className="text-xs text-white font-chinese">
              老師名義（{order.teacher}）：核對證明文件後按確認，押金 <span className="font-english">NT$ 0</span>。不符請取消訂單。
            </p>
          )}

          {/* 代客延期：天數輸入＋新歸還日預覽（不受僅乙次／前三天限制；撞期照擋） */}
          {mode === 'extend' && (
            <div>
              <label className="text-gray-light text-tiny block mb-2">
                延期天數（1-7，更長分次延）
              </label>
              <input
                type="number"
                min="1"
                max="7"
                value={days}
                onChange={e => setDays(e.target.value)}
                className={`${field} font-english`}
              />
              <p className="text-tiny text-gray-light font-chinese mt-2">
                原歸還日 <span className="font-english">{order.end_date}</span>
                {newEndDate && <>，延期後為 <span className="font-english">{newEndDate}</span></>}
                {order.status === 'overdue' && '；逾期單延期後將回到「租借中」。'}
              </p>
            </div>
          )}

          {/* 收押金（大量設備有預選時段）：顯示學生預約的時段＋是否同時取件 */}
          {mode === 'paid' && hasPickupSlot && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-light font-chinese">
                學生預約：繳押金 {order.deposit_date && order.deposit_slot
                  ? slotLabel({ date: order.deposit_date, slot: order.deposit_slot }) : '—'}
                ；取件 {slotLabel({ date: pickupDay, slot: order.pickup_slot! })}
              </p>
              <label className={`flex items-center gap-3 text-xs ${canPickupNow ? 'text-white cursor-pointer' : 'text-gray-light cursor-not-allowed'}`}>
                <input
                  type="checkbox"
                  className="custom-checkbox flex-shrink-0"
                  checked={pickupNow}
                  disabled={!canPickupNow}
                  onChange={e => setPickupNow(e.target.checked)}
                />
                <span className="font-chinese">
                  {canPickupNow ? '同時取件（設備當場交付，租借開始；不勾＝只收押金，之後再取件）' : '還沒到取件日，這次只收押金'}
                </span>
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
              <p className="text-gray-light mb-2">學生取件後新增的設備，交付後按確認：</p>
              {pendingItems.map(i => (
                <div key={i.id}>{i.name} <span className="font-english text-gray-light">×{i.quantity}</span></div>
              ))}
            </div>
          )}

          {/* 押金（現場計算，系統只記錄）：預填最新品項的建議值，可修改 */}
          {needDeposit && (
            <div>
              <label className="text-gray-light text-xs block mb-2">
                押金總額（現場計算後填入）
              </label>
              <input
                type="number"
                min="0"
                value={deposit}
                onChange={e => setDeposit(e.target.value)}
                className={`${field} font-english`}
              />
              <p className="text-xs text-gray-light font-chinese mt-2">
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
              未繳罰款 <span className="font-english">NT$ {penaltyOwed(order).toLocaleString()}</span>
              ，收款後這筆單結束，學生即可恢復預約。
            </p>
          )}

          {/* 值班經手人：已決定的只顯示（確認用）；共用的最高權限帳號從 ⋯ 選單或按鈕進來才要選 */}
          {lockedHandler && (
            <p className="text-xs text-gray-light font-chinese">經手人 <span className="text-white">{lockedHandler}</span></p>
          )}
          {!lockedHandler && (
            <div>
              <label className="text-gray-light text-xs block mb-2">
                值班經手人
              </label>
              {staff.length === 0 ? (
                <p className="text-xs font-chinese" style={{ color: 'var(--color-error)' }}>
                  尚無系學會成員，請先到「會員管理 Members」把幹部的身分設為系學會
                </p>
              ) : (
                // 值班中的幹部排前面並分組標示；沒人值班時就是一般清單（代班都選得到）
                <Select
                  value={handler}
                  onChange={setHandler}
                  options={staff.map(s => ({
                    value: s.name,
                    label: s.name,
                    group: staff.some(x => x.onDuty) ? (s.onDuty ? '值班中' : '其他') : undefined
                  }))}
                  className="font-chinese w-full"
                />
              )}
            </div>
          )}

          {/* 部分歸還（情境 5-①）：勾先還的品項，至少留一項沒勾；沒勾的拆子單續租 */}
          {mode === 'partial' && (
            <div>
              <label className="text-gray-light text-xs block mb-2">
                先還的品項（沒勾的拆成子單繼續租借；全部都還請用「歸還」欄）
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
                    {item.quantity > 1 && <span className="font-english text-gray-light">×{item.quantity}</span>}
                  </label>
                ))}
              </div>
              {isPartialReturn && (
                <p className="text-xs text-gray-light font-chinese mt-2">
                  部分歸還：未勾選品項將拆為子單（歸還日不變），續走逾期／延期流程；押金等全部歸還後一次結算。
                </p>
              )}
            </div>
          )}
        </div>

        {/* 橫線 */}
        <div className="px-6">
          <div className="border-t border-gray-mid"></div>
        </div>

        {/* 按鈕區 */}
        <div className="px-6 py-4 flex justify-end gap-6">
          <button onClick={onCancel} className={`text-gray-light ${BTN}`}>
            <span className="text-xs">取消</span>
          </button>
          <button
            onClick={() =>
              canConfirm &&
              onConfirm(
                handler,
                settling ? penaltyNum : 0,
                [...returnIds],
                mode === 'extend' ? daysNum : 0,
                mode === 'pickup' || pickupNow,
                needDeposit ? depositNum : undefined
              )
            }
            disabled={!canConfirm}
            className={`text-white ${BTN}`}
          >
            <span className="text-xs">確認</span>
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
