// 登入認證邏輯

// 本地存儲管理
const AuthStorage = {
  // 存儲登入狀態
  saveLoginData(studentData, rememberMe = false) {
    const loginData = {
      student: studentData.student,
      token: studentData.token,
      loginTime: Date.now(),
      expiresIn: studentData.expiresIn,
      rememberMe: rememberMe
    };

    if (rememberMe) {
      // 30天記住我
      localStorage.setItem('sccd_login_data', JSON.stringify(loginData));
    } else {
      // 瀏覽器會話期間
      sessionStorage.setItem('sccd_login_data', JSON.stringify(loginData));
    }
  },

  // 獲取登入狀態
  getLoginData() {
    let loginData = localStorage.getItem('sccd_login_data');
    if (!loginData) {
      loginData = sessionStorage.getItem('sccd_login_data');
    }

    if (!loginData) return null;

    try {
      const data = JSON.parse(loginData);

      // 檢查是否過期
      const now = Date.now();
      const expiryTime = data.loginTime + data.expiresIn;

      if (now > expiryTime) {
        this.clearLoginData();
        return null;
      }

      return data;
    } catch (error) {
      console.error('解析登入數據錯誤:', error);
      this.clearLoginData();
      return null;
    }
  },

  // 清除登入狀態
  clearLoginData() {
    localStorage.removeItem('sccd_login_data');
    sessionStorage.removeItem('sccd_login_data');
  },

  // 檢查是否已登入
  isLoggedIn() {
    return this.getLoginData() !== null;
  }
};

// 登入表單處理
class LoginForm {
  constructor() {
    this.form = document.getElementById('login-form');
    this.usernameField = document.getElementById('username');
    this.passwordField = document.getElementById('password');
    this.rememberMeField = document.getElementById('remember-me');
    this.loginBtn = document.getElementById('login-cta');
    this.usernameError = document.getElementById('username-error');
    this.passwordError = document.getElementById('password-error');
    this.passwordToggle = document.getElementById('password-toggle');
    this.passwordHiddenIcon = document.getElementById('password-hidden-icon');
    this.passwordVisibleIcon = document.getElementById('password-visible-icon');

    this.init();
  }

  init() {
    // 等待頁面載入完成後檢查登入狀態
    setTimeout(() => {
      this.checkLoginStatus();
    }, 100);

    // 綁定事件
    this.bindEvents();

    // 初始化表單驗證
    this.initValidation();
  }

  checkLoginStatus() {
    // 檢查是否已經登入
    if (AuthStorage.isLoggedIn()) {
      console.log('用戶已登入，檢查是否需要重定向'); // Debug

      // 檢查URL參數中是否有重定向需求
      const redirectUrl = this.getRedirectUrl();
      if (redirectUrl) {
        console.log('用戶已登入且有重定向需求，立即重定向到:', redirectUrl); // Debug
        window.location.href = redirectUrl;
      } else {
        console.log('用戶已登入但無重定向需求，顯示已登入狀態'); // Debug
        this.showLoggedInState();
      }
    }
  }

  // 從URL參數中獲取重定向URL
  getRedirectUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect_url');

    if (redirectUrl) {
      try {
        // 解碼URL
        const decodedUrl = decodeURIComponent(redirectUrl);
        console.log('找到重定向URL:', decodedUrl); // Debug

        // 驗證URL是否安全（同源檢查）
        if (this.isValidRedirectUrl(decodedUrl)) {
          return decodedUrl;
        } else {
          console.warn('不安全的重定向URL，忽略:', decodedUrl); // Debug
          return null;
        }
      } catch (error) {
        console.error('解析重定向URL失敗:', error); // Debug
        return null;
      }
    }

