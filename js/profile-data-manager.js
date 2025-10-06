// 個人資料數據管理器 - 負責處理個人資料相關邏輯

// SVG 圖標常量
const PASSWORD_ICONS = {
  VISIBLE: `
    <svg width="18" height="12" viewBox="0 0 409.19 260.49" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="m.31,127.88c1.02-3.69,3.59-6.84,5.95-9.8,28.79-36.09,62.2-67.03,102.37-90.18C135.08,12.66,163.29,2.42,193.99.36c28.12-1.89,55.03,3.64,80.83,14.67,36.97,15.81,68.59,39.44,96.71,67.8,11.68,11.78,22.35,24.59,33.14,37.22,6.13,7.17,5.91,13.07.05,20.48-28.95,36.67-62.57,68.16-103.17,91.65-32.1,18.57-66.35,29.82-103.97,28.15-25.73-1.14-50.01-8.08-73.05-19.39-48.37-23.76-87.09-59.08-120.22-100.99-2.66-3.32-5.21-7.67-4-12.07Zm378.8,2.65c-8.32-9-15.68-17.4-23.51-25.34-26.33-26.72-55.47-49.65-90.16-64.7-17.29-7.5-35.29-12.43-54.27-13.32-29.01-1.37-55.69,6.73-81.1,19.87-28.4,14.68-52.96,34.5-75.32,57.13-8.2,8.3-15.89,17.09-24.21,26.09,8.08,8.73,15.51,17.22,23.43,25.23,26.26,26.6,55.27,49.46,89.84,64.47,17.3,7.51,35.28,12.47,54.25,13.4,29.01,1.42,55.69-6.68,81.13-19.75,24.67-12.68,46.56-29.33,66.49-48.47,11.39-10.94,21.99-22.7,33.44-34.61Z" fill="#a4a4a4"/>
      <path d="m285.48,130.42c-.14,44.62-36.28,80.67-80.82,80.62-44.73-.05-81.05-36.55-80.72-81.12.33-44.71,36.55-80.65,81.01-80.42,44.66.24,80.66,36.41,80.52,80.92Zm-26.93-.23c-.09-29.73-24.15-53.78-53.82-53.81-29.63-.02-53.73,24.02-53.9,53.76-.17,29.67,24.43,54.24,54.06,54.01,29.8-.24,53.75-24.32,53.66-53.96Z" fill="#a4a4a4"/>
    </svg>
  `,
  HIDDEN: `
    <svg width="18" height="12" viewBox="0 0 409.19 274.6" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="m308.4,237.8s0,0,0,0l-19.66-19.66s0,0,0,0l-24.06-24.06s0,0,0,0l-19.07-19.07s0,0,0,0l-75.9-75.9s0,0,0,0l-19.09-19.09s0,0,0,0l-22.31-22.31s0,0,0,0l-19.93-19.93s0,0,0,0L74.99,4.39c-5.86-5.86-15.36-5.86-21.21,0-5.86,5.86-5.86,15.35,0,21.21l28.79,28.79C53.7,74.95,28.59,99.8,6.26,127.78c-2.36,2.96-4.93,6.12-5.95,9.8-1.22,4.4,1.34,8.75,4,12.07,33.14,41.91,71.86,77.23,120.22,100.99,23.03,11.31,47.31,18.25,73.05,19.39,29.64,1.31,57.2-5.4,83.25-17.38l17.56,17.56c2.93,2.93,6.77,4.39,10.61,4.39s7.68-1.46,10.61-4.39c5.86-5.86,5.86-15.36,0-21.21l-11.2-11.2Zm-155.37-112.94l66.8,66.8c-4.74,1.39-9.75,2.17-14.95,2.21-29.62.24-54.23-24.34-54.06-54.01.03-5.21.8-10.24,2.2-15Zm45.02,118.22c-18.97-.93-36.96-5.89-54.25-13.4-34.57-15.01-63.58-37.88-89.84-64.47-7.91-8.02-15.35-16.51-23.43-25.23,8.32-9,16.02-17.8,24.21-26.09,14.63-14.8,30.21-28.39,47.18-40.13l30.42,30.42c-5.29,10.69-8.3,22.72-8.4,35.46-.33,44.57,35.99,81.07,80.72,81.12,12.89.01,25.08-3,35.89-8.37l19.62,19.62c-19.69,7.81-40.25,12.15-62.12,11.08Z" fill="#a4a4a4"/>
      <path d="m404.67,129.77c-10.79-12.63-21.46-25.43-33.14-37.22-28.12-28.36-59.74-51.99-96.71-67.8-25.8-11.04-52.71-16.56-80.83-14.67-25.52,1.71-49.32,9.09-71.81,20.28l20.42,20.42c21.64-9.52,44.29-15.03,68.58-13.89,18.98.89,36.98,5.82,54.27,13.32,34.69,15.05,63.83,37.98,90.16,64.7,7.83,7.94,15.19,16.34,23.51,25.34-11.46,11.91-22.05,23.67-33.44,34.61-13.59,13.06-28.1,24.95-43.77,35.22l19.39,19.39c31.94-21.73,59.32-48.66,83.44-79.21,5.85-7.41,6.07-13.31-.05-20.48Z" fill="#a4a4a4"/>
      <path d="m273.74,181.91c7.41-12.18,11.69-26.47,11.74-41.78.14-44.51-35.86-80.68-80.52-80.92-15.45-.08-29.9,4.21-42.2,11.72l19.9,19.9c6.74-3.04,14.2-4.74,22.07-4.74,29.67.02,53.73,24.08,53.82,53.81.02,7.88-1.67,15.36-4.7,22.12l19.89,19.89Z" fill="#a4a4a4"/>
    </svg>
  `
};

