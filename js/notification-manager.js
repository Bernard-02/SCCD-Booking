// 通知管理器 - 負責處理通知系統的所有邏輯

class NotificationManager {
  constructor() {
    this.storageKey = null;
    this.currentUser = null;
  }

  // 初始化通知管理器
  init(userData) {
    this.currentUser = userData;
    this.storageKey = `sccd_notifications_${userData.studentId}`;
  }

  // 生成通知頁面HTML內容
  getNotificationsContent() {
    const notifications = this.getNotificationsData();

    return `
      <div class="space-y-8">
        <div>
          <h2 class="font-chinese text-white text-medium-title">通知</h2>
        </div>
        <div class="space-y-0">
          ${notifications.map((notification, index) => this.generateNotificationItem(notification, index, notifications.length)).join('')}
        </div>
      </div>
    `;
  }

  // 生成單個通知項目HTML
  generateNotificationItem(notification, index, totalCount) {
    const isRead = notification.isRead;
    const hasTopPadding = index > 0;
    const hasBorder = index < totalCount - 1;

    return `
      <div class="notification-item ${hasTopPadding ? 'pt-4' : ''} pb-4 ${hasBorder ? 'border-b border-gray-scale5' : ''}"
           data-notification-id="${notification.id}">
        <!-- 上半部：訊息和圓點 -->
        <div class="flex justify-between items-start mb-2">
          <p class="font-chinese ${isRead ? 'text-gray-scale3' : 'text-white'} text-small-title flex-1 pr-4">
            ${notification.message}
          </p>
          ${!isRead ? `
            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: var(--color-error);"></div>
          ` : ''}
        </div>

        <!-- 下半部：日期和時間 -->
        <div class="flex justify-between items-end">
          <span class="font-english ${isRead ? 'text-gray-scale3' : 'text-gray-scale2'} text-tiny">
            ${this.formatNotificationDate(notification.timestamp)}
          </span>
          <span class="font-chinese ${isRead ? 'text-gray-scale3' : 'text-gray-scale2'} text-tiny">
            ${this.getTimeAgo(notification.timestamp)}
          </span>
        </div>
      </div>
    `;
  }

  // 設置通知頁面事件監聽器
  setupEventListeners() {
    // 不需要設置任何事件監聽器
    // 通知頁面的已讀功能由 profile.js 的切換頁面邏輯處理
  }

  // 獲取通知數據
  getNotificationsData() {
    if (!this.storageKey) {
      console.warn('通知管理器未初始化');
      return [];
    }

    let notifications = this.loadNotificationsFromStorage();

    // 不再自動創建測試數據，保留用戶真實的通知記錄
    // 如果沒有數據，返回空陣列
    if (notifications.length === 0) {
      return [];
    }

    // 自動刪除超過7天的通知
    notifications = this.removeOldNotifications(notifications);

    return notifications.sort((a, b) => b.timestamp - a.timestamp);
  }

  // 移除超過7天的通知
  removeOldNotifications(notifications) {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const filteredNotifications = notifications.filter(notification => {
      return (now - notification.timestamp) < sevenDays;
    });

    // 如果有通知被刪除，更新存儲
    if (filteredNotifications.length !== notifications.length) {
      this.saveNotificationsData(filteredNotifications);
    }

    return filteredNotifications;
  }

