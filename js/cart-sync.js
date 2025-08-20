/* ===== 購物車同步功能 ===== */

// 這個文件現在主要用於向後兼容，實際的購物車同步邏輯已移到 cart-manager.js
// cart-manager.js 的 updateCartDisplay 方法現在會同時更新第一層和第二層的購物車數量

class CartSync {
  constructor() {
    console.log('CartSync 已載入，實際同步邏輯由 cart-manager.js 處理');
  }
}

// 全域初始化函數（向後兼容）
function initCartSync() {
  return new CartSync();
}

// 全域變數
window.CartSync = CartSync;
window.initCartSync = initCartSync;

// 自動初始化（向後兼容）
document.addEventListener('DOMContentLoaded', function() {
  initCartSync();
}); 