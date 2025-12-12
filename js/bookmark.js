/* ===== 統一收藏管理系統 ===== */

/**
 * 集中式收藏管理器
 * 負責處理所有收藏相關的邏輯，包括設備、教室等
 */
class UnifiedBookmarkManager {
  constructor() {
    this.baseStorageKey = 'sccd_bookmarks';
    this.bookmarks = new Set();
    this.currentUserId = null;
    this.observers = new Set(); // 觀察者模式，用於通知UI更新
    this.isInitialized = false;

    this.init();
  }

  // ===== 初始化 =====
  async init() {
    try {
      await this.updateCurrentUser();
      this.loadFromStorage();
      this.setupStorageListener();
      this.setupEventListeners();
      this.isInitialized = true;

      console.log('UnifiedBookmarkManager 初始化完成');
      console.log('當前用戶:', this.currentUserId);
      console.log('收藏列表:', Array.from(this.bookmarks));

      // 通知初始化完成
      this.notifyObservers('init', null);
      window.dispatchEvent(new CustomEvent('bookmarkManagerReady'));
    } catch (error) {
      console.error('收藏管理器初始化失敗:', error);
    }
  }

  // ===== 用戶管理 =====
  async updateCurrentUser() {
    try {
      if (typeof window.AuthStorage !== 'undefined' && window.AuthStorage.isLoggedIn()) {
        const loginData = window.AuthStorage.getLoginData();
        if (loginData && loginData.student && loginData.student.studentId) {
          const newUserId = loginData.student.studentId;

          // 只有在用戶變更時才重新載入數據
          if (this.currentUserId !== newUserId) {
            this.currentUserId = newUserId;
            if (this.isInitialized) {
              this.loadFromStorage();
              this.notifyObservers('user_changed', null);
            }
          }
        } else {
          this.currentUserId = null;
        }
      } else {
        this.currentUserId = null;
      }

      console.log('更新當前用戶ID:', this.currentUserId);
    } catch (error) {
      console.error('更新用戶狀態失敗:', error);
      this.currentUserId = null;
    }
  }

  // 獲取當前用戶的儲存key
  getCurrentStorageKey() {
    if (this.currentUserId) {
      return `${this.baseStorageKey}_${this.currentUserId}`;
    }
    return this.baseStorageKey; // 向後兼容，未登入時使用預設key
  }

  // ===== 數據管理 =====
  loadFromStorage() {
    try {
      const storageKey = this.getCurrentStorageKey();
      const saved = localStorage.getItem(storageKey);

      if (saved) {
        const bookmarkArray = JSON.parse(saved);
        this.bookmarks = new Set(bookmarkArray);
      } else {
        this.bookmarks = new Set();
      }

      console.log(`從 ${storageKey} 載入收藏:`, Array.from(this.bookmarks));
    } catch (error) {
      console.warn('無法載入收藏清單:', error);
      this.bookmarks = new Set();
    }
  }

  saveToStorage() {
    try {
      const storageKey = this.getCurrentStorageKey();
      const bookmarkArray = Array.from(this.bookmarks);
      localStorage.setItem(storageKey, JSON.stringify(bookmarkArray));
      console.log(`收藏清單已保存到 ${storageKey}:`, bookmarkArray);
    } catch (error) {
      console.warn('無法保存收藏清單:', error);
    }
  }

  // ===== 核心 API =====

  // 檢查是否已收藏
  isBookmarked(itemName) {
    return this.bookmarks.has(itemName);
  }

  // 添加收藏
  addBookmark(itemName, isUndo = false) {
    if (!this.bookmarks.has(itemName)) {
      this.bookmarks.add(itemName);
      this.saveToStorage();
      this.notifyObservers('add', itemName, isUndo);
      console.log(`已添加收藏: ${itemName}`);
      return true;
    }
    return false;
  }

  // 移除收藏
  removeBookmark(itemName) {
    if (this.bookmarks.has(itemName)) {
      this.bookmarks.delete(itemName);
      this.saveToStorage();
      this.notifyObservers('remove', itemName);
      console.log(`已移除收藏: ${itemName}`);
      return true;
    }
    return false;
  }