  // 從存儲加載通知數據
  loadNotificationsFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('獲取通知數據錯誤:', error);
      return [];
    }
  }

  // 創建測試通知數據
  createTestNotifications() {
    const now = Date.now();

    return [
      {
        id: '1',
        type: 'overdue',
        message: '您的租借 #2025001 即將逾期 1小時，請注意歸還設備或空間！',
        timestamp: now - (30 * 60 * 1000), // 30分鐘前
        isRead: false
      },
      {
        id: '2',
        type: 'approved',
        message: '您的租借申請 #2025002 已通過審核。',
        timestamp: now - (2 * 60 * 60 * 1000), // 2小時前
        isRead: false
      },
      {
        id: '3',
        type: 'extended',
        message: '您的租借單 #2025003 已延期，請以新的歸還日為主。',
        timestamp: now - (6 * 60 * 60 * 1000), // 6小時前
        isRead: false
      },
      {
        id: '4',
        type: 'overdue',
        message: '您的租借 #2025004 即將逾期 12小時，請注意歸還設備或空間！',
        timestamp: now - (12 * 60 * 60 * 1000), // 12小時前
        isRead: false
      },
      {
        id: '5',
        type: 'overdue',
        message: '您的租借 #2025005 即將逾期 1天，請注意歸還設備或空間！',
        timestamp: now - (24 * 60 * 60 * 1000), // 1天前
        isRead: false
      },
      {
        id: '6',
        type: 'approved',
        message: '您的租借申請 #2025006 已通過審核。',
        timestamp: now - (2 * 24 * 60 * 60 * 1000), // 2天前
        isRead: true
      },
      {
        id: '7',
        type: 'overdue',
        message: '您的租借 #2025007 即將逾期 3天，請注意歸還設備或空間！',
        timestamp: now - (3 * 24 * 60 * 60 * 1000), // 3天前
        isRead: true
      },
      {
        id: '8',
        type: 'extended',
        message: '您的租借單 #2025008 已延期，請以新的歸還日為主。',
        timestamp: now - (5 * 24 * 60 * 60 * 1000), // 5天前
        isRead: true
      }
    ];
  }

  // 保存通知數據
  saveNotificationsData(notifications) {
    if (!this.storageKey) {
      console.warn('通知管理器未初始化');
      return;
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(notifications));
    } catch (error) {
      console.error('保存通知數據錯誤:', error);
    }
  }

  // 標記所有通知為已讀
  markAllNotificationsAsRead() {
    const notifications = this.getNotificationsData();
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      isRead: true
    }));

    this.saveNotificationsData(updatedNotifications);
    return updatedNotifications;
  }

  // 標記單個通知為已讀
  markNotificationAsRead(notificationId) {
    const notifications = this.getNotificationsData();
    const updatedNotifications = notifications.map(notification =>
      notification.id === notificationId
        ? { ...notification, isRead: true }
        : notification
    );

    this.saveNotificationsData(updatedNotifications);
    return updatedNotifications;
  }

  // 更新左側菜單的通知指示器
  updateNotificationIndicator() {
    const notifications = this.getNotificationsData();
    const hasUnread = notifications.some(notification => !notification.isRead);

    const notificationMenuItem = document.querySelector('.sccd-filter-item[data-section="notifications"]');
    if (!notificationMenuItem) return;

    this.removeExistingIndicator(notificationMenuItem);

    if (hasUnread) {
      this.addNotificationIndicator(notificationMenuItem);
    }
  }

  // 移除現有的通知指示器
  removeExistingIndicator(menuItem) {
    const existingIndicator = menuItem.querySelector('.notification-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
      menuItem.style.position = '';
    }
  }

  // 添加通知指示器
  addNotificationIndicator(menuItem) {
    menuItem.style.position = 'relative';

    const indicator = document.createElement('div');
    indicator.className = 'notification-indicator w-2 h-2 rounded-full';
    indicator.style.backgroundColor = 'var(--color-error)';
    indicator.style.position = 'absolute';
    indicator.style.top = '0px';
    indicator.style.right = '-8px';

    menuItem.appendChild(indicator);
  }

  // 格式化通知日期
  formatNotificationDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();

    const notificationYear = date.getFullYear();
    const currentYear = now.getFullYear();

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const { hours, minutes, ampm } = this.formatTime(date);

    // 跨年判斷：如果通知的年份小於當前年份，顯示年份
    let yearPrefix = '';
    if (notificationYear < currentYear) {
      yearPrefix = `${notificationYear}年`;
    }

    return `${yearPrefix}${month}月${day}日 ${hours}:${minutes}${ampm}`;
  }

  // 格式化時間 - 提取公共邏輯
  formatTime(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12; // 0點顯示為12點
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;

    return { hours, minutes: minutesStr, ampm };
  }

  // 計算時間差
  getTimeAgo(timestamp) {
    const now = Date.now();
    const diffMs = now - timestamp;

    const timeUnits = [
      { unit: '分鐘', divisor: 1000 * 60, max: 60 },
      { unit: '小時', divisor: 1000 * 60 * 60, max: 24 },
      { unit: '天', divisor: 1000 * 60 * 60 * 24, max: 7 }
    ];

    // 小於1分鐘
    if (diffMs < timeUnits[0].divisor) {
      return '剛剛';
    }

    // 檢查各個時間單位
    for (const timeUnit of timeUnits) {
      const diff = Math.floor(diffMs / timeUnit.divisor);
      if (diff < timeUnit.max) {
        return `${diff}${timeUnit.unit}前`;
      }
    }

    // 超過7天
    return '7天前';
  }

  // 檢查是否有未讀通知
  hasUnreadNotifications() {
    const notifications = this.getNotificationsData();
    return notifications.some(notification => !notification.isRead);
  }

  // 獲取未讀通知數量
  getUnreadCount() {
    const notifications = this.getNotificationsData();
    return notifications.filter(notification => !notification.isRead).length;
  }

  // 添加新通知
  addNotification(message, type = 'info') {
    const notifications = this.getNotificationsData();

    const newNotification = {
      id: Date.now().toString(),
      message: message,
      timestamp: Date.now(),
      isRead: false,
      type: type
    };

    notifications.unshift(newNotification);
    this.saveNotificationsData(notifications);

    // 更新指示器
    this.updateNotificationIndicator();

    return newNotification;
  }

  // 刪除通知
  deleteNotification(notificationId) {
    const notifications = this.getNotificationsData();
    const updatedNotifications = notifications.filter(
      notification => notification.id !== notificationId
    );

    this.saveNotificationsData(updatedNotifications);
    this.updateNotificationIndicator();

    return updatedNotifications;
  }

  // 清空所有通知
  clearAllNotifications() {
    this.saveNotificationsData([]);
    this.updateNotificationIndicator();
  }

  // 獲取統計信息
  getNotificationStats() {
    const notifications = this.getNotificationsData();
    const unreadCount = notifications.filter(n => !n.isRead).length;
    const readCount = notifications.filter(n => n.isRead).length;

    return {
      total: notifications.length,
      unread: unreadCount,
      read: readCount,
      hasUnread: unreadCount > 0
    };
  }
}

// 導出供其他文件使用
if (typeof window !== 'undefined') {
  window.NotificationManager = NotificationManager;
}