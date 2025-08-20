/* ===== 表單驗證和交互 JavaScript ===== */

// 登入表單驗證管理
class LoginFormValidator {
  constructor() {
    this.form = document.getElementById('login-form');
    this.usernameInput = document.getElementById('username');
    this.passwordInput = document.getElementById('password');
    this.usernameError = document.getElementById('username-error');
    this.passwordError = document.getElementById('password-error');
    this.init();
  }
  
  init() {
    if (!this.form || !this.usernameInput || !this.passwordInput) return;
    
    this.setupEventListeners();
    this.setupLoginCTA();
  }
  
  setupEventListeners() {
    // 輸入時清除錯誤狀態（只有在已經有錯誤時才清除）
    this.usernameInput.addEventListener('input', () => {
      if (this.usernameInput.value.trim() && 
          this.usernameInput.parentElement.classList.contains('error')) {
        this.clearError(this.usernameInput.parentElement, this.usernameError);
      }
    });
    
    this.passwordInput.addEventListener('input', () => {
      if (this.passwordInput.value.trim() && 
          this.passwordInput.parentElement.classList.contains('error')) {
        this.clearError(this.passwordInput.parentElement, this.passwordError);
      }
    });
    
    // 表單提交驗證
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // 忘記密碼連結處理
    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', this.handleForgotPassword);
    }
    
    // 注冊連結處理
    const registerLink = document.getElementById('register-link');
    if (registerLink) {
      registerLink.addEventListener('click', this.handleRegister);
    }
  }

  // 綁定 (LOGIN) CTA 觸發提交
  setupLoginCTA() {
    const loginCta = document.getElementById('login-cta');
    if (!loginCta || !this.form) return;
    loginCta.addEventListener('click', (e) => {
      e.preventDefault();
      // 觸發與 submit 相同的流程
      const submitEvent = new Event('submit', { cancelable: true });
      this.form.dispatchEvent(submitEvent);
    });
  }
  
  clearError(inputGroup, errorElement) {
    inputGroup.classList.remove('error');
    if (errorElement) {
      errorElement.classList.remove('show');
    }
  }
  
  showError(inputGroup, errorElement) {
    inputGroup.classList.add('error');
    if (errorElement) {
      errorElement.classList.add('show');
    }
  }
  
  handleSubmit(e) {
    e.preventDefault(); // 阻止表單提交
    
    let hasError = false;
    
    // 驗證帳號
    if (!this.usernameInput.value.trim()) {
      this.showError(this.usernameInput.parentElement, this.usernameError);
      hasError = true;
    } else {
      this.clearError(this.usernameInput.parentElement, this.usernameError);
    }
    
    // 驗證密碼
    if (!this.passwordInput.value.trim()) {
      this.showError(this.passwordInput.parentElement, this.passwordError);
      hasError = true;
    } else {
      this.clearError(this.passwordInput.parentElement, this.passwordError);
    }
    
    // 如果沒有錯誤，繼續處理登入邏輯
    if (!hasError) {
      const username = this.usernameInput.value;
      const password = this.passwordInput.value;
      const rememberMe = document.getElementById('remember-me')?.checked || false;
      
      this.submitLogin(username, password, rememberMe);
    }
  }
  
  submitLogin(username, password, rememberMe) {
    // 這裡之後可以添加實際的登入邏輯
    console.log('Login attempt:', { username, password, rememberMe });
    
    // 暫時顯示登入成功消息
    alert('登入功能尚未實作，但表單已正常工作！');
  }
  
  handleForgotPassword(e) {
    e.preventDefault();
    alert('忘記密碼功能尚未實作！');
  }
  
  handleRegister(e) {
    e.preventDefault();
    alert('注冊功能尚未實作！');
  }
}

// 通用表單輔助功能
class FormHelper {
  // 輸入框標籤動畫
  static initInputLabels() {
    const inputs = document.querySelectorAll('.input-field');
    inputs.forEach(input => {
      const label = input.parentElement.querySelector('.input-label');
      if (!label) return;
      
      // 初始檢查
      FormHelper.updateLabelState(input, label);
      
      // 事件監聽
      input.addEventListener('focus', () => FormHelper.updateLabelState(input, label));
      input.addEventListener('blur', () => FormHelper.updateLabelState(input, label));
      input.addEventListener('input', () => FormHelper.updateLabelState(input, label));
    });
  }
  
  static updateLabelState(input, label) {
    if (input.value.trim() !== '' || input === document.activeElement) {
      label.style.transform = 'translateY(-1.5rem) translateX(-1px) scale(0.875)';
      label.style.color = '#cccccc';
    } else {
      label.style.transform = '';
      label.style.color = '#cccccc';
    }
  }
  
  // 自定義checkbox處理
  static initCustomCheckboxes() {
    const checkboxes = document.querySelectorAll('.custom-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        // 可以在這裡添加checkbox狀態變化的邏輯
        console.log('Checkbox changed:', this.checked);
      });
    });
  }
}

// 全域函數
window.LoginFormValidator = LoginFormValidator;
window.FormHelper = FormHelper;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  // 初始化登入表單驗證
  new LoginFormValidator();
  
  // 初始化表單輔助功能
  FormHelper.initInputLabels();
  FormHelper.initCustomCheckboxes();
}); 