  // 切換收藏狀態
  toggleBookmark(itemName) {
    if (this.isBookmarked(itemName)) {
      this.removeBookmark(itemName);
      return false;
    } else {
      this.addBookmark(itemName);
      return true;
    }
  }

  // 獲取所有收藏
  getAllBookmarks() {
    return Array.from(this.bookmarks);
  }

  // 清空收藏
  clearAllBookmarks() {
    this.bookmarks.clear();
    this.saveToStorage();
    this.notifyObservers('clear', null);
    console.log('已清空所有收藏');
  }

  // ===== 分類管理 =====

  // 獲取設備收藏
  getEquipmentBookmarks() {
    return this.getAllBookmarks().filter(item => !item.includes('教室'));
  }

  // 獲取教室收藏
  getClassroomBookmarks() {
    return this.getAllBookmarks().filter(item => item.includes('教室'));
  }

  // 獲取教室收藏（轉換為簡短格式）
  getClassroomBookmarksShort() {
    return this.getClassroomBookmarks().map(item => item.replace(' 教室', ''));
  }

  // ===== 觀察者模式 =====

  // 註冊觀察者
  addObserver(observer) {
    this.observers.add(observer);
    console.log('已註冊收藏狀態觀察者');
  }

  // 移除觀察者
  removeObserver(observer) {
    this.observers.delete(observer);
  }

  // 通知所有觀察者
  notifyObservers(action, itemName = null, isUndo = false) {
    this.observers.forEach(observer => {
      try {
        observer(action, itemName, this.bookmarks);
      } catch (error) {
        console.warn('觀察者回調執行錯誤:', error);
      }
    });

    // 觸發全域事件
    window.dispatchEvent(new CustomEvent('bookmarkUpdated', {
      detail: { action, itemName, bookmarks: this.getAllBookmarks(), isUndo }
    }));
  }

  // ===== 事件監聽 =====
  setupStorageListener() {
    // 監聽 localStorage 變化（跨頁面同步）
    window.addEventListener('storage', (event) => {
      if (event.key === this.getCurrentStorageKey()) {
        console.log('檢測到收藏數據變化，重新載入');
        this.loadFromStorage();
        this.notifyObservers('sync', null);
      }
    });
  }

  setupEventListeners() {
    // 監聽認證狀態變化
    window.addEventListener('authStateChanged', () => {
      console.log('認證狀態變化，更新收藏管理器');
      this.updateCurrentUser();
    });

    // 監聽頁面可見性變化，確保數據同步
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateCurrentUser();
      }
    });
  }

  // ===== 認證相關 =====
  onAuthStateChanged() {
    console.log('收藏管理器：認證狀態已改變，重新初始化');
    this.updateCurrentUser();
  }

  // ===== 統計和調試 =====
  getStats() {
    return {
      total: this.bookmarks.size,
      equipment: this.getEquipmentBookmarks().length,
      classrooms: this.getClassroomBookmarks().length,
      items: this.getAllBookmarks(),
      currentUser: this.currentUserId
    };
  }

  // 調試方法
  debug() {
    console.group('收藏管理器狀態');
    console.log('當前用戶:', this.currentUserId);
    console.log('儲存Key:', this.getCurrentStorageKey());
    console.log('總收藏數:', this.bookmarks.size);
    console.log('設備收藏:', this.getEquipmentBookmarks());
    console.log('教室收藏:', this.getClassroomBookmarks());
    console.log('觀察者數量:', this.observers.size);
    console.groupEnd();
  }
}

/**
 * UI 管理器 - 負責處理收藏按鈕的視覺狀態
 */
class BookmarkUIManager {
  constructor(bookmarkManager) {
    this.bookmarkManager = bookmarkManager;
    this.isInitialized = false;

    // 等待DOM和BookmarkManager都準備就緒
    this.initWhenReady();
  }

