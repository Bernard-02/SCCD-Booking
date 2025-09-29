/* ===== 通用 JavaScript 功能 ===== */

// ===== 統一的Toast通知系統 =====
function showBookmarkToast(message, type = 'success') {

  // 檢查是否已有toast，如果有則移除
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  // 創建新的toast
  const toast = document.createElement('div');
  toast.className = 'toast';

  // 創建內部的p元素
  const p = document.createElement('p');
  p.textContent = message;
  toast.appendChild(p);

  document.body.appendChild(toast);

  // 設定顏色樣式
  if (type === 'error') {
    toast.classList.add('error');
    // 錯誤樣式：粉色背景，紅色文字
    toast.style.backgroundColor = 'var(--color-bg-toast-error)';
    toast.style.color = 'var(--color-error)';
  } else {
    // 成功樣式：白色背景，黑色文字
    toast.style.backgroundColor = 'var(--color-bg-toast)';
    toast.style.color = 'var(--color-primary)';
  }

  // 使用新的 toast 樣式（右上角滑入）
  // 清除之前的動畫類別
  toast.classList.remove('show', 'fade-out');

  // 短暫延遲後顯示（確保 CSS 過渡效果正常）
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // 3秒後開始 fade out 動畫
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('fade-out');

    // fade out 動畫完成後移除元素
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// ===== 延遲收藏管理器 =====
class PendingBookmarkManager {
  constructor() {
    this.baseStorageKey = 'sccd_pending_bookmarks';
  }

  // 生成帶用戶識別的儲存key（基於瀏覽器會話）
  getStorageKey(userIdentifier = null) {
    if (userIdentifier) {
      return `${this.baseStorageKey}_${userIdentifier}`;
    }
    // 對於未登入用戶，使用基於時間的會話ID，確保不同瀏覽器會話分離
    const sessionId = this.getOrCreateSessionId();
    return `${this.baseStorageKey}_session_${sessionId}`;
  }

  // 獲取或創建會話ID
  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('sccd_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('sccd_session_id', sessionId);
    }
    return sessionId;
  }

  // 儲存未登入時的收藏操作
  savePendingBookmark(itemName, userIdentifier = null) {
    try {
      const storageKey = this.getStorageKey(userIdentifier);
      let pendingBookmarks = this.getPendingBookmarks(userIdentifier);

      // 避免重複添加
      if (!pendingBookmarks.includes(itemName)) {
        pendingBookmarks.push(itemName);
        sessionStorage.setItem(storageKey, JSON.stringify(pendingBookmarks));
        console.log(`已儲存延遲收藏 (${storageKey}): ${itemName}`);
      }
    } catch (error) {
      console.warn('儲存延遲收藏失敗:', error);
    }
  }

  // 獲取所有待處理的收藏
  getPendingBookmarks(userIdentifier = null) {
    try {
      const storageKey = this.getStorageKey(userIdentifier);
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('獲取延遲收藏失敗:', error);
      return [];
    }
  }

  // 處理延遲收藏（登入後執行）
  processPendingBookmarks() {
    // 獲取當前登入用戶的ID
    let currentUserId = null;
    if (typeof window.AuthStorage !== 'undefined' && window.AuthStorage.isLoggedIn()) {
      const loginData = window.AuthStorage.getLoginData();
      if (loginData && loginData.student && loginData.student.studentId) {
        currentUserId = loginData.student.studentId;
      }
    }

    if (!currentUserId) {
      console.warn('無法處理延遲收藏：用戶未登入或無法獲取用戶ID');
      return [];
    }

    // 獲取當前會話的延遲收藏（登入前儲存的）
    const pendingBookmarks = this.getPendingBookmarks(); // 使用當前會話ID

    if (pendingBookmarks.length > 0) {
      console.log(`處理用戶 ${currentUserId} 的延遲收藏:`, pendingBookmarks);

      const successfullyAdded = [];

      // 使用統一收藏管理器處理（來自 bookmark.js）
      pendingBookmarks.forEach(itemName => {
        if (window.unifiedBookmarkManager && !window.unifiedBookmarkManager.isBookmarked(itemName)) {
          window.unifiedBookmarkManager.addBookmark(itemName);
          successfullyAdded.push(itemName);
          console.log(`用戶 ${currentUserId} 延遲收藏成功: ${itemName}`);
        } else {
          console.log(`設備已被用戶 ${currentUserId} 收藏，跳過: ${itemName}`);
        }
      });

      // 清除當前會話的延遲收藏列表
      this.clearPendingBookmarks();

      // 只有成功添加的設備才顯示通知
      if (successfullyAdded.length > 0) {
        const message = successfullyAdded.length === 1
          ? `${successfullyAdded[0]}已加入收藏夾！`
          : `已將${successfullyAdded.length}個設備加入收藏夾！`;

        if (window.showBookmarkToast) {
          window.showBookmarkToast(message);
        }

        // 更新UI狀態
        if (window.bookmarkUIManager) {
          window.bookmarkUIManager.updateAllButtons();
        }

        // 如果是在設備頁面，重新應用篩選器以顯示"常用設備"
        if (window.location.pathname.includes('equipment.html')) {
          setTimeout(() => {
            if (window.desktopFilter) {
              window.desktopFilter.applyFilters();
            }
            if (window.recalculateRows) {
              window.recalculateRows();
            }
          }, 100);
        }
      }

      return successfullyAdded;
    }

    return [];
  }

  // 清除延遲收藏
  clearPendingBookmarks(userIdentifier = null) {
    try {
      const storageKey = this.getStorageKey(userIdentifier);
      sessionStorage.removeItem(storageKey);
      console.log(`已清除延遲收藏列表: ${storageKey}`);
    } catch (error) {
      console.warn('清除延遲收藏失敗:', error);
    }
  }
}

