/**
 * timeUtils 測試：工作時計算、狀態判定、歸還期限順延、逾期罰款
 * 基準週：2026-07-13（一）～ 2026-07-19（日）
 */

import { describe, it, expect } from 'vitest'
import {
  businessMsBetween,
  minStartDate,
  pendingMsRemaining,
  displayOrderStatus,
  effectiveReturnDeadline,
  overdueBusinessDays,
  overduePenalty,
  isWithinExtendWindow,
  isOnDuty,
  dutyHoursText,
  closedDayImpact,
  addBusinessMs,
  dutySlotOptions,
  closedKey,
  closedRangeRows,
  closedRun,
  type ClosedShift,
  maxStartDate,
  slotClosed,
  shiftClosed,
  pendingDeadline,
  dateTimeLabel,
  PENDING_LIMIT_MS
} from './timeUtils'

const NONE = new Set<string>()
const HOUR = 60 * 60 * 1000

describe('businessMsBetween', () => {
  it('平日之間直接計算', () => {
    const start = new Date(2026, 6, 14, 10, 0) // 週二 10:00
    const end = new Date(2026, 6, 15, 10, 0)   // 週三 10:00
    expect(businessMsBetween(start, end, NONE)).toBe(24 * HOUR)
  })

  it('跨週末扣掉週六日整天', () => {
    const start = new Date(2026, 6, 17, 10, 0) // 週五 10:00
    const end = new Date(2026, 6, 20, 10, 0)   // 下週一 10:00
    expect(businessMsBetween(start, end, NONE)).toBe(24 * HOUR)
  })

  it('臨時公休日跟週末同等跳過', () => {
    const closed = new Set(['2026-07-15']) // 週三公休
    const start = new Date(2026, 6, 14, 10, 0) // 週二 10:00
    const end = new Date(2026, 6, 16, 10, 0)   // 週四 10:00
    expect(businessMsBetween(start, end, closed)).toBe(24 * HOUR)
  })

  it('start >= end 回傳 0', () => {
    const t = new Date(2026, 6, 14, 10, 0)
    expect(businessMsBetween(t, t, NONE)).toBe(0)
  })
})

describe('pendingMsRemaining / displayOrderStatus', () => {
  it('剛送單剩接近 24 小時', () => {
    const created = new Date(2026, 6, 14, 10, 0)
    const now = new Date(2026, 6, 14, 12, 0)
    expect(pendingMsRemaining(created.toISOString(), now, NONE)).toBe(PENDING_LIMIT_MS - 2 * HOUR)
  })

  it('pending 超過 24 工作時顯示 canceled', () => {
    const created = new Date(2026, 6, 13, 10, 0) // 週一 10:00
    const now = new Date(2026, 6, 15, 10, 1)     // 週三 10:01（已過 48h 工作時）
    expect(displayOrderStatus('pending', created.toISOString(), NONE, now)).toBe('canceled')
  })

  it('pending 未逾時維持 pending；其他狀態原樣沿用', () => {
    const created = new Date(2026, 6, 14, 10, 0)
    const now = new Date(2026, 6, 14, 20, 0)
    expect(displayOrderStatus('pending', created.toISOString(), NONE, now)).toBe('pending')
    expect(displayOrderStatus('returned', created.toISOString(), NONE, now)).toBe('returned')
    expect(displayOrderStatus('in-progress', '2020-01-01', NONE, now)).toBe('in-progress')
  })
})

describe('effectiveReturnDeadline', () => {
  it('歸還日是營業日：當天 19:00', () => {
    const d = effectiveReturnDeadline('2026-07-17', NONE) // 週五
    expect(d.getDay()).toBe(5)
    expect(d.getHours()).toBe(19)
  })

  it('歸還日是週日：順延到週一 19:00', () => {
    const d = effectiveReturnDeadline('2026-07-19', NONE) // 週日
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(20)
    expect(d.getHours()).toBe(19)
  })

  it('順延目標又撞臨時公休：繼續往後找營業日', () => {
    const closed = new Set(['2026-07-20']) // 週一公休
    const d = effectiveReturnDeadline('2026-07-19', closed) // 週日
    expect(d.getDate()).toBe(21) // 週二
  })
})

