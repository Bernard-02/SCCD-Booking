/* ===== 按鈕動畫效果 JavaScript ===== */

// 初始化通用按鈕動畫
function initButtonAnimations() {
  // 檢查是否載入了 GSAP
  if (typeof gsap === 'undefined') {
    console.warn('GSAP未載入，按鈕動畫將不可用');
    return;
  }
  
  initStartRentalButton();
  initLoginButton();
  initResetDateButton();
}

// 初始化「開始租借」按鈕動畫
function initStartRentalButton() {
  const button = document.getElementById('start-rental-btn');
  if (!button) return;
  
  const buttonFill = button.querySelector('.button-bg-fill');
  if (!buttonFill) return;
  
  button.addEventListener('mouseenter', function() {
    gsap.to(buttonFill, {
      height: '100%',
      duration: 0.3,
      ease: "power2.out"
    });
    
    // 文字顏色變化
    this.classList.add('white-text');
  });
  
  button.addEventListener('mouseleave', function() {
    gsap.to(buttonFill, {
      height: '0%',
      duration: 0.3,
      ease: "power2.out"
    });
    
    // 文字顏色恢復
    this.classList.remove('white-text');
  });
}

// 初始化重設日期按鈕動畫
function initResetDateButton() {
  const button = document.getElementById('reset-date-button');
  if (!button) return;
  
  const buttonFill = button.querySelector('.button-bg-fill');
  if (!buttonFill) return;
  
  button.addEventListener('mouseenter', function() {
    // 只有在按鈕不是禁用狀態時才執行動畫
    if (!this.disabled) {
      gsap.to(buttonFill, {
        height: '100%',
        duration: 0.3,
        ease: "power2.out"
      });
      
      // 文字顏色變化
      this.classList.add('white-text');
    }
  });
  
  button.addEventListener('mouseleave', function() {
    // 始終執行離開動畫
    gsap.to(buttonFill, {
      height: '0%',
      duration: 0.3,
      ease: "power2.out"
    });
    
    // 文字顏色恢復
    this.classList.remove('white-text');
  });
}

// 初始化 Login 按鈕動畫
function initLoginButton() {
  const loginBtn = document.getElementById('login-btn');
  if (!loginBtn) return;
  
  const loginBtnFill = loginBtn.querySelector('.button-bg-fill');
  if (!loginBtnFill) return;
  
  loginBtn.addEventListener('mouseenter', function() {
    gsap.to(loginBtnFill, {
      height: '100%',
      duration: 0.3,
      ease: "power2.out"
    });
    
    // 文字顏色變化
    this.classList.add('white-text');
  });
  
  loginBtn.addEventListener('mouseleave', function() {
    gsap.to(loginBtnFill, {
      height: '0%',
      duration: 0.3,
      ease: "power2.out"
    });
    
    // 文字顏色恢復
    this.classList.remove('white-text');
  });
}

// 初始化 Login 頁面特殊按鈕動畫
function initLoginPageButton() {
  const loginButton = document.querySelector('.login-button');
  if (!loginButton) {
    console.log('Login button not found');
    return;
  }
  
  const buttonFill = loginButton.querySelector('.button-bg-fill');
  const arrowsWrapper = loginButton.querySelector('.login-arrows-wrapper');
  
  if (!buttonFill) {
    console.log('Button fill element not found');
    return;
  }
  
  // 檢查GSAP是否載入
  if (typeof gsap === 'undefined') {
    console.warn('GSAP not loaded for login button');
    return;
  }
  
  // 只在桌面版啟用動畫
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    loginButton.addEventListener('mouseenter', function() {
      // 背景填充動畫 - 與 index.html 開始租借按鈕完全相同
      gsap.to(buttonFill, {
        height: '100%',
        duration: 0.3,
        ease: "power2.out"
      });
      
      // 文字顏色變化
      this.classList.add('white-text');
      
      // 箭頭滑動動畫 - 從右往左滑動
      if (arrowsWrapper) {
        gsap.to(arrowsWrapper, {
          transform: 'translateX(0px)',
          duration: 1,
          ease: "cubic-bezier(0.4, 0, 0.2, 1)"
        });
      }
    });
    
    loginButton.addEventListener('mouseleave', function() {
      // 背景填充動畫 - 與 index.html 開始租借按鈕完全相同
      gsap.to(buttonFill, {
        height: '0%',
        duration: 0.3,
        ease: "power2.out"
      });
      
      // 文字顏色恢復
      this.classList.remove('white-text');
      
      // 箭頭復位動畫 - 回到原始位置
      if (arrowsWrapper) {
        gsap.to(arrowsWrapper, {
          transform: 'translateX(-34px)',
          duration: 1,
          ease: "cubic-bezier(0.4, 0, 0.2, 1)"
        });
      }
    });
  }
}

// 全域函數
window.initButtonAnimations = initButtonAnimations;
window.initLoginPageButton = initLoginPageButton;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  initButtonAnimations();
  
  // 延遲初始化login頁面按鈕，確保DOM完全加載
  setTimeout(() => {
    initLoginPageButton();
  }, 100);
}); 