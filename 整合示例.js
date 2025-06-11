// 整合示例 - 展示如何在實際頁面中使用後台 API

// =================
// 1. 設備列表頁面整合示例
// =================

class EquipmentPageIntegration {
  async loadEquipmentData() {
    try {
      // 顯示載入指示器
      this.showLoading();
      
      // 從後台獲取設備數據
      const response = await window.apiManager.getEquipment();
      
      if (response.success) {
        // 渲染設備列表
        this.renderEquipmentList(response.data);
      } else {
        // 如果後台失敗，使用本地數據
        console.warn('後台數據載入失敗，使用本地數據');
        const localData = window.apiManager.getLocalEquipmentData();
        this.renderEquipmentList(localData);
      }
    } catch (error) {
      console.error('載入設備數據失敗:', error);
      // 降級到本地數據
      const localData = window.apiManager.getLocalEquipmentData();
      this.renderEquipmentList(localData);
    } finally {
      this.hideLoading();
    }
  }

  renderEquipmentList(equipmentData) {
    const container = document.getElementById('equipment-container');
    if (!container) return;

    container.innerHTML = '';

    equipmentData.forEach(equipment => {
      const equipmentCard = this.createEquipmentCard(equipment);
      container.appendChild(equipmentCard);
    });
  }

  createEquipmentCard(equipment) {
    const card = document.createElement('div');
    card.className = 'equipment-card';
    card.innerHTML = `
      <div class="equipment-image">
        <img src="${equipment['圖片URL'] || equipment.mainImage || 'Images/placeholder.jpg'}" 
             alt="${equipment['設備名稱'] || equipment.name}" 
             onerror="this.src='Images/placeholder.jpg'">
      </div>
      <div class="equipment-info">
        <h3>${equipment['設備名稱'] || equipment.name}</h3>
        <p class="category">${equipment['類別'] || equipment.category}</p>
        <p class="status" style="color: ${equipment.statusColor || '#00ff80'}">
          ${equipment['狀態'] || equipment.status}
        </p>
        <p class="quantity">可用數量: ${equipment['數量'] || equipment.quantity}</p>
        <p class="deposit">押金: NT$ ${equipment['押金'] || equipment.deposit}</p>
        <button onclick="addToCart('${equipment['設備ID'] || equipment.id}')" 
                class="add-to-cart-btn">
          加入租借清單
        </button>
      </div>
    `;
    return card;
  }

  showLoading() {
    const loading = document.createElement('div');
    loading.id = 'loading-indicator';
    loading.innerHTML = '<div class="spinner">載入中...</div>';
    document.body.appendChild(loading);
  }

  hideLoading() {
    const loading = document.getElementById('loading-indicator');
    if (loading) loading.remove();
  }
}

// =================
// 2. 購物車結帳整合示例
// =================

class CheckoutIntegration {
  async submitOrder() {
    try {
      // 獲取購物車數據
      const cart = window.cartManager.getCart();
      if (cart.length === 0) {
        alert('購物車是空的！');
        return;
      }

      // 獲取用戶輸入的資料
      const orderData = this.collectOrderData(cart);
      
      // 驗證數據
      if (!this.validateOrderData(orderData)) {
        return;
      }

      // 顯示提交中狀態
      this.setSubmitState(true);

      // 提交訂單到後台
      const response = await window.apiManager.createOrder(orderData);

      if (response.success) {
        // 訂單成功
        this.handleOrderSuccess(response.data);
        
        // 清空購物車
        window.cartManager.clearCart();
        
        // 跳轉到成功頁面
        window.location.href = `rental-receipt.html?orderId=${response.data.orderId}`;
      } else {
        throw new Error(response.message);
      }

    } catch (error) {
      console.error('提交訂單失敗:', error);
      this.handleOrderError(error.message);
    } finally {
      this.setSubmitState(false);
    }
  }

  collectOrderData(cart) {
    return {
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        deposit: item.deposit
      })),
      totalAmount: window.cartManager.getTotalAmount(),
      rentalDates: {
        start: document.getElementById('rental-start-date')?.value,
        end: document.getElementById('rental-end-date')?.value
      },
      purpose: document.getElementById('rental-purpose')?.value || '',
      location: document.getElementById('rental-location')?.value || '',
      // 用戶資料會由 API 管理器自動添加
    };
  }

  validateOrderData(orderData) {
    if (!orderData.rentalDates.start || !orderData.rentalDates.end) {
      alert('請選擇租借日期！');
      return false;
    }

    if (new Date(orderData.rentalDates.start) >= new Date(orderData.rentalDates.end)) {
      alert('結束日期必須晚於開始日期！');
      return false;
    }

    if (!orderData.purpose.trim()) {
      alert('請填寫使用目的！');
      return false;
    }

    return true;
  }

  handleOrderSuccess(orderData) {
    // 顯示成功訊息
    showNotification('訂單提交成功！訂單編號：' + orderData.orderId, 'success');
    
    // 可選：發送確認郵件
    this.sendConfirmationEmail(orderData);
  }

  handleOrderError(errorMessage) {
    alert('訂單提交失敗：' + errorMessage);
  }

  setSubmitState(isSubmitting) {
    const submitBtn = document.getElementById('submit-order-btn');
    if (submitBtn) {
      submitBtn.disabled = isSubmitting;
      submitBtn.textContent = isSubmitting ? '提交中...' : '確認租借';
    }
  }

  async sendConfirmationEmail(orderData) {
    // 這裡可以調用後台 API 發送確認郵件
    try {
      // 如果您的 GAS 中有郵件功能，可以這樣調用
      // await window.apiManager.post('sendConfirmationEmail', {
      //   orderId: orderData.orderId,
      //   userEmail: orderData.userEmail
      // });
    } catch (error) {
      console.error('發送確認郵件失敗:', error);
    }
  }
}

