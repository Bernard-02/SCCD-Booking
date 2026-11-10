/**
 * AdminMembersPage 測試：多選標會費時，未啟用的寫預先登記、有帳號的寫 students，身份／狀態下拉只給有帳號的人
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminMembersPage from './AdminMembersPage'
import { listMembers, updateAllowlistDues, updateMembersMany } from '../services/adminService'

vi.mock('../services/adminService', () => ({
  listMembers: vi.fn().mockResolvedValue([{
    id: 'u1', student_id: 'A1', name: '陳有帳號', email: 'a1@x.tw', phone: null, grade: '大三', class_name: '甲',
    role: 'student', account_level: 0, on_leave: false, graduated: false, is_transfer: false, dues_paid: false
  }]),
  listStaff: vi.fn().mockResolvedValue([]),
  listAllowlist: vi.fn().mockResolvedValue([{
    student_id: 'B2', name: '林未啟用', email: 'b2@x.tw', role: 'student', is_sa: true, grade: '大三', class_name: '乙', dues_paid: false, note: null
  }]),
  updateMembersMany: vi.fn().mockResolvedValue({ ok: true }),
  updateAllowlistDues: vi.fn().mockResolvedValue({ ok: true })
}))
vi.mock('../services/ordersService', () => ({ fetchAllOrders: vi.fn().mockResolvedValue([]), penaltyOwed: () => 0 }))
vi.mock('../hooks/useConfirmDialog', () => ({ useConfirmDialog: () => ({ confirm: () => Promise.resolve(true), ConfirmDialog: () => null }) }))
vi.mock('../components/admin/MemberImportDialog', () => ({ default: () => null }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const openSelect = async () => {
  render(<MemoryRouter><AdminMembersPage /></MemoryRouter>)
  await screen.findByText('林未啟用')
  fireEvent.click(screen.getByRole('button', { name: '選取' }))
}
const markPaid = () => fireEvent.click(screen.getByRole('button', { name: '標記已繳會費' }))

describe('已畢業篩選', () => {
  const clickGraduated = () => fireEvent.click(screen.getByRole('button', { name: '已畢業' }))

  it('沒有畢業生：顯示沒有符合的帳號，再按一次回來', async () => {
    render(<MemoryRouter><AdminMembersPage /></MemoryRouter>)
    await screen.findByText('林未啟用')
    clickGraduated()
    expect(screen.getByText('沒有符合的帳號')).toBeTruthy()
    expect(screen.queryByText('林未啟用')).toBeNull()
    clickGraduated()
    expect(screen.getByText('林未啟用')).toBeTruthy()
  })

  it('有畢業生：只列已畢業的', async () => {
    vi.mocked(listMembers).mockResolvedValueOnce([{
      id: 'u9', student_id: 'A9', name: '張畢業', email: 'a9@x.tw', phone: null, grade: '大四', class_name: '甲',
      role: 'student', account_level: 0, on_leave: false, graduated: true, is_transfer: false, dues_paid: true
    }] as never)
    render(<MemoryRouter><AdminMembersPage /></MemoryRouter>)
    await screen.findByText('林未啟用')
    expect(screen.queryByText('張畢業')).toBeNull()
    clickGraduated()
    expect(screen.getByText('張畢業')).toBeTruthy()
    expect(screen.queryByText('林未啟用')).toBeNull()
  })
})

describe('多選標會費', () => {
  it('只勾未啟用的：寫預先登記，沒有身份狀態下拉', async () => {
    await openSelect()
    fireEvent.click(screen.getByRole('checkbox', { name: '選取 林未啟用' }))
    expect(screen.queryAllByLabelText(/設定 林未啟用/)).toHaveLength(0)
    markPaid()
    await waitFor(() => expect(updateAllowlistDues).toHaveBeenCalledWith(['B2'], true))
    expect(updateMembersMany).not.toHaveBeenCalled()
  })

  it('全選：有帳號與未啟用各寫各的', async () => {
    await openSelect()
    fireEvent.click(screen.getByRole('checkbox', { name: '全選' }))
    expect(screen.queryAllByLabelText(/設定 陳有帳號/).length).toBeGreaterThan(0)
    markPaid()
    await waitFor(() => expect(updateAllowlistDues).toHaveBeenCalledWith(['B2'], true))
    expect(updateMembersMany).toHaveBeenCalledWith(['u1'], { dues_paid: true })
  })
})