// 中文數字轉換
const CHINESE_NUMBERS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

class ProfileDataManager {
  constructor() {
    console.log('ProfileDataManager constructor - 新版本v2');
    this.currentUser = null;
    this.isPasswordVisible = false;
  }

  // 初始化個人資料管理器
  init(userData) {
    this.currentUser = userData;
  }

  // 生成個人資料頁面HTML內容
  getProfileContent() {
    const userData = this.getCurrentUserData();

    return `
      <div class="space-y-8">
        <div>
          <h2 class="font-chinese text-white text-medium-title">個人資料</h2>
        </div>
        <div class="space-y-6">
          ${this.generateProfileRows(userData)}
        </div>
      </div>
    `;
  }

  // 生成個人資料行內容
  generateProfileRows(userData) {
    return `
      <!-- 第一行：姓名和班級 -->
      <div class="grid grid-cols-2 gap-24">
        ${this.generateField('姓名', userData.name, 'font-chinese')}
        ${this.generateField('班級', this.formatClassName(userData), 'font-chinese')}
      </div>

      <!-- 第二行：帳號和密碼 -->
      <div class="grid grid-cols-2 gap-24">
        ${this.generateField('帳號', userData.studentId, 'font-english')}
        ${this.generatePasswordField()}
      </div>

      <!-- 第三行：手機號碼和Email -->
      <div class="grid grid-cols-2 gap-24">
        ${this.generatePhoneField(userData)}
        ${this.generateEmailField(userData)}
      </div>
    `;
  }

  // 生成通用欄位HTML
  generateField(label, value, fontClass = 'font-chinese') {
    return `
      <div>
        <label class="font-chinese text-gray-scale3 text-tiny block mb-2">${label}</label>
        <p class="${fontClass} text-white text-small-title">${value}</p>
      </div>
    `;
  }

  // 生成密碼欄位HTML
  generatePasswordField() {
    return `
      <div>
        <label class="font-chinese text-gray-scale3 text-tiny block mb-2">密碼</label>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 flex-1">
            <span id="password-display" class="font-english text-white text-small-title">••••••••</span>
            <button id="toggle-password" class="text-gray-scale3 hover:text-gray-scale3 cursor-pointer transition-colors">
              ${PASSWORD_ICONS.VISIBLE}
            </button>
          </div>
          <button id="change-password-btn" class="page-button">
            <div class="menu-item-wrapper">
              <span class="menu-text">(Change)</span>
              <span class="menu-text-hidden">(Change)</span>
            </div>
          </button>
        </div>
      </div>
    `;
  }

  // 生成手機號碼欄位HTML
  generatePhoneField(userData) {
    const hasPhone = userData.phone;
    return `
      <div>
        <label class="font-chinese text-gray-scale3 text-tiny block mb-2">手機號碼</label>
        <div class="flex items-center gap-3">
          <p id="phone-display" class="font-english text-white text-small-title flex-1">${userData.phone || '未設定'}</p>
          <button id="set-phone-btn" class="page-button">
            <div class="menu-item-wrapper">
              <span class="menu-text">(${hasPhone ? 'CHANGE' : 'SET'})</span>
              <span class="menu-text-hidden">(${hasPhone ? 'CHANGE' : 'SET'})</span>
            </div>
          </button>
        </div>
      </div>
    `;
  }

  // 生成Email欄位HTML
  generateEmailField(userData) {
    return `
      <div>
        <label class="font-english text-gray-scale3 text-tiny block mb-2">Email</label>
        <p class="font-english text-white text-small-title">${userData.email}</p>
      </div>
    `;
  }

  // 設置個人資料頁面事件監聽器
  setupEventListeners() {
    this.setupPasswordToggleEvent();
  }

  // 設置密碼顯示/隱藏事件
  setupPasswordToggleEvent() {
    const togglePasswordBtn = document.getElementById('toggle-password');
    const passwordDisplay = document.getElementById('password-display');

    if (!togglePasswordBtn || !passwordDisplay) return;

    togglePasswordBtn.addEventListener('click', () => {
      this.isPasswordVisible = !this.isPasswordVisible;
      this.updatePasswordDisplay(passwordDisplay, togglePasswordBtn);
    });
  }

  // 更新密碼顯示狀態
  updatePasswordDisplay(passwordDisplay, toggleButton) {
    if (this.isPasswordVisible) {
      passwordDisplay.textContent = this.getCurrentUserPassword();
      toggleButton.innerHTML = PASSWORD_ICONS.HIDDEN;
    } else {
      passwordDisplay.textContent = '••••••••';
      toggleButton.innerHTML = PASSWORD_ICONS.VISIBLE;
    }
  }

