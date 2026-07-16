/**
 * timeUtils 測試：工作時計算、狀態判定、歸還期限順延、逾期罰款
 * 基準週：2026-07-13（一）～ 2026-07-19（日）
 */

import { describe, it, expect } from 'vitest'
import {
  businessMsBetween,
  pendingMsRemaining,
  displayOrderStatus,
  effectiveReturnDeadline,
  overdueBusinessDays,
  overduePenalty,
  isWithinExtendWindow,
  isOnDuty,
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
