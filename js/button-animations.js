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
      duration: 0.5,
      ease: "power2.out"
    });
    
    // 文字顏色變化
    this.classList.add('white-text');
  });
  
  button.addEventListener('mouseleave', function() {
    gsap.to(buttonFill, {
      height: '0%',
      duration: 0.5,
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
      duration: 0.5,
      ease: "power2.out"
    });
    
    // 文字顏色變化
    this.classList.add('white-text');
  });
  
  loginBtn.addEventListener('mouseleave', function() {
    gsap.to(loginBtnFill, {
      height: '0%',
      duration: 0.5,
      ease: "power2.out"
    });
    
    // 文字顏色恢復
    this.classList.remove('white-text');
  });
}

// 初始化 Login 頁面特殊按鈕動畫
function initLoginPageButton() {
  const loginButton = document.querySelector('.login-button');
  if (!loginButton) return;
  
  const arrowWrapper = loginButton.querySelector('.login-arrows-wrapper');
  if (!arrowWrapper) return;
  
  // 只在桌面版顯示 hover 效果
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return;
  }
  
  loginButton.addEventListener('mouseenter', function() {
    arrowWrapper.style.transform = 'translateX(0px)';
  });
  
  loginButton.addEventListener('mouseleave', function() {
    arrowWrapper.style.transform = 'translateX(-34px)';
  });
}

// 全域函數
window.initButtonAnimations = initButtonAnimations;
window.initLoginPageButton = initLoginPageButton;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  initButtonAnimations();
  initLoginPageButton();
}); 