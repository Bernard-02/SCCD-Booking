/* ===== 統一購物車與設備管理器 ===== */

class CartManager {
  constructor() {
    this.cartStorageKey = 'sccd-rental-cart';
    this.equipmentData = {}; // 從JSON載入的設備資料
    this.isEquipmentLoaded = false;
    this.init();
  }
  
  // 初始化
  async init() {
    // 載入設備數據
    await this.loadEquipmentData();
    
    // 更新購物車顯示
    this.updateCartDisplay();
    
    // 監聽storage事件，用於跨頁面同步
    window.addEventListener('storage', (e) => {
      if (e.key === this.cartStorageKey) {
        this.updateCartDisplay();
      }
    });
  }
  
  // === 設備數據管理 ===
  
  // 載入設備數據
  async loadEquipmentData() {
    try {
      const response = await fetch('equipment-data.json');
      if (!response.ok) {
        throw new Error('無法載入設備數據');
      }
      this.equipmentData = await response.json();
      this.isEquipmentLoaded = true;
      console.log('設備數據載入成功');
    } catch (error) {
      console.error('載入設備數據時發生錯誤:', error);
      this.isEquipmentLoaded = false;
    }
  }
  
  // 獲取設備資料
  getEquipmentById(equipmentId) {
    return this.equipmentData[equipmentId] || null;
  }
  
  // 獲取原始數量
  getOriginalQuantity(equipmentId) {
    const equipment = this.getEquipmentById(equipmentId);
    return equipment ? equipment.originalQuantity : 0;
  }
  
  // 獲取購物車中該設備的數量
  getCartQuantity(equipmentId) {
    const cart = this.getCart();
    const item = cart.find(item => item.id === equipmentId && item.category !== 'area');
    return item ? item.quantity : 0;
  }
  
  // 動態計算可用數量
  getAvailableQuantity(equipmentId) {
    const originalQty = this.getOriginalQuantity(equipmentId);
    const cartQty = this.getCartQuantity(equipmentId);
    return Math.max(0, originalQty - cartQty);
  }
  
  // 檢查是否有庫存
  hasStock(equipmentId) {
    return this.getAvailableQuantity(equipmentId) > 0;
  }
  
  // === 購物車基本操作 ===
  
  // 獲取購物車數據
  getCart() {
    try {
      const cartData = localStorage.getItem(this.cartStorageKey);
      return cartData ? JSON.parse(cartData) : [];
    } catch (error) {
      console.error('讀取購物車數據錯誤:', error);
      return [];
    }
  }
  
  // 保存購物車數據
  saveCart(cartData) {
    try {
      localStorage.setItem(this.cartStorageKey, JSON.stringify(cartData));
      // 確保立即更新顯示
      setTimeout(() => {
        this.updateCartDisplay();
      }, 10);
      this.notifyChange();
    } catch (error) {
      console.error('保存購物車數據錯誤:', error);
    }
  }
  
  // === 設備購物車操作 ===
  
  // 添加設備到購物車
  addEquipmentToCart(equipment) {
    // 檢查是否有庫存
    if (!this.hasStock(equipment.id)) {
      console.warn('設備無庫存:', equipment.id);
      return false;
    }
    
    const cart = this.getCart();
    const existingItem = cart.find(item => item.id === equipment.id);
    
    if (existingItem) {
      // 檢查是否超過庫存限制
      if (existingItem.quantity >= this.getOriginalQuantity(equipment.id)) {
        console.warn('已達庫存上限:', equipment.id);
        return false;
      }
      existingItem.quantity += 1;
    } else {
      // 新增項目
      cart.push({
        id: equipment.id,
        name: equipment.name,
        category: equipment.category,
        deposit: equipment.deposit,
        image: equipment.mainImage || equipment.image,
        quantity: 1
      });
    }
    
    this.saveCart(cart);
    console.log(`${equipment.name} 已加入購物車`);
    return true;
  }
  
  // 更新設備數量
  updateEquipmentQuantity(equipmentId, newQuantity) {
    const cart = this.getCart();
    const item = cart.find(item => item.id === equipmentId);
    
    if (!item) {
      console.warn('購物車中找不到設備:', equipmentId);
      return false;
    }
    
    // 檢查數量限制
    const maxQuantity = this.getOriginalQuantity(equipmentId);
    if (newQuantity > maxQuantity) {
      console.warn('超過庫存限制:', equipmentId, '最大:', maxQuantity);
      return false;
    }
    
    if (newQuantity <= 0) {
      // 移除項目
      return this.removeFromCart(equipmentId);
    }
    
    item.quantity = newQuantity;
    this.saveCart(cart);
    console.log(`設備 ${equipmentId} 數量更新為 ${newQuantity}`);
    return true;
  }
  
  // === 通用購物車操作 ===
  
  // 通用添加到購物車方法（支援設備、area和教室）
  addToCart(item) {
    if (item.category === 'area') {
      // area邏輯保持不變
      return this.addAreaToCart(item);
    } else if (item.category === 'classroom') {
      // 教室邏輯
      return this.addClassroomToCart(item);
    } else {
      // 設備邏輯
      return this.addEquipmentToCart(item);
    }
  }
  
  // 從購物車移除項目
  removeFromCart(itemId) {
    const cart = this.getCart();
    const updatedCart = cart.filter(item => item.id !== itemId);
    
    if (updatedCart.length !== cart.length) {
      this.saveCart(updatedCart);
      console.log(`項目 ${itemId} 已從購物車移除`);
      return true;
    }
    
    console.warn('購物車中找不到項目:', itemId);
    return false;
  }
  
