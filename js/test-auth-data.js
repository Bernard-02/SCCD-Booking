// 測試用的學生數據和認證功能

// 簡單的哈希函數（僅用於測試，實際應使用更安全的方法）
function simpleHash(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 轉換為32位整數
  }
  return Math.abs(hash).toString(16);
}

// 測試用學生數據
const TEST_STUDENTS = [
  {
    studentId: "A111144001",
    name: "阿志",
    email: "A111144001@gm2.usc.edu.tw",
    phone: "0912345678",
    department: "媒體傳達設計系",
    className: "乙班", // 144=乙班
    year: "111學年",
    passwordHash: simpleHash("20030911"), // 預設密碼的哈希值 (生日格式)
    isFirstLogin: false, // 不強制修改密碼
    emailVerified: true,
    createdAt: "2025-01-01",
    lastLogin: null
  },
  {
    studentId: "A111144002",
    name: "小美",
    email: "A111144002@gm2.usc.edu.tw",
    phone: "0987654321",
    department: "媒體傳達設計系",
    className: "乙班",
    year: "111學年",
    passwordHash: simpleHash("20040301"), // 不同的預設密碼
    isFirstLogin: false,
    emailVerified: false, // 測試未驗證狀態
    createdAt: "2025-01-01",
    lastLogin: null
  },
  {
    studentId: "A111141003",
    name: "大明",
    email: "A111141003@gm2.usc.edu.tw",
    phone: null, // 測試未設定手機號碼
    department: "媒體傳達設計系",
    className: "甲班", // 141=甲班
    year: "111學年",
    passwordHash: simpleHash("20020515"), // 不同的預設密碼
    isFirstLogin: false,
    emailVerified: true,
    createdAt: "2025-01-01",
    lastLogin: null
  }
];

// 驗證學號格式（實踐大學格式：A+學年+144/141+學生號碼，如A111144001）
function validateStudentId(studentId) {
  const pattern = /^A\d{3}(144|141)\d{3}$/;
  return pattern.test(studentId);
}

// 驗證學校Email格式
function validateSchoolEmail(email) {
  const pattern = /^A\d{3}(144|141)\d{3}@gm2\.usc\.edu\.tw$/i;
  return pattern.test(email);
}

// 驗證密碼強度
function validatePasswordStrength(password) {
  if (password.length < 8) {
    return { valid: false, message: "密碼至少需要8個字符" };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasLetter) {
    return { valid: false, message: "密碼必須包含英文字母" };
  }

  // 需要至少包含：字母 + (數字或大小寫變化或符號)
  const hasComplexity = hasNumber || (hasUpperCase && hasLowerCase) || hasSymbol;

  if (!hasComplexity) {
    return { valid: false, message: "密碼必須包含數字、大小寫字母或符號" };
  }

  return { valid: true, message: "密碼強度良好" };
}

// 防暴力破解管理
class BruteForceProtection {
  constructor() {
    this.storageKey = 'sccd_login_attempts';
    this.maxAttempts = 3;
    this.lockoutDuration = 15 * 60 * 1000; // 15分鐘
  }

  getAttemptData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : { attempts: 0, lastAttempt: null, lockedUntil: null };
    } catch {
      return { attempts: 0, lastAttempt: null, lockedUntil: null };
    }
  }

  saveAttemptData(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  isLocked() {
    const data = this.getAttemptData();
    if (!data.lockedUntil) return false;

    const now = Date.now();
    if (now < data.lockedUntil) {
      return true;
    } else {
      // 鎖定時間已過，重置數據
      this.resetAttempts();
      return false;
    }
  }

  getRemainingLockTime() {
    const data = this.getAttemptData();
    if (!data.lockedUntil) return 0;

    const remaining = data.lockedUntil - Date.now();
    return Math.max(0, remaining);
  }

  recordFailedAttempt() {
    const data = this.getAttemptData();
    data.attempts += 1;
    data.lastAttempt = Date.now();

    if (data.attempts >= this.maxAttempts) {
      data.lockedUntil = Date.now() + this.lockoutDuration;
    }

    this.saveAttemptData(data);
  }

  resetAttempts() {
    this.saveAttemptData({ attempts: 0, lastAttempt: null, lockedUntil: null });
  }

  getAttemptsRemaining() {
    const data = this.getAttemptData();
    return Math.max(0, this.maxAttempts - data.attempts);
  }
}

