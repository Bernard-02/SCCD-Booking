// API 管理器 - 與 Google Apps Script 後台通信
// 請將 GAS_WEB_APP_URL 替換為您的 Google Apps Script Web App URL

class APIManager {
  constructor() {
    // 替換為您的 Google Apps Script Web App URL
    this.GAS_WEB_APP_URL = 'YOUR_GAS_WEB_APP_URL_HERE';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分鐘緩存
  }

  // =================
  // 基本 HTTP 方法
  // =================

  async get(action, params = {}) {
    try {
      const url = new URL(this.GAS_WEB_APP_URL);
      url.searchParams.append('action', action);
      
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, params[key]);
        }
      });

      const cacheKey = url.toString();
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (data.success) {
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      } else {
        throw new Error(data.message || '請求失敗');
      }
    } catch (error) {
      console.error('GET 請求錯誤:', error);
      throw error;
    }
  }

  async post(action, data = {}) {
    try {
      const url = new URL(this.GAS_WEB_APP_URL);
      url.searchParams.append('action', action);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      if (result.success) {
        // 清除相關緩存
        this.clearCache();
        return result;
      } else {
        throw new Error(result.message || '請求失敗');
      }
    } catch (error) {
      console.error('POST 請求錯誤:', error);
      throw error;
    }
  }

  // =================
  // 設備相關 API
  // =================

  async getEquipment() {
    return this.get('getEquipment');
  }

  async getEquipmentById(equipmentId) {
    return this.get('getEquipmentById', { id: equipmentId });
  }

  async updateInventory(equipmentId, quantityChange, operation) {
    return this.post('updateInventory', {
      equipmentId,
      quantityChange,
      operation
    });
  }

  // =================
  // 訂單相關 API
  // =================

  async createOrder(orderData) {
    // 添加必要的用戶信息
    const userData = this.getCurrentUser();
    const completeOrderData = {
      ...orderData,
      userId: userData.userId || 'GUEST_' + Date.now(),
      userName: userData.name || '訪客用戶',
      userEmail: userData.email || '',
      userPhone: userData.phone || ''
    };

    return this.post('createOrder', completeOrderData);
  }

  async getOrders(userId = null) {
    return this.get('getOrders', userId ? { userId } : {});
  }

  async updateOrderStatus(orderId, status, reviewer = '') {
    return this.post('updateOrderStatus', {
      orderId,
      status,
      reviewer
    });
  }

  // =================
  // 用戶相關 API
  // =================

  async createUser(userData) {
    return this.post('createUser', userData);
  }

  async getUserProfile(userId) {
    return this.get('getUserProfile', { userId });
  }

  // =================
  // 預約相關 API
  // =================

  async createBooking(bookingData) {
    const userData = this.getCurrentUser();
    const completeBookingData = {
      ...bookingData,
      userId: userData.userId || 'GUEST_' + Date.now(),
      userName: userData.name || '訪客用戶'
    };

    return this.post('createBooking', completeBookingData);
  }

  // =================
  // 本地用戶管理
  // =================

  getCurrentUser() {
    try {
      const userData = localStorage.getItem('sccd-user-data');
      return userData ? JSON.parse(userData) : {};
    } catch (error) {
      console.error('獲取用戶數據錯誤:', error);
      return {};
    }
  }

  setCurrentUser(userData) {
    try {
      localStorage.setItem('sccd-user-data', JSON.stringify(userData));
    } catch (error) {
      console.error('保存用戶數據錯誤:', error);
    }
  }

  logout() {
    localStorage.removeItem('sccd-user-data');
    this.clearCache();
  }

  // =================
  // 緩存管理
  // =================

  clearCache() {
    this.cache.clear();
  }

  // =================
  // 錯誤處理和重試
  // =================

  async retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  // =================
  // 數據同步
  // =================

  async syncEquipmentData() {
    try {
      const response = await this.getEquipment();
      if (response.success) {
        // 更新本地設備數據
        this.updateLocalEquipmentData(response.data);
        return response.data;
      }
    } catch (error) {
      console.error('同步設備數據失敗:', error);
      // 返回本地緩存數據
      return this.getLocalEquipmentData();
    }
  }

  updateLocalEquipmentData(equipmentData) {
    try {
      localStorage.setItem('sccd-equipment-data', JSON.stringify({
        data: equipmentData,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('保存設備數據錯誤:', error);
    }
  }

  getLocalEquipmentData() {
    try {
      const cached = localStorage.getItem('sccd-equipment-data');
      if (cached) {
        const parsed = JSON.parse(cached);
        // 檢查數據是否過期（1小時）
        if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
          return parsed.data;
        }
      }
    } catch (error) {
      console.error('讀取本地設備數據錯誤:', error);
    }
    return [];
  }

  // =================
  // 離線支持
  // =================

  isOnline() {
    return navigator.onLine;
  }

  async handleOfflineData(action, data) {
    if (!this.isOnline()) {
      // 保存離線數據，待上線後同步
      const offlineData = JSON.parse(localStorage.getItem('sccd-offline-data') || '[]');
      offlineData.push({
        action,
        data,
        timestamp: Date.now()
      });
      localStorage.setItem('sccd-offline-data', JSON.stringify(offlineData));
      return { success: false, message: '目前離線，數據已保存待同步' };
    }
    return null;
  }

  async syncOfflineData() {
    if (!this.isOnline()) return;

    const offlineData = JSON.parse(localStorage.getItem('sccd-offline-data') || '[]');
    if (offlineData.length === 0) return;

    console.log('開始同步離線數據...');
    
    for (const item of offlineData) {
      try {
        switch (item.action) {
          case 'createOrder':
            await this.createOrder(item.data);
            break;
          case 'createBooking':
            await this.createBooking(item.data);
            break;
          // 添加其他需要同步的操作
        }
      } catch (error) {
        console.error('同步離線數據失敗:', item, error);
      }
    }

    // 清除已同步的離線數據
    localStorage.removeItem('sccd-offline-data');
    console.log('離線數據同步完成');
  }
}

// =================
// 全域實例和初始化
// =================

// 創建全域 API 管理器實例
window.apiManager = new APIManager();

// 監聽網路狀態變化
window.addEventListener('online', () => {
  console.log('網路已連接，開始同步離線數據...');
  window.apiManager.syncOfflineData();
});

window.addEventListener('offline', () => {
  console.log('網路已斷開，將使用離線模式');
});

// 頁面載入時同步設備數據
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.apiManager.syncEquipmentData();
  } catch (error) {
    console.error('初始化數據同步失敗:', error);
  }
});

// =================
// 輔助函數
// =================

// 格式化日期
function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return date.toISOString().split('T')[0];
}

// 格式化時間
function formatDateTime(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return date.toLocaleString('zh-TW');
}

// 驗證電子郵件
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// 驗證電話號碼
function validatePhone(phone) {
  const regex = /^[0-9\-\+\(\)\s]+$/;
  return regex.test(phone) && phone.replace(/[^0-9]/g, '').length >= 8;
}

// 顯示通知
function showNotification(message, type = 'info') {
  // 這裡可以集成您喜歡的通知庫
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // 簡單的瀏覽器通知
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(message);
  } else if ('Notification' in window && Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(message);
      }
    });
  }
} 