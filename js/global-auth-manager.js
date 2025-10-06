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

    // 更新 PROFILE 的通知紅點
    this.updateProfileNotificationIndicator();
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

  // 更新 PROFILE 連結的通知紅點
  updateProfileNotificationIndicator() {
    // 檢查是否有未讀通知
    const hasUnread = this.checkUnreadNotifications();

    // 桌面版 PROFILE 連結
    const desktopProfileLinks = document.querySelectorAll('.desktop-nav a[href="profile.html"]');
    desktopProfileLinks.forEach(link => {
      this.updateLinkNotificationIndicator(link, hasUnread);
    });

    // 手機版 PROFILE 連結
    const mobileProfileLinks = document.querySelectorAll('#mobile-menu a[href="profile.html"]');
    mobileProfileLinks.forEach(link => {
      this.updateLinkNotificationIndicator(link, hasUnread);
    });
  }

  // 更新連結的通知指示器
  updateLinkNotificationIndicator(link, hasUnread) {
    // 移除現有的指示器
    const existingIndicator = link.querySelector('.notification-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
      link.style.position = '';
    }

    // 如果有未讀通知，添加紅點
    if (hasUnread) {
      link.style.position = 'relative';

      const indicator = document.createElement('div');
      indicator.className = 'notification-indicator w-2 h-2 rounded-full';
      indicator.style.backgroundColor = 'var(--color-error)';
      indicator.style.position = 'absolute';
      indicator.style.top = '0px';
      indicator.style.right = '-8px';

      link.appendChild(indicator);
    }
  }

  // 檢查是否有未讀通知
  checkUnreadNotifications() {
    if (!this.isLoggedIn()) return false;

    const loginData = window.AuthStorage.getLoginData();
    if (!loginData || !loginData.student) return false;

    const storageKey = `sccd_notifications_${loginData.student.studentId}`;

    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return false;

      const notifications = JSON.parse(stored);
      return notifications.some(notification => !notification.isRead);
    } catch (error) {
      console.error('檢查未讀通知錯誤:', error);
      return false;
    }
  }
}

// 創建全局實例
const globalAuthManager = new GlobalAuthManager();

// 導出供其他腳本使用
if (typeof window !== 'undefined') {
  window.GlobalAuthManager = globalAuthManager;
}