/**
 * 後台 · A5F 編號區（值班段，唯讀——2026-09-29 新規則 #6）
 * 沿用前台 A5F SVG 與 numbered-area.css 的區塊狀態視覺：
 * 格子顏色＝該日期佔用訂單的狀態，同 StatusChip 色票（黃＝待繳押金、藍＝使用中、粉紅＝未完成歸還）；有顏色的格子編號改黑（編號本身是黃／白）；
 * 暗（is-disabled）＝後台已關閉（不可點，反正不會有人借）；預設＝空閒。
 * 版面：地圖靠左、撐滿視窗剩餘高度（等比縮放，不捲動）；右欄由上而下＝圖例、日期、選到的區塊面板（點地圖上的區塊看借用人）；
 * 視窗偏方或直立時（tall: 變體，index.css）改成地圖在上、下面左圖例右日期與面板，
 * 點到的區塊在地圖上填白色、格子上的編號改黑字（編號是獨立的 path，用位置對回格子）。教室不在 SVG 上，這頁不列（2026-10-24 定），教室借用到「訂單」篩個人／團體空間看。
 * 純查看不可改——開關在「設定 → 空間管理」，訂單操作在「值班 → 訂單」。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { listSpacesAdmin, fetchSpaceOccupancy } from '../services/adminService'
import type { AdminSpace, SpaceOccupant } from '../services/adminService'
import { PageTitle, StatusChip, DatePicker, LoadError, STATUS_META } from '../components/admin/adminUi'
import type { OrderStatus } from '../services/ordersService'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { toDateKey } from '../utils/timeUtils'

const AREA_META: Record<string, string> = {
  square: '中庭',
  corridor: '專案許可區',
  pillar: '專案許可區（柱）',
  'front-terrace': '前陽台',
  'back-terrace': '後陽台',
  'glass-wall': '玻璃牆'
}

const AdminSpaceMapPage: React.FC = () => {
  const [date, setDate] = useState(toDateKey(new Date()))
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

  // 注入 SVG：寬高 100%＋viewBox＝等比縮放塞滿容器（容器高＝視窗剩餘高）；靠左不置中
  useEffect(() => {
    if (!svgContent || !containerRef.current) return
    containerRef.current.innerHTML = svgContent
    const svg = containerRef.current.querySelector('svg')
    if (svg) {
      svg.style.width = '100%'
      svg.style.height = '100%'
      svg.style.display = 'block'
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet') // 地圖在欄內置中（2026-11-02 自靠左改）
      // 格子編號是疊在格子上面的獨立 path：讓滑鼠事件穿透，hover 到編號也算 hover 到格子（游標與點擊才準）
      svg.querySelectorAll<SVGElement>('path.cls-2, path.cls-3').forEach(l => { l.style.pointerEvents = 'none' })
      setSvgElement(svg)
    }
  }, [svgContent])

  // 載入空間主檔（一次）與該日期佔用
  useEffect(() => {
    listSpacesAdmin().then(setSpaces).catch(fail('載入空間資料'))
  }, [reloadKey])
  // 佔用是否已到過一次／地圖是否已第一次上色：都沒好之前地圖 invisible，不然 SVG 先到會先亮一下再變暗（閃）
  const [occupantsLoaded, setOccupantsLoaded] = useState(false)
  const [painted, setPainted] = useState(false)
  useEffect(() => {
    fetchSpaceOccupancy(date).then(o => { setOccupants(o); setOccupantsLoaded(true) }).catch(fail('載入租借狀態'))
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

  // 依狀態上色＋掛點擊（唯讀查看）；已關閉的不掛點擊；選到的區塊填白
  // （inline !important 才蓋得過 numbered-area.css 的 fill !important；借用人明細看右欄面板）
  useEffect(() => {
    if (!svgElement || spaces.length === 0 || !occupantsLoaded) return

    listenersRef.current.forEach(({ element, handler }) => element.removeEventListener('click', handler))
    listenersRef.current = []

    // 格子編號（黃 cls-2／白 cls-3）不在格子的 <g> 裡，先全部還原，有底色（佔用或選到）的格子再把落在它範圍內的編號改黑
    const labels = Array.from(svgElement.querySelectorAll<SVGGraphicsElement>('path.cls-2, path.cls-3'))
    labels.forEach(l => l.style.removeProperty('fill'))
    const blackenLabels = (el: Element) => {
      const box = el.getBoundingClientRect() // 用螢幕座標比，不受 SVG 群組 transform 影響
      labels.forEach(l => {
        const b = l.getBoundingClientRect()
        const cx = b.left + b.width / 2
        const cy = b.top + b.height / 2
        if (cx >= box.left && cx <= box.right && cy >= box.top && cy <= box.bottom) l.style.setProperty('fill', 'var(--color-black)', 'important')
      })
    }
    // 同一格同一天理論上只有一張生效訂單；萬一重疊取最嚴重的
    const occupiedColor = (id: string) => {
      const occ = occupantsByItem[id]
      if (!occ?.length) return null
      const st = (['overdue', 'in-progress', 'pending'] as const).find(k => occ.some(o => o.status === k)) ?? (occ[0].status as OrderStatus)
      return STATUS_META[st]?.color ?? 'var(--color-error)'
    }

    spaces.filter(s => s.area !== 'classroom').forEach(s => {
      const el = svgElement.querySelector(`#${s.id}`)
      if (!el) return
      const shapes = el.tagName.toLowerCase() === 'g'
        ? Array.from(el.querySelectorAll('path, rect, polygon, circle'))
        : [el]
      const selected = s.id === selectedId
      const color = occupiedColor(s.id)

      shapes.forEach(shape => {
        shape.classList.remove('area-block', 'is-available', 'is-selected', 'is-rented', 'is-interactive', 'is-disabled')
        if (color) shape.classList.add('area-block')
        else if (!s.is_active) shape.classList.add('area-block', 'is-disabled')
        const st = (shape as SVGElement).style
        if (selected) st.setProperty('fill', 'var(--color-white)', 'important')
        else if (color) st.setProperty('fill', color, 'important')
        else st.removeProperty('fill')
      })
      if (selected || color) blackenLabels(el)
      ;(el as HTMLElement).style.cursor = s.is_active ? 'pointer' : 'not-allowed'
      if (!s.is_active) return

      const handler = () => setSelectedId(prev => (prev === s.id ? null : s.id)) // 再點同一格＝取消選取
      el.addEventListener('click', handler)
      listenersRef.current.push({ element: el, handler })
    })

    setPainted(true) // 上色完成後下一輪 render 才顯示地圖（useEffect 在 paint 之後跑，不能直接用 ready 旗標）
    return () => {
      listenersRef.current.forEach(({ element, handler }) => element.removeEventListener('click', handler))
      listenersRef.current = []
    }
  }, [svgElement, spaces, occupantsByItem, selectedId, occupantsLoaded])

  const selected = spaces.find(s => s.id === selectedId) ?? null
  const selectedOccupants = selectedId ? occupantsByItem[selectedId] ?? [] : []

  const occupantRow = (o: SpaceOccupant) => (
    <div key={o.rentalNumber} className="flex flex-wrap items-center gap-3 text-xs py-2">
      <span className="font-chinese">{o.studentName}</span>
      <span className="font-english">{o.studentNo}</span>
      <span className="font-english">{o.rentalNumber}</span>
      <span className="font-english">{o.startDate} ~ {o.endDate}</span>
      <StatusChip status={o.status as OrderStatus} />
    </div>
  )

  return (
    // 撐滿內容區（AdminLayout main 固定 h-screen）：地圖吃掉標題以下全部高度，整頁不捲動
    <div className="h-full flex flex-col">
      <PageTitle zh="A5F 編號區" />

      {loadError && (
        <LoadError message={loadError} onRetry={() => { setLoadError(null); setReloadKey(k => k + 1) }} />
      )}

      {/* 失敗時用 hidden 而非卸載：SVG 是注入進 containerRef 的節點 */}
      <div className={`flex-1 min-h-0 flex gap-8 tall:flex-col ${loadError ? 'hidden' : ''}`}>
        {/* 地圖 */}
        {/* invisible（非 display:none）：仍有版面與座標，編號改黑用的 getBoundingClientRect 才準 */}
        <div ref={containerRef} className={`flex-1 min-w-0 min-h-0 h-full ${painted ? '' : 'invisible'}`} />

        {/* 右欄：圖例＋面板（tall：改成地圖下方一列，圖例靠左、日期與面板靠右） */}
        <div className="w-1/4 min-w-56 max-w-80 shrink-0 min-h-0 flex flex-col gap-6 tall:w-full tall:max-w-none tall:flex-row tall:justify-between tall:items-end max-md:!flex-col max-md:!items-stretch">
          {/* 圖例：三種佔用狀態同 StatusChip 色票（pending 在地圖上叫待繳押金，同訂單頁分頁用字） */}
          <div className="flex flex-col gap-2 text-xs font-chinese text-white">
            {([['pending', '待繳押金'], ['in-progress', '使用中'], ['overdue', '未完成歸還（逾期）']] as const).map(([st, zh]) => (
              <span key={st} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3" style={{ backgroundColor: STATUS_META[st].color }} />{zh}
              </span>
            ))}
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-gray-mid" />已關閉
            </span>
          </div>

          <div className="min-h-0 flex flex-col gap-6 tall:w-80 max-md:!w-full">
          <DatePicker value={date} onChange={setDate} />

          {/* 選到的區塊：代號・區域＋該日期借用人。高度跟內容走；借用人太多超過右欄時只在面板內捲 */}
          {/* 灰卡片（gray-dark，同上方日期框底色、圓角 12px，地圖說明框那級）：全部白字（gray-dark 底上 gray-light 對比太低，2026-11-02） */}
          <div className="min-h-0 flex flex-col bg-gray-dark text-white rounded-xl p-4 text-xs tall:max-h-48">
            <div className="min-h-0 overflow-y-auto">
              {!selected ? (
                <p className="font-chinese">點地圖上的區塊查看借用人</p>
              ) : (
                <>
                  <p className="text-sm mb-3">
                    <span className="font-english text-white">{selected.id}</span>
                    <span className="font-chinese"> · {AREA_META[selected.area] ?? selected.area}</span>
                  </p>
                  {selectedOccupants.length === 0 ? (
                    <p className="font-chinese">此日期無人借用</p>
                  ) : (
                    <div className="divide-y divide-gray-mid">
                      {selectedOccupants.map(occupantRow)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminSpaceMapPage
