// Profile 頁面主控制器 - 協調各個功能模塊

class ProfilePage {
  constructor() {
    this.currentSection = null;
    this.managers = {};
    this.currentUser = null;
    this.isInternalBookmarkChange = false; // 防止內部操作觸發全局同步
    this.init();
  }

  init() {
    this.setupGreeting();
    this.setupMenuEvents();
    this.setupLogoutButton();
    this.checkLoginStatus();
    this.initializeManagers();

    // 設定預設頁面為租借歷史
    this.switchSection('history');

    // 設定預設選中狀態
    const firstMenuItem = document.querySelector('.sccd-filter-item[data-section="history"]');
    if (firstMenuItem) {
      const wrapper = firstMenuItem.querySelector('.menu-item-wrapper');
      if (wrapper) {
        wrapper.classList.add('active');
      }
    }

    // 更新通知指示器
    this.updateNotificationIndicator();

    // 監聽全站收藏變化
    this.setupGlobalBookmarkListener();
  }

  // 初始化各個功能管理器
  initializeManagers() {
    this.managers.favorites = new window.FavoritesManager();
    this.managers.notifications = new window.NotificationManager();
    this.managers.rentalHistory = new window.RentalHistoryManager();
    this.managers.profileData = new window.ProfileDataManager();

    // 如果用戶已登入，初始化管理器
    if (this.currentUser) {
      this.managers.notifications.init(this.currentUser);
      this.managers.rentalHistory.init(this.currentUser);
      this.managers.profileData.init(this.currentUser);
    }
  }

  setupGreeting() {
    const now = new Date();
    const hour = now.getHours();
    const greetingElement = document.getElementById('greeting-text');

    let greeting;
    if (hour >= 5 && hour < 12) {
      greeting = '早安!';
    } else if (hour >= 12 && hour < 18) {
      greeting = '午安!';
    } else {
      greeting = '晚安!';
    }

    if (greetingElement) {
      greetingElement.textContent = greeting;
    }
  }