  // 獲取當前用戶密碼 - 應該從安全來源獲取
  getCurrentUserPassword() {
    // 這裡應該實際從安全的地方獲取密碼
    // 目前使用測試數據
    return '20030911';
  }

  // 獲取當前用戶數據
  getCurrentUserData() {
    // 從登入狀態獲取用戶數據
    if (this.isLoggedIn()) {
      const loginData = window.AuthStorage.getLoginData();
      if (loginData?.student) {
        return this.formatUserData(loginData.student);
      }
    }

    // 返回預設數據
    return this.getDefaultUserData();
  }

  // 格式化用戶數據
  formatUserData(studentData) {
    return {
      studentId: studentData.studentId || 'A111144001',
      name: studentData.name || '阿志',
      email: studentData.email || `${studentData.studentId}@gm2.usc.edu.tw`,
      phone: studentData.phone || null,
      emailVerified: studentData.emailVerified || false,
      department: studentData.department || '媒體傳達設計系',
      className: studentData.className || '乙班',
      year: studentData.year || '111學年'
    };
  }

  // 獲取預設用戶數據
  getDefaultUserData() {
    return {
      studentId: 'A111144001',
      name: '阿志',
      email: 'A111144001@gm2.usc.edu.tw',
      phone: null,
      emailVerified: false,
      department: '媒體傳達設計系',
      className: '乙班',
      year: '111學年'
    };
  }

  // 格式化班級名稱 - 簡化邏輯
  formatClassName(userData) {
    const studentId = userData.studentId;

    if (!studentId || studentId.length < 7) {
      return userData.className || '乙班';
    }

    try {
      const yearCode = studentId.substring(1, 4); // 111
      const classCode = studentId.substring(4, 7); // 144 或 141

      const grade = this.calculateGrade(yearCode);
      const className = this.getClassNameFromCode(classCode);

      return `日媒${this.getChineseNumber(grade)}${className}`;
    } catch (error) {
      console.error('格式化班級名稱錯誤:', error);
      return userData.className || '乙班';
    }
  }

  // 計算年級
  calculateGrade(yearCode) {
    const admissionYear = parseInt(yearCode);
    const currentYear = new Date().getFullYear() - 1911; // 民國年
    return currentYear - admissionYear + 1;
  }

  // 從班級代碼獲取班級名稱
  getClassNameFromCode(classCode) {
    return classCode === '141' ? '甲' : '乙';
  }

  // 數字轉中文
  getChineseNumber(num) {
    if (num < 1 || num > 9) {
      return num.toString();
    }
    return CHINESE_NUMBERS[num];
  }

  // 檢查是否已登入
  isLoggedIn() {
    return typeof window.AuthStorage !== 'undefined' && window.AuthStorage.isLoggedIn();
  }

  // 更新用戶資料顯示 - 用於頁面其他地方的用戶資料更新
  updateUserInfo(student) {
    this.updateNameDisplay(student.name);
    this.updateStudentIdDisplay(student.studentId);
  }

  // 更新姓名顯示
  updateNameDisplay(name) {
    const nameElements = document.querySelectorAll('.font-chinese');
    nameElements.forEach(el => {
      if (el.textContent === '阿志') {
        el.textContent = name || '阿志';
      }
    });
  }

  // 更新學號顯示
  updateStudentIdDisplay(studentId) {
    const studentIdElements = document.querySelectorAll('.font-english');
    studentIdElements.forEach(el => {
      if (el.textContent === 'A111144001') {
        el.textContent = studentId || 'A111144001';
      }
    });
  }