const bruteForceProtection = new BruteForceProtection();

// 模擬API調用 - 驗證登入
function mockApiLogin(studentId, password) {
  return new Promise((resolve) => {
    // 檢查是否被鎖定
    if (bruteForceProtection.isLocked()) {
      const remainingTime = bruteForceProtection.getRemainingLockTime();
      const minutes = Math.ceil(remainingTime / (60 * 1000));

      resolve({
        success: false,
        message: `登入已被暫時鎖定，請在 ${minutes} 分鐘後再試`,
        errorCode: "ACCOUNT_LOCKED",
        remainingTime: remainingTime
      });
      return;
    }

    // 模擬網路延遲
    setTimeout(() => {
      const student = TEST_STUDENTS.find(s => s.studentId === studentId);

      if (!student) {
        bruteForceProtection.recordFailedAttempt();
        resolve({
          success: false,
          message: "學號不存在",
          errorCode: "STUDENT_NOT_FOUND",
          attemptsRemaining: bruteForceProtection.getAttemptsRemaining()
        });
        return;
      }

      if (!student.emailVerified) {
        resolve({
          success: false,
          message: "請先驗證您的學校Email",
          errorCode: "EMAIL_NOT_VERIFIED"
        });
        return;
      }

      const passwordHash = simpleHash(password);
      if (passwordHash !== student.passwordHash) {
        bruteForceProtection.recordFailedAttempt();
        const attemptsRemaining = bruteForceProtection.getAttemptsRemaining();

        let message = "密碼錯誤";
        if (attemptsRemaining > 0) {
          message += `，還剩 ${attemptsRemaining} 次嘗試機會`;
        } else {
          message = "密碼錯誤次數過多，帳號已被鎖定 15 分鐘";
        }

        resolve({
          success: false,
          message: message,
          errorCode: "WRONG_PASSWORD",
          attemptsRemaining: attemptsRemaining
        });
        return;
      }

      // 登入成功，重置失敗次數
      bruteForceProtection.resetAttempts();

      const loginData = {
        success: true,
        message: "登入成功",
        student: {
          studentId: student.studentId,
          name: student.name,
          email: student.email,
          department: student.department,
          year: student.year,
          isFirstLogin: student.isFirstLogin
        },
        token: `mock_token_${student.studentId}_${Date.now()}`,
        expiresIn: 30 * 24 * 60 * 60 * 1000 // 30天（毫秒）
      };

      resolve(loginData);
    }, 500); // 模擬500ms網路延遲
  });
}

// 模擬API調用 - 修改密碼
function mockApiChangePassword(studentId, oldPassword, newPassword) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const student = TEST_STUDENTS.find(s => s.studentId === studentId);

      if (!student) {
        resolve({
          success: false,
          message: "學號不存在"
        });
        return;
      }

      const oldPasswordHash = simpleHash(oldPassword);
      if (oldPasswordHash !== student.passwordHash) {
        resolve({
          success: false,
          message: "舊密碼錯誤"
        });
        return;
      }

      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        resolve({
          success: false,
          message: passwordValidation.message
        });
        return;
      }

      // 更新密碼（在實際應用中這會更新數據庫）
      student.passwordHash = simpleHash(newPassword);
      student.isFirstLogin = false;

      resolve({
        success: true,
        message: "密碼修改成功"
      });
    }, 300);
  });
}

// 導出函數供其他文件使用
if (typeof window !== 'undefined') {
  window.TestAuth = {
    mockApiLogin,
    mockApiChangePassword,
    validateStudentId,
    validateSchoolEmail,
    validatePasswordStrength,
    TEST_STUDENTS
  };
}