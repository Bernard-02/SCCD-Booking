// 全域購物車管理器
class CartManager {
  constructor() {
    this.storageKey = 'sccd-rental-cart';
    this.init();
  }
  
  init() {
    // 頁面載入時更新購物車數量顯示
    this.updateCartDisplay();
    
    // 監聽 storage 事件，用於跨頁面同步
    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey) {
        this.updateCartDisplay();
      }
    });
  }
  
  // 獲取購物車數據
  getCart() {
    try {
      const cartData = localStorage.getItem(this.storageKey);
      return cartData ? JSON.parse(cartData) : [];
    } catch (error) {
      console.error('Error reading cart data:', error);
      return [];
    }
  }
  
  // 保存購物車數據
  saveCart(cartData) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(cartData));
      this.updateCartDisplay();
      this.notifyChange();
    } catch (error) {
      console.error('Error saving cart data:', error);
    }
  }
  
  // 添加設備到購物車
  addToCart(equipment) {
    const cart = this.getCart();
    const existingItem = cart.find(item => item.id === equipment.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        id: equipment.id,
        name: equipment.name,
        category: equipment.category,
        deposit: equipment.deposit,
        image: equipment.mainImage,
        quantity: 1
      });
    }
    
    this.saveCart(cart);
    return true;
  }
  
  // 從購物車移除設備
  removeFromCart(equipmentId) {
    const cart = this.getCart();
    const updatedCart = cart.filter(item => item.id !== equipmentId);
    this.saveCart(updatedCart);
  }
  
  // 更新設備數量
  updateQuantity(equipmentId, quantity) {
    const cart = this.getCart();
    const item = cart.find(item => item.id === equipmentId);
    
    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(equipmentId);
      } else {
        item.quantity = quantity;
        this.saveCart(cart);
      }
    }
  }
  
  // 獲取購物車總數量
  getTotalQuantity() {
    const cart = this.getCart();
    return cart.reduce((total, item) => total + item.quantity, 0);
  }
  
  // 獲取購物車總金額
  getTotalAmount() {
    const cart = this.getCart();
    return cart.reduce((total, item) => total + (item.deposit * item.quantity), 0);
  }
  
  // 清空購物車
  clearCart() {
    this.saveCart([]);
  }
  
  // 更新頁面上的購物車數量顯示
  updateCartDisplay() {
    const totalQuantity = this.getTotalQuantity();
    
    // 更新桌面版 CART 數量
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
      cartCountElement.textContent = totalQuantity;
    }
    
    // 更新手機版 CART 數量
    const mobileCartCountElement = document.getElementById('mobile-cart-count');
    if (mobileCartCountElement) {
      mobileCartCountElement.textContent = totalQuantity;
    }
  }
  
  // 通知其他頁面購物車已變更（用於同一頁面內的即時更新）
  notifyChange() {
    // 觸發自定義事件
    window.dispatchEvent(new CustomEvent('cartUpdated', {
      detail: {
        totalQuantity: this.getTotalQuantity(),
        totalAmount: this.getTotalAmount(),
        cart: this.getCart()
      }
    }));
  }
}

// 創建全域購物車管理實例
window.cartManager = new CartManager();

// 全域函數，供其他頁面調用
window.updateCartDisplay = function() {
  if (window.cartManager) {
    window.cartManager.updateCartDisplay();
  }
};

// 頁面載入完成後初始化購物車顯示
document.addEventListener('DOMContentLoaded', function() {
  window.cartManager.updateCartDisplay();
}); 