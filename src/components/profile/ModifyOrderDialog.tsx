/**
 * 修改訂單品項（學生，order-lifecycle 情境 3）：小量／大量設備單改原單、不另開新單。
 * 取件前可增減、改數量；取件後只能加（已點交的不能減，新增的待學會點交）。
 * 可借數量＝庫存 − 該時段佔用＋本單原有數量；規則最終由 server 端 modify_my_order 把關。
 */

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEquipmentData, useBundles, fetchEquipmentReserved, type ReservedInfo } from '../../services/equipmentService'
import { calcBundles } from '../../utils/bundleUtils'
import { EQUIPMENT_CATEGORIES } from '../../types/equipment'
import { useT } from '../../stores/langStore'

/** 目前品項（同設備合併）；held＝已點交數量（取件後的下限，取件前為 0） */
export interface ModifyLine {
  id: string
  name: string
  deposit: number
  quantity: number
  held: number
}

interface Props {
  rentalNumber: string
  startDate: string // YYYY-MM-DD
  endDate: string
  isMass: boolean
  picked: boolean      // 已取件（租借中）：只能加
  depositPaid: boolean // 已繳押金：差額由學會現場計算
  lines: ModifyLine[]
  onConfirm: (items: { item_id: string; quantity: number }[]) => Promise<string | null> // 失敗回傳原因
  onCancel: () => void
}

const LITTLE_MAX = 9
const MASS_MIN = 10