// =================
// 3. 用戶資料管理整合示例
// =================

class UserProfileIntegration {
  async saveUserProfile() {
    try {
      const userData = this.collectUserData();
      
      if (!this.validateUserData(userData)) {
        return;
      }

      // 保存到本地存儲
      window.apiManager.setCurrentUser(userData);

      // 如果有網路連接，也保存到後台
      if (window.apiManager.isOnline()) {
        const response = await window.apiManager.createUser(userData);
        
        if (response.success) {
          showNotification('用戶資料保存成功！', 'success');
        } else {
          console.warn('後台保存失敗，僅保存到本地:', response.message);
        }
      }

    } catch (error) {
      console.error('保存用戶資料失敗:', error);
      showNotification('保存失敗：' + error.message, 'error');
    }
  }

  collectUserData() {
    return {
      userId: document.getElementById('student-id')?.value || '',
      name: document.getElementById('user-name')?.value || '',
      email: document.getElementById('user-email')?.value || '',
      phone: document.getElementById('user-phone')?.value || '',
      studentId: document.getElementById('student-id')?.value || '',
      grade: document.getElementById('user-grade')?.value || '',
      department: '媒體傳達設計學系',
      emergencyContact: document.getElementById('emergency-contact')?.value || '',
      lineId: document.getElementById('line-id')?.value || ''
    };
  }

  validateUserData(userData) {
    if (!userData.name.trim()) {
      alert('請填寫姓名！');
      return false;
    }

    if (!userData.email.trim() || !validateEmail(userData.email)) {
      alert('請填寫有效的電子郵件！');
      return false;
    }

    if (!userData.phone.trim() || !validatePhone(userData.phone)) {
      alert('請填寫有效的電話號碼！');
      return false;
    }

    if (!userData.studentId.trim()) {
      alert('請填寫學號！');
      return false;
    }

    return true;
  }

  async loadUserProfile() {
    const userData = window.apiManager.getCurrentUser();
    
    if (userData && Object.keys(userData).length > 0) {
      this.fillUserForm(userData);
    }
  }

  fillUserForm(userData) {
    if (document.getElementById('user-name')) 
      document.getElementById('user-name').value = userData.name || '';
    if (document.getElementById('user-email')) 
      document.getElementById('user-email').value = userData.email || '';
    if (document.getElementById('user-phone')) 
      document.getElementById('user-phone').value = userData.phone || '';
    if (document.getElementById('student-id')) 
      document.getElementById('student-id').value = userData.studentId || '';
    if (document.getElementById('user-grade')) 
      document.getElementById('user-grade').value = userData.grade || '';
    if (document.getElementById('emergency-contact')) 
      document.getElementById('emergency-contact').value = userData.emergencyContact || '';
    if (document.getElementById('line-id')) 
      document.getElementById('line-id').value = userData.lineId || '';
  }
}

// =================
// 4. 訂單歷史整合示例
// =================

class OrderHistoryIntegration {
  async loadOrderHistory() {
    try {
      const currentUser = window.apiManager.getCurrentUser();
      if (!currentUser.userId) {
        this.showNoUserMessage();
        return;
      }

      const response = await window.apiManager.getOrders(currentUser.userId);
      
      if (response.success) {
        this.renderOrderHistory(response.data);
      } else {
        throw new Error(response.message);
      }

    } catch (error) {
      console.error('載入訂單歷史失敗:', error);
      this.showErrorMessage(error.message);
    }
  }

  renderOrderHistory(orders) {
    const container = document.getElementById('order-history-container');
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = '<p class="no-orders">暫無訂單記錄</p>';
      return;
    }

    container.innerHTML = '';

