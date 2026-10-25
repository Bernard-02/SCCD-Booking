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
