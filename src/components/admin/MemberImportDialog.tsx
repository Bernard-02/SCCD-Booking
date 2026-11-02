/**
 * 後台 · 會員管理 › 匯入會員（.xlsx）：下載範本 → 選檔 → 預覽逐列驗證（錯的列標紅、其餘照匯）→ 寫入 login_allowlist。
 * 解析與驗證在 utils/memberImport（表頭名稱對應）；讀檔用 SheetJS，按下才動態載入（同收據的 jspdf，平常不進 bundle）。
 * 已登記未啟用的學號會被檔案內容覆寫（換屆重匯即此用途，addAllowlist 是 upsert）；已有帳號的列跳過。
 * 只收 .xlsx 不收 CSV：Windows Excel 存的 CSV 預設 Big5，中文會亂碼。
 */

import { BTN } from '@/components/common/btn'
import React, { useState } from 'react'
import { addAllowlist } from '../../services/adminService'
import { parseMemberRows, IDENTITY_ZH_LIST, type ImportRow } from '../../utils/memberImport'
import { FormDialog } from './adminUi'

const TEMPLATE = [
  ['學號', '姓名', 'Email', '身份', '職稱'],
  ['A113144001', '王小明', 'a113144001@gm.usc.edu.tw', '學生', ''],
  ['A112141002', '李小華', '', '系學會', '會長']
]
const IDENTITY_ZH = { student: '學生', transfer: '轉學生', sa: '系學會', secretary: '系秘' } as const
const cellCls = 'px-2 py-1.5 border-b border-gray-mid whitespace-nowrap'

const MemberImportDialog: React.FC<{
  existingSids: ReadonlySet<string> // 已有帳號的學號（大寫）
  onDone: (count: number) => void // 匯入成功：父層關閉、提示、重載
  onCancel: () => void
  showToast: (message: string) => void
}> = ({ existingSids, onDone, onCancel, showToast }) => {
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const valid = rows?.filter(r => !r.error) ?? []
  const bad = (rows?.length ?? 0) - valid.length

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(TEMPLATE), '會員')
    XLSX.writeFile(wb, '會員匯入範本.xlsx')
  }

  const pickFile = async (file: File) => {
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' })
      const parsed = parseMemberRows(aoa, existingSids)
      if (parsed.length === 0) { showToast('找不到「學號」表頭或沒有資料列，請照範本格式'); return }
      setRows(parsed)
      setFileName(file.name)
    } catch (e) {
      showToast(`讀檔失敗：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    setBusy(true)
    const res = await addAllowlist(valid.map(r => ({
      student_id: r.sid, note: null, name: r.name, email: r.email,
      role: r.identity === 'secretary' ? 'staff' : 'student',
      is_transfer: r.identity === 'transfer',
      is_sa: r.identity === 'sa',
      position: r.identity === 'sa' ? r.position : null
    })))
    setBusy(false)
    if (!res.ok) { showToast(res.message ?? '匯入失敗'); return }
    onDone(valid.length)
  }

  return (
    <FormDialog
      title="匯入會員"
      confirmZh={rows ? `匯入 ${valid.length} 筆` : '匯入'}
      canConfirm={valid.length > 0}
      busy={busy}
      onConfirm={handleImport}
      onCancel={onCancel}
      wide
    >
      <p className="text-xs text-gray-light font-chinese leading-6">
        Excel（.xlsx）第一列是表頭，認「學號、姓名、Email、身份、職稱」，順序不拘、其他欄略過。
        身份填 {IDENTITY_ZH_LIST}，空白＝學生；Email 空白＝學號@gm.usc.edu.tw；班級由學號自動判斷。
        已登記未啟用的學號以檔案為準更新，已有帳號的跳過。
        <button type="button" onClick={downloadTemplate} className={`ml-2 text-white underline ${BTN}`}>下載範本</button>
      </p>

      {!rows ? (
        <label className={`flex flex-col items-center justify-center gap-2 h-32 rounded-xl border border-dashed border-gray-mid text-gray-light ${
          busy ? 'cursor-wait' : 'cursor-pointer hover:border-white hover:text-white'
        }`}>
          <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>input</span>
          <span className="text-2xs font-chinese">{busy ? '讀取中…' : '點這裡選擇 .xlsx 檔案'}</span>
          <input
            type="file" accept=".xlsx" className="sr-only" disabled={busy}
            onChange={e => { const f = e.target.files?.[0]; if (f) void pickFile(f) }}
          />
        </label>
      ) : (
        <>
          <div className="flex items-center gap-3 text-xs font-chinese">
            <span className="font-english text-gray-light truncate">{fileName}</span>
            <span>
              共 <span className="font-english">{rows.length}</span> 列、可匯入 <span className="font-english">{valid.length}</span> 筆
              {bad > 0 && <span style={{ color: 'var(--color-error)' }}>、<span className="font-english">{bad}</span> 筆有問題</span>}
            </span>
            <button type="button" onClick={() => setRows(null)} className={`ml-auto text-gray-light ${BTN}`}>重選檔案</button>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-gray-light font-chinese">
                  <th className={`${cellCls} font-normal w-10`}>列</th>
                  <th className={`${cellCls} font-normal`}>學號</th>
                  <th className={`${cellCls} font-normal`}>姓名</th>
                  <th className={`${cellCls} font-normal font-english`}>Email</th>
                  <th className={`${cellCls} font-normal`}>身份</th>
                  <th className={`${cellCls} font-normal`}>問題</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.line} className={r.error ? 'opacity-60' : ''}>
                    <td className={`${cellCls} font-english text-gray-light`}>{r.line}</td>
                    <td className={`${cellCls} font-english`}>{r.sid || '—'}</td>
                    <td className={`${cellCls} font-chinese`}>{r.name || '—'}</td>
                    <td className={`${cellCls} font-english`}>{r.email || '—'}</td>
                    <td className={`${cellCls} font-chinese`}>{IDENTITY_ZH[r.identity]}{r.identity === 'sa' && r.position ? `・${r.position}` : ''}</td>
                    <td className={`${cellCls} font-chinese`} style={r.error ? { color: 'var(--color-error)' } : undefined}>{r.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </FormDialog>
  )
}

export default MemberImportDialog
