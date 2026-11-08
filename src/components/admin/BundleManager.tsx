/**
 * 後台 · 設備管理 › 組合（equipment-bundles.sql）
 * 設定哪些設備湊成一組、各要幾個、一組押金多少。學生同一張設備單湊滿一組 → 押金只收一組、
 * 9 件額度／大量 10 件門檻算 1 件；湊不滿照單件計。同一設備可屬多個組合（先建的優先湊）。
 * 學生端加入組合內的設備時會提示整組借（EquipmentGrid）。改完學生端重新整理生效。
 * 清單資料由父層（AdminEquipmentPage）載入並傳入；新增／修改走同一個對話框（FormDialog）。
 */

import { BTN } from '@/components/common/btn'
import React, { useEffect, useState } from 'react'
import { saveBundle, deleteBundle, uploadImage, imageSrc } from '../../services/adminService'
import type { AdminEquipment, BundleFields, AdminBundle } from '../../services/adminService'
import { useConfirmDialog } from '../../hooks/useConfirmDialog'
import { useToast } from '../../hooks/useToast'
import { inputCls, iconFillBtn, tableTh as th, tableTd as td, Select, FormDialog, Field, NumberInput, ImagePicker, Thumb } from './adminUi'
import { EQUIPMENT_CATEGORIES } from '../../types/equipment'

// 一組押金預設 500（規則：整組借只收一份單件押金），admin 可改
const EMPTY: BundleFields = { name: '', en_name: '', deposit: 500, items: [] }

