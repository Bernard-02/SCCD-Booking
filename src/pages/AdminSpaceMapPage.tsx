/**
 * 後台 · 空間地圖（值班段，唯讀——2026-09-29 新規則 #6）
 * 沿用前台 A5F SVG 與 numbered-area.css 的區塊狀態視覺：
 * 紅（is-rented）＝該日期有生效訂單佔用；暗（is-disabled）＝後台已關閉；預設＝空閒。
 * 點區塊看借用人與單號；教室不在 SVG 上，另列於下方。
 * 純查看不可改——開關在「設定 → 空間管理」，訂單操作在「值班 → 訂單」。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { listSpacesAdmin, fetchSpaceOccupancy } from '../services/adminService'
import type { AdminSpace, SpaceOccupant } from '../services/adminService'
import { PageTitle, StatusChip, inputCls, LoadError } from '../components/admin/adminUi'
import type { OrderStatus } from '../services/ordersService'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const AREA_META: Record<string, string> = {
  classroom: '教室',
  square: '中庭',
  corridor: '專案許可區',
  pillar: '專案許可區（柱）',
  'front-terrace': '前陽台',
  'back-terrace': '後陽台',
  'glass-wall': '玻璃牆'
}

const localToday = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const AdminSpaceMapPage: React.FC = () => {
  const [date, setDate] = useState(localToday())
  const [spaces, setSpaces] = useState<AdminSpace[]>([])
  const [occupants, setOccupants] = useState<SpaceOccupant[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null)
  const listenersRef = useRef<Array<{ element: Element; handler: (e: Event) => void }>>([])
  // 任一來源失敗即顯示錯誤並隱藏地圖——沒上色的地圖看起來像「全部空閒」，比空白更誤導。
  // 成功不清錯誤（避免 A 成功蓋掉 B 的失敗）；重試時先清再 bump reloadKey 全部重抓
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const fail = (what: string) => (err: unknown) => {
    console.error(`[AdminSpaceMap] ${what}失敗:`, err)
    setLoadError(`${what}失敗（${err instanceof Error ? err.message : String(err)}）`)
  }

  // 載入 SVG（一次）
  useEffect(() => {
    let mounted = true
    fetch('/Area/A5F Area Booking.svg')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text() })
      .then(content => { if (mounted) setSvgContent(content) })
      .catch(fail('載入地圖圖檔'))
    return () => { mounted = false }
  }, [reloadKey])

  // 注入 SVG
  useEffect(() => {
    if (!svgContent || !containerRef.current) return
    containerRef.current.innerHTML = svgContent
    const svg = containerRef.current.querySelector('svg')
    if (svg) {
      svg.style.width = '100%'
      svg.style.height = 'auto'
      svg.style.display = 'block'
      setSvgElement(svg)
    }
  }, [svgContent])

  // 載入空間主檔（一次）與該日期佔用
  useEffect(() => {
    listSpacesAdmin().then(setSpaces).catch(fail('載入空間資料'))
  }, [reloadKey])
  useEffect(() => {
    fetchSpaceOccupancy(date).then(setOccupants).catch(fail('載入租借狀態'))
  }, [date, reloadKey])
  // 自動更新：只重抓空間與佔用（SVG 圖檔不變）；背景失敗不蓋畫面，下次再試
  useAutoRefresh(() =>
    Promise.all([listSpacesAdmin(), fetchSpaceOccupancy(date)])
      .then(([s, o]) => { setSpaces(s); setOccupants(o) })
      .catch(() => {})
  )

  const occupantsByItem = useMemo(() => {
    const map: Record<string, SpaceOccupant[]> = {}
    occupants.forEach(o => { (map[o.itemId] ??= []).push(o) })
    return map
  }, [occupants])

  // 依狀態上色＋掛點擊（唯讀查看）
  useEffect(() => {
    if (!svgElement || spaces.length === 0) return

    listenersRef.current.forEach(({ element, handler }) => element.removeEventListener('click', handler))
    listenersRef.current = []

    spaces.filter(s => s.area !== 'classroom').forEach(s => {
      const el = svgElement.querySelector(`#${s.id}`)
      if (!el) return
      const shapes = el.tagName.toLowerCase() === 'g'
        ? Array.from(el.querySelectorAll('path, rect, polygon, circle'))
        : [el]

      shapes.forEach(shape => {
        shape.classList.remove('area-block', 'is-available', 'is-selected', 'is-rented', 'is-interactive', 'is-disabled')
        if (occupantsByItem[s.id]?.length) shape.classList.add('area-block', 'is-rented')
        else if (!s.is_active) shape.classList.add('area-block', 'is-disabled')
      })
      ;(el as HTMLElement).style.cursor = 'pointer'

      const handler = () => setSelectedId(s.id)
      el.addEventListener('click', handler)
      listenersRef.current.push({ element: el, handler })
    })

    return () => {
      listenersRef.current.forEach(({ element, handler }) => element.removeEventListener('click', handler))
      listenersRef.current = []
    }
  }, [svgElement, spaces, occupantsByItem])

  const selected = spaces.find(s => s.id === selectedId) ?? null
  const selectedOccupants = selectedId ? occupantsByItem[selectedId] ?? [] : []
  const classrooms = spaces.filter(s => s.area === 'classroom')

  const occupantRow = (o: SpaceOccupant) => (
    <div key={o.rentalNumber} className="flex flex-wrap items-center gap-3 text-xs py-2">
      <span className="font-chinese text-white">{o.studentName}</span>
      <span className="font-english text-gray-scale2">{o.studentNo}</span>
      <span className="font-english text-gray-scale2">{o.rentalNumber}</span>
      <span className="font-english text-gray-scale2">{o.startDate} ~ {o.endDate}</span>
      <StatusChip status={o.status as OrderStatus} />
    </div>
  )

  return (
    <div>
      <PageTitle
        en="Space Map"
        zh="空間地圖"
        desc="唯讀：查看各區塊指定日期的租借狀態與借用人。開關空間到「設定 → 空間管理」，處理訂單到「值班 → 訂單」。"
      />

      {/* 日期＋圖例 */}
      <div className="flex flex-wrap items-center gap-6 mb-6 text-xs">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inputCls} cursor-pointer`} />
        <span className="font-chinese text-gray-scale2 flex items-center gap-2">
          <span className="inline-block w-3 h-3" style={{ backgroundColor: 'var(--color-error2)' }} />使用中（含待繳押金／逾期）
        </span>
        <span className="font-chinese text-gray-scale2 flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-gray-scale4" />已關閉
        </span>
        <span className="font-chinese text-gray-scale2">點擊區塊查看借用人</span>
      </div>

      {loadError && (
        <LoadError message={loadError} onRetry={() => { setLoadError(null); setReloadKey(k => k + 1) }} />
      )}

      {/* 失敗時用 hidden 而非卸載：SVG 是注入進 containerRef 的節點 */}
      <div className={`flex flex-wrap gap-8 items-start ${loadError ? 'hidden' : ''}`}>
        {/* SVG 地圖 */}
        <div ref={containerRef} className="flex-1 min-w-[24rem] max-w-[52rem]" />

        {/* 選取區塊資訊 */}
        <aside className="w-80 shrink-0 border border-gray-scale4 rounded-lg p-4 text-xs">
          {!selected ? (
            <p className="font-chinese text-gray-scale3">尚未選取區塊</p>
          ) : (
            <>
              <p className="text-sm text-white mb-1">
                <span className="font-english">{selected.id}</span>{' '}
                <span className="font-chinese">{selected.name || AREA_META[selected.area] || selected.area}</span>
              </p>
              <p className="font-chinese text-gray-scale2 mb-3">
                {AREA_META[selected.area] ?? selected.area} · 押金 NT$ {selected.deposit} ·{' '}
                {selected.is_active
                  ? <span style={{ color: 'var(--color-success)' }}>開放中</span>
                  : <span className="text-gray-scale3">已關閉</span>}
              </p>
              {selectedOccupants.length === 0 ? (
                <p className="font-chinese text-gray-scale2">此日期無人借用</p>
              ) : (
                <div className="divide-y divide-gray-scale4">
                  {selectedOccupants.map(occupantRow)}
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {/* 教室（不在 SVG 上，另列） */}
      <div className={`mt-10 max-w-[52rem] ${loadError ? 'hidden' : ''}`}>
        <h2 className="text-sm text-white mb-3">
          <span className="font-english">Classrooms</span> <span className="font-chinese">教室</span>
        </h2>
        <div className="divide-y divide-gray-scale4 border-t border-b border-gray-scale4">
          {classrooms.map(c => {
            const occ = occupantsByItem[c.id] ?? []
            return (
              <div key={c.id} className={`py-3 flex flex-wrap items-center gap-4 text-xs ${!c.is_active ? 'opacity-50' : ''}`}>
                <span className="font-chinese text-white w-28">{c.name || c.id}</span>
                {!c.is_active && <span className="font-chinese text-gray-scale3">已關閉</span>}
                {occ.length === 0
                  ? <span className="font-chinese text-gray-scale2">此日期無人借用</span>
                  : <div className="flex-1 min-w-0">{occ.map(occupantRow)}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AdminSpaceMapPage