  async initWhenReady() {
    // 等待DOM準備
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }

    // 等待BookmarkManager準備
    if (!this.bookmarkManager.isInitialized) {
      await new Promise(resolve => {
        window.addEventListener('bookmarkManagerReady', resolve);
      });
    }

    this.init();
  }

  init() {
    if (this.isInitialized) return;

    // 註冊為收藏管理器的觀察者
    this.bookmarkManager.addObserver(this.handleBookmarkChange.bind(this));

    // 設置事件監聽器
    this.setupEventListeners();

    // 初始化所有按鈕狀態
    setTimeout(() => {
      this.updateAllButtons();
    }, 100);

    this.isInitialized = true;
    console.log('BookmarkUIManager 初始化完成');
  }

  // 處理收藏狀態變化
  handleBookmarkChange(action, itemName, bookmarks) {
    console.log(`處理收藏變化: ${action}, 項目: ${itemName}`);

    switch (action) {
      case 'add':
      case 'remove':
        this.updateButtonsForItem(itemName);
        break;
      case 'sync':
      case 'clear':
      case 'user_changed':
        this.updateAllButtons();
        break;
    }
  }

  // 更新特定項目的所有按鈕
  updateButtonsForItem(itemName) {
    const buttons = document.querySelectorAll(`[data-equipment="${itemName}"]`);
    const isBookmarked = this.bookmarkManager.isBookmarked(itemName);

    buttons.forEach(button => {
      this.updateButtonState(button, isBookmarked);
    });
  }

  // 更新所有收藏按鈕
  updateAllButtons() {
    const buttons = document.querySelectorAll('.bookmark-btn[data-equipment]');
    const isLoggedIn = this.checkLoginStatus();

    buttons.forEach(button => {
      const itemName = button.getAttribute('data-equipment');
      if (itemName) {
        // 如果未登入，強制顯示為未收藏狀態
        if (!isLoggedIn) {
          this.updateButtonState(button, false);
        } else {
          const isBookmarked = this.bookmarkManager.isBookmarked(itemName);
          this.updateButtonState(button, isBookmarked);
        }
      }
    });

    console.log(`已更新 ${buttons.length} 個收藏按鈕`);
  }

  // 更新單個按鈕狀態
  updateButtonState(button, isBookmarked) {
    // 檢查登入狀態
    const isLoggedIn = this.checkLoginStatus();

    // 如果未登入，強制顯示為未收藏狀態
    if (!isLoggedIn) {
      button.src = 'Icons/Bookmark Sharp Regular.svg';
      button.classList.remove('bookmarked');
      return;
    }

    // 已登入時根據收藏狀態顯示
    if (isBookmarked) {
      button.src = 'Icons/Bookmark Sharp Fill.svg';
      button.classList.add('bookmarked');
    } else {
      button.src = 'Icons/Bookmark Sharp Regular.svg';
      button.classList.remove('bookmarked');
    }
  }

  // 設置事件監聽器
  setupEventListeners() {
    try {
      // 使用事件委託處理收藏按鈕點擊
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('bookmark-btn') && e.target.hasAttribute('data-equipment')) {
          this.handleButtonClick(e);
        }
      });

      // 監聽DOM變化，處理動態生成的按鈕
      const observer = new MutationObserver(() => {
        this.updateAllButtons();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      console.log('BookmarkUIManager 事件監聽器設置完成');
    } catch (error) {
      console.error('設置事件監聽器時發生錯誤:', error);
    }
  }

  // 處理收藏按鈕點擊
  handleButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const button = e.target;
    const itemName = button.getAttribute('data-equipment');

    if (!itemName) {
      console.warn('收藏按鈕缺少 data-equipment 屬性:', button);
      return;
    }

    console.log(`收藏按鈕被點擊: ${itemName}`);

    // 檢查登入狀態
    if (!this.checkLoginStatus()) {
      this.handleNotLoggedIn(itemName);
      return;
    }

    // 檢查當前收藏狀態
    const wasBookmarked = this.bookmarkManager.isBookmarked(itemName);

    // 切換收藏狀態
    const isNowBookmarked = this.bookmarkManager.toggleBookmark(itemName);

    // 根據操作類型顯示不同的toast
    if (isNowBookmarked) {
      // 添加收藏 - 簡單toast
      const message = `${itemName} 已加入收藏！`;
      this.showToast(message, 'success');
    } else {
      // 移除收藏 - 帶UNDO的toast
      const message = `${itemName} 已取消收藏！`;
      this.showUndoToast(message, itemName);
    }
  }

  // 檢查登入狀態
  checkLoginStatus() {
    return typeof window.AuthStorage !== 'undefined' && window.AuthStorage.isLoggedIn();
  }

  // 處理未登入情況
  handleNotLoggedIn(itemName) {
    // 簡單邏輯：顯示toast並重定向到登入頁面
    this.showToast('請先登入以使用收藏功能', 'success');

    if (typeof window.redirectToLogin === 'function') {
      window.redirectToLogin('請先登入以使用收藏功能');
    }
  }


  // 顯示通知 - 使用全局showToast函數
  showToast(message, type = 'success') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    }
  }

  // 顯示帶UNDO按鈕的toast
  showUndoToast(message, itemName) {
    // 移除現有的toast
    const existingToast = document.getElementById('bookmark-undo-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // 創建toast容器
    const toast = document.createElement('div');
    toast.id = 'bookmark-undo-toast';
    toast.className = 'toast';

    // 創建內容容器
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'flex items-center gap-4';

    // 創建消息文字
    const messageP = document.createElement('p');
    messageP.textContent = message;

    // 創建UNDO按鈕
    const undoBtn = document.createElement('button');
    undoBtn.className = 'font-english font-medium text-tiny uppercase tracking-wide hover:opacity-70 transition-opacity';
    undoBtn.style.color = '#000000';
    undoBtn.style.marginLeft = '1rem';
    undoBtn.textContent = 'UNDO';
    undoBtn.onclick = () => {
      // 重新添加收藏，標記為UNDO操作
      this.bookmarkManager.addBookmark(itemName, true);
      toast.classList.add('fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    };
    undoBtn.style.cursor = 'pointer';
    undoBtn.style.pointerEvents = 'auto';

    contentWrapper.appendChild(messageP);
    contentWrapper.appendChild(undoBtn);
    toast.appendChild(contentWrapper);
    document.body.appendChild(toast);

    // 顯示toast
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // 3秒後自動消失
    setTimeout(() => {
      if (toast.parentNode && !toast.classList.contains('fade-out')) {
        toast.classList.add('fade-out');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }
    }, 3000);
  }
}

// ===== 全域初始化 =====

// 創建全域實例
let unifiedBookmarkManager = null;
let bookmarkUIManager = null;

// 初始化函數
function initBookmarkSystem() {
  if (!unifiedBookmarkManager) {
    unifiedBookmarkManager = new UnifiedBookmarkManager();
    bookmarkUIManager = new BookmarkUIManager(unifiedBookmarkManager);

    // 設置全域變數（向後兼容）
    window.unifiedBookmarkManager = unifiedBookmarkManager;
    window.bookmarkUIManager = bookmarkUIManager;

    // 兼容舊的變數名
    window.sccdBookmarkManager = unifiedBookmarkManager;
    window.sccdBookmarkUIManager = bookmarkUIManager;

    console.log('統一收藏系統初始化完成');
  }
}

// 認證狀態變更回調
window.onBookmarkAuthStateChanged = function() {
  if (unifiedBookmarkManager) {
    unifiedBookmarkManager.onAuthStateChanged();
  }
  if (bookmarkUIManager) {
    setTimeout(() => {
      bookmarkUIManager.updateAllButtons();
    }, 100);
  }
};

// 自動初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBookmarkSystem);
} else {
  initBookmarkSystem();
}

// 導出給其他模組使用
window.initBookmarkSystem = initBookmarkSystem;