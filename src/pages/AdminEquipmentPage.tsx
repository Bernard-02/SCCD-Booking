/**
 * 後台 · 設備管理（設定段）
 * 版面同訂單頁：標題列右側＝新增設備／新增組合（開對話框）；計數分頁 設備／組合；搜尋列（左搜尋、右選取模式＋分類／狀態篩選）；
 * 表格（表頭可單欄排序）。選取模式同購物車：出現勾選欄、表頭全選；勾選的列切開關＝套用到所有勾選（批次上／下架）。
 * 設備新增／修改走同一個對話框（左圖右表單：圖片、名稱、分類、總量、押金）；圖片在對話框裡換（按確定才上傳，取消即丟棄）。
 * 上架狀態＝開關（下架先確認、上架直接切；軟性，is_active 不實刪）。
 * 只填總量——可借數由訂單佔用即時算，不用手動維護在庫（見 adminService withStock）。
 * 前台只撈 is_active=true：下架即從學生端消失（重新整理生效），歷史訂單不受影響（order_items 冗餘存名稱）。
 * 圖片只收 JPG／PNG、5MB 內（IMAGE_ACCEPT＋uploadImage 擋）。寫入權限由 RLS 把關（admin only）。
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  listEquipmentAdmin, listBundlesAdmin, addEquipment, updateEquipment, setEquipmentActive, setEquipmentActiveMany,
  imageSrc, uploadImage
} from '../services/adminService'
import type { AdminEquipment, EquipmentFields, AdminBundle } from '../services/adminService'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useToast } from '../hooks/useToast'
import {
  PageTitle, inputCls, textBtn, iconFillBtn, SearchBox, CountTabs, SelectControls, tableTh as th, tableTd as td,
  SortTh, toggleSort, sortRows, Thumb, ImagePicker, NumberInput, Switch, usePager, Pager, LoadError, Select, FormDialog, Field
} from '../components/admin/adminUi'
import type { Sort } from '../components/admin/adminUi'
import { EQUIPMENT_CATEGORIES } from '../types/equipment'
import BundleManager from '../components/admin/BundleManager'

const EMPTY: EquipmentFields = { name: '', category: '', original_quantity: 0, deposit: 0 }
const TABS = [{ key: 'equipment', zh: '設備' }, { key: 'bundle', zh: '組合' }] as const
type Tab = typeof TABS[number]['key']
type StatusFilter = 'all' | 'active' | 'inactive'
type SortField = 'name' | 'category' | 'original_quantity' | 'deposit' | 'is_active'

// 對話框狀態：id null＝新增；file／preview＝這次選的新圖（按確定才上傳）
type Dialog = { id: string | null; f: EquipmentFields; imageUrl: string | null; file?: File; preview?: string }

const AdminEquipmentPage: React.FC = () => {
  const [rows, setRows] = useState<AdminEquipment[]>([])
  const [bundles, setBundles] = useState<AdminBundle[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('equipment')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<Sort<SortField>>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null) // 上／下架處理中的那一列（防連點）
  const [dialog, setDialog] = useState<Dialog | null>(null)
  // 新增組合鈕在標題列，用旗標叫 BundleManager 開它的對話框；值＝預填品項（[]＝空白新增，選取模式「組成組合」＝勾選的設備）
  const [addingBundle, setAddingBundle] = useState<false | { equipmentId: string; quantity: number }[]>(false)
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast, toastElement } = useToast()

  const load = () => Promise.all([listEquipmentAdmin(), listBundlesAdmin()])
    .then(([e, b]) => { setRows(e); setBundles(b); setLoadError(null) })
    .catch(e => setLoadError(e?.message ?? '未知錯誤'))
    .finally(() => setLoading(false))
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      (!q || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)) &&
      (category === 'all' || r.category === category) &&
      (status === 'all' || r.is_active === (status === 'active'))
    )
  }, [rows, search, category, status])
  const sorted = useMemo(() => (sort ? sortRows(filtered, sort.dir, r => r[sort.field]) : filtered), [filtered, sort])
  const { pageRows, pager } = usePager(sorted, [search, category, status, sort])

  // 選取模式：切分頁即退出；全選＝目前篩選結果（不只這一頁）
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()) }
  useEffect(exitSelect, [tab])
  const selectedCount = filtered.filter(r => selected.has(r.id)).length
  const allSelected = filtered.length > 0 && selectedCount === filtered.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(r => r.id)))
  const toggleOne = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const validate = (f: EquipmentFields): string | null => {
    if (!f.name) return '請輸入名稱'
    if (!f.category) return '請選擇分類'
    if (f.original_quantity < 0 || f.deposit < 0) return '數字不可為負'
    return null
  }

  const closeDialog = () => {
    if (dialog?.preview) URL.revokeObjectURL(dialog.preview)
    setDialog(null)
  }
  const openDialog = (r?: AdminEquipment) => setDialog(r
    ? { id: r.id, f: { name: r.name, category: r.category, original_quantity: r.original_quantity, deposit: r.deposit }, imageUrl: r.image_url }
    : { id: null, f: EMPTY, imageUrl: null })
  const setF = (patch: Partial<EquipmentFields>) => setDialog(d => (d ? { ...d, f: { ...d.f, ...patch } } : d))
  const pickImage = (file: File) => setDialog(d => {
    if (!d) return d
    if (d.preview) URL.revokeObjectURL(d.preview)
    return { ...d, file, preview: URL.createObjectURL(file) }
  })

  const handleSubmit = async () => {
    if (!dialog) return
    const f = { ...dialog.f, name: dialog.f.name.trim(), category: dialog.f.category.trim() }
    const err = validate(f)
    if (err) { showToast(err); return }
    setBusy(true)
    const res: { ok: boolean; message?: string; id?: string } = dialog.id
      ? await updateEquipment(dialog.id, f)
      : await addEquipment(f)
    if (!res.ok) { setBusy(false); showToast(res.message ?? (dialog.id ? '儲存失敗' : '新增失敗')); return }
    // 新選的圖片在主檔存好後才上傳（新增時要先有 id）
    const id = dialog.id ?? res.id
    const up = dialog.file && id ? await uploadImage('equipment', id, dialog.file) : { ok: true as const }
    setBusy(false)
    showToast(up.ok ? `已${dialog.id ? '更新' : '新增'}「${f.name}」` : `資料已存，圖片上傳失敗：${up.message ?? ''}`, up.ok ? 'success' : undefined)
    closeDialog()
    await load()
  }

  // 開關：下架會讓學生端看不到，先確認；上架沒有副作用直接切
  const handleToggleActive = async (r: AdminEquipment) => {
    if (r.is_active) {
      const ok = await confirm({
        title: '下架設備',
        message: `下架「${r.name}」？前台將不再顯示（資料保留，可隨時上架）。`,
        confirmTextZh: '下架', variant: 'danger'
      })
      if (!ok) return
    }
    setTogglingId(r.id)
    const res = await setEquipmentActive(r.id, !r.is_active)
    if (!res.ok) { setTogglingId(null); showToast(res.message ?? '操作失敗'); return }
    showToast(`已${r.is_active ? '下架' : '上架'}「${r.name}」`, 'success')
    await load()
    setTogglingId(null)
  }

  // 批次上／下架：只動狀態會變的那些；下架一樣先確認
  const bulkSetActive = async (active: boolean) => {
    const ids = filtered.filter(r => selected.has(r.id) && r.is_active !== active).map(r => r.id)
    if (ids.length === 0) { showToast(active ? '選取的設備都已上架' : '選取的設備都已下架'); return }
    if (!active) {
      const ok = await confirm({
        title: '下架設備',
        message: `下架選取的 ${ids.length} 項設備？前台將不再顯示（資料保留，可隨時上架）。`,
        confirmTextZh: '下架', variant: 'danger'
      })
      if (!ok) return
    }
    setBusy(true)
    const res = await setEquipmentActiveMany(ids, active)
    setBusy(false)
    if (!res.ok) { showToast(res.message ?? '操作失敗'); return }
    showToast(`已${active ? '上架' : '下架'} ${ids.length} 項設備`, 'success')
    setSelected(new Set())
    await load()
  }

  const sortProps = { sort, onSort: (f: SortField) => setSort(s => toggleSort(s, f)) }

  return (
    // 撐滿內容區（AdminLayout main 固定 h-screen）：標題／分頁／搜尋固定，只有表格區捲動
    <div className="h-full flex flex-col">
      <PageTitle zh="設備管理">
        <button
          onClick={() => (tab === 'equipment' ? openDialog() : setAddingBundle([]))}
          className={textBtn(false)}
        >
          <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">add</span>
          {tab === 'equipment' ? '新增設備' : '新增組合'}
        </button>
      </PageTitle>

      {/* 搜尋列（分頁上方，同訂單頁）：左搜尋（常駐）；右＝選取模式、分類、狀態篩選 */}
      <div className="flex items-center gap-2 mb-4">
        <SearchBox value={search} onChange={setSearch} className="w-72 mr-auto" />
        {/* 組合分頁只有搜尋；選取、分類、狀態是設備的 */}
        {tab === 'equipment' && (<>
        <SelectControls
          mode={selectMode}
          count={selectedCount}
          onEnter={() => setSelectMode(true)}
          onExit={exitSelect}
          // 勾選的設備各 1 個帶去組合分頁開新增對話框（數量、押金、名稱在那裡填）
          actions={[{
            zh: '組成組合',
            onClick: () => {
              setAddingBundle(filtered.filter(r => selected.has(r.id)).map(r => ({ equipmentId: r.id, quantity: 1 })))
              exitSelect()
              setTab('bundle')
            }
          }]}
        />
        <Select
          value={category}
          onChange={setCategory}
          options={[{ value: 'all', label: '全部分類' }, ...EQUIPMENT_CATEGORIES.map(c => ({ value: c.zh, label: c.zh }))]}
          icon="category"
          filled
          className="font-chinese"
        />
        <Select<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[{ value: 'all', label: '全部狀態' }, { value: 'active', label: '上架中' }, { value: 'inactive', label: '已下架' }]}
          icon="filter_list"
          filled
          className="font-chinese"
        />
        </>)}
      </div>

      <CountTabs tabs={TABS} value={tab} onChange={setTab} counts={{ equipment: rows.length, bundle: bundles.length }} />

      {loading ? (
        <div className="text-gray-light text-xs font-chinese">載入中…</div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={() => { setLoading(true); void load() }} />
      ) : tab === 'bundle' ? (
        <div className="flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
          <BundleManager
            equipment={rows}
            bundles={bundles}
            search={search}
            reload={load}
            adding={addingBundle}
            onAddClose={() => setAddingBundle(false)}
          />
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
            {/* border-separate：表頭 sticky 時底線才跟著走（collapse 模式的 border 不會）。設備欄不給寬度、吃掉剩餘寬度 */}
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-gray-light">
                  {selectMode && (
                    <th className={`${th} w-10`}>
                      <input type="checkbox" className="custom-checkbox block" checked={allSelected} onChange={toggleAll} aria-label="全選" />
                    </th>
                  )}
                  <SortTh zh="設備" field="name" {...sortProps} />
                  <SortTh zh="分類" field="category" className="w-40" {...sortProps} />
                  <SortTh zh="總數量" field="original_quantity" className="w-28 text-center" {...sortProps} />
                  <SortTh zh="押金/個" field="deposit" className="w-32 text-center" {...sortProps} />
                  <SortTh zh="上架狀態" field="is_active" className="w-36 text-center" {...sortProps} />
                  <th className={`${th} w-24 text-center`}>操作</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => {
                  // 已下架：只淡化內容（不是整格），開關、修改鈕與儲存格底線維持原亮度
                  const dim = r.is_active ? '' : 'opacity-50'
                  return (
                    <tr key={r.id} className="hover:bg-white/10">
                      {selectMode && (
                        <td className={td}>
                          <input
                            type="checkbox" className="custom-checkbox block" checked={selected.has(r.id)}
                            onChange={() => toggleOne(r.id)} aria-label={`選取 ${r.name}`}
                          />
                        </td>
                      )}
                      <td className={td}>
                        <div className={`flex items-center gap-3 ${dim}`}>
                          {/* 沒上傳過圖＝灰底相機 icon（不沿用前台的預設延長線圖） */}
                          <Thumb src={r.image_url ? imageSrc(r.image_url) : null} alt={r.name} icon="photo_camera" />
                          <span className="font-chinese">{r.name}</span>
                        </div>
                      </td>
                      <td className={`${td} font-chinese`}><span className={dim}>{r.category}</span></td>
                      <td className={`${td} font-english text-center`}><span className={dim}>{r.original_quantity}</span></td>
                      <td className={`${td} font-english text-center`}><span className={dim}>NT$ {r.deposit.toLocaleString()}</span></td>
                      <td className={`${td} text-center`}>
                        {/* iOS 式開關：on＝上架中；下架先確認、上架直接切。選取模式下勾選的列：切一個＝套用到所有勾選 */}
                        <Switch
                          checked={r.is_active}
                          onChange={() => (selectMode && selected.has(r.id) ? bulkSetActive(!r.is_active) : handleToggleActive(r))}
                          busy={togglingId === r.id}
                          label={r.is_active ? '下架' : '上架'}
                        />
                      </td>
                      <td className={`${td} text-center`}>
                        <button onClick={() => openDialog(r)} title="修改" aria-label="修改" className={iconFillBtn}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="py-16 text-center text-xs text-gray-light font-chinese">找不到符合條件的設備</div>
            )}
          </div>

          {/* 分頁：放在捲動區外，固定在底部 */}
          <Pager {...pager} />
        </>
      )}

      {/* 新增／修改設備：同一個對話框，左圖右表單；新增時預設空白 */}
      {dialog && (
        <FormDialog
          title={dialog.id ? '修改設備' : '新增設備'}
          confirmZh={dialog.id ? '確定修改' : '新增'}
          busy={busy}
          onConfirm={handleSubmit}
          onCancel={closeDialog}
          wide
        >
          <div className="flex gap-8">
            <div className="shrink-0">
              {/* 還沒有圖（新增、或舊資料沒圖）→ 虛線 placeholder */}
              <ImagePicker
                src={dialog.preview ?? (dialog.imageUrl ? imageSrc(dialog.imageUrl) : null)}
                alt={dialog.f.name || '設備圖片'}
                size={160}
                caption={dialog.preview || dialog.imageUrl ? '更換圖片' : '選擇圖片'}
                onPick={pickImage}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              <Field zh="名稱" required>
                <input
                  type="text" value={dialog.f.name} onChange={e => setF({ name: e.target.value })}
                  className={`${inputCls} w-full font-chinese`} autoFocus
                />
              </Field>
              {/* 分類只能選固定清單（前台篩選靠完全相符）；舊資料若有清單外的值仍列出，避免開修改就被默默改掉 */}
              <Field zh="分類" required>
                <Select
                  value={dialog.f.category}
                  onChange={category => setF({ category })}
                  placeholder="選擇分類"
                  options={[
                    ...EQUIPMENT_CATEGORIES.map(c => ({ value: c.zh, label: c.zh })),
                    ...(dialog.f.category && !EQUIPMENT_CATEGORIES.some(c => c.zh === dialog.f.category)
                      ? [{ value: dialog.f.category, label: `${dialog.f.category}（清單外）` }]
                      : [])
                  ]}
                  className="font-chinese w-full"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field zh="總數量">
                  <NumberInput value={dialog.f.original_quantity} onChange={n => setF({ original_quantity: n })} />
                </Field>
                <Field zh="押金/個">
                  <NumberInput value={dialog.f.deposit} onChange={n => setF({ deposit: n })} step={50} />
                </Field>
              </div>
            </div>
          </div>
        </FormDialog>
      )}
      <ConfirmDialog />
      {toastElement}
    </div>
  )
}

export default AdminEquipmentPage