    orders.forEach(order => {
      const orderCard = this.createOrderCard(order);
      container.appendChild(orderCard);
    });
  }

  createOrderCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card';
    
    const statusClass = this.getStatusClass(order['狀態'] || order.status);
    const items = typeof order['商品清單'] === 'string' ? 
      JSON.parse(order['商品清單']) : order['商品清單'] || order.items;

    card.innerHTML = `
      <div class="order-header">
        <span class="order-id">訂單編號: ${order['訂單ID'] || order.orderId}</span>
        <span class="order-status ${statusClass}">${order['狀態'] || order.status}</span>
      </div>
      <div class="order-content">
        <p class="order-date">建立時間: ${formatDateTime(order['建立時間'] || order.createTime)}</p>
        <p class="rental-period">
          租借期間: ${order['租借開始日期'] || order.startDate} ~ ${order['租借結束日期'] || order.endDate}
        </p>
        <div class="order-items">
          <h4>租借項目:</h4>
          <ul>
            ${items.map(item => `<li>${item.name} x ${item.quantity}</li>`).join('')}
          </ul>
        </div>
        <p class="order-total">總押金: NT$ ${order['總金額'] || order.totalAmount}</p>
        ${order['使用目的'] ? `<p class="order-purpose">使用目的: ${order['使用目的']}</p>` : ''}
      </div>
    `;

    return card;
  }

  getStatusClass(status) {
    switch (status) {
      case '待審核': return 'status-pending';
      case '已確認': return 'status-confirmed';
      case '已完成': return 'status-completed';
      case '已取消': return 'status-cancelled';
      default: return 'status-unknown';
    }
  }

  showNoUserMessage() {
    const container = document.getElementById('order-history-container');
    if (container) {
      container.innerHTML = '<p class="no-user">請先登錄查看訂單歷史</p>';
    }
  }

  showErrorMessage(message) {
    const container = document.getElementById('order-history-container');
    if (container) {
      container.innerHTML = `<p class="error-message">載入失敗: ${message}</p>`;
    }
  }
}

// =================
// 5. 全域初始化和事件綁定
// =================

// 創建全域實例
window.equipmentPage = new EquipmentPageIntegration();
window.checkout = new CheckoutIntegration();
window.userProfile = new UserProfileIntegration();
window.orderHistory = new OrderHistoryIntegration();

// 頁面載入完成後的初始化
document.addEventListener('DOMContentLoaded', function() {
  // 根據頁面類型進行相應的初始化
  const currentPage = window.location.pathname.split('/').pop();

  switch (currentPage) {
    case 'booking.html':
    case 'equipment.html':
      // 設備頁面初始化
      window.equipmentPage.loadEquipmentData();
      break;

    case 'rental-list.html':
      // 購物車頁面初始化
      bindCheckoutEvents();
      break;

    case 'login.html':
      // 登錄頁面初始化
      window.userProfile.loadUserProfile();
      bindUserProfileEvents();
      break;

    case 'order-history.html':
      // 訂單歷史頁面初始化
      window.orderHistory.loadOrderHistory();
      break;
  }
});

// 綁定結帳相關事件
function bindCheckoutEvents() {
  const submitBtn = document.getElementById('submit-order-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      window.checkout.submitOrder();
    });
  }
}

// 綁定用戶資料相關事件
function bindUserProfileEvents() {
  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      window.userProfile.saveUserProfile();
    });
  }
}

// =================
// 6. 輔助函數
// =================

// 添加到購物車的全域函數
function addToCart(equipmentId) {
  // 首先從本地設備數據中找到設備信息
  const equipment = getEquipmentById(equipmentId);
  
  if (!equipment) {
    alert('設備信息未找到！');
    return;
  }

  // 檢查庫存
  if (equipment.quantity <= 0) {
    alert('此設備暫無庫存！');
    return;
  }

  // 添加到購物車
  const success = window.cartManager.addToCart(equipment);
  
  if (success) {
    showNotification('已添加到租借清單！', 'success');
    
    // 可選：同步更新後台庫存（預留庫存）
    // window.apiManager.updateInventory(equipmentId, 1, 'reserve');
  } else {
    alert('添加失敗，請稍後重試！');
  }
}

// 從 ID 獲取設備信息（結合本地和遠程數據）
function getEquipmentById(equipmentId) {
  // 首先嘗試從本地數據獲取
  const localEquipment = window.EQUIPMENT_DATA && window.EQUIPMENT_DATA[equipmentId];
  if (localEquipment) {
    return localEquipment;
  }

  // 如果本地沒有，嘗試從緩存的遠程數據獲取
  const remoteData = window.apiManager.getLocalEquipmentData();
  return remoteData.find(item => 
    (item['設備ID'] || item.id) === equipmentId
  );
}

// 格式化貨幣
function formatCurrency(amount) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0
  }).format(amount);
}

// 檢查用戶登錄狀態
function checkUserLogin() {
  const userData = window.apiManager.getCurrentUser();
  return userData && userData.userId;
}

// 要求用戶登錄
function requireLogin() {
  if (!checkUserLogin()) {
    const shouldLogin = confirm('此功能需要登錄，是否前往登錄頁面？');
    if (shouldLogin) {
      window.location.href = 'login.html';
    }
    return false;
  }
  return true;
} 