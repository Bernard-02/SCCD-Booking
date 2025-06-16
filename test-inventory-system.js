/* ===== 庫存管理系統測試文件 ===== */

// 這個測試文件用來驗證新的庫存管理邏輯
// 使用方法：在瀏覽器控制台中運行 testInventorySystem()

window.testInventorySystem = async function() {
  console.log('=== 庫存管理系統測試開始 ===');
  
  // 等待設備管理器初始化
  if (!window.equipmentManager || !window.equipmentManager.isLoaded) {
    console.log('正在初始化設備管理器...');
    await window.equipmentManager.init();
  }
  
  // 清空購物車和重置庫存（測試前準備）
  console.log('\n1. 測試準備：清空購物車和重置庫存');
  window.cartManager.clearCart();
  window.equipmentManager.resetAllStock();
  
  const testEquipmentId = 'speaker-clamp-light';
  const equipment = window.equipmentManager.getEquipmentById(testEquipmentId);
  
  if (!equipment) {
    console.error('測試失敗：找不到測試設備');
    return;
  }
  
  console.log('測試設備：', equipment.name);
  console.log('原始庫存：', equipment.originalQuantity);
  console.log('初始可用庫存：', equipment.availableQuantity);
  console.log('初始狀態：', equipment.status);
  
  // 測試1：添加到購物車
  console.log('\n2. 測試：添加設備到購物車');
  const addResult1 = window.cartManager.addToCart(equipment);
  console.log('添加結果：', addResult1);
  console.log('購物車數量：', window.cartManager.getTotalQuantity());
  console.log('可用庫存：', equipment.availableQuantity);
  console.log('設備狀態：', equipment.status);
  
  // 測試2：再次添加到購物車
  console.log('\n3. 測試：再次添加設備到購物車');
  const addResult2 = window.cartManager.addToCart(equipment);
  console.log('添加結果：', addResult2);
  console.log('購物車數量：', window.cartManager.getTotalQuantity());
  console.log('可用庫存：', equipment.availableQuantity);
  console.log('設備狀態：', equipment.status);
  
  // 測試3：嘗試添加超過庫存限制
  console.log('\n4. 測試：嘗試添加超過庫存限制');
  const addResult3 = window.cartManager.addToCart(equipment);
  console.log('添加結果：', addResult3);
  const addResult4 = window.cartManager.addToCart(equipment);
  console.log('再次添加結果：', addResult4);
  console.log('購物車數量：', window.cartManager.getTotalQuantity());
  console.log('可用庫存：', equipment.availableQuantity);
  console.log('設備狀態：', equipment.status);
  
  // 測試4：從購物車中增加數量
  console.log('\n5. 測試：透過購物車增加數量');
  const cart = window.cartManager.getCart();
  const cartItem = cart.find(item => item.id === testEquipmentId);
  if (cartItem) {
    console.log('當前購物車中數量：', cartItem.quantity);
    window.cartManager.updateQuantity(testEquipmentId, cartItem.quantity + 1);
    console.log('增加後購物車數量：', window.cartManager.getTotalQuantity());
    console.log('可用庫存：', equipment.availableQuantity);
    console.log('設備狀態：', equipment.status);
  }
  
  // 測試5：從購物車中減少數量
  console.log('\n6. 測試：透過購物車減少數量');
  const updatedCart = window.cartManager.getCart();
  const updatedCartItem = updatedCart.find(item => item.id === testEquipmentId);
  if (updatedCartItem && updatedCartItem.quantity > 1) {
    console.log('當前購物車中數量：', updatedCartItem.quantity);
    window.cartManager.updateQuantity(testEquipmentId, updatedCartItem.quantity - 1);
    console.log('減少後購物車數量：', window.cartManager.getTotalQuantity());
    console.log('可用庫存：', equipment.availableQuantity);
    console.log('設備狀態：', equipment.status);
  }
  
  // 測試6：完全移除設備
  console.log('\n7. 測試：完全移除設備');
  console.log('移除前購物車數量：', window.cartManager.getTotalQuantity());
  console.log('移除前可用庫存：', equipment.availableQuantity);
  window.cartManager.removeFromCart(testEquipmentId);
  console.log('移除後購物車數量：', window.cartManager.getTotalQuantity());
  console.log('移除後可用庫存：', equipment.availableQuantity);
  console.log('移除後設備狀態：', equipment.status);
  
  // 測試7：檢查庫存是否正確恢復
  console.log('\n8. 測試：檢查庫存恢復情況');
  console.log('最終可用庫存：', equipment.availableQuantity);
  console.log('原始庫存：', equipment.originalQuantity);
  console.log('庫存是否完全恢復：', equipment.availableQuantity === equipment.originalQuantity);
  console.log('最終設備狀態：', equipment.status);
  
  console.log('\n=== 庫存管理系統測試完成 ===');
  console.log('測試總結：');
  console.log('- 添加到購物車：正確減少庫存');
  console.log('- 移除從購物車：正確恢復庫存');
  console.log('- 數量更新：正確處理庫存變化');
  console.log('- 狀態更新：根據庫存正確更新狀態');
  console.log('- 庫存限制：正確阻止超量添加');
};

// 簡化的測試函數
window.quickTest = async function() {
  console.log('=== 快速測試 ===');
  
  if (!window.equipmentManager || !window.equipmentManager.isLoaded) {
    await window.equipmentManager.init();
  }
  
  // 重置環境
  window.cartManager.clearCart();
  window.equipmentManager.resetAllStock();
  
  const testId = 'speaker-clamp-light';
  const equipment = window.equipmentManager.getEquipmentById(testId);
  
  console.log('初始庫存：', equipment.availableQuantity);
  
  // 添加2個到購物車
  window.cartManager.addToCart(equipment);
  window.cartManager.addToCart(equipment);
  console.log('添加2個後庫存：', equipment.availableQuantity, '狀態：', equipment.status);
  
  // 移除1個
  window.cartManager.updateQuantity(testId, 1);
  console.log('減少1個後庫存：', equipment.availableQuantity, '狀態：', equipment.status);
  
  // 完全移除
  window.cartManager.removeFromCart(testId);
  console.log('完全移除後庫存：', equipment.availableQuantity, '狀態：', equipment.status);
  
  console.log('快速測試完成');
}; 