describe('overdueBusinessDays / overduePenalty', () => {
  it('未過期限回傳 0 天、0 元', () => {
    const now = new Date(2026, 6, 17, 18, 0) // 週五 18:00，期限當天未過
    expect(overdueBusinessDays('2026-07-17', NONE, now)).toBe(0)
    expect(overduePenalty('2026-07-17', 5000, NONE, now)).toBe(0)
  })

  it('逾期天數不含週末：週五到期、下週一還 = 1 天 100 元', () => {
    const now = new Date(2026, 6, 20, 10, 0) // 下週一 10:00
    expect(overdueBusinessDays('2026-07-17', NONE, now)).toBe(1)
    expect(overduePenalty('2026-07-17', 5000, NONE, now)).toBe(100)
  })

  it('罰款每日翻倍累計：3 個營業日 = 100+200+400 = 700', () => {
    const now = new Date(2026, 6, 22, 10, 0) // 下週三（一二三共 3 個營業日）
    expect(overdueBusinessDays('2026-07-17', NONE, now)).toBe(3)
    expect(overduePenalty('2026-07-17', 5000, NONE, now)).toBe(700)
  })

  it('罰款上限為押金總額', () => {
    const now = new Date(2026, 6, 22, 10, 0) // 3 個營業日 = 700
    expect(overduePenalty('2026-07-17', 500, NONE, now)).toBe(500)
  })

  it('長期逾期不溢位、鎖在押金上限', () => {
    const now = new Date(2027, 6, 17, 10, 0) // 一年後
    expect(overduePenalty('2026-07-17', 5000, NONE, now)).toBe(5000)
  })
})

describe('isWithinExtendWindow（延期前三天邊界）', () => {
  const now = new Date(2026, 6, 14, 10, 0) // 週二 7/14

  it('歸還日 7/17：今天 7/14 = 前三天邊界（含），可延', () => {
    expect(isWithinExtendWindow('2026-07-17', now)).toBe(true)
  })
  it('歸還日 7/16：今天 7/14 已逾前三天，不可延', () => {
    expect(isWithinExtendWindow('2026-07-16', now)).toBe(false)
  })
  it('歸還日 7/20：離歸還日還很遠，可延', () => {
    expect(isWithinExtendWindow('2026-07-20', now)).toBe(true)
  })
})

describe('isOnDuty', () => {
  // 週二 12:30（2026-07-14）；時段格式同 Postgres time：'HH:MM:SS'
  const tue1230 = new Date(2026, 6, 14, 12, 30)
  const tueNoon = [{ weekday: 2, start_time: '12:00:00', end_time: '13:00:00' }]

  it('now 落在值班時段內 → 值班中', () => {
    expect(isOnDuty(tueNoon, tue1230)).toBe(true)
  })
  it('同時段但不同天 → 不在班', () => {
    expect(isOnDuty([{ weekday: 3, start_time: '12:00:00', end_time: '13:00:00' }], tue1230)).toBe(false)
  })
  it('邊界：開始時間含、結束時間不含', () => {
    expect(isOnDuty(tueNoon, new Date(2026, 6, 14, 12, 0))).toBe(true)
    expect(isOnDuty(tueNoon, new Date(2026, 6, 14, 13, 0))).toBe(false)
  })
  it('多時段任一命中即值班；無時段 → 不在班', () => {
    const multi = [
      { weekday: 2, start_time: '17:00:00', end_time: '19:00:00' },
      ...tueNoon
    ]
    expect(isOnDuty(multi, tue1230)).toBe(true)
    expect(isOnDuty([], tue1230)).toBe(false)
  })
})