  // 更新項目數量（通用）
  updateQuantity(itemId, newQuantity) {
    const cart = this.getCart();
    const item = cart.find(item => item.id === itemId);
    
    if (!item) {
      return false;
    }
    
    // 如果是教室，不允許修改數量（只能刪除）
    if (item.category === 'classroom') {
      if (newQuantity <= 0) {
        return this.removeFromCart(itemId);
      } else {
        console.warn('教室不允許修改數量');
        return false;
      }
    }
    
    // 如果是設備，使用設備專用方法
    if (item.category !== 'area') {
      return this.updateEquipmentQuantity(itemId, newQuantity);
    }
    
    // area項目的邏輯（保持原有邏輯）
    if (newQuantity <= 0) {
      return this.removeFromCart(itemId);
    }
    
    item.quantity = newQuantity;
    this.saveCart(cart);
    return true;
  }
  
  // 清空購物車
  clearCart() {
    this.saveCart([]);
    console.log('購物車已清空');
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
  
  // 獲取購物車物品列表
  getCartItems() {
    return this.getCart();
  }
  
  // === 教室相關功能 ===
  
  // 添加教室到購物車
  addClassroomToCart(classroomItem) {
    const cart = this.getCart();
    const existingItem = cart.find(item => item.id === classroomItem.id);
    
    if (existingItem) {
      // 教室不能重複添加，返回 false
      console.warn('教室已存在於購物車中:', classroomItem.id);
      return false;
    } else {
      // 新增教室項目
      cart.push({
        id: classroomItem.id,
        name: classroomItem.name,
        category: 'classroom',
        deposit: classroomItem.deposit,
        image: classroomItem.mainImage || classroomItem.image,
        quantity: 1
      });
    }
    
    this.saveCart(cart);
    console.log(`${classroomItem.name} 已加入購物車`);
    return true;
  }
  
  // === Area相關功能（保留現有邏輯） ===
  
  // 添加area到購物車
  addAreaToCart(areaItem) {
    const cart = this.getCart();
    const existingItem = cart.find(item => item.id === areaItem.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        id: areaItem.id,
        name: areaItem.name,
        category: 'area',
        deposit: areaItem.deposit,
        image: areaItem.image,
        quantity: 1,
        areaKey: areaItem.areaKey,
        blocks: areaItem.blocks || []
      });
    }
    
    this.saveCart(cart);
    return true;
  }
  
  // 獲取指定區域已存在的格子
  getExistingBlocksForArea(areaKey) {
    const cart = this.getCart();
    const existingBlocks = [];
    
    cart.forEach(item => {
      if (item.category === 'area' && item.blocks) {
        let itemAreaKey = item.areaKey;
        
        if (!itemAreaKey) {
          itemAreaKey = this.getAreaKeyFromName(item.name);
        }
        
        if (itemAreaKey === areaKey) {
          existingBlocks.push(...item.blocks);
        }
      }
    });
    
    return existingBlocks;
  }
  
  // 從項目名稱推斷區域鍵值
  getAreaKeyFromName(name) {
    const areaName = name.split(' (')[0];
    switch(areaName) {
      case '中庭': return 'courtyard';
      case '走廊': return 'corridor';
      case '前陽台': return 'front-balcony';
      case '後陽台': return 'back-balcony';
      case '玻璃牆': return 'glass-wall';
      case '柱子': return 'pillar';
      default: return '';
    }
  }
  
  // 檢查特定格子是否已在購物車中
  isBlockInCart(areaKey, blockName) {
    const existingBlocks = this.getExistingBlocksForArea(areaKey);
    return existingBlocks.includes(blockName);
  }
  
  // 獲取所有區域的格子狀態
  getAllAreaBlocks() {
    const cart = this.getCart();
    const allBlocks = [];
    
    cart.forEach(item => {
      if (item.category === 'area' && item.blocks) {
        let itemAreaKey = item.areaKey;
        
        if (!itemAreaKey) {
          itemAreaKey = this.getAreaKeyFromName(item.name);
        }
        
        item.blocks.forEach(block => {
          allBlocks.push({
            areaKey: itemAreaKey,
            blockName: block,
            itemName: item.name
          });
        });
      }
    });
    
    return allBlocks;
  }
  
  // === 顯示更新 ===
  
  // 更新購物車顯示
  updateCartDisplay() {
    const totalQuantity = this.getTotalQuantity();
    
    // 更新桌面版購物車數量
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
      cartCount.textContent = totalQuantity;
    }
    
    // 更新手機版購物車數量
    const mobileCartCount = document.getElementById('mobile-cart-count');
    if (mobileCartCount) {
      mobileCartCount.textContent = totalQuantity;
    }
    
    // 更新 hover 時隱藏的數量（第二層）
    this.updateMirrorCounts(totalQuantity);
  }
  
  // 更新 hover 時隱藏的數量
  updateMirrorCounts(quantity) {
    // 重建桌面版 menu-text-hidden 的完整結構
    const desktopCartHidden = document.querySelector('a[href="rental-list.html"] .menu-text-hidden');
    if (desktopCartHidden) {
      desktopCartHidden.innerHTML = `((<span class="cart-count-mirror">${quantity}</span>) CART)`;
    }
    
    // 重建手機版 menu-text-hidden 的完整結構
    const mobileCartHidden = document.querySelector('.mobile-nav a[href="rental-list.html"] .menu-text-hidden');
    if (mobileCartHidden) {
      mobileCartHidden.innerHTML = `((<span class="mobile-cart-count-mirror">${quantity}</span>) CART)`;
    }
  }
  
  // 通知變更
  notifyChange() {
    const cart = this.getCart();
    const totalQuantity = this.getTotalQuantity();
    
    // 發送自定義事件
    window.dispatchEvent(new CustomEvent('cartUpdated', {
      detail: { 
        cart: cart,
        totalQuantity: totalQuantity
      }
    }));
  }
}

// 創建全局購物車管理器實例
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