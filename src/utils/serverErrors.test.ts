import { afterEach, describe, expect, it } from 'vitest'
import { useLangStore } from '../stores/langStore'
import { serverErrorText } from './serverErrors'

afterEach(() => useLangStore.setState({ lang: 'zh' }))

describe('serverErrorText', () => {
  it('中文介面原樣回傳', () => {
    expect(serverErrorText('品項重複')).toBe('品項重複')
  })

  it('英文介面：固定句與帶參數的句子都對照', () => {
    useLangStore.setState({ lang: 'en' })
    expect(serverErrorText('品項重複')).toBe('Duplicate items in the order.')
    expect(serverErrorText('「腳架」該時段庫存不足（剩餘 3）')).toBe('Not enough "腳架" for these dates (3 left).')
    expect(serverErrorText('您已有一張未歸還的小量設備訂單（#2026001），需歸還後才能再借設備'))
      .toBe('You have an unreturned light equipment order (#2026001). Return it before booking equipment again.')
    expect(serverErrorText('您已有一張未歸還的團體空間訂單（#2026002），需歸還後才能再借空間'))
      .toBe('You have an unreturned group space order (#2026002). Return it before booking spaces again.')
    expect(serverErrorText('無法延期：「A」、「B」於延長期間已被其他訂單預約'))
      .toBe('Can’t extend: "A", "B" are booked by another order during the extension.')
  })

  it('英文介面對不到的照原文', () => {
    useLangStore.setState({ lang: 'en' })
    expect(serverErrorText('新的錯誤訊息')).toBe('新的錯誤訊息')
  })
})
