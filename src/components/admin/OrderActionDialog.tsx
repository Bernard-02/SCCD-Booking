/**
 * 後台操作對話框：收押金／歸還（逾期時含罰款確認）＋值班經手人選擇。
 * 經手人必選（追溯用）；樣式沿用 common/ConfirmDialog。
 */

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AdminOrderRow } from '../../services/ordersService'

interface Props {
  order: AdminOrderRow
  mode: 'paid' | 'return'
  staff: { name: string; onDuty: boolean }[] // 幹部（值班中排前面，選單來源）
  defaultHandler: string // 上次選擇的經手人（同班次免重選）
  estPenalty: number // 逾期試算罰款（overdue 時預填，可修改）
  onConfirm: (handler: string, penalty: number, itemIds: number[]) => void // 歸還模式：勾選的「已歸還」品項
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
  const chargePenalty = isOverdue && returnKind === 'late'

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

  // 按 ESC 鍵關閉
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])

  const penaltyNum = parseInt(penalty, 10)
  const penaltyValid = !chargePenalty || (!Number.isNaN(penaltyNum) && penaltyNum >= 0)
  const canConfirm = handler !== '' && penaltyValid && (mode !== 'return' || returnIds.size > 0)

  const title = mode === 'paid' ? { en: 'Deposit', zh: '確認收押金' } : { en: 'Return', zh: '確認歸還' }
  const field =
    'bg-black border border-gray-scale4 rounded-lg px-3 py-1.5 text-tiny text-white focus:border-white outline-none w-full'

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
          <h2 className="font-english text-small-title text-white font-normal">
            {title.en} <span className="font-chinese">{title.zh}</span>
          </h2>
          <p className="font-english text-tiny text-gray-scale2 mt-1">
            {order.rental_number} · <span className="font-chinese">{order.students?.name ?? '—'}</span>
            {' '}· NT$ {order.deposit_total.toLocaleString()}
          </p>
        </div>

        {/* 內容區 */}
        <div className="px-6 py-5 flex flex-col gap-5">
          {/* 值班經手人 */}
          <div>
            <label className="text-gray-scale2 text-tiny block mb-2">
              <span className="font-english">Handled by</span> <span className="font-chinese">值班經手人</span>
            </label>
            {staff.length === 0 ? (
              <p className="text-tiny font-chinese" style={{ color: 'var(--color-error2)' }}>
                尚無幹部，請先到「幹部名單 Staff」新增成員
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
              <label className="text-gray-scale2 text-tiny block mb-2">
                <span className="font-english">Returned items</span>{' '}
                <span className="font-chinese">已歸還品項（未勾選者拆為子單繼續租借）</span>
              </label>
              <div className="flex flex-col gap-2">
                {order.order_items.map(item => (
                  <label key={item.id} className="flex items-center gap-3 text-tiny text-white cursor-pointer">
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
                <p className="text-tiny text-gray-scale2 font-chinese mt-2">
                  部分歸還：未勾選品項將拆為子單（歸還日不變），續走逾期／延期／罰款流程。
                </p>
              )}
            </div>
          )}

          {/* 已標逾期的單：下拉區分準時歸還（免罰）／逾期歸還（計罰款）——情境 6 定案 2026-09-26 */}
          {isOverdue && (
            <div>
              <label className="text-gray-scale2 text-tiny block mb-2">
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
              <label className="text-gray-scale2 text-tiny block mb-2">
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
            </div>
          )}
          {mode === 'return' && !isOverdue && (
            <p className="text-tiny text-gray-scale2 font-chinese">準時歸還，無罰款。</p>
          )}
        </div>

        {/* 橫線 */}
        <div className="px-6">
          <div className="border-t border-[#545454]"></div>
        </div>

        {/* 按鈕區 */}
        <div className="px-6 py-4 flex justify-end gap-6">
          <button onClick={onCancel} className="text-gray-scale2 hover:text-white transition-colors cursor-pointer">
            <span className="font-english text-tiny">
              Cancel <span className="font-chinese">取消</span>
            </span>
          </button>
          <button
            onClick={() => canConfirm && onConfirm(handler, chargePenalty ? penaltyNum : 0, [...returnIds])}
            disabled={!canConfirm}
            className={`transition-opacity ${
              canConfirm ? 'text-white hover:opacity-70 cursor-pointer' : 'text-gray-scale3 cursor-not-allowed'
            }`}
          >
            <span className="font-english text-tiny">
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
