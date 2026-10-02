/**
 * 後台 · 設備管理（設定段）
 * 新增／編輯（名稱、分類、總量、押金）／軟性下架（is_active，不實刪）。
 * 只填總量——可借數由訂單佔用即時算，不用手動維護在庫（見 adminService withStock）。
 * 前台只撈 is_active=true：下架即從學生端消失（重新整理生效），歷史訂單不受影響
 * （order_items 冗餘存名稱）。寫入權限由 RLS 把關（admin only）。
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  listEquipmentAdmin, addEquipment, updateEquipment, setEquipmentActive, imageSrc, uploadImage
} from '../services/adminService'
import type { AdminEquipment, EquipmentFields } from '../services/adminService'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useToast } from '../hooks/useToast'
import { PageTitle, actionBtn, inputCls, listHeadCls, listRowCls, HeadCell, ImagePicker, EditIconBtn, usePager, Pager, LoadError } from '../components/admin/adminUi'
import { EQUIPMENT_CATEGORIES } from '../types/equipment'

// 圖片／名稱／分類／總量／押金／狀態／操作
const cols = 'grid-cols-[40px_1fr_120px_100px_120px_90px_200px]'
const numCls = `${inputCls} w-20 text-center font-english`

const EMPTY: EquipmentFields = { name: '', category: '', original_quantity: 0, deposit: 0 }

const AdminEquipmentPage: React.FC = () => {
  const [rows, setRows] = useState<AdminEquipment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast, toastElement } = useToast()

  // 新增表單
  const [draft, setDraft] = useState<EquipmentFields>(EMPTY)
  // 列編輯：一次只開一列
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EquipmentFields>(EMPTY)

  const load = () => listEquipmentAdmin()
    .then(r => { setRows(r); setLoadError(null) })
    .catch(e => setLoadError(e?.message ?? '未知錯誤'))
    .finally(() => setLoading(false))
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q))
  }, [rows, search])
  const { pageRows, pager } = usePager(filtered, [search])

  const validate = (f: EquipmentFields): string | null => {
    if (!f.name.trim()) return '請輸入名稱'
    if (!f.category) return '請選擇分類'
    if (f.original_quantity < 0 || f.deposit < 0) return '數字不可為負'
    return null
  }

  const handleAdd = async () => {
    const err = validate(draft)
    if (err) { showToast(err); return }
    setBusy(true)
    const res = await addEquipment({ ...draft, name: draft.name.trim(), category: draft.category.trim() })
    setBusy(false)
    if (!res.ok) { showToast(res.message ?? '新增失敗'); return }
    showToast(`已新增「${draft.name.trim()}」`, 'success')
    setDraft(EMPTY)
    await load()
  }

  const startEdit = (r: AdminEquipment) => {
    setEditingId(r.id)
    setEditDraft({
      name: r.name, category: r.category,
      original_quantity: r.original_quantity, deposit: r.deposit
    })
  }

  const handleSave = async (id: string) => {
    const err = validate(editDraft)
    if (err) { showToast(err); return }
    setBusy(true)
    const res = await updateEquipment(id, { ...editDraft, name: editDraft.name.trim(), category: editDraft.category.trim() })
    setBusy(false)
    if (!res.ok) { showToast(res.message ?? '儲存失敗'); return }
    showToast(`已更新「${editDraft.name.trim()}」`, 'success')
    setEditingId(null)
    await load()
  }

  const handleToggleActive = async (r: AdminEquipment) => {
    const ok = await confirm(r.is_active
      ? {
          title: '下架設備', titleEn: 'Deactivate',
          message: `下架「${r.name}」？前台將不再顯示（資料保留，可隨時上架）。`,
          confirmText: 'Deactivate', confirmTextZh: '下架', variant: 'danger'
        }
      : {
          title: '上架設備', titleEn: 'Activate',
          message: `重新上架「${r.name}」？前台將恢復顯示。`,
          confirmText: 'Activate', confirmTextZh: '上架'
        })
    if (!ok) return
    const res = await setEquipmentActive(r.id, !r.is_active)
    if (!res.ok) { showToast(res.message ?? '操作失敗'); return }
    showToast(`已${r.is_active ? '下架' : '上架'}「${r.name}」`, 'success')
    await load()
  }

  const handleImage = async (id: string, file: File) => {
    setUploadingId(id)
    const res = await uploadImage('equipment', id, file)
    setUploadingId(null)
    if (!res.ok) { showToast(res.message ?? '上傳失敗'); return }
    showToast(`已更換「${rows.find(r => r.id === id)?.name ?? id}」的圖片`, 'success')
    await load()
  }

  // 數字輸入的共用 onChange（空字串暫記 0）
  const num = (v: string) => Math.max(0, parseInt(v, 10) || 0)

  const fieldInputs = (f: EquipmentFields, set: (f: EquipmentFields) => void) => ({
    name: (
      <input type="text" value={f.name} onChange={e => set({ ...f, name: e.target.value })}
        placeholder="名稱" className={`${inputCls} font-chinese w-full max-w-[16rem]`} />
    ),
    // 分類只能選固定清單（前台篩選靠完全相符）；舊資料若有清單外的值仍列出，避免開編輯就被默默改掉
    category: (
      <select value={f.category} onChange={e => set({ ...f, category: e.target.value })}
        className="bg-black border border-gray-scale4 rounded-lg px-2 py-1.5 text-xs text-white focus:border-white outline-none font-chinese cursor-pointer w-full max-w-[9rem]">
        <option value="" disabled>選擇分類</option>
        {EQUIPMENT_CATEGORIES.map(c => <option key={c.zh} value={c.zh}>{c.zh}</option>)}
        {f.category && !EQUIPMENT_CATEGORIES.some(c => c.zh === f.category) && (
          <option value={f.category}>{f.category}（清單外）</option>
        )}
      </select>
    ),
    original: (
      <input type="number" min={0} value={f.original_quantity}
        onChange={e => set({ ...f, original_quantity: num(e.target.value) })} className={numCls} />
    ),
    deposit: (
      <input type="number" min={0} step={50} value={f.deposit}
        onChange={e => set({ ...f, deposit: num(e.target.value) })} className={numCls} />
    )
  })

  const addInputs = fieldInputs(draft, setDraft)
  const editInputs = fieldInputs(editDraft, setEditDraft)

  return (
    // 撐滿視窗（扣 AdminLayout main 的 py-10 上下各 2.5rem）：標題／新增列／搜尋固定，只有清單區捲動
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      <PageTitle
        en="Equipment"
        zh="設備管理"
        desc="改主檔會影響前台顯示與可借數量；點圖片可更換（jpg／png／webp，5MB 內）；下架＝隱藏不刪除，歷史訂單不受影響。學生端重新整理後生效。"
      />

      {/* 新增列 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {addInputs.name}
        {addInputs.category}
        <label className="text-xs text-gray-scale2 font-chinese">總量 {addInputs.original}</label>
        <label className="text-xs text-gray-scale2 font-chinese">押金 {addInputs.deposit}</label>
        <button onClick={handleAdd} disabled={busy} className={actionBtn(!busy)}>
          <span className="font-english">Add <span className="font-chinese">新增</span></span>
        </button>
      </div>

      {/* 搜尋 */}
      <div className="mb-6">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋名稱／分類" className={`${inputCls} font-chinese min-w-[16rem]`}
        />
        <span className="ml-3 text-xs text-gray-scale3 font-chinese">{filtered.length} 項</span>
      </div>

      {loading ? (
        <div className="text-gray-scale2 text-xs font-chinese">載入中…</div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={() => { setLoading(true); void load() }} />
      ) : (
        // 清單區自己捲（直向＋視窗過窄時橫向，不壓縮名稱欄）；表頭黏在清單區頂端
        <div className="flex-1 min-h-0 overflow-auto">
          <div className={`${listHeadCls} ${cols} min-w-[60rem] sticky top-0 z-10 bg-black`}>
            <HeadCell en="Image" zh="圖片" />
            <HeadCell en="Name" zh="名稱" />
            <HeadCell en="Category" zh="分類" />
            <HeadCell en="Total Qty" zh="總數量" center />
            <HeadCell en="Deposit" zh="押金/個" center />
            <HeadCell en="Status" zh="狀態" center />
            <HeadCell en="Action" zh="操作" center />
          </div>

          {pageRows.map(r => {
            const editing = editingId === r.id
            return (
              <div key={r.id} className={`${listRowCls} ${cols} min-w-[60rem] text-sm ${!r.is_active ? 'opacity-50' : ''}`}>
                <ImagePicker src={imageSrc(r.image_url)} alt={r.name} busy={uploadingId === r.id}
                  onPick={f => handleImage(r.id, f)} />
                <div className="font-chinese">{editing ? editInputs.name : r.name}</div>
                <div className="font-chinese">{editing ? editInputs.category : r.category}</div>
                <div className="font-english text-center">{editing ? editInputs.original : r.original_quantity}</div>
                <div className="font-english text-center whitespace-nowrap">{editing ? editInputs.deposit : `NT$ ${r.deposit}`}</div>
                <div className="font-chinese text-center">
                  {r.is_active
                    ? <span style={{ color: 'var(--color-success)' }}>上架中</span>
                    : <span className="text-gray-scale3">已下架</span>}
                </div>
                <div className="flex justify-center items-center gap-4 whitespace-nowrap">
                  {editing ? (
                    <>
                      <button onClick={() => handleSave(r.id)} disabled={busy} className={actionBtn(!busy)}>
                        <span className="font-english">Save <span className="font-chinese">儲存</span></span>
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="text-gray-scale2 hover:!text-white transition-colors cursor-pointer">
                        <span className="font-english">Cancel <span className="font-chinese">取消</span></span>
                      </button>
                    </>
                  ) : (
                    <>
                      <EditIconBtn onClick={() => startEdit(r)} />
                      <button onClick={() => handleToggleActive(r)}
                        className="cursor-pointer hover:opacity-70 transition-opacity"
                        style={{ color: r.is_active ? 'var(--color-error2)' : 'var(--color-success)' }}>
                        {r.is_active
                          ? <><span className="font-english">Deactivate</span> <span className="font-chinese">下架</span></>
                          : <><span className="font-english">Activate</span> <span className="font-chinese">上架</span></>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-scale2">
              <p className="font-english">No Equipment Found</p>
              <p className="font-chinese">找不到符合條件的設備</p>
            </div>
          )}
        </div>
      )}

      {/* 分頁：放在捲動區外，固定在底部 */}
      {!loading && !loadError && <Pager {...pager} />}
      <ConfirmDialog />
      {toastElement}
    </div>
  )
}

export default AdminEquipmentPage
