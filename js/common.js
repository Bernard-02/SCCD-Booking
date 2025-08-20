/* ===== 通用 JavaScript 功能 ===== */

// ===== 全域收藏夾管理庫 =====
class BookmarkManager {
  constructor() {
    this.storageKey = 'sccd_bookmarks';
    this.bookmarks = new Set();
    this.observers = new Set(); // 觀察者模式，用於通知UI更新
    this.init();
  }

  // 初始化：從 localStorage 載入資料
  init() {
    this.loadFromStorage();
    this.setupStorageListener();
    console.log('BookmarkManager 初始化完成，當前收藏:', Array.from(this.bookmarks));
  }

  // 從 localStorage 載入收藏清單
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const bookmarkArray = JSON.parse(saved);
        this.bookmarks = new Set(bookmarkArray);
      }
    } catch (error) {
      console.warn('無法載入收藏清單:', error);
      this.bookmarks = new Set();
    }
  }

  // 保存收藏清單到 localStorage
  saveToStorage() {
    try {
      const bookmarkArray = Array.from(this.bookmarks);
      localStorage.setItem(this.storageKey, JSON.stringify(bookmarkArray));
      console.log('收藏清單已保存:', bookmarkArray);
    } catch (error) {
      console.warn('無法保存收藏清單:', error);
    }
  }

  // 監聽 localStorage 變化（跨頁面同步）
  setupStorageListener() {
    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey) {
        console.log('檢測到其他頁面的收藏狀態變化');
        this.loadFromStorage();
        this.notifyObservers('sync');
      }
    });
  }

  // ===== 核心API =====
  
  // 檢查是否已收藏
  isBookmarked(itemName) {
    return this.bookmarks.has(itemName);
  }

  // 添加收藏
  addBookmark(itemName) {
    if (!this.bookmarks.has(itemName)) {
      this.bookmarks.add(itemName);
      this.saveToStorage();
      this.notifyObservers('add', itemName);
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
    const wasBookmarked = this.isBookmarked(itemName);
    if (wasBookmarked) {
      this.removeBookmark(itemName);
      return false; // 已移除
    } else {
      this.addBookmark(itemName);
      return true; // 已添加
    }
  }

  // 獲取所有收藏的項目
  getAllBookmarks() {
    return Array.from(this.bookmarks);
  }

  // 清空所有收藏
  clearAllBookmarks() {
    this.bookmarks.clear();
    this.saveToStorage();
    this.notifyObservers('clear');
    console.log('已清空所有收藏');
  }

  // ===== 觀察者模式 =====
  
  // 註冊觀察者（用於UI更新）
  addObserver(observer) {
    this.observers.add(observer);
    console.log('已註冊收藏狀態觀察者');
  }

  // 移除觀察者
  removeObserver(observer) {
    this.observers.delete(observer);
  }

  // 通知所有觀察者
  notifyObservers(action, itemName = null) {
    this.observers.forEach(observer => {
      try {
        observer(action, itemName, this.bookmarks);
      } catch (error) {
        console.warn('觀察者回調執行錯誤:', error);
      }
    });
  }

  // ===== 調試和統計功能 =====
  
  // 獲取收藏統計
  getStats() {
    return {
      total: this.bookmarks.size,
      items: Array.from(this.bookmarks)
    };
  }
}

// ===== UI 更新管理器 =====
class BookmarkUIManager {
  constructor(bookmarkManager) {
    this.bookmarkManager = bookmarkManager;
    this.isInitialized = false;
    
    // 檢查DOM是否已準備就緒
    if (document.readyState === 'loading') {
      // DOM還在載入中，等待DOMContentLoaded
      document.addEventListener('DOMContentLoaded', () => {
        this.init();
      });
    } else {
      // DOM已載入完成，直接初始化
      this.init();
    }
  }