const BundleManager: React.FC<{
  equipment: AdminEquipment[]
  bundles: AdminBundle[]
  /** 父層搜尋列的字串：篩組合名稱或內容裡的設備名 */
  search?: string
  reload: () => Promise<void>
  /** 父層要開新增對話框＝預填的品項（標題列「新增組合」＝[]；設備頁選取「組成組合」＝勾選的設備各 1 個）；false＝沒開。關閉時呼叫 onAddClose */
  adding: false | BundleFields['items']
  onAddClose: () => void
}> = ({ equipment, bundles, search = '', reload, adding, onAddClose }) => {
  const [busy, setBusy] = useState(false)
  // 對話框：id＝null 為新增；一次只開一個。file／preview＝這次選的新圖（按確定才上傳）
  const [editing, setEditing] = useState<{
    id: string | null; f: BundleFields; imageUrl: string | null; file?: File; preview?: string
  } | null>(null)
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast, toastElement } = useToast()

  // ponytail: 新增鈕在父層，用旗標開對話框；關閉時回報父層把旗標清掉
  useEffect(() => { if (adding) setEditing({ id: null, f: { ...EMPTY, items: adding }, imageUrl: null }) }, [adding])
  const close = () => {
    if (editing?.preview) URL.revokeObjectURL(editing.preview)
    setEditing(null)
    onAddClose()
  }
  const pickImage = (file: File) => setEditing(e => {
    if (!e) return e
    if (e.preview) URL.revokeObjectURL(e.preview)
    return { ...e, file, preview: URL.createObjectURL(file) }
  })

  const byId = Object.fromEntries(equipment.map(e => [e.id, e]))
  const nameOf = (id: string) => byId[id]?.name ?? '（已刪除的設備）'
  const q = search.trim().toLowerCase()
  const visible = q ? bundles.filter(b => b.name.toLowerCase().includes(q) || (b.en_name ?? '').toLowerCase().includes(q) || b.items.some(i => nameOf(i.equipmentId).toLowerCase().includes(q))) : bundles
  // 單件合計：同一組照單件押金算的話要多少，方便和組合押金比較
  const itemsTotal = (f: BundleFields) => f.items.reduce((s, i) => s + (byId[i.equipmentId]?.deposit ?? 0) * i.quantity, 0)

  // 設備選單依固定分類分組；下架的也列出（標示）但排在後面
  const categories = [
    ...EQUIPMENT_CATEGORIES.map(c => c.zh),
    ...new Set(equipment.map(e => e.category).filter(c => !EQUIPMENT_CATEGORIES.some(k => k.zh === c)))
  ]
  const equipmentOptions = (exclude: string[]) => categories.flatMap(c =>
    equipment
      .filter(e => e.category === c && !exclude.includes(e.id))
      .sort((a, b) => Number(b.is_active) - Number(a.is_active))
      .map(e => ({ value: e.id, label: `${e.name}${e.is_active ? '' : '（已下架）'}`, group: c }))
  )

  const validate = (f: BundleFields): string | null => {
    if (!f.name.trim()) return '請輸入組合名稱'
    if (f.deposit < 0) return '押金不可為負'
    if (f.items.reduce((s, i) => s + i.quantity, 0) < 2) return '組合至少要有 2 件設備'
    return null
  }

  const handleSave = async () => {
    if (!editing) return
    const err = validate(editing.f)
    if (err) { showToast(err); return }
    setBusy(true)
    const res = await saveBundle(editing.id, { ...editing.f, name: editing.f.name.trim(), en_name: editing.f.en_name?.trim() || null })
    if (!res.ok) { setBusy(false); showToast(res.message ?? '儲存失敗'); return }
    // 新選的圖片在組合存好後才上傳（新增時要先有 id）
    const id = editing.id ?? res.id
    const up = editing.file && id ? await uploadImage('equipment_bundles', id, editing.file) : { ok: true as const }
    setBusy(false)
    showToast(
      up.ok ? `已${editing.id ? '更新' : '新增'}「${editing.f.name.trim()}」` : `資料已存，圖片上傳失敗：${up.message ?? ''}`,
      up.ok ? 'success' : undefined
    )
    close()
    await reload()
  }

  const handleDelete = async (r: AdminBundle) => {
    const ok = await confirm({
      title: '刪除組合',
      message: `刪除「${r.name}」？之後這些設備照單件押金計算（已送出的訂單押金不受影響）。`,
      confirmTextZh: '刪除', variant: 'danger'
    })
    if (!ok) return
    const res = await deleteBundle(r.id)
    if (!res.ok) { showToast(res.message ?? '刪除失敗'); return }
    showToast(`已刪除「${r.name}」`, 'success')
    await reload()
  }

  const setF = (patch: Partial<BundleFields>) => setEditing(e => (e ? { ...e, f: { ...e.f, ...patch } } : e))
  const setItemQty = (idx: number, q: number) =>
    setF({ items: editing!.f.items.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, q) } : it)) })

  return (
    <>
      {/* border-separate：表頭 sticky 時底線才跟著走 */}
      <table className="w-full text-xs border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-gray-light">
            <th className={`${th} w-48`}>名稱</th>
            <th className={th}>一組內容</th>
            <th className={`${th} w-28 text-center`}>押金/組</th>
            <th className={`${th} w-28 text-center`}>單件合計</th>
            <th className={`${th} w-32 text-center`}>操作</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(r => (
            <tr key={r.id} className="hover:bg-white/10">
              <td className={td}>
                <div className="flex items-center gap-3">
                  {/* 沒圖＝灰底組合 icon（不沿用設備的預設圖） */}
                  <Thumb src={r.image_url ? imageSrc(r.image_url) : null} alt={r.name} icon="inventory_2" />
                  <div>
                    <div className="font-chinese">{r.name}</div>
                    {r.en_name && <div className="font-english text-gray-light">{r.en_name}</div>}
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 font-chinese text-gray-light border-b border-gray-mid">
                {r.items.map(i => `${nameOf(i.equipmentId)} ×${i.quantity}`).join('、')}
              </td>
              <td className={`${td} font-english text-center`}>NT$ {r.deposit.toLocaleString()}</td>
              <td className={`${td} font-english text-center text-gray-light`}>NT$ {itemsTotal(r).toLocaleString()}</td>
              <td className={`${td} text-center`}>
                <div className="inline-flex items-center gap-3">
                  <button
                    onClick={() => setEditing({ id: r.id, f: { name: r.name, en_name: r.en_name, deposit: r.deposit, items: r.items }, imageUrl: r.image_url })}
                    title="修改" aria-label="修改" className={iconFillBtn}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                  </button>
                  <button onClick={() => handleDelete(r)} className={`${BTN} font-chinese`} style={{ color: 'var(--color-error)' }}>
                    刪除
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {visible.length === 0 && (
        <div className="py-16 text-center text-xs text-gray-light font-chinese">尚未設定組合（所有設備照單件押金計算）</div>
      )}

      {/* 新增／修改組合：同一個對話框 */}
      {editing && (
        <FormDialog
          title={editing.id ? '修改組合' : '新增組合'}
          confirmZh={editing.id ? '確定修改' : '新增'}
          busy={busy}
          onConfirm={handleSave}
          onCancel={close}
          wide
        >
          <div className="flex gap-8">
            <div className="shrink-0">
              {/* 同設備對話框：左圖（沒圖＝虛線 placeholder），按確定才上傳 */}
              <ImagePicker
                src={editing.preview ?? (editing.imageUrl ? imageSrc(editing.imageUrl) : null)}
                alt={editing.f.name || '組合圖片'}
                size={160}
                caption={editing.preview || editing.imageUrl ? '更換圖片' : '選擇圖片'}
                onPick={pickImage}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              <Field zh="組合名稱" required>
                <input
                  type="text" value={editing.f.name} onChange={e => setF({ name: e.target.value })}
                  placeholder="例：木桌組" className={`${inputCls} w-full font-chinese`} autoFocus
                />
              </Field>
              <Field zh="英文名稱">
                <input
                  type="text" value={editing.f.en_name ?? ''} onChange={e => setF({ en_name: e.target.value })}
                  placeholder="空白＝英文介面顯示中文名稱" className={`${inputCls} w-full font-english`}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field zh="押金/組">
                  <NumberInput value={editing.f.deposit} onChange={n => setF({ deposit: n })} step={50} />
                </Field>
                <Field zh="單件合計">
                  <span className={`${inputCls} w-full font-english text-gray-light border-transparent !px-0`}>
                    NT$ {itemsTotal(editing.f).toLocaleString()}
                  </span>
                </Field>
              </div>

              {/* 組合內容：每列一項設備＋一組需要幾個 */}
              <Field zh="一組內容（至少 2 件）" required>
                <div className="flex flex-col gap-2">
                  {editing.f.items.map((it, idx) => (
                    <div key={it.equipmentId} className="flex items-center gap-3">
                      <span className="flex-1 text-xs text-white font-chinese">{nameOf(it.equipmentId)}</span>
                      <label className="flex items-center gap-1 text-xs text-gray-light font-chinese">×
                        <NumberInput value={it.quantity} onChange={n => setItemQty(idx, n)} min={1} className="w-24" />
                      </label>
                      <button
                        type="button"
                        onClick={() => setF({ items: editing.f.items.filter((_, i) => i !== idx) })}
                        aria-label="移除" title="移除"
                        className={`flex items-center text-gray-light ${BTN}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                      </button>
                    </div>
                  ))}
                  <Select
                    value=""
                    onChange={equipmentId => setF({ items: [...editing.f.items, { equipmentId, quantity: 1 }] })}
                    placeholder="＋ 加入設備"
                    searchable
                    options={equipmentOptions(editing.f.items.map(i => i.equipmentId))}
                    className="font-chinese w-full"
                  />
            </div>
          </Field>
            </div>
          </div>
        </FormDialog>
      )}
      <ConfirmDialog />
      {toastElement}
    </>
  )
}

export default BundleManager
