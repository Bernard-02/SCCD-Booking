// 帳號狀態守衛 - 負責檢查用戶狀態並鎖定功能

class AccountStatusGuard {
  constructor() {
    this.isInitialized = false;
  }

  // 初始化守衛
  init() {
    if (this.isInitialized) return;

    // 等待 DOM 加載完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.checkAndLockBooking());
    } else {
      this.checkAndLockBooking();
    }

    this.isInitialized = true;
  }

  // 檢查並鎖定 booking 功能
  checkAndLockBooking() {
    // 檢查用戶是否登入
    if (typeof window.AuthStorage === 'undefined' || !window.AuthStorage.isLoggedIn()) {
      return; // 未登入不需要鎖定
    }

    const loginData = window.AuthStorage.getLoginData();
    if (!loginData || !loginData.student) {
      return;
    }

    // 檢查用戶帳號狀態
    const accountStatus = this.getUserAccountStatus(loginData.student);

    if (accountStatus.isSuspended) {
      // 用戶已停權，鎖定所有 booking 相關功能
      this.lockBookingFeatures();
    }
  }

  // 獲取用戶帳號狀態
  getUserAccountStatus(userData) {
    if (!window.RentalHistoryManager) {
      return { isSuspended: false };
    }

    const rentalHistoryManager = new window.RentalHistoryManager();
    rentalHistoryManager.init(userData);
    return rentalHistoryManager.getAccountStatus();
  }

  // 鎖定 booking 功能
  lockBookingFeatures() {
    // 查找所有指向 booking.html 的鏈接
    const bookingLinks = document.querySelectorAll('a[href="booking.html"], a[href="./booking.html"], a[href="../booking.html"]');

    bookingLinks.forEach(link => {
      // 移除 href
      link.removeAttribute('href');

      // 添加禁用樣式
      link.style.opacity = '0.5';
      link.style.cursor = 'not-allowed';
      link.style.pointerEvents = 'none';

      // 添加停權提示
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSuspendedMessage();
      });
    });

    // 查找所有 booking 按鈕（根據文字內容）
    const bookingButtons = Array.from(document.querySelectorAll('button, a')).filter(el => {
      const text = el.textContent.trim().toLowerCase();
      return text.includes('booking') || text.includes('租借');
    });

    bookingButtons.forEach(button => {
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
      button.style.pointerEvents = 'none';

      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSuspendedMessage();
      });
    });
  }

  // 顯示停權提示訊息
  showSuspendedMessage() {
    alert('您的帳號因逾期超過5天已遭停權，無法使用租借功能。\n如有任何疑問請洽系學會。');
  }

  // 檢查用戶是否可以使用 booking 功能（供其他模組調用）
  canUseBooking() {
    if (typeof window.AuthStorage === 'undefined' || !window.AuthStorage.isLoggedIn()) {
      return true; // 未登入允許訪問（會在 booking 頁面要求登入）
    }

    const loginData = window.AuthStorage.getLoginData();
    if (!loginData || !loginData.student) {
      return true;
    }

    const accountStatus = this.getUserAccountStatus(loginData.student);
    return !accountStatus.isSuspended;
  }
}

// 創建全局實例
if (typeof window !== 'undefined') {
  window.AccountStatusGuard = new AccountStatusGuard();

  // 自動初始化
  window.AccountStatusGuard.init();
}
