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
  onConfirm: (handler: string, penalty: number) => void
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

  // 按 ESC 鍵關閉
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])

  const penaltyNum = parseInt(penalty, 10)
  const penaltyValid = !isOverdue || (!Number.isNaN(penaltyNum) && penaltyNum >= 0)
  const canConfirm = handler !== '' && penaltyValid

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
          <h2 className="font-english text-small-title text-white font-medium">
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

          {/* 罰款金額（僅逾期歸還） */}
          {isOverdue && (
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
            onClick={() => canConfirm && onConfirm(handler, isOverdue ? penaltyNum : 0)}
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
