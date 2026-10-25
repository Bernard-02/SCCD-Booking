/**
 * 後台 · 空間管理（設定段）
 * 版面同設備管理：計數分頁 教室／編號區；搜尋列（搜尋、選取模式、狀態篩選）；表格（表頭可單欄排序）。
 * 教室＝一列一間；編號區依「區」收合成群組列（後陽台／前陽台／中庭…），展開才列出各格（搜尋中全部展開）：
 * 群組列有該區示意圖、開關一次開／關整區（部分開放顯示 n/m，按下＝全開）、修改＝整區押金；格列只有自己的開關。
 * 開關＝開放／關閉（關閉先確認、開放直接切）；選取模式同購物車：勾選欄（群組列＝整區）、表頭全選、批次開放／關閉。
 * 前台空間頁只撈 is_active=true：關閉即從前台消失（學生端重新整理生效）。A508 與後陽台預設不開放（2026-09-29 規則 #1）。
 * 圖片只有教室能換（JPG／PNG、5MB 內；沒上傳過沿用前台 /Images/{id}.webp）；編號區前台只讀 AREA_IMAGE_MAP 的靜態示意圖，
 * 後台同一張（前／後陽台沒有示意圖＝灰底 icon），格子的 image_url 沒人讀，不提供換圖。
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  listSpacesAdmin, setSpaceActive, setSpaceActiveMany, updateSpace, updateAreaDeposit, uploadImage, imageSrc
} from '../services/adminService'
import type { AdminSpace } from '../services/adminService'
import { AREA_IMAGE_MAP } from '../components/cart/cartHelpers'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useToast } from '../hooks/useToast'
import {
  PageTitle, inputCls, iconFillBtn, SearchBox, CountTabs, SelectControls, tableTh as th, tableTd as td,
  SortTh, toggleSort, sortRows, Thumb, ImagePicker, NumberInput, Switch, usePager, Pager, LoadError, Select, FormDialog, Field
} from '../components/admin/adminUi'
import type { Sort } from '../components/admin/adminUi'

// 編號區 area → 顯示名稱（沿用前台 SpaceAreaMap 的命名）；後陽台有開關需求排最前
const AREA_META: Record<string, { zh: string }> = {
  'back-terrace': { zh: '後陽台' },
  'front-terrace': { zh: '前陽台' },
  square: { zh: '中庭' },
  'glass-wall': { zh: '玻璃牆' },
  corridor: { zh: '專案許可區' },
  pillar: { zh: '專案許可區（柱）' }
}
const AREA_ORDER = Object.keys(AREA_META)
const areaZh = (a: string) => AREA_META[a]?.zh ?? a

const TABS = [{ key: 'classroom', zh: '教室' }, { key: 'area', zh: '編號區' }] as const
type Tab = typeof TABS[number]['key']
type StatusFilter = 'all' | 'active' | 'inactive'
type SortField = 'label' | 'deposit' | 'is_active'

// 編號自然排序（A2 在 A10 前）；先依區排、資料裡有但 AREA_ORDER 沒列的區排最後，不能默默吞掉
const blockKey = (id: string) => {
  const m = /^([A-Z]+)(\d+)$/.exec(id)
  return m ? ([m[1], Number(m[2])] as const) : ([id, 0] as const)
}
const sortBlocks = (a: AdminSpace, b: AdminSpace) => {
  const ai = AREA_ORDER.indexOf(a.area), bi = AREA_ORDER.indexOf(b.area)
  if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  const [ap, an] = blockKey(a.id), [bp, bn] = blockKey(b.id)
  return ap === bp ? an - bn : ap.localeCompare(bp)
}
// 表頭排序的取值：第一欄教室用名稱、格子用「前綴＋補零編號」字串維持自然順序（編號區只影響組內順序，組固定依 AREA_ORDER）
const SORT_GET: Record<SortField, (r: AdminSpace) => string | number | boolean> = {
  label: r => (r.area === 'classroom' ? r.name || r.id : `${blockKey(r.id)[0].padEnd(2, ' ')}${String(blockKey(r.id)[1]).padStart(3, '0')}`),
  deposit: r => r.deposit,
  is_active: r => r.is_active
}

// 教室：後台上傳的圖，沒上傳過沿用前台 /Images/{id}.webp
const classroomImage = (r: AdminSpace) => imageSrc(r.image_url, `/Images/${r.id}.webp`)

const ntd = (n: number) => `NT$ ${n.toLocaleString()}`
const toggled = (s: Set<string>, k: string) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n }

// 修改對話框：教室＝名稱＋押金＋圖（file／preview＝這次選的新圖，按確定才上傳）；area 有值＝從群組列開的整區押金
type Dialog = { space: AdminSpace; name: string; deposit: number; area?: string; file?: File; preview?: string }

const AdminSpacesPage: React.FC = () => {
  const [rows, setRows] = useState<AdminSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('classroom')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<Sort<SortField>>(null)
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set()) // 展開中的區（預設全收合）
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null) // 開／關處理中的那顆開關（格 id／區 key／'bulk'，防連點）
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast, toastElement } = useToast()

  const load = () => listSpacesAdmin()
    .then(r => { setRows(r); setLoadError(null) })
    .catch(e => setLoadError(e?.message ?? '未知錯誤'))
    .finally(() => setLoading(false))
  useEffect(() => { void load() }, [])

  const classrooms = useMemo(() => rows.filter(r => r.area === 'classroom'), [rows])
  const blocks = useMemo(() => rows.filter(r => r.area !== 'classroom').sort(sortBlocks), [rows])
  const areaKeys = useMemo(
    () => [...AREA_ORDER, ...new Set(blocks.map(r => r.area).filter(a => !(a in AREA_META)))],
    [blocks]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (tab === 'classroom' ? classrooms : blocks).filter(r =>
      (!q || r.id.toLowerCase().includes(q) || (r.name ?? '').toLowerCase().includes(q) || areaZh(r.area).includes(q)) &&
      (status === 'all' || r.is_active === (status === 'active'))
    )
  }, [tab, classrooms, blocks, search, status])
  const sorted = useMemo(() => (sort ? sortRows(filtered, sort.dir, SORT_GET[sort.field]) : filtered), [filtered, sort])
  const { pageRows, pager } = usePager(sorted, [tab, search, status, sort])
  // 編號區依區分組（組序固定 AREA_ORDER，組內跟表頭排序）；不分頁——收合時本來就只有幾列
  const groups = useMemo(
    () => areaKeys.map(a => [a, sorted.filter(r => r.area === a)] as const).filter(([, g]) => g.length > 0),
    [areaKeys, sorted]
  )
  const searching = search.trim() !== ''

  // 選取模式：切分頁即退出；全選＝目前篩選結果（不只這一頁）
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()) }
  useEffect(exitSelect, [tab])
  const selectedCount = filtered.filter(r => selected.has(r.id)).length
  const allSelected = filtered.length > 0 && selectedCount === filtered.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(r => r.id)))
  const toggleOne = (id: string) => setSelected(s => toggled(s, id))
  const toggleGroup = (g: AdminSpace[]) => setSelected(s => {
    const n = new Set(s), all = g.every(r => n.has(r.id))
    g.forEach(r => (all ? n.delete(r.id) : n.add(r.id)))
    return n
  })

  // 開關：關閉會讓學生端看不到，先確認；開放沒有副作用直接切
  const handleToggle = async (r: AdminSpace) => {
    const label = r.name || r.id
    if (r.is_active) {
      const ok = await confirm({
        title: '關閉租借',
        message: `關閉「${label}」的租借？前台將不再顯示（可隨時重新開放）。`,
        confirmTextZh: '關閉', variant: 'danger'
      })
      if (!ok) return
    }
    setTogglingId(r.id)
    const res = await setSpaceActive(r.id, !r.is_active)
    if (!res.ok) { setTogglingId(null); showToast(res.message ?? '操作失敗'); return }
    showToast(`已${r.is_active ? '關閉' : '開放'}「${label}」`, 'success')
    await load()
    setTogglingId(null)
  }

  // 多格一起開／關（選取模式批次、群組列整區共用）：關閉一樣先確認
  const setManyActive = async (ids: string[], active: boolean, what: string, key: string) => {
    if (!active) {
      const ok = await confirm({
        title: '關閉租借',
        message: `關閉${what}？前台將不再顯示（可隨時重新開放）。`,
        confirmTextZh: '關閉', variant: 'danger'
      })
      if (!ok) return false
    }
    setTogglingId(key)
    const res = await setSpaceActiveMany(ids, active)
    if (!res.ok) { setTogglingId(null); showToast(res.message ?? '操作失敗'); return false }
    showToast(`已${active ? '開放' : '關閉'} ${ids.length} 個空間`, 'success')
    await load()
    setTogglingId(null)
    return true
  }
  // 批次：只動狀態會變的那些
  const bulkSetActive = async (active: boolean) => {
    const ids = filtered.filter(r => selected.has(r.id) && r.is_active !== active).map(r => r.id)
    if (ids.length === 0) { showToast(active ? '選取的都已開放' : '選取的都已關閉'); return }
    if (await setManyActive(ids, active, `選取的 ${ids.length} 個空間`, 'bulk')) setSelected(new Set())
  }
  // 群組列開關：全開→關整區；否則把還沒開的都開（部分開放按下＝全開）
  const toggleArea = (area: string, g: AdminSpace[]) => {
    const allOn = g.every(r => r.is_active)
    const ids = g.filter(r => r.is_active === allOn).map(r => r.id)
    void setManyActive(ids, !allOn, `「${areaZh(area)}」${ids.length} 格`, area)
  }

  const closeDialog = () => {
    if (dialog?.preview) URL.revokeObjectURL(dialog.preview)
    setDialog(null)
  }
  const openDialog = (r: AdminSpace) => setDialog({ space: r, name: r.name ?? r.id, deposit: r.deposit })
  const openAreaDialog = (area: string, g: AdminSpace[]) => setDialog({ space: g[0], name: '', deposit: g[0].deposit, area })
  const pickImage = (file: File) => setDialog(d => {
    if (!d) return d
    if (d.preview) URL.revokeObjectURL(d.preview)
    return { ...d, file, preview: URL.createObjectURL(file) }
  })

  const handleSubmit = async () => {
    if (!dialog) return
    const { space: r, area } = dialog
    const isClassroom = r.area === 'classroom'
    const name = dialog.name.trim()
    if (isClassroom && !name) { showToast('請輸入名稱'); return }
    setBusy(true)
    const res = area ? await updateAreaDeposit(area, dialog.deposit) : await updateSpace(r.id, { name, deposit: dialog.deposit })
    if (!res.ok) { setBusy(false); showToast(res.message ?? '儲存失敗'); return }
    const up = dialog.file ? await uploadImage('space', r.id, dialog.file) : { ok: true as const }
    setBusy(false)
    showToast(up.ok ? `已更新「${area ? areaZh(area) : name}」` : `資料已存，圖片上傳失敗：${up.message ?? ''}`, up.ok ? 'success' : undefined)
    closeDialog()
    await load()
  }

  const isClassroomTab = tab === 'classroom'
  const areaCount = dialog?.area ? blocks.filter(b => b.area === dialog.area).length : 0
  const sortProps = { sort, onSort: (f: SortField) => setSort(s => toggleSort(s, f)) }

  // 一列一間／一格；nested＝群組底下的格：沒縮圖、沒修改鈕（圖與押金都在群組列），編號縮排到群組名正下方
  // （chevron 20 + gap 8 + 縮圖 40 + gap 12 ＝ 80px），列高用 h-10 撐到與有縮圖的列一樣。已關閉：只淡化內容，開關、修改鈕維持原亮度
  const renderRow = (r: AdminSpace, nested = false) => {
    const dim = r.is_active ? '' : 'opacity-50'
    return (
      <tr key={r.id} className="hover:bg-white/5">
        {selectMode && (
          <td className={td}>
            <input
              type="checkbox" className="custom-checkbox block" checked={selected.has(r.id)}
              onChange={() => toggleOne(r.id)} aria-label={`選取 ${r.name || r.id}`}
            />
          </td>
        )}
        <td className={td}>
          <div className={`h-10 flex items-center gap-3 ${nested ? 'pl-20' : ''} ${dim}`}>
            {!nested && <Thumb src={classroomImage(r)} alt={r.name ?? r.id} icon="meeting_room" />}
            <span className={nested ? 'font-english' : 'font-chinese'}>{nested ? r.id : (r.name || r.id)}</span>
          </div>
        </td>
        <td className={`${td} font-english text-center`}><span className={dim}>{ntd(r.deposit)}</span></td>
        <td className={`${td} text-center`}>
          {/* 選取模式下勾選的列：切一個開關＝套用到所有勾選（批次開放／關閉） */}
          <Switch
            checked={r.is_active}
            onChange={() => (selectMode && selected.has(r.id) ? bulkSetActive(!r.is_active) : handleToggle(r))}
            busy={togglingId === r.id || (selectMode && selected.has(r.id) && togglingId === 'bulk')}
            label={r.is_active ? '關閉租借' : '開放租借'}
          />
        </td>
        <td className={`${td} text-center`}>
          {!nested && (
            <button onClick={() => openDialog(r)} title="修改" aria-label="修改" className={iconFillBtn}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
            </button>
          )}
        </td>
      </tr>
    )
  }

  // 群組列：整列可點展開；勾選／開關／修改格子擋掉冒泡
  const renderGroup = ([area, g]: readonly [string, AdminSpace[]]) => {
    const open = searching || openAreas.has(area)
    const on = g.filter(r => r.is_active).length
    const allOn = on === g.length
    const dim = on ? '' : 'opacity-50'
    const lo = Math.min(...g.map(r => r.deposit)), hi = Math.max(...g.map(r => r.deposit))
    const stop = (e: React.MouseEvent) => e.stopPropagation()
    return (
      <React.Fragment key={area}>
        <tr className="hover:bg-white/5 cursor-pointer" onClick={() => setOpenAreas(s => toggled(s, area))}>
          {selectMode && (
            <td className={td} onClick={stop}>
              <input
                type="checkbox" className="custom-checkbox block" checked={g.every(r => selected.has(r.id))}
                onChange={() => toggleGroup(g)} aria-label={`選取 ${areaZh(area)} 整區`}
              />
            </td>
          )}
          <td className={td}>
            <button type="button" aria-expanded={open} className={`flex items-center gap-2 cursor-pointer ${dim}`}>
              <span className={`material-symbols-outlined transition-transform ${open ? 'rotate-180' : ''}`} style={{ fontSize: '20px' }}>expand_more</span>
              {/* 該區示意圖，同前台購物車／訂單頁（前／後陽台沒有＝灰底 icon） */}
              <Thumb src={AREA_IMAGE_MAP[area] ?? null} alt={areaZh(area)} icon="map" />
              <span className="font-chinese ml-1">{areaZh(area)}</span>
              {/* 格數徽章：同上方 CountTabs 的計數樣式，但直接貼在黑底上，底色提亮到 20% 才看得到 */}
              <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-lg text-2xs font-english bg-white/20">{g.length}</span>
            </button>
          </td>
          <td className={`${td} font-english text-center`}>
            <span className={dim}>{lo === hi ? ntd(lo) : `${ntd(lo)}–${hi.toLocaleString()}`}</span>
          </td>
          <td className={`${td} text-center`} onClick={stop}>
            <span className="inline-flex items-center gap-2">
              <Switch checked={allOn} onChange={() => toggleArea(area, g)} busy={togglingId === area} label={allOn ? '關閉整區' : '開放整區'} />
              {!allOn && on > 0 && <span className="text-2xs text-gray-scale2 font-english">{on}/{g.length}</span>}
            </span>
          </td>
          <td className={`${td} text-center`} onClick={stop}>
            <button onClick={() => openAreaDialog(area, g)} title="修改押金" aria-label="修改押金" className={iconFillBtn}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
            </button>
          </td>
        </tr>
        {open && g.map(r => renderRow(r, true))}
      </React.Fragment>
    )
  }

  return (
    // 撐滿內容區（AdminLayout main 固定 h-screen）：標題／分頁／搜尋固定，只有表格區捲動
    <div className="h-full flex flex-col">
      <PageTitle zh="空間管理" />

      <CountTabs tabs={TABS} value={tab} onChange={setTab} counts={{ classroom: classrooms.length, area: blocks.length }} />

      {loading ? (
        <div className="text-gray-scale2 text-xs font-chinese">載入中…</div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={() => { setLoading(true); void load() }} />
      ) : (
        <>
          {/* 搜尋列：左搜尋（常駐）；右＝選取模式、狀態篩選 */}
          <div className="flex items-center gap-2 mb-4">
            <SearchBox value={search} onChange={setSearch} className="w-72 mr-auto" />
            <SelectControls
              mode={selectMode}
              count={selectedCount}
              onEnter={() => setSelectMode(true)}
              onExit={exitSelect}
              actions={[]}
            />
            <Select<StatusFilter>
              value={status}
              onChange={setStatus}
              options={[{ value: 'all', label: '全部狀態' }, { value: 'active', label: '開放中' }, { value: 'inactive', label: '已關閉' }]}
              icon="filter_list"
              filled
              className="font-chinese"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
            {/* border-separate：表頭 sticky 時底線才跟著走 */}
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-gray-scale2">
                  {selectMode && (
                    <th className={`${th} w-10`}>
                      <input type="checkbox" className="custom-checkbox block" checked={allSelected} onChange={toggleAll} aria-label="全選" />
                    </th>
                  )}
                  <SortTh zh={isClassroomTab ? '教室' : '區域／編號'} field="label" {...sortProps} />
                  <SortTh zh="押金" field="deposit" className="w-32 text-center" {...sortProps} />
                  <SortTh zh="開放狀態" field="is_active" className="w-36 text-center" {...sortProps} />
                  <th className={`${th} w-24 text-center`}>操作</th>
                </tr>
              </thead>
              <tbody>{isClassroomTab ? pageRows.map(r => renderRow(r)) : groups.map(renderGroup)}</tbody>
            </table>

            {filtered.length === 0 && (
              <div className="py-16 text-center text-xs text-gray-scale2 font-chinese">找不到符合條件的空間</div>
            )}
          </div>

          {/* 分頁：放在捲動區外，固定在底部（編號區不分頁） */}
          {isClassroomTab && <Pager {...pager} />}
        </>
      )}

      {/* 修改：教室＝左圖右表單（名稱＋押金）；整區＝只有押金 */}
      {dialog && (
        <FormDialog
          title={dialog.area ? `修改 ${areaZh(dialog.area)}` : '修改教室'}
          confirmZh="確定修改"
          busy={busy}
          onConfirm={handleSubmit}
          onCancel={closeDialog}
          wide={!dialog.area}
        >
          {dialog.area ? (
            <Field zh={`押金（整區 ${areaCount} 格一起改）`}>
              <NumberInput value={dialog.deposit} onChange={n => setDialog(d => (d ? { ...d, deposit: n } : d))} step={100} />
            </Field>
          ) : (
            <div className="flex gap-8">
              <div className="shrink-0">
                <ImagePicker
                  src={dialog.preview ?? classroomImage(dialog.space)}
                  alt={dialog.name || dialog.space.id}
                  size={160}
                  caption="更換圖片"
                  onPick={pickImage}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                <Field zh="名稱" required>
                  <input
                    type="text" value={dialog.name} onChange={e => setDialog(d => (d ? { ...d, name: e.target.value } : d))}
                    className={`${inputCls} w-full font-chinese`} autoFocus
                  />
                </Field>
                <Field zh="押金">
                  <NumberInput value={dialog.deposit} onChange={n => setDialog(d => (d ? { ...d, deposit: n } : d))} step={100} />
                </Field>
              </div>
            </div>
          )}
        </FormDialog>
      )}
      <ConfirmDialog />
      {toastElement}
    </div>
  )
}

export default AdminSpacesPage
