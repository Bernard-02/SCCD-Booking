/* ===== 購物車同步功能 ===== */

class CartSync {
  constructor() {
    this.cartCountElement = document.getElementById('cart-count');
    this.mobileCartCountElement = document.getElementById('mobile-cart-count');
    this.observer = null;
    this.syncInterval = null;
    this.init();
  }
  
  init() {
    // 初始化購物車顯示
    this.updateDisplay();
    
    // 設置同步機制
    this.setupSync();
    
    // 監聽cartManager事件
    this.setupEventListeners();
  }
  
  // 更新購物車數量顯示
  updateDisplay() {
    if (window.cartManager) {
      const totalQuantity = window.cartManager.getTotalQuantity();
      this.updateCartElements(totalQuantity);
    }
  }
  
  // 更新所有購物車元素
  updateCartElements(quantity) {
    // 更新桌面版 CART 數量
    if (this.cartCountElement) {
      this.cartCountElement.textContent = quantity;
    }
    
    // 更新手機版 CART 數量
    if (this.mobileCartCountElement) {
      this.mobileCartCountElement.textContent = quantity;
    }
  }
  
  // 手機版購物車數量同步（從桌面版同步到手機版）
  updateMobileCartCount() {
    if (this.mobileCartCountElement && this.cartCountElement) {
      this.mobileCartCountElement.textContent = this.cartCountElement.textContent;
    }
  }
  
  // 設置同步機制
  setupSync() {
    // 使用 MutationObserver 監聽桌面版購物車數量變化
    if (this.cartCountElement && this.mobileCartCountElement) {
      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            this.updateMobileCartCount();
          }
        });
      });
      
      this.observer.observe(this.cartCountElement, {
        childList: true,
        characterData: true,
        subtree: true
      });
      
      // 定期檢查同步（備用機制）
      this.syncInterval = setInterval(() => {
        this.updateMobileCartCount();
      }, 500);
      
      // 頁面載入時立即同步
      this.updateMobileCartCount();
    }
  }
  
  // 設置事件監聽器
  setupEventListeners() {
    // 監聽cartManager的更新事件
    window.addEventListener('cartUpdated', (event) => {
      const { totalQuantity } = event.detail;
      this.updateCartElements(totalQuantity);
    });
    
    // 監聽storage事件（跨頁面同步）
    window.addEventListener('storage', (event) => {
      if (event.key === 'sccd-rental-cart') {
        this.updateDisplay();
      }
    });
  }
  
  // 強制同步（供外部調用）
  forceSync() {
    this.updateDisplay();
    this.updateMobileCartCount();
  }
  
  // 清理資源
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

// 全域初始化函數
function initCartSync() {
  // 等待cartManager準備好
  if (window.cartManager) {
    return new CartSync();
  } else {
    // 如果cartManager還沒準備好，延遲初始化
    setTimeout(() => {
      if (window.cartManager) {
        new CartSync();
      }
    }, 100);
  }
}

// 兼容性函數（供其他頁面調用）
function updateCartDisplay() {
  if (window.cartManager) {
    window.cartManager.updateCartDisplay();
  }
}

// 全域變數
window.CartSync = CartSync;
window.initCartSync = initCartSync;
window.updateCartDisplay = updateCartDisplay;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  // 延遲一下確保cartManager已載入
  setTimeout(() => {
    initCartSync();
  }, 50);
}); 