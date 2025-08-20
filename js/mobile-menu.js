/* ===== 手機版選單功能 ===== */

class MobileMenu {
  constructor() {
    this.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    this.mobileMenuClose = document.getElementById('mobile-menu-close');
    this.mobileMenu = document.getElementById('mobile-menu');
    this.body = document.body;
    this.init();
  }
  
  init() {
    if (!this.mobileMenu) return;
    
    this.bindEvents();
  }
  
  bindEvents() {
    // 打開/關閉選單（同一個按鈕）
    if (this.mobileMenuBtn) {
      this.mobileMenuBtn.addEventListener('click', () => {
        if (this.mobileMenu.classList.contains('active')) {
          this.closeMenu();
        } else {
          this.openMenu();
        }
      });
    }
    
    // 關閉選單（如果有獨立的 close 按鈕）
    if (this.mobileMenuClose) {
      this.mobileMenuClose.addEventListener('click', () => this.closeMenu());
    }
    
    // 點擊選單項目時關閉選單
    const mobileMenuLinks = this.mobileMenu.querySelectorAll('nav a');
    mobileMenuLinks.forEach(link => {
      link.addEventListener('click', () => this.closeMenu());
    });
    
    // 點擊背景關閉選單
    this.mobileMenu.addEventListener('click', (event) => {
      if (event.target === this.mobileMenu) {
        this.closeMenu();
      }
    });
  }
  
  openMenu() {
    this.mobileMenu.classList.add('active');
    this.body.style.overflow = 'hidden'; // 防止背景滾動
    
    // 更換按鈕文字為 (CLOSE)
    this.updateMenuButtonText('(CLOSE)');
    
    // 觸發選單動畫
    this.triggerMenuAnimation();
  }
  
  closeMenu() {
    this.mobileMenu.classList.remove('active');
    this.body.style.overflow = ''; // 恢復滾動
    
    // 恢復按鈕文字為 (MENU)
    this.updateMenuButtonText('(MENU)');
  }
  
  updateMenuButtonText(text) {
    if (this.mobileMenuBtn) {
      const menuTexts = this.mobileMenuBtn.querySelectorAll('.menu-text, .menu-text-hidden');
      menuTexts.forEach(element => {
        element.textContent = text;
      });
    }
  }
  
  triggerMenuAnimation() {
    // 獲取所有動畫元素
    const animatedElements = this.mobileMenu.querySelectorAll('.menu-animate-enter-content');
    
    // 重置動畫
    animatedElements.forEach(element => {
      element.style.animation = 'none';
      element.offsetHeight; // 強制重排
      element.style.animation = null;
    });
  }
}

// 全域初始化函數
function initMobileMenu() {
  return new MobileMenu();
}

// 全域變數
window.MobileMenu = MobileMenu;
window.initMobileMenu = initMobileMenu;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  initMobileMenu();
}); 