  // 驗證用戶資料
  validateUserData(userData) {
    const errors = [];

    if (!userData.name || userData.name.trim() === '') {
      errors.push('姓名不能為空');
    }

    if (!userData.studentId || !this.isValidStudentId(userData.studentId)) {
      errors.push('學號格式不正確');
    }

    if (!userData.email || !this.isValidEmail(userData.email)) {
      errors.push('Email格式不正確');
    }

    if (userData.phone && !this.isValidPhone(userData.phone)) {
      errors.push('手機號碼格式不正確');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  // 驗證學號格式
  isValidStudentId(studentId) {
    const pattern = /^[A-Z]\d{8}$/;
    return pattern.test(studentId);
  }

  // 驗證Email格式
  isValidEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
  }

  // 驗證手機號碼格式
  isValidPhone(phone) {
    const pattern = /^09\d{8}$/;
    return pattern.test(phone);
  }

  // 更新用戶資料
  updateUserData(newData) {
    const validation = this.validateUserData(newData);
    if (!validation.isValid) {
      throw new Error(`資料驗證失敗: ${validation.errors.join(', ')}`);
    }

    // 這裡應該調用API更新用戶資料
    console.log('更新用戶資料:', newData);
    return true;
  }

  // 顯示更改密碼彈出視窗
  showChangePasswordModal() {
    console.log('showChangePasswordModal被調用了 - 新版本');
    alert('新版本的showChangePasswordModal被調用！');
    // 凍結背景滾動
    document.body.style.overflow = 'hidden';

    // 創建overlay
    const overlay = document.createElement('div');
    overlay.id = 'change-password-overlay';
    overlay.className = 'fixed inset-0 flex items-center justify-center';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '1000';

    // 創建模態框 (參考收藏頁面的刪除確認框樣式)
    const modal = document.createElement('div');
    modal.className = 'bg-black p-6 max-w-md mx-4';

    // 標題
    const title = document.createElement('h3');
    title.className = 'font-chinese text-white text-content mb-6';
    title.textContent = '更改密碼';

    // 表單容器
    const form = document.createElement('div');
    form.className = 'space-y-4 mb-6';
    form.innerHTML = `
      <!-- 當前密碼 -->
      <div class="input-group">
        <input
          type="password"
          id="current-password"
          class="input-field password-field"
          placeholder=" "
          autocomplete="current-password"
        />
        <label for="current-password" class="input-label text-small-title">當前密碼</label>
        <button type="button" class="password-toggle password-toggle-btn" data-target="current-password">
          ${PASSWORD_ICONS.VISIBLE}
        </button>
        <div class="error-message" id="current-password-error" style="display: none;"></div>
      </div>

      <!-- 新密碼 -->
      <div class="input-group">
        <input
          type="password"
          id="new-password"
          class="input-field password-field"
          placeholder=" "
          autocomplete="new-password"
        />
        <label for="new-password" class="input-label text-small-title">新密碼</label>
        <button type="button" class="password-toggle password-toggle-btn" data-target="new-password">
          ${PASSWORD_ICONS.VISIBLE}
        </button>
        <div class="error-message" id="new-password-error" style="display: none;"></div>
      </div>

      <!-- 確認密碼 -->
      <div class="input-group">
        <input
          type="password"
          id="confirm-password"
          class="input-field password-field"
          placeholder=" "
          autocomplete="new-password"
        />
        <label for="confirm-password" class="input-label text-small-title">確認密碼</label>
        <button type="button" class="password-toggle password-toggle-btn" data-target="confirm-password">
          ${PASSWORD_ICONS.VISIBLE}
        </button>
        <div class="error-message" id="confirm-password-error" style="display: none;"></div>
      </div>

      <!-- 密碼強度指示器（在第三條橫線下方） -->
      <div class="password-strength-bar">
        <div class="strength-bar-container">
          <div class="strength-bar" id="strength-weak"></div>
          <div class="strength-bar" id="strength-medium"></div>
          <div class="strength-bar" id="strength-strong"></div>
        </div>
      </div>

      <!-- 密碼強度提示文字（在bar下方） -->
      <div class="password-requirements">
        <div class="text-gray-scale4 text-tiny space-y-1">
          <div id="req-length" class="requirement-item">• 至少8個字符</div>
          <div id="req-letter" class="requirement-item">• 包含英文字母</div>
          <div id="req-complexity" class="requirement-item">• 包含數字、大小寫字母或符號</div>
        </div>
      </div>
    `;

    // 按鈕容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-between gap-4';

    // DISCARD 按鈕
    const discardBtn = document.createElement('button');
    discardBtn.className = 'page-button';
    discardBtn.innerHTML = `
      <div class="menu-item-wrapper">
        <span class="menu-text">(DISCARD)</span>
        <span class="menu-text-hidden">(DISCARD)</span>
      </div>
    `;
    discardBtn.onclick = () => {
      // 恢復背景滾動
      document.body.style.overflow = '';
      document.body.removeChild(overlay);
    };

    // CHANGE 按鈕
    const changeBtn = document.createElement('button');
    changeBtn.className = 'page-button';
    changeBtn.id = 'change-password-submit';
    changeBtn.innerHTML = `
      <div class="menu-item-wrapper">
        <span class="menu-text">(CHANGE)</span>
        <span class="menu-text-hidden">(CHANGE)</span>
      </div>
    `;
    changeBtn.onclick = () => {
      this.handlePasswordChange(overlay);
    };

    // 組裝模態框
    buttonContainer.appendChild(discardBtn);
    buttonContainer.appendChild(changeBtn);
    modal.appendChild(title);
    modal.appendChild(form);
    modal.appendChild(buttonContainer);
    overlay.appendChild(modal);

    // 添加到頁面
    document.body.appendChild(overlay);

    // 設置事件監聽器
    this.setupPasswordModalEventListeners();
  }

  // 設置密碼模態框的事件監聽器
  setupPasswordModalEventListeners() {
    // 密碼顯示/隱藏切換
    const toggleButtons = document.querySelectorAll('.password-toggle-btn');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        const isVisible = input.type === 'text';

        input.type = isVisible ? 'password' : 'text';
        btn.innerHTML = isVisible ? PASSWORD_ICONS.VISIBLE : PASSWORD_ICONS.HIDDEN;
      });
    });

    // 新密碼即時強度檢測
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    newPasswordInput.addEventListener('input', () => {
      this.validatePasswordStrength(newPasswordInput.value);
    });

    // 確認密碼即時匹配檢查
    confirmPasswordInput.addEventListener('input', () => {
      this.validatePasswordMatch();
    });
  }

  // 驗證密碼強度並更新指示器
  validatePasswordStrength(password) {
    const requirements = {
      length: password.length >= 8,
      letter: /[a-zA-Z]/.test(password),
      complexity: /\d/.test(password) || (/[A-Z]/.test(password) && /[a-z]/.test(password)) || /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    // 更新checklist
    document.getElementById('req-length').style.color = requirements.length ? '#22c55e' : '#a4a4a4';
    document.getElementById('req-letter').style.color = requirements.letter ? '#22c55e' : '#a4a4a4';
    document.getElementById('req-complexity').style.color = requirements.complexity ? '#22c55e' : '#a4a4a4';

    // 計算強度等級
    const validCount = Object.values(requirements).filter(Boolean).length;
    this.updatePasswordStrengthBar(validCount);

    return requirements;
  }

  // 更新密碼強度指示器
  updatePasswordStrengthBar(level) {
    const weakBar = document.getElementById('strength-weak');
    const mediumBar = document.getElementById('strength-medium');
    const strongBar = document.getElementById('strength-strong');

    // 重置所有bar
    [weakBar, mediumBar, strongBar].forEach(bar => {
      bar.style.backgroundColor = '#333';
    });

    // 根據等級點亮對應的bar
    if (level >= 1) weakBar.style.backgroundColor = '#ef4444'; // 紅色
    if (level >= 2) mediumBar.style.backgroundColor = '#f97316'; // 橘色
    if (level >= 3) strongBar.style.backgroundColor = '#22c55e'; // 綠色
  }

  // 驗證密碼匹配
  validatePasswordMatch() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorElement = document.getElementById('confirm-password-error');

    if (confirmPassword && newPassword !== confirmPassword) {
      errorElement.textContent = '密碼不匹配';
      errorElement.style.display = 'block';
      return false;
    } else {
      errorElement.style.display = 'none';
      return true;
    }
  }

  // 處理密碼更改提交
  async handlePasswordChange(overlay) {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // 驗證表單
    if (!this.validatePasswordForm(currentPassword, newPassword, confirmPassword)) {
      return;
    }

    // 獲取當前用戶
    const currentUser = this.getCurrentUserData();

    try {
      // 調用API更改密碼
      const result = await window.TestAuth.mockApiChangePassword(
        currentUser.studentId,
        currentPassword,
        newPassword
      );

      if (result.success) {
        // 關閉模態框
        document.body.style.overflow = '';
        document.body.removeChild(overlay);

        // 顯示成功消息
        this.showPasswordChangeSuccess();
      } else {
        // 顯示錯誤消息
        this.showPasswordChangeError(result.message);
      }
    } catch (error) {
      console.error('密碼更改錯誤:', error);
      this.showPasswordChangeError('更改密碼時發生錯誤，請稍後再試');
    }
  }

  // 驗證密碼表單
  validatePasswordForm(currentPassword, newPassword, confirmPassword) {
    let isValid = true;

    // 檢查當前密碼
    if (!currentPassword) {
      document.getElementById('current-password-error').textContent = '請輸入當前密碼';
      document.getElementById('current-password-error').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('current-password-error').style.display = 'none';
    }

    // 檢查新密碼強度
    const strengthRequirements = this.validatePasswordStrength(newPassword);
    const isPasswordStrong = Object.values(strengthRequirements).every(Boolean);
    if (!isPasswordStrong) {
      document.getElementById('new-password-error').textContent = '密碼不符合安全要求';
      document.getElementById('new-password-error').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('new-password-error').style.display = 'none';
    }

    // 檢查密碼匹配
    if (!this.validatePasswordMatch()) {
      isValid = false;
    }

    return isValid;
  }

  // 顯示密碼更改成功消息
  showPasswordChangeSuccess() {
    // 可以使用現有的toast系統或簡單的alert
    alert('密碼更改成功！');
  }

  // 顯示密碼更改錯誤消息
  showPasswordChangeError(message) {
    // 可以使用現有的toast系統或簡單的alert
    alert(`密碼更改失敗：${message}`);
  }

  // 設置個人資料頁面事件監聽器
  setupEventListeners() {
    console.log('ProfileDataManager setupEventListeners被調用');
    // 設置Change按鈕事件
    const changePasswordBtn = document.getElementById('change-password-btn');
    console.log('找到change-password-btn:', changePasswordBtn);
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', () => {
        console.log('Change按鈕被點擊');
        this.showNewPasswordModal();
      });
      console.log('Change按鈕事件監聽器已設置');
    } else {
      console.log('找不到change-password-btn元素');
    }

    // 設置密碼顯示/隱藏切換（個人資料頁面的密碼欄位）
    const togglePasswordBtn = document.getElementById('toggle-password');
    if (togglePasswordBtn) {
      togglePasswordBtn.addEventListener('click', () => {
        this.togglePasswordDisplay();
      });
    }

    // 設置手機號碼SET/CHANGE按鈕事件
    const setPhoneBtn = document.getElementById('set-phone-btn');
    if (setPhoneBtn) {
      setPhoneBtn.addEventListener('click', () => {
        this.showPhoneModal();
      });
    }
  }

  // 全新的密碼更改modal
  showNewPasswordModal() {
    console.log('全新版本密碼更改modal');

    // 移除任何現有的modal
    const existingModal = document.getElementById('new-password-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // 凍結背景滾動
    document.body.style.overflow = 'hidden';

    // 創建全新的overlay
    const overlay = document.createElement('div');
    overlay.id = 'new-password-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    // 創建模態框內容
    const modal = document.createElement('div');
    modal.style.cssText = `
      background-color: black;
      border: 1px solid white;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
    `;

    // 模態框HTML內容
    modal.innerHTML = `
      <h3 style="color: white; font-family: 'Noto Sans TC', sans-serif; font-size: 1.25rem; margin-bottom: 18px;">更改密碼</h3>

      <!-- 當前密碼 -->
      <div class="input-group" style="margin-bottom: 1rem;">
        <label for="new-current-password" class="text-gray-scale1 text-tiny font-english" style="display: block;">當前密碼</label>
        <div style="position: relative;">
          <input type="password" id="new-current-password" class="input-field password-field" style="width: 100%; padding: 8px 40px 8px 1px; border: none; border-bottom: 1px solid white; background: transparent; color: white; font-family: 'Inter', sans-serif; font-size: 1rem; outline: none;">
          <button type="button" class="password-toggle-btn" onclick="window.profilePage.managers.profileData.toggleNewPasswordField('new-current-password')" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; padding: 4px;">
            ${PASSWORD_ICONS.VISIBLE}
          </button>
        </div>
      </div>

      <!-- 新密碼 -->
      <div class="input-group" style="margin-bottom: 1rem;">
        <label for="new-new-password" class="text-gray-scale1 text-tiny font-english" style="display: block;">新密碼</label>
        <div style="position: relative;">
          <input type="password" id="new-new-password" class="input-field password-field" style="width: 100%; padding: 8px 40px 8px 1px; border: none; border-bottom: 1px solid white; background: transparent; color: white; font-family: 'Inter', sans-serif; font-size: 1rem; outline: none;">
          <button type="button" class="password-toggle-btn" onclick="window.profilePage.managers.profileData.toggleNewPasswordField('new-new-password')" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; padding: 4px;">
            ${PASSWORD_ICONS.VISIBLE}
          </button>
        </div>
      </div>

      <!-- 確認密碼 -->
      <div class="input-group" style="margin-bottom: 1rem;">
        <label for="new-confirm-password" class="text-gray-scale1 text-tiny font-english" style="display: block;">確認密碼</label>
        <div style="position: relative;">
          <input type="password" id="new-confirm-password" class="input-field password-field" style="width: 100%; padding: 8px 40px 8px 1px; border: none; border-bottom: 1px solid white; background: transparent; color: white; font-family: 'Inter', sans-serif; font-size: 1rem; outline: none;">
          <button type="button" class="password-toggle-btn" onclick="window.profilePage.managers.profileData.toggleNewPasswordField('new-confirm-password')" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; padding: 4px;">
            ${PASSWORD_ICONS.VISIBLE}
          </button>
        </div>
      </div>

      <!-- 密碼強度指示器 -->
      <div style="margin-bottom: 1rem;">
        <div style="display: flex; gap: 4px; width: 100%;">
          <div id="new-strength-weak" style="flex: 1; height: 4px; background-color: #333; transition: background-color 0.3s ease; border-radius: 2px;"></div>
          <div id="new-strength-medium" style="flex: 1; height: 4px; background-color: #333; transition: background-color 0.3s ease; border-radius: 2px;"></div>
          <div id="new-strength-strong" style="flex: 1; height: 4px; background-color: #333; transition: background-color 0.3s ease; border-radius: 2px;"></div>
        </div>
      </div>

      <!-- 密碼強度提示文字 -->
      <div style="margin-bottom: 1.5rem;">
        <div style="color: #a4a4a4; font-size: 0.75rem; font-family: 'Noto Sans TC', sans-serif;">
          <div id="new-req-length" style="margin-bottom: 0.25rem;">• 至少8個字符</div>
          <div id="new-req-letter" style="margin-bottom: 0.25rem;">• 包含英文字母</div>
          <div id="new-req-complexity" style="margin-bottom: 0.25rem;">• 包含數字、大小寫字母或符號</div>
        </div>
      </div>

      <!-- 按鈕 -->
      <div style="display: flex; justify-content: space-between; gap: 1rem;">
        <button onclick="window.profilePage.managers.profileData.closeNewPasswordModal()" class="page-button" style="flex: 1; background: transparent; border: none; color: #ff8698; cursor: pointer; padding: 0.5rem 1rem; position: relative; overflow: hidden;">
          <div class="menu-item-wrapper">
            <span class="menu-text">(DISCARD)</span>
            <span class="menu-text-hidden">(DISCARD)</span>
          </div>
        </button>
        <button onclick="window.profilePage.managers.profileData.submitNewPasswordChange()" class="page-button" style="flex: 1; background: transparent; border: none; color: white; cursor: pointer; padding: 0.5rem 1rem; position: relative; overflow: hidden;">
          <div class="menu-item-wrapper">
            <span class="menu-text">(CHANGE)</span>
            <span class="menu-text-hidden">(CHANGE)</span>
          </div>
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 設置密碼強度檢查
    this.setupNewPasswordStrengthChecker();
  }

  // 關閉新密碼modal
  closeNewPasswordModal() {
    const modal = document.getElementById('new-password-modal');
    if (modal) {
      document.body.style.overflow = '';
      modal.remove();
    }
  }

  // 切換新密碼欄位顯示
  toggleNewPasswordField(fieldId) {
    const field = document.getElementById(fieldId);
    const button = field.nextElementSibling; // 在同一個relative div中，input的下一個元素就是button

    if (field.type === 'password') {
      field.type = 'text';
      button.innerHTML = PASSWORD_ICONS.HIDDEN;
    } else {
      field.type = 'password';
      button.innerHTML = PASSWORD_ICONS.VISIBLE;
    }
  }

  // 設置新modal的輸入框效果
  setupNewModalInputEffects() {
    const inputs = ['new-current-password', 'new-new-password', 'new-confirm-password'];

    inputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      const label = input.nextElementSibling;

      // 焦點和失焦事件
      input.addEventListener('focus', () => {
        label.style.transform = 'translateY(-1.5rem) translateX(-1px) scale(0.875)';
        label.style.color = '#cccccc';
      });

      input.addEventListener('blur', () => {
        if (input.value === '') {
          label.style.transform = 'translateY(0) translateX(0) scale(1)';
          label.style.color = '#cccccc';
        }
      });

      // 檢查初始值
      if (input.value !== '') {
        label.style.transform = 'translateY(-1.5rem) translateX(-1px) scale(0.875)';
        label.style.color = '#cccccc';
      }
    });
  }

  // 設置新密碼強度檢查
  setupNewPasswordStrengthChecker() {
    const newPasswordInput = document.getElementById('new-new-password');

    newPasswordInput.addEventListener('input', (e) => {
      this.updateNewPasswordStrength(e.target.value);
    });
  }

  // 更新新密碼強度顯示
  updateNewPasswordStrength(password) {
    const weakBar = document.getElementById('new-strength-weak');
    const mediumBar = document.getElementById('new-strength-medium');
    const strongBar = document.getElementById('new-strength-strong');

    const lengthReq = document.getElementById('new-req-length');
    const letterReq = document.getElementById('new-req-letter');
    const complexityReq = document.getElementById('new-req-complexity');

    // 重置所有bar
    [weakBar, mediumBar, strongBar].forEach(bar => {
      bar.style.backgroundColor = '#333';
    });

    // 重置所有要求顏色
    [lengthReq, letterReq, complexityReq].forEach(req => {
      req.style.color = '#a4a4a4';
    });

    if (password.length === 0) return;

    let score = 0;

    // 檢查長度
    if (password.length >= 8) {
      score++;
      lengthReq.style.color = 'var(--color-success)';
    }

    // 檢查字母
    if (/[a-zA-Z]/.test(password)) {
      score++;
      letterReq.style.color = 'var(--color-success)';
    }

    // 檢查複雜性（數字、大小寫、符號）
    const hasNumber = /[0-9]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);

    if ((hasNumber && (hasUpper || hasLower)) || hasSymbol) {
      score++;
      complexityReq.style.color = 'var(--color-success)';
    }

    // 更新強度bar - 使用common.css定義的顏色
    if (score >= 1) {
      weakBar.style.backgroundColor = 'var(--color-error)'; // 粉紅色
    }
    if (score >= 2) {
      mediumBar.style.backgroundColor = 'var(--color-warning)'; // 橘色
    }
    if (score >= 3) {
      strongBar.style.backgroundColor = 'var(--color-success)'; // 綠色
    }
  }

  // 提交新密碼更改
  submitNewPasswordChange() {
    const currentPassword = document.getElementById('new-current-password').value;
    const newPassword = document.getElementById('new-new-password').value;
    const confirmPassword = document.getElementById('new-confirm-password').value;

    // 基本驗證
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('請填寫所有欄位');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('新密碼與確認密碼不符');
      return;
    }

    if (newPassword.length < 8) {
      alert('密碼長度至少需要8個字符');
      return;
    }

    // 這裡可以調用API
    console.log('提交密碼更改:', { currentPassword, newPassword });
    alert('密碼更改成功！');
    this.closeNewPasswordModal();
  }

  // 切換密碼顯示/隱藏（個人資料頁面）
  togglePasswordDisplay() {
    const passwordDisplay = document.getElementById('password-display');
    const toggleBtn = document.getElementById('toggle-password');

    if (this.isPasswordVisible) {
      // 隱藏密碼
      passwordDisplay.textContent = '••••••••';
      toggleBtn.innerHTML = PASSWORD_ICONS.VISIBLE;
      this.isPasswordVisible = false;
    } else {
      // 顯示密碼
      passwordDisplay.textContent = this.getCurrentUserPassword();
      toggleBtn.innerHTML = PASSWORD_ICONS.HIDDEN;
      this.isPasswordVisible = true;
    }
  }

  // 顯示手機號碼設定/更改modal
  showPhoneModal() {
    const userData = this.getCurrentUserData();
    const hasPhone = !!userData.phone;

    // 移除任何現有的modal
    const existingModal = document.getElementById('phone-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // 凍結背景滾動
    document.body.style.overflow = 'hidden';

    // 創建overlay
    const overlay = document.createElement('div');
    overlay.id = 'phone-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    // 創建模態框內容
    const modal = document.createElement('div');
    modal.style.cssText = `
      background-color: black;
      border: 1px solid white;
      padding: 24px;
      max-width: 400px;
      width: 90%;
    `;

    // 模態框HTML內容
    modal.innerHTML = `
      <h3 style="color: white; font-family: 'Noto Sans TC', sans-serif; font-size: 1.25rem; margin-bottom: 18px;">${hasPhone ? '更改手機號碼' : '設定手機號碼'}</h3>

      <!-- 手機號碼輸入框 -->
      <div style="margin-bottom: 1.5rem;">
        <label for="phone-input" class="text-gray-scale3 text-tiny font-chinese" style="display: block; margin-bottom: 8px;">手機號碼</label>
        <input
          type="tel"
          id="phone-input"
          class="input-field"
          placeholder="0912345678"
          value="${userData.phone || ''}"
          maxlength="10"
          style="width: 100%; padding: 8px; border: none; border-bottom: 1px solid white; background: transparent; color: white; font-family: 'Inter', sans-serif; font-size: 1rem; outline: none;"
        >
        <div id="phone-error" class="text-error2 font-chinese" style="font-size: 0.75rem; margin-top: 4px; display: none;"></div>
      </div>

      <!-- 按鈕 -->
      <div style="display: flex; justify-content: space-between; gap: 1rem;">
        <button id="phone-discard-btn" onclick="window.profilePage.managers.profileData.closePhoneModal()" class="page-button" style="flex: 1; background: transparent; border: none; color: #ff8698; cursor: pointer; padding: 0.5rem 1rem;">
          <div class="menu-item-wrapper">
            <span class="menu-text">(DISCARD)</span>
            <span class="menu-text-hidden">(DISCARD)</span>
          </div>
        </button>
        <button id="phone-ok-btn" onclick="window.profilePage.managers.profileData.submitPhoneChange()" class="page-button" style="flex: 1; background: transparent; border: none; color: white; cursor: pointer; padding: 0.5rem 1rem; opacity: 0.3; pointer-events: none;">
          <div class="menu-item-wrapper">
            <span class="menu-text">(OKAY)</span>
            <span class="menu-text-hidden">(OKAY)</span>
          </div>
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 設置事件監聽器
    this.setupPhoneModalEventListeners();

    // 自動聚焦到輸入框
    setTimeout(() => {
      document.getElementById('phone-input').focus();
    }, 100);
  }

  // 設置手機號碼modal的事件監聽器
  setupPhoneModalEventListeners() {
    const phoneInput = document.getElementById('phone-input');
    const phoneError = document.getElementById('phone-error');
    const okBtn = document.getElementById('phone-ok-btn');

    if (!phoneInput || !okBtn) return;

    // 監聽輸入變化
    phoneInput.addEventListener('input', (e) => {
      const value = e.target.value.trim();

      // 隱藏錯誤訊息（輸入時不顯示錯誤）
      phoneError.style.display = 'none';

      // 如果有輸入至少一個字符，啟用OK按鈕
      if (value.length > 0) {
        okBtn.style.opacity = '1';
        okBtn.style.pointerEvents = 'auto';
      } else {
        // 沒有輸入，禁用OK按鈕
        okBtn.style.opacity = '0.3';
        okBtn.style.pointerEvents = 'none';
      }
    });

    // 檢查初始值（如果有預填的號碼）
    if (phoneInput.value.trim().length > 0) {
      okBtn.style.opacity = '1';
      okBtn.style.pointerEvents = 'auto';
    }
  }

  // 關閉手機號碼modal
  closePhoneModal() {
    const modal = document.getElementById('phone-modal');
    if (modal) {
      document.body.style.overflow = '';
      modal.remove();
    }
  }

  // 提交手機號碼更改
  submitPhoneChange() {
    const phoneInput = document.getElementById('phone-input');
    const phoneError = document.getElementById('phone-error');
    const phone = phoneInput.value.trim();

    // 必須有輸入
    if (!phone) {
      return;
    }

    // 驗證手機號碼格式
    if (!this.isValidPhone(phone)) {
      phoneError.textContent = '手機號碼格式不正確（格式：0912345678）';
      phoneError.style.display = 'block';
      return;
    }

    // 更新用戶數據（這裡應該調用API）
    const userData = this.getCurrentUserData();
    userData.phone = phone;

    // 更新顯示
    const phoneDisplay = document.getElementById('phone-display');
    const setPhoneBtn = document.getElementById('set-phone-btn');

    if (phoneDisplay) {
      phoneDisplay.textContent = phone;
    }

    if (setPhoneBtn) {
      const menuText = setPhoneBtn.querySelector('.menu-text');
      const menuTextHidden = setPhoneBtn.querySelector('.menu-text-hidden');

      if (menuText) menuText.textContent = '(CHANGE)';
      if (menuTextHidden) menuTextHidden.textContent = '(CHANGE)';
    }

    // 這裡應該調用API保存到後端
    console.log('更新手機號碼:', phone);

    // 關閉modal
    this.closePhoneModal();

    // 顯示成功消息
    alert('手機號碼已更新！');
  }
}

// 導出供其他文件使用
if (typeof window !== 'undefined') {
  window.ProfileDataManager = ProfileDataManager;
}