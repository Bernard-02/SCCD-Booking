import { describe, expect, it } from 'vitest'
import { calcBundles, shiftPairBundles, splitIntoSets, type Bundle } from './bundleUtils'

// 木桌組：1 板＋4 腳架＋8 支架，一組押金 500（各單件 500）
const TABLE: Bundle = {
  id: 'b1', name: '木桌組', deposit: 500,
  items: [{ equipmentId: 'board', quantity: 1 }, { equipmentId: 'leg', quantity: 4 }, { equipmentId: 'bracket', quantity: 8 }]
}
const line = (id: string, quantity: number) => ({ id, quantity, deposit: 500 })

describe('calcBundles', () => {
  it('湊滿一組：押金 500、算 1 件', () => {
    const r = calcBundles([line('board', 1), line('leg', 4), line('bracket', 8)], [TABLE])
    expect(r).toMatchObject({ units: 1, deposit: 500 })
    expect(r.sets[0].count).toBe(1)
  })

  it('少一個支架：照單件計', () => {
    expect(calcBundles([line('board', 1), line('leg', 4), line('bracket', 7)], [TABLE]))
      .toMatchObject({ units: 12, deposit: 6000, sets: [] })
  })

  it('兩組＋多出的零件照單件加上去', () => {
    const r = calcBundles([line('board', 2), line('leg', 9), line('bracket', 16), line('other', 1)], [TABLE])
    expect(r).toMatchObject({ units: 2 + 1 + 1, deposit: 1000 + 500 + 500 })
    expect(r.left).toMatchObject({ board: 0, leg: 1, bracket: 0, other: 1 })
  })

  it('splitIntoSets：一組＋多出的腳架成單件，保留原欄位', () => {
    const r = splitIntoSets(
      [line('board', 1), { ...line('leg', 4), tag: 'held' }, { ...line('leg', 1), tag: 'pending' }, line('bracket', 8)],
      [TABLE]
    )
    expect(r.sets[0].count).toBe(1)
    expect(r.loose).toEqual([{ id: 'leg', quantity: 1, deposit: 500, tag: 'pending' }])
  })

  it('沒有組合時同原本算法', () => {
    expect(calcBundles([line('a', 3)], [])).toMatchObject({ units: 3, deposit: 1500 })
  })
})

describe('shiftPairBundles（分時段的設備：雷切機午班＋晚班）', () => {
  const EQUIPMENT = [
    { id: 'L', name: '雷切機（午班）', deposit: 1000 },
    { id: 'L-E', name: '雷切機(晚班)', deposit: 1000 },
    { id: 'cam', name: '相機', deposit: 500 },
    { id: 'solo', name: '熱壓機（午班）', deposit: 800 } // 只有一班：不成對
  ]
  const pairs = shiftPairBundles(EQUIPMENT)

  it('名稱結尾（午班）／（晚班）、其餘相同的才成對，押金一份', () => {
    expect(pairs).toEqual([{
      id: 'shift:L', name: '雷切機（午班＋晚班）', deposit: 1000,
      items: [{ equipmentId: 'L', quantity: 1 }, { equipmentId: 'L-E', quantity: 1 }]
    }])
  })

  it('兩班都借：押金 1,000、算 1 件；只借一班照單件', () => {
    const l = (id: string) => ({ id, quantity: 1, deposit: 1000 })
    expect(calcBundles([l('L'), l('L-E')], pairs)).toMatchObject({ units: 1, deposit: 1000 })
    expect(calcBundles([l('L')], pairs)).toMatchObject({ units: 1, deposit: 1000, sets: [] })
  })
})
