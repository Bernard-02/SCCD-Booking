/**
 * 後台 · 空間管理（設定段）
 * 各教室／區塊的開放 toggle（is_active）——A508 與後陽台預設不開放、學會可隨時開關
 * （2026-09-29 新規則 #1）。前台空間頁只撈 is_active=true：關閉即從前台消失
 * （學生端重新整理生效）。分「教室」「編號區」兩個分頁。
 * 教室可改名稱／押金／圖片；編號區押金以「區」為單位整區改（規則本來就是按區定價）。
 */

import React, { useEffect, useState } from 'react'
import {
  listSpacesAdmin, setSpaceActive, updateSpace, updateAreaDeposit, uploadImage, imageSrc
} from '../services/adminService'
import type { AdminSpace } from '../services/adminService'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { useToast } from '../hooks/useToast'
import { PageTitle, actionBtn, inputCls, listHeadCls, listRowCls, HeadCell, ImagePicker, EditIconBtn, LoadError } from '../components/admin/adminUi'

// 教室：圖片／名稱／押金／狀態／操作；編號區：編號／押金／狀態／操作
const classroomCols = 'grid-cols-[40px_1fr_120px_100px_200px]'
const areaCols = 'grid-cols-[1fr_120px_100px_120px]'
const numCls = `${inputCls} w-24 text-center font-english`

// 編號區 area → 顯示名稱（沿用前台 SpaceAreaMap 的命名）；後陽台有開關需求排最前
const AREA_META: Record<string, { zh: string; en: string }> = {
  'back-terrace': { zh: '後陽台', en: 'Back Terrace' },
  'front-terrace': { zh: '前陽台', en: 'Front Terrace' },
  square: { zh: '中庭', en: 'Square' },
  'glass-wall': { zh: '玻璃牆', en: 'Glass Wall' },
  corridor: { zh: '專案許可區', en: 'Case Permit Area' },
  pillar: { zh: '專案許可區（柱）', en: 'Case Permit Area (Pillar)' }
}
const AREA_ORDER = Object.keys(AREA_META)

type Tab = 'classroom' | 'area'

// 數字輸入（空字串暫記 0）
const num = (v: string) => Math.max(0, parseInt(v, 10) || 0)

