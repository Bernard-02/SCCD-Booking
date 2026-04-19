/**
 * 測試用的學生數據和認證功能
 * 從 test-auth-data.js 遷移
 */

// 簡單的哈希函數（僅用於測試）
function simpleHash(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 轉換為32位整數
  }
  return Math.abs(hash).toString(16)
}

// 學生數據接口
export interface Student {
  studentId: string
  name: string
  email: string
  phone: string | null
  department: string
  className: string
  year: string
  passwordHash: string
  isFirstLogin: boolean
  emailVerified: boolean
  createdAt: string
  lastLogin: string | null
}

// 測試用學生數據
export const TEST_STUDENTS: Student[] = [
  {
    studentId: 'A111144001',
    name: '阿志',
    email: 'A111144001@gm2.usc.edu.tw',
    phone: '0912345678',
    department: '媒體傳達設計系',
    className: '乙班',
    year: '111學年',
    passwordHash: simpleHash('20030911'),
    isFirstLogin: false,
    emailVerified: true,
    createdAt: '2025-01-01',
    lastLogin: null
  },
  {
    studentId: 'A111144002',
    name: '小美',
    email: 'A111144002@gm2.usc.edu.tw',
    phone: '0987654321',
    department: '媒體傳達設計系',
    className: '乙班',
    year: '111學年',
    passwordHash: simpleHash('20040301'),
    isFirstLogin: false,
    emailVerified: false, // 測試未驗證狀態
    createdAt: '2025-01-01',
    lastLogin: null
  },
  {
    studentId: 'A111141003',
    name: '大明',
    email: 'A111141003@gm2.usc.edu.tw',
    phone: null,
    department: '媒體傳達設計系',
    className: '甲班',
    year: '111學年',
    passwordHash: simpleHash('20020515'),
    isFirstLogin: false,
    emailVerified: true,
    createdAt: '2025-01-01',
    lastLogin: null
  }
]

// 驗證學號格式
export function validateStudentId(studentId: string): boolean {
  const pattern = /^A\d{3}(144|141)\d{3}$/
  return pattern.test(studentId)
}

// 驗證學校Email格式
export function validateSchoolEmail(email: string): boolean {
  const pattern = /^A\d{3}(144|141)\d{3}@gm2\.usc\.edu\.tw$/i
  return pattern.test(email)
}

// 登入結果接口
export interface LoginResult {
  success: boolean
  student?: Student
  token?: string
  expiresIn?: number
  message?: string
  error?: 'user_not_found' | 'invalid_password' | 'account_locked'
  errorCode?: string
  remainingTime?: number
}

// 防暴力破解管理
class BruteForceProtection {
  private failedAttempts: Map<string, number[]> = new Map()
  private readonly MAX_ATTEMPTS = 5
  private readonly LOCK_DURATION = 5 * 60 * 1000 // 5分鐘

  recordFailedAttempt(studentId: string): void {
    const now = Date.now()
    const attempts = this.failedAttempts.get(studentId) || []

    // 只保留最近5分鐘內的嘗試
    const recentAttempts = attempts.filter(time => now - time < this.LOCK_DURATION)
    recentAttempts.push(now)

    this.failedAttempts.set(studentId, recentAttempts)
  }

  isLocked(studentId: string): { locked: boolean; remainingTime?: number } {
    const attempts = this.failedAttempts.get(studentId) || []
    const now = Date.now()
    const recentAttempts = attempts.filter(time => now - time < this.LOCK_DURATION)

    if (recentAttempts.length >= this.MAX_ATTEMPTS) {
      const oldestAttempt = Math.min(...recentAttempts)
      const remainingTime = this.LOCK_DURATION - (now - oldestAttempt)
      return { locked: true, remainingTime }
    }

    return { locked: false }
  }

  clearAttempts(studentId: string): void {
    this.failedAttempts.delete(studentId)
  }
}

const bruteForceProtection = new BruteForceProtection()

// 模擬API登入
export async function mockApiLogin(studentId: string, password: string): Promise<LoginResult> {
  // 模擬網路延遲
  await new Promise(resolve => setTimeout(resolve, 500))

  // 檢查是否被鎖定
  const lockStatus = bruteForceProtection.isLocked(studentId)
  if (lockStatus.locked) {
    const minutes = Math.floor((lockStatus.remainingTime || 0) / 60000)
    const seconds = Math.floor(((lockStatus.remainingTime || 0) % 60000) / 1000)
    return {
      success: false,
      error: 'account_locked',
      errorCode: 'ACCOUNT_LOCKED',
      message: `帳號已被鎖定，請在 ${minutes}:${seconds.toString().padStart(2, '0')} 後重試`,
      remainingTime: lockStatus.remainingTime
    }
  }

  // 尋找學生
  const student = TEST_STUDENTS.find(s => s.studentId === studentId)

  if (!student) {
    bruteForceProtection.recordFailedAttempt(studentId)
    return {
      success: false,
      error: 'user_not_found',
      errorCode: 'STUDENT_NOT_FOUND',
      message: '學號不存在'
    }
  }

  // 檢查Email是否已驗證
  if (!student.emailVerified) {
    return {
      success: false,
      errorCode: 'EMAIL_NOT_VERIFIED',
      message: '請先驗證您的學校Email'
    }
  }

  // 驗證密碼
  const passwordHash = simpleHash(password)
  if (passwordHash !== student.passwordHash) {
    bruteForceProtection.recordFailedAttempt(studentId)
    const remainingAttempts = 5 - (bruteForceProtection['failedAttempts'].get(studentId)?.length || 0)

    return {
      success: false,
      error: 'invalid_password',
      errorCode: 'WRONG_PASSWORD',
      message: remainingAttempts > 0
        ? `密碼錯誤，還剩 ${remainingAttempts} 次嘗試機會`
        : '密碼錯誤'
    }
  }

  // 登入成功，清除失敗記錄
  bruteForceProtection.clearAttempts(studentId)

  // 生成token（實際應該由後端生成）
  const token = `token_${studentId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  const expiresIn = 7 * 24 * 60 * 60 * 1000 // 7天

  return {
    success: true,
    student: {
      ...student,
      lastLogin: new Date().toISOString()
    },
    token,
    expiresIn
  }
}
