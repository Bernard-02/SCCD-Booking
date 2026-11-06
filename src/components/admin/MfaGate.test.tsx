import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MfaGate from './MfaGate'
import { getMfaStep, verifyMfa } from '../../services/authService'

vi.mock('../../services/authService', () => ({ getMfaStep: vi.fn(), verifyMfa: vi.fn() }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }))

const gate = () => render(<MfaGate><p>後台內容</p></MfaGate>)
const submitCode = (code: string) => {
  fireEvent.change(screen.getByLabelText('6 位數驗證碼'), { target: { value: code } })
  fireEvent.click(screen.getByRole('button', { name: '確認' }))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MfaGate', () => {
  it('已通過 2FA：直接顯示後台', async () => {
    vi.mocked(getMfaStep).mockResolvedValue({ kind: 'passed' })
    gate()
    expect(await screen.findByText('後台內容')).toBeTruthy()
  })

  it('要驗證：驗證碼錯不放行，對了才顯示後台', async () => {
    vi.mocked(getMfaStep).mockResolvedValue({ kind: 'verify', factorId: 'f1' })
    vi.mocked(verifyMfa).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    gate()
    await screen.findByLabelText('6 位數驗證碼')

    submitCode('111111')
    expect(await screen.findByText('驗證碼錯誤，請再試一次')).toBeTruthy()
    expect(screen.queryByText('後台內容')).toBeNull()

    submitCode('222222')
    expect(await screen.findByText('後台內容')).toBeTruthy()
    expect(verifyMfa).toHaveBeenLastCalledWith('f1', '222222')
  })

  it('還沒綁定：顯示 QR 與金鑰', async () => {
    vi.mocked(getMfaStep).mockResolvedValue({ kind: 'enroll', factorId: 'f1', qrCode: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABC123' })
    gate()
    expect(await screen.findByRole('img')).toBeTruthy()
    expect(screen.getByText('ABC123')).toBeTruthy()
    expect(screen.queryByText('後台內容')).toBeNull()
  })

  it('查不到狀態：關卡不放行', async () => {
    vi.mocked(getMfaStep).mockRejectedValue(new Error('network'))
    gate()
    expect(await screen.findByText('無法確認兩步驟驗證狀態，請重新整理')).toBeTruthy()
    expect(screen.queryByText('後台內容')).toBeNull()
  })
})