describe('closedDayImpact（新增公休 → 歸還期限順延）', () => {
  const end = (end_date: string) => ({ end_date })

  it('歸還日當天公休 → 順延到隔天營業日', () => {
    // 週二歸還、週二公休 → 週三
    expect(closedDayImpact(end('2026-07-14'), ['2026-07-14'], new Set(['2026-07-14']))).toBe('2026-07-15')
  })

  it('週末連鎖：週六歸還本已順延到週一，週一再公休 → 週二', () => {
    expect(closedDayImpact(end('2026-07-18'), ['2026-07-20'], new Set(['2026-07-20']))).toBe('2026-07-21')
  })

  it('公休日落在租借期間中間 → 不順延', () => {
    expect(closedDayImpact(end('2026-07-17'), ['2026-07-15'], new Set(['2026-07-15']))).toBeNull()
  })

  it('一次新增多天：連續公休一起順延', () => {
    const added = ['2026-07-14', '2026-07-15']
    expect(closedDayImpact(end('2026-07-14'), added, new Set(added))).toBe('2026-07-16')
  })

  it('只休晚班：當天沒有 19:00 的收件 → 順延；只休午班不影響', () => {
    const evening = closedKey('2026-07-14', 'evening')
    const noon = closedKey('2026-07-14', 'noon')
    expect(closedDayImpact(end('2026-07-14'), [evening], new Set([evening]))).toBe('2026-07-15')
    expect(closedDayImpact(end('2026-07-14'), [noon], new Set([noon]))).toBeNull()
  })
})

describe('公休時段', () => {
  it('slotClosed：整天擋所有班；只休一班只擋那班', () => {
    const noon = new Set([closedKey('2026-07-14', 'noon')])
    expect(slotClosed('2026-07-14', '12:00-13:00', noon)).toBe(true)
    expect(slotClosed('2026-07-14', '17:00-19:00', noon)).toBe(false)
    expect(slotClosed('2026-07-14', '17:00-19:00', new Set(['2026-07-14']))).toBe(true)
  })

  it('shiftClosed：只休那一班、公休整天、週六日都算沒開（分時段的設備）', () => {
    const noon = new Set([closedKey('2026-07-14', 'noon')])
    expect(shiftClosed('2026-07-14', 'noon', noon)).toBe(true)
    expect(shiftClosed('2026-07-14', 'evening', noon)).toBe(false)
    expect(shiftClosed('2026-07-14', 'evening', new Set(['2026-07-14']))).toBe(true)
    expect(shiftClosed('2026-07-18', 'noon', NONE)).toBe(true) // 週六
    expect(shiftClosed('2026-07-15', 'noon', noon)).toBe(false) // 隔天照常
  })

  it('只休一班的日子不暫停倒數', () => {
    const start = new Date(2026, 6, 14, 10, 0) // 週二
    const end = new Date(2026, 6, 15, 10, 0)
    expect(businessMsBetween(start, end, new Set([closedKey('2026-07-14', 'noon')]))).toBe(24 * HOUR)
  })

  it('closedRangeRows：單天＝午班到晚班整天、同一班只休那班', () => {
    expect(closedRangeRows('2026-07-14', '2026-07-14', 'noon', 'evening')).toEqual([{ day: '2026-07-14', shift: 'all' }])
    expect(closedRangeRows('2026-07-14', '2026-07-14', 'noon', 'noon')).toEqual([{ day: '2026-07-14', shift: 'noon' }])
    expect(closedRangeRows('2026-07-14', '2026-07-14', 'evening', 'evening')).toEqual([{ day: '2026-07-14', shift: 'evening' }])
  })

  it('closedRangeRows：跨多天從第一天開始班到最後一天結束班，週末不列', () => {
    expect(closedRangeRows('2026-07-16', '2026-07-21', 'evening', 'noon')).toEqual([
      { day: '2026-07-16', shift: 'evening' }, // 週四晚班起
      { day: '2026-07-17', shift: 'all' },
      { day: '2026-07-20', shift: 'all' },
      { day: '2026-07-21', shift: 'noon' }     // 週二午班止
    ])
    expect(closedRangeRows('2026-07-18', '2026-07-19', 'noon', 'evening')).toEqual([])
  })

  it('closedRun：同原因跨週末與法定假日算一段，班接不上或原因不同就斷', () => {
    const r = (day: string, shift: ClosedShift = 'all', kind = 'activity', reason: string | null = null) => ({ day, shift, kind, reason })
    const rows = [
      r('2026-07-16', 'evening'),                // 週四晚班起
      r('2026-07-17'),                           // 週五，後面隔週末
      r('2026-07-20', 'all', 'holiday', '假日'), // 週一法定假日，隔過去但不算進去
      r('2026-07-21', 'noon'),                   // 週二休到午班
      r('2026-07-22', 'noon'),                   // 週三只休午班：前一天沒休到晚班，接不上
      r('2026-07-23', 'all', 'review')           // 週四原因不同
    ]
    const days = (day: string) => closedRun(rows, day).map(c => c.day)
    expect(days('2026-07-17')).toEqual(['2026-07-16', '2026-07-17', '2026-07-21'])
    expect(days('2026-07-21')).toEqual(['2026-07-16', '2026-07-17', '2026-07-21'])
    expect(days('2026-07-20')).toEqual(['2026-07-20'])
    expect(days('2026-07-22')).toEqual(['2026-07-22'])
    expect(days('2026-07-23')).toEqual(['2026-07-23'])
    expect(days('2026-07-24')).toEqual([])
  })

  it('dutySlotOptions 跳過公休的那一班', () => {
    const duties = [
      { weekday: 2, start_time: '12:00:00', end_time: '13:00:00' },
      { weekday: 2, start_time: '17:00:00', end_time: '19:00:00' }
    ]
    const opts = dutySlotOptions(duties, new Date('2026-07-14T00:00'), new Date('2026-07-14T23:59'), new Set([closedKey('2026-07-14', 'noon')]))
    expect(opts).toEqual([{ date: '2026-07-14', slot: '17:00-19:00' }])
  })
})