const AdminSpacesPage: React.FC = () => {
  const [rows, setRows] = useState<AdminSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('classroom')
  // 編輯中：一次只開一個（教室列 key＝id；編號區 key＝area）
  const [editing, setEditing] = useState<{ kind: Tab; key: string } | null>(null)
  const [draft, setDraft] = useState({ name: '', deposit: 0 })
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { showToast, toastElement } = useToast()

  const load = () => listSpacesAdmin()
    .then(r => { setRows(r); setLoadError(null) })
    .catch(e => setLoadError(e?.message ?? '未知錯誤'))
    .finally(() => setLoading(false))
  useEffect(() => { void load() }, [])

  const handleToggle = async (r: AdminSpace) => {
    const label = r.name || r.id
    const ok = await confirm(r.is_active
      ? {
          title: '關閉租借', titleEn: 'Close',
          message: `關閉「${label}」的租借？前台將不再顯示（可隨時重新開放）。`,
          confirmText: 'Close', confirmTextZh: '關閉', variant: 'danger'
        }
      : {
          title: '開放租借', titleEn: 'Open',
          message: `開放「${label}」租借？前台將恢復顯示。`,
          confirmText: 'Open', confirmTextZh: '開放'
        })
    if (!ok) return
    setBusyId(r.id)
    const res = await setSpaceActive(r.id, !r.is_active)
    setBusyId(null)
    if (!res.ok) { showToast(res.message ?? '操作失敗'); return }
    showToast(`已${r.is_active ? '關閉' : '開放'}「${label}」`, 'success')
    await load()
  }

  const handleSave = async () => {
    if (!editing) return
    if (editing.kind === 'classroom' && !draft.name.trim()) { showToast('請輸入名稱'); return }
    setBusyId(editing.key)
    const res = editing.kind === 'classroom'
      ? await updateSpace(editing.key, { name: draft.name.trim(), deposit: draft.deposit })
      : await updateAreaDeposit(editing.key, draft.deposit)
    setBusyId(null)
    if (!res.ok) { showToast(res.message ?? '儲存失敗'); return }
    showToast(
      editing.kind === 'classroom'
        ? `已更新「${draft.name.trim()}」`
        : `已更新「${AREA_META[editing.key]?.zh ?? editing.key}」整區押金為 NT$ ${draft.deposit}`,
      'success'
    )
    setEditing(null)
    await load()
  }

  const handleImage = async (id: string, file: File) => {
    setUploadingId(id)
    const res = await uploadImage('space', id, file)
    setUploadingId(null)
    if (!res.ok) { showToast(res.message ?? '上傳失敗'); return }
    const sp = rows.find(r => r.id === id)
    showToast(`已更換「${sp?.name || id}」的圖片`, 'success')
    await load()
  }

  const classrooms = rows.filter(r => r.area === 'classroom')
  const areas = rows.filter(r => r.area !== 'classroom')

  // 編號區依 area 分組；資料裡出現但 AREA_ORDER 沒列的 area 排最後，不能默默吞掉
  const areaGroups = [...AREA_ORDER, ...new Set(areas.map(r => r.area).filter(a => !(a in AREA_META)))]
    .map(area => ({ area, items: areas.filter(r => r.area === area) }))
    .filter(g => g.items.length > 0)

  const statusCell = (r: AdminSpace) => (
    <div className="font-chinese text-center">
      {r.is_active
        ? <span style={{ color: 'var(--color-success)' }}>開放中</span>
        : <span className="text-gray-scale3">已關閉</span>}
    </div>
  )

  const toggleBtn = (r: AdminSpace) => (
    <button onClick={() => handleToggle(r)} disabled={busyId === r.id} className={actionBtn(busyId !== r.id)}>
      {r.is_active
        ? <span className="font-english">Close <span className="font-chinese">關閉</span></span>
        : <span className="font-english">Open <span className="font-chinese">開放</span></span>}
    </button>
  )

  const depositInput = (
    <input type="number" min={0} step={100} value={draft.deposit}
      onChange={e => setDraft(d => ({ ...d, deposit: num(e.target.value) }))} className={numCls} />
  )

  const saveCancel = (
    <>
      <button onClick={handleSave} disabled={busyId === editing?.key} className={actionBtn(busyId !== editing?.key)}>
        <span className="font-english">Save <span className="font-chinese">儲存</span></span>
      </button>
      <button onClick={() => setEditing(null)} className="text-gray-scale2 hover:!text-white transition-colors cursor-pointer">
        <span className="font-english">Cancel <span className="font-chinese">取消</span></span>
      </button>
    </>
  )

  const editBtn = (onClick: () => void, en = 'Edit', zh = '編輯') => (
    <EditIconBtn onClick={onClick} label={`${zh} ${en}`} />
  )

  const tabBtn = (key: Tab, en: string, zh: string, count: number, open: number) => (
    <button
      onClick={() => setTab(key)}
      className={`text-sm transition-colors cursor-pointer ${
        tab === key ? 'text-white font-bold' : 'text-gray-scale2 hover:!text-white'
      }`}
    >
      <span className="font-english">{en}</span> <span className="font-chinese">{zh}</span>
      <span className="text-xs text-gray-scale3 font-chinese font-normal ml-2">開放 {open} / {count}</span>
    </button>
  )

  return (
    <div>
      <PageTitle
        en="Spaces"
        zh="空間管理"
        desc="開放／關閉各教室與區塊的租借（關閉＝前台隱藏，資料保留）；教室可改名稱、押金、點圖片更換；編號區押金整區一起改。A508 與後陽台依規則預設關閉。學生端重新整理後生效。"
      />

      {/* 分頁 */}
      <div className="flex gap-10 mb-8 pb-3 border-b border-gray-scale4">
        {tabBtn('classroom', 'Classrooms', '教室', classrooms.length, classrooms.filter(r => r.is_active).length)}
        {tabBtn('area', 'Numbered Areas', '編號區', areas.length, areas.filter(r => r.is_active).length)}
      </div>

      {loading ? (
        <div className="text-gray-scale2 text-xs font-chinese">載入中…</div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={() => { setLoading(true); void load() }} />
      ) : tab === 'classroom' ? (
        <div className="max-w-[56rem]">
          <div className={`${listHeadCls} ${classroomCols}`}>
            <HeadCell en="Image" zh="圖片" />
            <HeadCell en="Name" zh="名稱" />
            <HeadCell en="Deposit" zh="押金" center />
            <HeadCell en="Status" zh="狀態" center />
            <HeadCell en="Action" zh="操作" center />
          </div>
          {classrooms.map(r => {
            const isEditing = editing?.kind === 'classroom' && editing.key === r.id
            return (
              <div key={r.id} className={`${listRowCls} ${classroomCols} text-sm`}>
                {/* 未上傳過＝沿用前台原本的 /Images/{id}.webp */}
                <ImagePicker src={imageSrc(r.image_url, `/Images/${r.id}.webp`)} alt={r.name ?? r.id}
                  busy={uploadingId === r.id} onPick={f => handleImage(r.id, f)} />
                <div className="font-chinese">
                  {isEditing ? (
                    <input type="text" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                      placeholder="名稱" className={`${inputCls} font-chinese w-full max-w-[16rem]`} />
                  ) : (r.name || r.id)}
                </div>
                <div className="font-english text-center whitespace-nowrap">{isEditing ? depositInput : `NT$ ${r.deposit}`}</div>
                {statusCell(r)}
                <div className="flex justify-center items-center gap-4">
                  {isEditing ? saveCancel : (
                    <>
                      {editBtn(() => { setEditing({ kind: 'classroom', key: r.id }); setDraft({ name: r.name ?? r.id, deposit: r.deposit }) })}
                      {toggleBtn(r)}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : areaGroups.map(g => {
        const meta = AREA_META[g.area] ?? { zh: g.area, en: g.area }
        const isEditing = editing?.kind === 'area' && editing.key === g.area
        return (
          <div key={g.area} className="mb-10">
            <div className="flex items-center gap-4 mb-3 text-sm">
              <h2 className="text-white">
                <span className="font-english">{meta.en}</span> <span className="font-chinese">{meta.zh}</span>
                <span className="text-xs text-gray-scale3 font-chinese ml-3">
                  開放 {g.items.filter(r => r.is_active).length} / {g.items.length}
                </span>
              </h2>
              {isEditing ? (
                <>
                  <label className="text-xs text-gray-scale2 font-chinese">整區押金 {depositInput}</label>
                  {saveCancel}
                </>
              ) : (
                editBtn(() => { setEditing({ kind: 'area', key: g.area }); setDraft({ name: '', deposit: g.items[0].deposit }) }, 'Edit Deposit', '編輯押金')
              )}
            </div>
            <div className="max-w-[56rem]">
              <div className={`${listHeadCls} ${areaCols}`}>
                <HeadCell en="ID" zh="編號" />
                <HeadCell en="Deposit" zh="押金" center />
                <HeadCell en="Status" zh="狀態" center />
                <HeadCell en="Action" zh="操作" center />
              </div>
              {g.items.map(r => (
                <div key={r.id} className={`${listRowCls} ${areaCols} text-sm ${!r.is_active ? 'opacity-50' : ''}`}>
                  <div className="font-english">{r.id}</div>
                  <div className="font-english text-center whitespace-nowrap">NT$ {r.deposit}</div>
                  {statusCell(r)}
                  <div className="flex justify-center">{toggleBtn(r)}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <ConfirmDialog />
      {toastElement}
    </div>
  )
}

export default AdminSpacesPage