    return null;
  }

  // 驗證重定向URL是否安全
  isValidRedirectUrl(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      // 只允許同源重定向
      return urlObj.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  showLoggedInState() {
    // 已登入時不修改頁面內容，保持原有的登入頁面顯示
    // 只更新 header 導航（由 global-auth-manager.js 處理）
    console.log('顯示已登入狀態'); // Debug
  }


  bindEvents() {
    // 檢查所有必需的元素是否存在
    console.log('檢查DOM元素:', {
      form: this.form,
      loginBtn: this.loginBtn,
      usernameField: this.usernameField,
      passwordField: this.passwordField
    }); // Debug

    // 登入按鈕點擊事件
    if (this.loginBtn) {
      this.loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    } else {
      console.error('登入按鈕未找到，ID: login-cta');
    }

    // 表單提交事件
    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    } else {
      console.error('登入表單未找到，ID: login-form');
    }

    // 特定的輸入驗證邏輯
    if (this.usernameField) {
      this.usernameField.addEventListener('input', () => {
        this.clearError('username');
        this.validateUsernameFormat();
      });
    } else {
      console.error('用戶名輸入框未找到，ID: username');
    }

    if (this.passwordField) {
      this.passwordField.addEventListener('input', () => {
        this.clearError('password');
        // 密碼輸入時不顯示錯誤提示
      });
    } else {
      console.error('密碼輸入框未找到，ID: password');
    }

    // 密碼切換按鈕事件
    if (this.passwordToggle) {
      this.passwordToggle.addEventListener('click', () => {
        this.togglePasswordVisibility();
      });
    } else {
      console.error('密碼切換按鈕未找到，ID: password-toggle');
    }
  }

  initValidation() {
    // 預填充測試數據（僅開發環境）
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // 開發測試時可以預填充
      // this.usernameField.value = 'A111144001';
      // this.passwordField.value = '20030911';
    }
  }

  // 即時格式驗證（只在有輸入內容時檢查格式）
  validateUsernameFormat() {
    const username = this.usernameField.value.trim();

    // 如果是空的，不顯示錯誤
    if (!username) {
      this.clearError('username');
      return;
    }

    // 如果有內容但格式錯誤，顯示格式錯誤
    if (!window.TestAuth.validateStudentId(username)) {
      this.showError('username', '學號格式錯誤（格式：A111144001）');
    } else {
      this.clearError('username');
    }
  }

  // 登入時的完整驗證（檢查空值和格式）
  validateUsername() {
    const username = this.usernameField.value.trim();

    if (!username) {
      this.showError('username', '請輸入學號');
      return false;
    }

    if (!window.TestAuth.validateStudentId(username)) {
      this.showError('username', '學號格式錯誤（格式：A111144001）');
      return false;
    }

    this.clearError('username');
    return true;
  }

  // 密碼驗證（只在登入時檢查空值）
  validatePassword() {
    const password = this.passwordField.value;

    if (!password) {
      this.showError('password', '請輸入密碼');
      return false;
    }

    this.clearError('password');
    return true;
  }

  showError(field, message) {
    const errorElement = document.getElementById(`${field}-error`);
    const inputElement = document.getElementById(field);

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('show');
    }

    if (inputElement) {
      inputElement.classList.add('error');
    }
  }

  clearError(field) {
    const errorElement = document.getElementById(`${field}-error`);
    const inputElement = document.getElementById(field);

    if (errorElement) {
      errorElement.classList.remove('show');
    }

    if (inputElement) {
      inputElement.classList.remove('error');
    }
  }

  // 切換密碼顯示/隱藏
  togglePasswordVisibility() {
    const isPasswordHidden = this.passwordField.type === 'password';

    if (isPasswordHidden) {
      // 顯示密碼
      this.passwordField.type = 'text';
      this.passwordHiddenIcon.style.display = 'none';
      this.passwordVisibleIcon.style.display = 'block';
    } else {
      // 隱藏密碼
      this.passwordField.type = 'password';
      this.passwordHiddenIcon.style.display = 'block';
      this.passwordVisibleIcon.style.display = 'none';
    }
  }

  async handleLogin() {
    // 驗證表單
    const isUsernameValid = this.validateUsername();
    const isPasswordValid = this.validatePassword();

    if (!isUsernameValid || !isPasswordValid) {
      return;
    }

    // 顯示載入狀態
    this.setLoading(true);

    try {
      const username = this.usernameField.value.trim();
      const password = this.passwordField.value;
      const rememberMe = this.rememberMeField.checked;

      // 調用模擬API進行登入驗證
      const result = await window.TestAuth.mockApiLogin(username, password);

      if (result.success) {
        // 登入成功
        AuthStorage.saveLoginData(result, rememberMe);

        // 通知收藏管理器用戶狀態改變
        if (window.onAuthStateChanged) {
          window.onAuthStateChanged();
        }

        // 通知全站管理器更新導航
        if (window.GlobalAuthManager) {
          window.GlobalAuthManager.onAuthStatusChanged();
        }

        // 處理延遲收藏操作
        if (window.processPendingBookmarks) {
          window.processPendingBookmarks();
        }

        // 重定向到原頁面（如果有）或profile頁面
        this.redirectToProfile();

      } else {
        // 登入失敗
        this.handleLoginError(result);
      }

    } catch (error) {
      console.error('登入過程發生錯誤:', error);
      this.showError('password', '登入過程發生錯誤，請稍後再試');
    } finally {
      this.setLoading(false);
    }
  }

  handleLoginError(result) {
    switch (result.errorCode) {
      case 'STUDENT_NOT_FOUND':
        this.showError('username', '學號不存在');
        break;
      case 'WRONG_PASSWORD':
        this.showError('password', result.message);
        break;
      case 'EMAIL_NOT_VERIFIED':
        this.showError('username', '請先驗證您的學校Email');
        break;
      case 'ACCOUNT_LOCKED':
        this.showError('password', result.message);
        // 當帳號被鎖定時，禁用登入按鈕
        this.disableLoginButton(result.remainingTime);
        break;
      default:
        this.showError('password', result.message || '登入失敗');
    }
  }

  setLoading(loading) {
    const loginText = this.loginBtn.querySelector('.hero-cta-text');
    const loginHidden = this.loginBtn.querySelector('.hero-cta-hidden');

    if (loading) {
      if (loginText) loginText.textContent = '(LOGGING IN...)';
      if (loginHidden) loginHidden.textContent = '(LOGGING IN...)';
      this.loginBtn.style.pointerEvents = 'none';
      this.loginBtn.style.opacity = '0.6';
    } else {
      if (loginText) loginText.textContent = '(LOGIN)';
      if (loginHidden) loginHidden.textContent = '(LOGIN)';
      this.loginBtn.style.pointerEvents = '';
      this.loginBtn.style.opacity = '';
    }
  }

  disableLoginButton(remainingTime) {
    // 禁用登入按鈕並顯示倒計時
    const loginText = this.loginBtn.querySelector('.hero-cta-text');
    const loginHidden = this.loginBtn.querySelector('.hero-cta-hidden');

    this.loginBtn.style.pointerEvents = 'none';
    this.loginBtn.style.opacity = '0.6';

    // 開始倒計時
    const startTime = Date.now();
    const endTime = startTime + remainingTime;

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        // 倒計時結束，恢復按鈕
        if (loginText) loginText.textContent = '(LOGIN)';
        if (loginHidden) loginHidden.textContent = '(LOGIN)';
        this.loginBtn.style.pointerEvents = '';
        this.loginBtn.style.opacity = '';
        this.clearError('password');
        return;
      }

      const minutes = Math.floor(remaining / (60 * 1000));
      const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
      const timeText = `(鎖定中 ${minutes}:${seconds.toString().padStart(2, '0')})`;

      if (loginText) loginText.textContent = timeText;
      if (loginHidden) loginHidden.textContent = timeText;

      setTimeout(updateCountdown, 1000);
    };

    updateCountdown();
  }

  redirectToProfile() {
    // 檢查URL參數中的重定向URL
    const redirectUrl = this.getRedirectUrl();

    if (redirectUrl) {
      // 有重定向需求，跳轉到指定頁面
      console.log('登入成功，重定向到原頁面:', redirectUrl); // Debug
      window.location.href = redirectUrl;
    } else {
      // 沒有重定向需求，跳轉到profile頁面
      console.log('登入成功，跳轉到profile頁面'); // Debug
      window.location.href = 'profile.html';
    }
  }
}

// 使用更安全的初始化方法
function initLoginPage() {
  console.log('準備初始化LoginForm...'); // Debug

  // 檢查關鍵元素是否存在
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-cta');

  if (loginForm && loginBtn) {
    console.log('DOM元素已準備好，初始化LoginForm'); // Debug
    new LoginForm();
  } else {
    console.log('DOM元素尚未準備好，等待中...', { loginForm, loginBtn }); // Debug
    // 等待500ms後重試
    setTimeout(initLoginPage, 500);
  }
}

// 多種方式確保初始化
document.addEventListener('DOMContentLoaded', initLoginPage);

// 如果DOMContentLoaded已經觸發
if (document.readyState === 'loading') {
  // 文檔仍在加載中
  console.log('文檔加載中，等待DOMContentLoaded'); // Debug
} else {
  // 文檔已加載完成
  console.log('文檔已完成加載，立即初始化'); // Debug
  initLoginPage();
}

// 導出供其他文件使用
if (typeof window !== 'undefined') {
  window.AuthStorage = AuthStorage;
  window.LoginForm = LoginForm;
}