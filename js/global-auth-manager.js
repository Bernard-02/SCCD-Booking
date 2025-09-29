// 全站登入狀態管理系統

class GlobalAuthManager {
  constructor() {
    this.init();
  }

  init() {
    // 等待頁面完全載入後檢查登入狀態
    document.addEventListener('DOMContentLoaded', () => {
      this.updateNavigationBasedOnAuthStatus();
    });
  }

  // 檢查是否已登入
  isLoggedIn() {
    if (typeof window.AuthStorage === 'undefined') {
      return false;
    }
    return window.AuthStorage.isLoggedIn();
  }

  // 獲取登入用戶資料
  getLoggedInUser() {
    if (!this.isLoggedIn()) return null;

    const loginData = window.AuthStorage.getLoginData();
    return loginData ? loginData.student : null;
  }

  // 更新導航基於登入狀態
  updateNavigationBasedOnAuthStatus() {
    if (this.isLoggedIn()) {
      this.updateNavigationForLoggedInUser();
    } else {
      this.updateNavigationForGuestUser();
    }
  }

  // 已登入用戶的導航更新
  updateNavigationForLoggedInUser() {
    // 更新桌面版導航
    this.updateDesktopNavigation(true);

    // 更新手機版導航
    this.updateMobileNavigation(true);
  }

  // 未登入用戶的導航更新
  updateNavigationForGuestUser() {
    // 更新桌面版導航
    this.updateDesktopNavigation(false);

    // 更新手機版導航
    this.updateMobileNavigation(false);
  }

  // 更新桌面版導航
  updateDesktopNavigation(isLoggedIn) {
    // 找到桌面版的 LOGIN 連結
    const desktopLoginLinks = document.querySelectorAll('.desktop-nav a[href="login.html"]');

    desktopLoginLinks.forEach(link => {
      if (isLoggedIn) {
        // 已登入：改為 PROFILE
        link.href = 'profile.html';
        const menuText = link.querySelector('.menu-text');
        const menuTextHidden = link.querySelector('.menu-text-hidden');

        if (menuText) menuText.textContent = '(PROFILE)';
        if (menuTextHidden) menuTextHidden.textContent = '(PROFILE)';
      } else {
        // 未登入：保持 LOGIN
        link.href = 'login.html';
        const menuText = link.querySelector('.menu-text');
        const menuTextHidden = link.querySelector('.menu-text-hidden');

        if (menuText) menuText.textContent = '(LOGIN)';
        if (menuTextHidden) menuTextHidden.textContent = '(LOGIN)';
      }
    });
  }

  // 更新手機版導航
  updateMobileNavigation(isLoggedIn) {
    // 找到手機版選單中的 LOGIN 連結
    const mobileLoginLinks = document.querySelectorAll('#mobile-menu a[href="login.html"]');

    mobileLoginLinks.forEach(link => {
      if (isLoggedIn) {
        // 已登入：改為 PROFILE
        link.href = 'profile.html';
        const menuText = link.querySelector('.menu-text');
        const menuTextHidden = link.querySelector('.menu-text-hidden');

        if (menuText) menuText.textContent = '(PROFILE)';
        if (menuTextHidden) menuTextHidden.textContent = '(PROFILE)';
      } else {
        // 未登入：保持 LOGIN
        link.href = 'login.html';
        const menuText = link.querySelector('.menu-text');
        const menuTextHidden = link.querySelector('.menu-text-hidden');

        if (menuText) menuText.textContent = '(LOGIN)';
        if (menuTextHidden) menuTextHidden.textContent = '(LOGIN)';
      }
    });
  }

  // 處理登入狀態變化（供其他腳本調用）
  onAuthStatusChanged() {
    this.updateNavigationBasedOnAuthStatus();
  }

  // 登出後的處理
  onLogout() {
    this.updateNavigationForGuestUser();
  }
}

// 創建全局實例
const globalAuthManager = new GlobalAuthManager();

// 導出供其他腳本使用
if (typeof window !== 'undefined') {
  window.GlobalAuthManager = globalAuthManager;
}