describe('起租日上限與押金 0 的單', () => {
  it('maxStartDate：今天＋30 天，系秘不受限', () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 30)
    expect(maxStartDate('student')).toEqual(d)
    expect(maxStartDate(undefined)).toEqual(d)
    expect(maxStartDate('staff')).toBeUndefined()
  })

  it('繳押金時段結束前不算逾時（公休順延超過 24 工作時）', () => {
    const created = new Date(2026, 6, 13, 10, 0).toISOString() // 週一 10:00
    const now = new Date(2026, 6, 15, 10, 0)                   // 週三 10:00，24 工作時已過
    const slot = new Date(2026, 6, 15, 13, 0)
    expect(pendingMsRemaining(created, now, NONE)).toBeLessThan(0)
    expect(pendingMsRemaining(created, now, NONE, slot)).toBe(3 * HOUR)
    expect(displayOrderStatus('pending', created, NONE, now)).toBe('canceled')
    expect(displayOrderStatus('pending', created, NONE, now, slot)).toBe('pending')
  })

  it('押金 0 的單試算以 5,000 為上限（老師名義沒有押金當上限）', () => {
    const now = new Date(2026, 6, 28, 12, 0)
    expect(overduePenalty('2026-07-17', 0, NONE, now)).toBe(5000)
  })
})