  init() {
    // 確保不重複初始化
    if (this.isInitialized) {
      return;
    }

    // 檢查document.body是否存在
    if (!document.body) {
      console.warn('document.body 不存在，延遲初始化');
      setTimeout(() => this.init(), 50);
      return;
    }

    // 註冊為收藏管理器的觀察者
    this.bookmarkManager.addObserver(this.handleBookmarkChange.bind(this));
    
    // 設置事件監聽器
    this.setupEventListeners();
    
    // 延遲初始化所有按鈕狀態，確保頁面加載完成
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
        this.updateAllButtons();
        break;
    }
  }

  // 更新特定項目的所有按鈕
  updateButtonsForItem(itemName) {
    const isBookmarked = this.bookmarkManager.isBookmarked(itemName);
    const buttons = this.findButtonsForItem(itemName);
    
    buttons.forEach(button => {
      this.updateButtonIcon(button, isBookmarked);
    });
  }

  // 更新所有收藏按鈕
  updateAllButtons() {
    // 確保已初始化且document.body存在
    if (!this.isInitialized || !document.body) {
      return;
    }

    const allButtons = document.querySelectorAll('.bookmark-btn, .js-bookmark-btn');
    
    allButtons.forEach(button => {
      const itemName = button.getAttribute('data-equipment');
      if (itemName) {
        const isBookmarked = this.bookmarkManager.isBookmarked(itemName);
        this.updateButtonIcon(button, isBookmarked);
      }
    });
    
    console.log(`已更新 ${allButtons.length} 個收藏按鈕`);
  }

  // 找到特定項目的所有收藏按鈕
  findButtonsForItem(itemName) {
    if (!document.body) {
      return [];
    }

    const selectors = '.bookmark-btn, .js-bookmark-btn';
    const allButtons = document.querySelectorAll(selectors);
    
    return Array.from(allButtons).filter(button => 
      button.getAttribute('data-equipment') === itemName
    );
  }

  // 更新按鈕圖示
  updateButtonIcon(button, isBookmarked) {
    if (button && button.tagName === 'IMG') {
      const iconSrc = isBookmarked 
        ? 'Icons/Bookmark Sharp Fill.svg' 
        : 'Icons/Bookmark Sharp Regular.svg';
      
      button.src = iconSrc;
      console.log(`更新按鈕圖示: ${button.getAttribute('data-equipment')} -> ${isBookmarked ? '已收藏' : '未收藏'}`);
    }
  }

  // 設置事件監聽器
  setupEventListeners() {
    // 檢查document.body是否存在
    if (!document.body) {
      console.error('setupEventListeners: document.body 不存在');
      return;
    }

    try {
      // 使用事件委派處理收藏按鈕點擊
      document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('bookmark-btn') || e.target.classList.contains('js-bookmark-btn')) {
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

      console.log('事件監聽器設置完成');
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

    // 切換收藏狀態
    const isNowBookmarked = this.bookmarkManager.toggleBookmark(itemName);
    
    // 觸發通知
    const message = isNowBookmarked 
      ? `${itemName}已加入收藏夾！` 
      : `${itemName}已從收藏夾中移除！`;
    
    // 使用統一的通知系統
    this.showBookmarkNotification(message);
  }

  // 顯示收藏通知
  showBookmarkNotification(message) {
    // 使用統一的 showBookmarkToast
    if (window.showBookmarkToast) {
      window.showBookmarkToast(message);
    } else {
      // 降級到 alert
      alert(message);
    }
  }
}

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

// ===== 初始化和全域變數 =====

// 創建全域實例 - 先只創建數據管理器
const bookmarkManager = new BookmarkManager();
let bookmarkUIManager = null; // UI管理器延遲創建

// 設置全域變數
window.sccdBookmarkManager = bookmarkManager;
window.showBookmarkToast = showBookmarkToast;

// 向後兼容
window.bookmarkManager = bookmarkManager;
window.showToast = showBookmarkToast;

// 通用頁面初始化
function initCommonFeatures() {
  // 創建UI管理器（此時DOM應該已經準備好）
  if (!bookmarkUIManager) {
    bookmarkUIManager = new BookmarkUIManager(bookmarkManager);
    window.sccdBookmarkUIManager = bookmarkUIManager;
    window.bookmarkUIManager = bookmarkUIManager;
  }
}

// 向後兼容的API
window.refreshBookmarkStates = function() {
  if (window.sccdBookmarkUIManager) {
    window.sccdBookmarkUIManager.updateAllButtons();
  }
};

// 全域函數
window.initCommonFeatures = initCommonFeatures;

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

// 創建全域實例
const headerMenuScrollManager = new HeaderMenuScrollManager();
window.sccdHeaderMenuScrollManager = headerMenuScrollManager;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded 事件觸發');
  
  // 確保DOM完全載入後再初始化
  setTimeout(() => {
    initCommonFeatures();
  }, 100);
}); 