// 創建延遲收藏管理器實例
const pendingBookmarkManager = new PendingBookmarkManager();

// ===== 登入狀態檢查和重定向功能 =====

// 檢查用戶是否已登入
function checkLoginStatus() {
  if (typeof window.AuthStorage !== 'undefined') {
    return window.AuthStorage.isLoggedIn();
  }
  return false;
}

// 儲存延遲收藏操作
function savePendingBookmark(itemName) {
  pendingBookmarkManager.savePendingBookmark(itemName);
}

// 處理延遲收藏（登入後調用）
function processPendingBookmarks() {
  return pendingBookmarkManager.processPendingBookmarks();
}

// 重定向到登入頁面並顯示提示 (使用業界標準的URL參數方法)
function redirectToLogin(message = '請先登入') {
  // 獲取當前頁面URL
  const currentUrl = window.location.href;

  // 編碼當前URL作為參數
  const encodedUrl = encodeURIComponent(currentUrl);

  // 構建登入頁面URL，包含重定向參數
  const loginUrl = `login.html?redirect_url=${encodedUrl}`;

  console.log('需要登入，重定向到:', loginUrl); // Debug
  console.log('登入後將返回:', currentUrl); // Debug

  // 顯示提示信息
  if (window.showBookmarkToast) {
    window.showBookmarkToast(message, 'error');
  }

  // 1秒後跳轉，讓用戶看到提示
  setTimeout(() => {
    window.location.href = loginUrl;
  }, 1000);
}

// ===== Header Menu 滾動效果管理器 =====
class HeaderMenuScrollManager {
  constructor() {
    this.lastScrollTop = 0;
    this.menu = null;
    this.isInitialized = false;
    this.init();
  }

  init() {
    // 確保不重複初始化
    if (this.isInitialized) {
      return;
    }

    // 檢查DOM是否已準備就緒
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setup();
      });
    } else {
      this.setup();
    }
  }

  setup() {
    // 尋找 header menu 元素
    this.menu = document.querySelector('.header-menu');

    if (!this.menu) {
      console.log('Header menu 元素未找到，跳過滾動效果初始化');
      return;
    }

    // 設置滾動監聽器
    window.addEventListener('scroll', () => {
      this.handleScroll();
    });

    this.isInitialized = true;
    console.log('Header menu 滾動效果已初始化');
  }

  handleScroll() {
    if (!this.menu) return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > this.lastScrollTop) {
      // 向下滾動 - fade out
      this.menu.classList.add('fade-out');
    } else {
      // 向上滾動 - fade in
      this.menu.classList.remove('fade-out');
    }

    this.lastScrollTop = scrollTop;
  }

  // 手動重置滾動位置
  reset() {
    this.lastScrollTop = 0;
    if (this.menu) {
      this.menu.classList.remove('fade-out');
    }
  }
}

// ===== 初始化和全域變數 =====

// 設置全域變數（不包含收藏管理器，使用 bookmark.js 提供的）
window.showBookmarkToast = showBookmarkToast;
window.checkLoginStatus = checkLoginStatus;
window.redirectToLogin = redirectToLogin;
window.savePendingBookmark = savePendingBookmark;
window.processPendingBookmarks = processPendingBookmarks;

// 用戶認證狀態改變時的回調（與 bookmark.js 協作）
window.onAuthStateChanged = function() {
  // 通知 bookmark.js 的收藏管理器
  if (typeof window.onBookmarkAuthStateChanged === 'function') {
    window.onBookmarkAuthStateChanged();
  }

  // 處理延遲收藏
  if (checkLoginStatus()) {
    setTimeout(() => {
      processPendingBookmarks();
    }, 500);
  }
};

// 向後兼容
window.showToast = showBookmarkToast;

// 通用頁面初始化
function initCommonFeatures() {
  console.log('初始化通用功能');

  // 處理延遲收藏（如果用戶已登入）
  if (checkLoginStatus()) {
    // 延遲處理，確保收藏管理器已初始化
    setTimeout(() => {
      processPendingBookmarks();
    }, 1000);
  }
}

// 全域函數
window.initCommonFeatures = initCommonFeatures;

// 創建全域 Header 滾動效果實例
const headerMenuScrollManager = new HeaderMenuScrollManager();
window.sccdHeaderMenuScrollManager = headerMenuScrollManager;

// 自動初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCommonFeatures);
} else {
  initCommonFeatures();
}

console.log('通用功能模組載入完成');