describe('addBusinessMs／dutySlotOptions（大量設備選繳押金／取件時段）', () => {
  it('週五 15:00 送單＋24 工作時 → 跳過週末，下週一 15:00', () => {
    const d = addBusinessMs(new Date('2026-07-17T15:00'), PENDING_LIMIT_MS, NONE)
    expect(d).toEqual(new Date('2026-07-20T15:00'))
  })

  it('週一臨時公休 → 再順延到週二 15:00', () => {
    const d = addBusinessMs(new Date('2026-07-17T15:00'), PENDING_LIMIT_MS, new Set(['2026-07-20']))
    expect(d).toEqual(new Date('2026-07-21T15:00'))
  })

  it('後台顯示的繳押金期限：週五關門後送單 → 下週一同一時間；選的繳押金時段比較晚就看時段', () => {
    const created = new Date('2026-07-17T20:00').toISOString() // 週五 20:00
    expect(dateTimeLabel(pendingDeadline(created, NONE))).toBe('7/20（一）20:00')
    expect(dateTimeLabel(pendingDeadline(created, new Set(['2026-07-20'])))).toBe('7/21（二）20:00')
    expect(dateTimeLabel(pendingDeadline(created, NONE, new Date('2026-07-22T13:00')))).toBe('7/22（三）13:00')
    // 週六送的單：週一 00:00 才開始算，期限是週一整天結束
    expect(dateTimeLabel(pendingDeadline(new Date('2026-07-18T10:00').toISOString(), NONE))).toBe('7/20（一）24:00')
    // 與倒數同一個時間點：到期前一分鐘還有剩，到期那一刻歸零
    const deadline = pendingDeadline(created, NONE)
    expect(pendingMsRemaining(created, new Date(deadline.getTime() - 60_000), NONE)).toBe(60_000)
    expect(pendingMsRemaining(created, deadline, NONE)).toBe(0)
  })

  it('只列區間內、未結束、非公休日的值班時段', () => {
    const duties = [
      { weekday: 1, start_time: '12:00:00', end_time: '13:00:00' }, // 週一
      { weekday: 3, start_time: '12:00:00', end_time: '13:00:00' }, // 週三
      { weekday: 6, start_time: '10:00:00', end_time: '11:00:00' }  // 週六（公休，不列）
    ]
    // 週一 12:30 起：週一時段尚未結束 → 列入；週三在 until 內 → 列入；下週一超出 until
    const opts = dutySlotOptions(duties, new Date('2026-07-13T12:30'), new Date('2026-07-17T18:00'), NONE)
    expect(opts).toEqual([
      { date: '2026-07-13', slot: '12:00-13:00' },
      { date: '2026-07-15', slot: '12:00-13:00' }
    ])
  })
})

describe('minStartDate', () => {
  it('只有大量設備要 3 天前，團體空間當天可借', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = (d: Date) => Math.round((d.getTime() - today.getTime()) / 86400000)
    expect(days(minStartDate('equipment', 'mass-personal'))).toBe(3)
    expect(days(minStartDate('equipment', 'little'))).toBe(0)
    expect(days(minStartDate('space', 'mass-group'))).toBe(0)
  })
})

describe('dutyHoursText（前台營業時間）', () => {
  const slot = (weekday: number, start: string, end: string) => ({ weekday, start_time: `${start}:00`, end_time: `${end}:00` })
  const weekdays = [1, 2, 3, 4, 5].flatMap(w => [slot(w, '17:00', '19:00'), slot(w, '12:00', '13:00')])

  it('週一到週五同時段 → 平日，時段照時間排', () => {
    expect(dutyHoursText(weekdays)).toEqual({
      zh: '平日 12:00–13:00、17:00–19:00',
      en: 'Weekdays 12:00–13:00, 17:00–19:00'
    })
  })

  it('不同人重疊／相接的時段合併；時段不同的星期分組', () => {
    expect(dutyHoursText([
      slot(1, '12:00', '13:00'), slot(1, '12:30', '14:00'), slot(1, '14:00', '15:00'),
      slot(3, '12:00', '15:00'),
      slot(2, '17:00', '19:00')
    ])).toEqual({
      zh: '週一、週三 12:00–15:00；週二 17:00–19:00',
      en: 'Mon, Wed 12:00–15:00; Tue 17:00–19:00'
    })
  })

  it('沒有排班 → null', () => {
    expect(dutyHoursText([])).toBeNull()
  })
})

// ---- 部分時段：逐日 key 與連續段 ----
import { contiguousRuns, dayKeysBetween, fromDateKey } from './timeUtils'

describe('部分時段可借用', () => {
  const days = dayKeysBetween(fromDateKey('2026-10-01'), fromDateKey('2026-10-10'))

  it('10/1–10/10 拆成 10 個 key', () => {
    expect(days).toHaveLength(10)
    expect(days[0]).toBe('2026-10-01')
    expect(days[9]).toBe('2026-10-10')
  })

  it('前後兩段可借，依日期順序', () => {
    const ok = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'])
    expect(contiguousRuns(ok, days)).toEqual([['2026-10-01', '2026-10-03'], ['2026-10-07', '2026-10-10']])
  })

  it('每天都夠＝一整段；沒有一天夠＝沒有段', () => {
    expect(contiguousRuns(new Set(days), days)).toEqual([['2026-10-01', '2026-10-10']])
    expect(contiguousRuns(new Set(), days)).toEqual([])
  })
})