const ModifyOrderDialog: React.FC<Props> = ({
  rentalNumber, startDate, endDate, isMass, picked, depositPaid, lines, onConfirm, onCancel
}) => {
  const t = useT()
  const equipmentData = useEquipmentData()
  const bundles = useBundles()
  const [reserved, setReserved] = useState<Record<string, ReservedInfo>>({})
  const [rows, setRows] = useState<ModifyLine[]>(lines)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEquipmentReserved(startDate, endDate).then(setReserved).catch(() => setReserved({}))
  }, [startDate, endDate])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])

  // 本單原有數量已算在佔用裡，要加回來才是這張單能用的上限
  const original = (id: string) => lines.find(l => l.id === id)?.quantity ?? 0
  const available = (id: string) =>
    Math.max(0, (equipmentData[id]?.originalQuantity ?? 0) - (reserved[id]?.reserved ?? 0) + original(id))
  const minQty = (r: ModifyLine) => (picked ? r.held : 0)

  const setQty = (id: string, q: number) =>
    setRows(prev => (q <= 0 ? prev.filter(r => r.id !== id) : prev.map(r => (r.id === id ? { ...r, quantity: q } : r))))

  const addItem = (id: string) => {
    const eq = equipmentData[id]
    if (!eq) return
    setRows(prev => [...prev, { id, name: eq.name, deposit: eq.deposit, quantity: 1, held: 0 }])
  }

  // 件數與押金套用組合（湊滿一組算 1 件、押金只收一組），同 server 端 modify_my_order
  const calc = calcBundles(rows, bundles)
  const total = calc.units
  const changed =
    rows.length !== lines.length || rows.some(r => r.quantity !== original(r.id))
  const limitError = !isMass && total > LITTLE_MAX
    ? t(`Light orders allow up to ${LITTLE_MAX} items`, `小量訂單最多 ${LITTLE_MAX} 件`)
    : isMass && total < MASS_MIN ? t(`Mass orders need at least ${MASS_MIN} items`, `大量訂單需滿 ${MASS_MIN} 件`) : null
  const canSave = changed && rows.length > 0 && !limitError && !busy

  const handleSave = async () => {
    if (!canSave) return
    setBusy(true)
    setError(null)
    const err = await onConfirm(rows.map(r => ({ item_id: r.id, quantity: r.quantity })))
    setBusy(false)
    if (err) setError(err)
  }

  // 新增選單：上架中、本單還沒有的設備，依固定分類分組
  const addable = Object.values(equipmentData).filter(e => !rows.some(r => r.id === e.id))
  const groups = [
    ...EQUIPMENT_CATEGORIES.map(c => c.zh),
    ...new Set(addable.map(e => e.category).filter(c => !EQUIPMENT_CATEGORIES.some(k => k.zh === c)))
  ]

  // − ＋ 純文字鈕（無外框，同型錄數量調整）；點擊區保留 28px
  const stepBtn = (enabled: boolean) =>
    `w-7 h-7 flex items-center justify-center text-sm font-['Inter',_sans-serif] ${
      enabled ? 'text-white hover:opacity-70 cursor-pointer' : 'text-gray-scale3 cursor-not-allowed'
    }`
  // 品項表格欄位：設備／可借／數量（表頭與每列共用；可借、數量置中）
  const cols = 'grid grid-cols-[1fr_64px_104px] gap-4 items-center'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center fadeIn"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onCancel}
    >
      <div
        className="bg-[#151515] border border-[#545454] rounded-2xl max-w-[640px] w-[90%] mx-4 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 標題 */}
        {/* 標題：修改訂單＋單號（單號不另起一行） */}
        <div className="px-6 pt-6 pb-4 border-b border-[#545454]">
          <div className="flex items-start justify-between">
            <h2 className="text-sm text-white">
              <span>{t('Edit Order', '修改訂單')}</span>
              <span className="ml-3 text-gray-scale2 font-['Inter',_sans-serif]">{rentalNumber}</span>
            </h2>
            <button onClick={onCancel} className="text-white hover:opacity-70 cursor-pointer -mt-1" aria-label="Close">
              <span className="material-icons text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-6 overflow-y-auto">
          {/* 規則 */}
          <div className="text-white text-xs space-y-1 mb-6 font-['Inter','Noto_Sans_TC',_sans-serif]">
            {picked ? (
              <>
                <p>1. 已取件的訂單只能新增設備；不需要的設備到期一起歸還即可。</p>
                <p>2. 新增的設備請於 24 工作時內至系學會點交{!isMass && '並補繳押金差額'}，逾時自動取消（原有設備不受影響）。</p>
              </>
            ) : (
              <p>1. 取件前可增減設備與數量，以最新內容為準。</p>
            )}
            <p>{picked ? 3 : 2}. {isMass ? `大量訂單需滿 ${MASS_MIN} 件。` : `小量訂單最多 ${LITTLE_MAX} 件。`}</p>
          </div>

          {/* 品項：表頭寫欄位名稱，下面只放數字 */}
          <div className="flex flex-col">
            <div className={`${cols} pb-2 border-b border-[#545454] text-2xs text-gray-scale2`}>
              <span>{t('Equipment', '設備')}</span>
              <span className="text-center">{t('Available', '可借')}</span>
              <span className="text-center">{t('Quantity', '數量')}</span>
            </div>
            {rows.map(r => {
              const max = available(r.id)
              const canDec = r.quantity > minQty(r) // 減到 0＝移除（取件後已點交的不可）
              return (
                <div key={r.id} className={`${cols} py-3 border-b border-[#545454]`}>
                  <span className="text-xs text-white font-['Inter','Noto_Sans_TC',_sans-serif]">
                    {r.name}
                    {picked && r.held > 0 && (
                      <span className="text-gray-scale2 ml-2">已取 {r.held}</span>
                    )}
                    {picked && r.quantity > r.held && (
                      <span className="ml-2" style={{ color: 'var(--color-yellow)' }}>新增 {r.quantity - r.held} 待點交</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-scale2 font-['Inter',_sans-serif] text-center">{max}</span>
                  <div className="flex items-center justify-center">
                    <button
                      className={stepBtn(canDec)}
                      disabled={!canDec}
                      onClick={() => setQty(r.id, r.quantity - 1)}
                      aria-label="減少"
                    >−</button>
                    <span className="w-8 text-center text-xs text-white font-['Inter',_sans-serif]">{r.quantity}</span>
                    <button
                      className={stepBtn(r.quantity < max)}
                      disabled={r.quantity >= max}
                      onClick={() => setQty(r.id, r.quantity + 1)}
                      aria-label="增加"
                    >+</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 新增設備 */}
          <select
            value=""
            onChange={e => addItem(e.target.value)}
            className="mt-4 w-full bg-black border border-gray-scale4 rounded-lg px-3 py-2 text-xs text-white focus:border-white outline-none cursor-pointer font-['Inter','Noto_Sans_TC',_sans-serif]"
          >
            <option value="" disabled>＋ {t('Add equipment', '新增設備')}</option>
            {groups.map(g => {
              const items = addable.filter(e => e.category === g)
              if (items.length === 0) return null
              return (
                <optgroup key={g} label={g}>
                  {items.map(e => {
                    const n = available(e.id)
                    return (
                      <option key={e.id} value={e.id} disabled={n <= 0}>
                        {e.name}（可借 {n}）
                      </option>
                    )
                  })}
                </optgroup>
              )
            })}
          </select>

          {/* 小計 */}
          <div className="mt-6 text-xs font-['Inter','Noto_Sans_TC',_sans-serif] flex justify-between">
            <span className={limitError ? '' : 'text-white'} style={limitError ? { color: 'var(--color-error2)' } : undefined}>
              共 <span className="font-['Inter',_sans-serif]">{total}</span> 件
              {calc.sets.length > 0 && `（含 ${calc.sets.map(s => `${s.bundle.name} ×${s.count}`).join('、')}，整組算 1 件）`}
              {limitError && `（${limitError}）`}
            </span>
            <span className="text-gray-scale2">
              {depositPaid
                ? '押金差額由系學會現場計算'
                : <>押金 <span className="font-['Inter',_sans-serif]">NT$ {Math.min(calc.deposit, 5000).toLocaleString()}</span></>}
            </span>
          </div>

          {error && (
            <p className="mt-3 text-xs font-['Inter','Noto_Sans_TC',_sans-serif]" style={{ color: 'var(--color-error2)' }}>{error}</p>
          )}

          <div className="border-t border-[#545454] my-4"></div>

          <div className="flex justify-end gap-6">
            <button onClick={onCancel} className="text-[#cccccc] hover:text-white cursor-pointer">
              <span className="font-['Inter',_sans-serif] text-xs">
                {t('Cancel', '取消')}
              </span>
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`${canSave ? 'text-white hover:opacity-70 cursor-pointer' : 'text-gray-scale3 cursor-not-allowed'}`}
            >
              <span className="font-['Inter',_sans-serif] text-xs">
                {t(busy ? 'Saving…' : 'Save', '儲存')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ModifyOrderDialog
