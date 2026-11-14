/**
 * 設備組合（後台「設備管理 › 組合」設定）：湊滿一組＝押金只收一組、9 件額度／大量 10 件門檻也只算 1 件；
 * 湊不滿的零件照單件押金與件數計。與 SQL equipment_bundle_calc（supabase/equipment-bundles.sql）同演算法，改一邊要改另一邊。
 */

export interface Bundle {
  id: string
  name: string
  deposit: number // 一組的押金
  items: { equipmentId: string; quantity: number }[] // 一組需要的品項與數量
}

export interface BundleLine {
  id: string
  quantity: number
  deposit: number // 單件押金
}

export interface BundleCalc {
  units: number // 件數：每組算 1 件＋湊不成組的零件數量
  deposit: number // 押金（未 cap 5,000）
  sets: { bundle: Bundle; count: number }[] // 湊成的組
  left: Record<string, number> // 湊組後剩下的零件數量
}

/**
 * 分時段的設備（名稱結尾（午班）／（晚班）、其餘相同的一對，目前是雷切機）：兩班都借押金只收一份、算 1 件，
 * 不用在後台建組合（2026-11-14 Bernard 定）——從設備名稱推出內建的組合，接在後台組合後面一起湊（equipmentService.loadBundles）。
 * 押金取兩班裡較高的那個。SQL equipment_bundle_calc 的分時段那段同規則，改一邊要改另一邊。
 */
export const SHIFT_RE = /\s*[（(](午班|晚班)[）)]\s*$/
export const shiftPairBundles = (equipment: { id: string; name: string; deposit: number }[]): Bundle[] => {
  const byBase: Record<string, { noon?: typeof equipment[number]; evening?: typeof equipment[number] }> = {}
  for (const e of equipment) {
    const m = e.name.match(SHIFT_RE)
    if (m) (byBase[e.name.replace(SHIFT_RE, '')] ??= {})[m[1] === '午班' ? 'noon' : 'evening'] = e
  }
  return Object.entries(byBase).flatMap(([base, { noon, evening }]) => (noon && evening ? [{
    id: `shift:${noon.id}`,
    name: `${base}（午班＋晚班）`,
    deposit: Math.max(noon.deposit, evening.deposit),
    items: [{ equipmentId: noon.id, quantity: 1 }, { equipmentId: evening.id, quantity: 1 }]
  }] : []))
}

// ponytail: 依後台建立順序貪婪湊組（同一設備可屬多個組合時先建的優先），不求全域最省；組合多到會互搶再改最佳化
export const calcBundles = (lines: BundleLine[], bundles: Bundle[]): BundleCalc => {
  const left: Record<string, number> = {}
  const unitDeposit: Record<string, number> = {}
  for (const l of lines) {
    left[l.id] = (left[l.id] ?? 0) + l.quantity
    unitDeposit[l.id] = l.deposit
  }

  let units = 0
  let deposit = 0
  const sets: BundleCalc['sets'] = []
  for (const bundle of bundles) {
    if (bundle.items.length === 0) continue
    const count = Math.min(...bundle.items.map(c => Math.floor((left[c.equipmentId] ?? 0) / c.quantity)))
    if (count <= 0) continue
    bundle.items.forEach(c => { left[c.equipmentId] -= count * c.quantity })
    units += count
    deposit += count * bundle.deposit
    sets.push({ bundle, count })
  }

  for (const [id, q] of Object.entries(left)) {
    units += q
    deposit += q * (unitDeposit[id] ?? 0)
  }
  return { units, deposit, sets, left }
}

/**
 * 顯示用（訂單明細、收據）：拆成「湊成的組合」與「剩下的單件」，單件保留原本欄位（待點交等標記）。
 * 同設備有多列時（已點交＋待點交），後面的列先當單件。
 */
export const splitIntoSets = <T extends BundleLine>(lines: T[], bundles: Bundle[]) => {
  const { sets, left } = calcBundles(lines, bundles)
  const remaining = { ...left }
  const loose = [...lines].reverse().flatMap(l => {
    const q = Math.min(remaining[l.id] ?? 0, l.quantity)
    remaining[l.id] = (remaining[l.id] ?? 0) - q
    return q > 0 ? [{ ...l, quantity: q }] : []
  }).reverse()
  return { sets, loose }
}