// ---- 分時段的設備（雷切機）：只借其中幾天（days） ----
import { daysLabel, shiftPassed } from './timeUtils'
import { reservedFor } from '../components/cart/cartHelpers'

describe('分時段設備借的那幾天', () => {
  it('daysLabel：連續的日子收成一段，跨月也算連續；沒有 days＝空字串', () => {
    expect(daysLabel(['2026-11-19', '2026-11-17', '2026-11-18', '2026-11-24'])).toBe('11/17–11/19、11/24')
    expect(daysLabel(['2026-11-30', '2026-12-01'], ', ')).toBe('11/30–12/1')
    expect(daysLabel(['2026-11-17', '2026-11-19'], ', ')).toBe('11/17, 11/19')
    expect(daysLabel(null)).toBe('')
  })

  const item = { id: 'L', name: '雷切機（午班）', startDate: '2026-11-17', endDate: '2026-11-21' }
  const range = { L: { reserved: 1 } }
  const daily = { L: { '2026-11-18': 1 } }
  const BEFORE = new Date(2026, 10, 16, 10, 0) // 租借日期之前

  it('reservedFor：有 days 只看借的那幾天，別人借的是別天就不算', () => {
    expect(reservedFor({ ...item, days: ['2026-11-17', '2026-11-19'] }, range, daily, BEFORE)).toBe(0)
    expect(reservedFor({ ...item, days: ['2026-11-17', '2026-11-18'] }, range, daily, BEFORE)).toBe(1)
  })

  it('reservedFor：沒有 days 看整段；沒有逐日資料退回整段；選的日子超出租借日期＝借不到', () => {
    expect(reservedFor(item, range, daily, BEFORE)).toBe(1)
    expect(reservedFor({ ...item, days: ['2026-11-17'] }, range, null, BEFORE)).toBe(1)
    expect(reservedFor({ ...item, days: ['2026-11-24'] }, range, daily, BEFORE)).toBe(Infinity)
  })

  it('今天過了的班不能借：午班到 13:00、晚班到 19:00，隔天的照常', () => {
    const at = (h: number, m = 0) => new Date(2026, 10, 17, h, m)
    expect(shiftPassed('2026-11-17', 'noon', at(12, 59))).toBe(false)
    expect(shiftPassed('2026-11-17', 'noon', at(13))).toBe(true)
    expect(shiftPassed('2026-11-17', 'evening', at(13))).toBe(false)
    expect(shiftPassed('2026-11-17', 'evening', at(19))).toBe(true)
    expect(shiftPassed('2026-11-18', 'noon', at(19))).toBe(false)
    expect(shiftPassed('2026-11-16', 'evening', at(9))).toBe(true)
    // 清單裡放到下午才送：今天午班那格借不到，晚班的還可以
    expect(reservedFor({ ...item, days: ['2026-11-17'] }, {}, {}, at(14))).toBe(Infinity)
    expect(reservedFor({ ...item, name: '雷切機（晚班）', days: ['2026-11-17'] }, {}, {}, at(14))).toBe(0)
  })
})

// ---- 過了今天最後營業時間，歸還日不能是今天 ----
import { minEndDate, periodExpired, toDateKey } from './timeUtils'

describe('過了最後營業時間的歸還日', () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 17, h, m) // 11/17（二）

  it('minEndDate：19:00 前可以當天還，19:00 起最早明天', () => {
    expect(toDateKey(minEndDate(at(18, 59)))).toBe('2026-11-17')
    expect(toDateKey(minEndDate(at(19)))).toBe('2026-11-18')
  })

  it('periodExpired：起租日過了，或 19:00 後歸還日還是今天；借到明天的不算', () => {
    expect(periodExpired('2026-11-16', '2026-11-18', at(10))).toBe(true)
    expect(periodExpired('2026-11-17', '2026-11-17', at(10))).toBe(false)
    expect(periodExpired('2026-11-17', '2026-11-17', at(20))).toBe(true)
    expect(periodExpired('2026-11-17', '2026-11-18', at(20))).toBe(false)
  })
})