  setupMenuEvents() {
    const menuItems = document.querySelectorAll('.sccd-filter-item');
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        this.switchSection(section);

        // 更新選中狀態
        menuItems.forEach(mi => {
          const wrapper = mi.querySelector('.menu-item-wrapper');
          if (wrapper) {
            wrapper.classList.remove('active');
          }
        });

        const currentWrapper = item.querySelector('.menu-item-wrapper');
        if (currentWrapper) {
          currentWrapper.classList.add('active');
        }
      });
    });
  }

  setupLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.handleLogout();
      });
    }
  }

  switchSection(section) {
    this.currentSection = section;
    const contentArea = document.getElementById('content-area');

    if (!contentArea) return;

    let content = '';

    // 使用對應的管理器生成內容
    switch (section) {
      case 'history':
        content = this.managers.rentalHistory.getRentalHistoryContent();
        break;
      case 'profile':
        content = this.managers.profileData.getProfileContent();
        break;
      case 'favorites':
        content = this.managers.favorites.getFavoritesContent();
        break;
      case 'notifications':
        content = this.managers.notifications.getNotificationsContent();
        break;
      default:
        content = this.getDefaultContent();
    }

    contentArea.innerHTML = content;

    // 設置對應管理器的事件監聽器
    this.setupSectionEventListeners(section);
  }

  // 設置各個頁面的事件監聽器 - 委託給對應的管理器
  setupSectionEventListeners(section) {
    switch (section) {
      case 'profile':
        this.managers.profileData.setupEventListeners();
        break;
      case 'notifications':
        this.managers.notifications.setupEventListeners();
        // 設置通知特殊的回調
        this.setupNotificationCallbacks();
        break;
      case 'history':
        this.managers.rentalHistory.setupEventListeners();
        break;
      case 'favorites':
        this.managers.favorites.setupEventListeners();
        break;
    }
  }

  // 設置通知相關的回調函數
  setupNotificationCallbacks() {
    // 重寫管理器的標記方法，添加頁面更新邏輯
    const originalMarkAll = this.managers.notifications.markAllNotificationsAsRead.bind(this.managers.notifications);
    const originalMarkOne = this.managers.notifications.markNotificationAsRead.bind(this.managers.notifications);

    this.managers.notifications.markAllNotificationsAsRead = () => {
      originalMarkAll();
      this.switchSection('notifications'); // 重新渲染頁面
      this.updateNotificationIndicator(); // 更新指示器
    };

    this.managers.notifications.markNotificationAsRead = (id) => {
      originalMarkOne(id);
      this.switchSection('notifications'); // 重新渲染頁面
      this.updateNotificationIndicator(); // 更新指示器
    };
  }

  checkLoginStatus() {
    // 檢查是否有有效的登入狀態
    if (typeof window.AuthStorage !== 'undefined' && window.AuthStorage.isLoggedIn()) {
      const loginData = window.AuthStorage.getLoginData();
      if (loginData && loginData.student) {
        // 設置當前用戶
        this.currentUser = this.formatUserData(loginData.student);

        // 更新用戶資料顯示
        this.updateUserInfo(loginData.student);

        // 處理可能的延遲收藏操作
        setTimeout(() => {
          if (window.processPendingBookmarks) {
            window.processPendingBookmarks();
          }
        }, 500);
      }
    } else {
      // 如果未登入，跳轉到登入頁面
      window.location.href = 'login.html';
    }
  }

  // 格式化用戶數據
  formatUserData(studentData) {
    return {
      studentId: studentData.studentId || 'A111144001',
      name: studentData.name || '阿志',
      email: studentData.email || `${studentData.studentId}@gm2.usc.edu.tw`,
      phone: studentData.phone || null,
      emailVerified: studentData.emailVerified || false,
      department: studentData.department || '媒體傳達設計系',
      className: studentData.className || '乙班',
      year: studentData.year || '111學年'
    };
  }

  updateUserInfo(student) {
    // 更新左側面板的用戶信息
    this.updateLeftPanelUserInfo(student);

    // 委託給 ProfileDataManager 處理個人資料頁面內容
    if (this.managers.profileData) {
      this.managers.profileData.updateUserInfo(student);
    }
  }

  // 更新左側面板的用戶信息
  updateLeftPanelUserInfo(student) {
    // 更新學號顯示 - 找到在問候區塊內的學號元素
    const greetingArea = document.querySelector('#greeting-text')?.parentElement;
    if (greetingArea) {
      const studentIdElement = greetingArea.querySelector('.font-english.text-white.text-content');
      if (studentIdElement) {
        studentIdElement.textContent = student.studentId || 'A111144001';
      }

      // 更新姓名顯示 - 找到學號元素的下一個中文元素
      const nameElement = studentIdElement?.nextElementSibling;
      if (nameElement && nameElement.classList.contains('font-chinese')) {
        nameElement.textContent = student.name || '阿志';
      }
    }
  }

  // 更新左側菜單的通知指示器
  updateNotificationIndicator() {
    if (this.managers.notifications) {
      this.managers.notifications.updateNotificationIndicator();
    }
  }

  // 監聽全站收藏變化
  setupGlobalBookmarkListener() {
    // 監聽localStorage變化（支援用戶特定的收藏）
    window.addEventListener('storage', (event) => {
      if (event.key === 'sccd_bookmarks' || event.key?.startsWith('sccd_bookmarks_')) {
        this.syncGlobalBookmarks();
      }
    });

    // 監聽自定義事件（BookmarkManager 觸發的事件）
    window.addEventListener('bookmarkUpdated', () => {
      this.syncGlobalBookmarks();
    });
  }

  // 同步全站收藏到用戶收藏
  syncGlobalBookmarks() {
    try {
      // 如果是內部操作觸發的變化，跳過全局同步
      if (this.isInternalBookmarkChange) {
        this.isInternalBookmarkChange = false;
        return;
      }

      // 確保 BookmarkManager 有最新的用戶狀態
      if (window.sccdBookmarkManager) {
        window.sccdBookmarkManager.updateCurrentUser();
      }

      // 委託給 FavoritesManager 處理同步
      if (this.managers.favorites) {
        this.managers.favorites.syncFavorites();
      }

      // 如果當前在收藏頁面，重新載入內容
      if (this.currentSection === 'favorites') {
        this.switchSection('favorites');
      }
    } catch (error) {
      console.error('同步收藏數據錯誤:', error);
    }
  }

  handleLogout() {
    // 清除登入狀態
    if (window.AuthStorage) {
      window.AuthStorage.clearLoginData();
    }

    // 清除當前用戶
    this.currentUser = null;

    // 通知收藏管理器用戶狀態改變
    if (window.onAuthStateChanged) {
      window.onAuthStateChanged();
    }

    // 通知全站管理器更新導航
    if (window.GlobalAuthManager) {
      window.GlobalAuthManager.onLogout();
    }

    // 直接跳轉到登入頁面
    window.location.href = 'login.html';
  }

  getDefaultContent() {
    return `
      <div class="text-center py-16">
        <p class="font-chinese text-gray-scale4 text-small-title">請選擇左側選單項目</p>
      </div>
    `;
  }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
  window.profilePage = new ProfilePage();
});