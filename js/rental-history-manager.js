// 租借歷史管理器 - 負責處理租借歷史的所有邏輯

// 租借狀態常量
const RENTAL_STATUS = {
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  OVERDUE: 'overdue'
};

// 逾期警告常量
const DUE_WARNING = {
  CRITICAL_DAYS: 3, // 3天內顯示紅色警告
  CRITICAL_HOURS: 24 // 24小時內顯示小時倒計時
};

class RentalHistoryManager {
  constructor() {
    this.storageKey = null;
    this.currentUser = null;
  }

  // 初始化租借歷史管理器
  init(userData) {
    this.currentUser = userData;
    this.storageKey = `sccd_rental_history_${userData.studentId}`;
  }

  // 生成租借歷史頁面HTML內容
  getRentalHistoryContent() {
    const rentalData = this.getRentalHistoryData();
    const ongoingRentals = rentalData.filter(rental => rental.status === RENTAL_STATUS.ONGOING);
    const completedRentals = rentalData.filter(rental => rental.status === RENTAL_STATUS.COMPLETED);

    return `
      <div class="space-y-8">
        <div>
          <h2 class="font-chinese text-white text-medium-title">租借歷史</h2>
        </div>

        <!-- 進行中 -->
        ${ongoingRentals.length > 0 ? this.generateOngoingRentalsSection(ongoingRentals) : ''}

        <!-- 已完成 -->
        ${completedRentals.length > 0 ? this.generateCompletedRentalsSection(completedRentals) : ''}
      </div>
    `;
  }

  // 生成進行中的租借項目區塊
  generateOngoingRentalsSection(ongoingRentals) {
    return `
      <div>
        <h3 class="font-chinese text-white text-content mb-4">進行中</h3>
        <div class="space-y-0">
          ${ongoingRentals.map((rental, index) =>
            this.generateRentalItem(rental, index, ongoingRentals.length, true)
          ).join('')}
        </div>
      </div>
    `;
  }

  // 生成已完成的租借項目區塊
  generateCompletedRentalsSection(completedRentals) {
    return `
      <div>
        <h3 class="font-chinese text-white text-content mb-4">已完成</h3>
        <div class="space-y-0">
          ${completedRentals.map((rental, index) =>
            this.generateRentalItem(rental, index, completedRentals.length, false)
          ).join('')}
        </div>
      </div>
    `;
  }

  // 生成單個租借項目HTML
  generateRentalItem(rental, index, totalCount, isOngoing) {
    const hasBorder = index < totalCount - 1;
    const dueInfo = this.calculateDueInfo(rental.dueDate);

    return `
      <div class="rental-item px-4 pt-6 pb-4 ${hasBorder ? 'border-b border-gray-scale5' : ''} transition-colors duration-200"
           data-rental-id="${rental.id}"
           style="cursor: pointer;"
           onmouseover="this.style.backgroundColor='var(--color-gray-scale5)'"
           onmouseout="this.style.backgroundColor='transparent'">
        <!-- 上半部：租借單號和狀態 -->
        <div class="flex justify-between items-start mb-2">
          <span class="font-english text-white text-small-title">${rental.orderNumber}</span>
          <span class="font-chinese text-tiny pr-1" ${dueInfo.needsRedColor ? 'style="color: var(--color-error);"' : ''}>
            ${this.getStatusText(rental, dueInfo)}
          </span>
        </div>

        <!-- 下半部：租借日期和操作按鈕 -->
        <div class="flex justify-between items-start">
          <span class="font-english text-gray-scale3 text-tiny">
            ${this.formatRentalDateRange(rental.startDate, rental.endDate)}
          </span>
          ${this.generateActionButton(rental, isOngoing)}
        </div>
      </div>
    `;
  }

  // 獲取狀態文字
  getStatusText(rental, dueInfo) {
    if (rental.status === RENTAL_STATUS.COMPLETED) {
      return '已完成';
    }
    return dueInfo.text;
  }

  // 生成操作按鈕
  generateActionButton(rental, isOngoing) {
    const isDisabled = !isOngoing;
    const disabledStyles = isDisabled ? ' disabled" disabled style="opacity: 0.5; cursor: not-allowed;"' : '"';

    return `
      <button class="page-button rental-extend-btn${disabledStyles} data-rental-id="${rental.id}">
        <div class="menu-item-wrapper">
          <span class="menu-text">(EXTEND)</span>
          <span class="menu-text-hidden">(EXTEND)</span>
        </div>
      </button>
    `;
  }

  // 設置租借歷史頁面事件監聽器
  setupEventListeners() {
    this.setupRentalItemClickEvents();
    this.setupExtendButtonEvents();
  }

  // 設置租借項目點擊事件
  setupRentalItemClickEvents() {
    const rentalItems = document.querySelectorAll('.rental-item');
    rentalItems.forEach(item => {
      item.addEventListener('click', (e) => {
        // 如果點擊的是按鈕，不處理項目點擊
        if (e.target.closest('.rental-extend-btn')) {
          return;
        }

        const rentalId = item.dataset.rentalId;
        this.goToRentalReceipt(rentalId);
      });
    });
  }

  // 設置續借按鈕事件
  setupExtendButtonEvents() {
    const extendBtns = document.querySelectorAll('.rental-extend-btn:not(.disabled)');
    extendBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 防止觸發項目點擊事件
        const rentalId = btn.dataset.rentalId;
        this.handleExtendRental(rentalId);
      });
    });
  }

  // 獲取租借歷史數據
  getRentalHistoryData() {
    if (!this.storageKey) {
      console.warn('租借歷史管理器未初始化');
      return [];
    }

    let rentals = this.loadRentalsFromStorage();

    // 如果沒有數據，創建測試數據
    if (rentals.length === 0) {
      rentals = this.createTestRentalData();
      this.saveRentalHistoryData(rentals);
    }

    return rentals.sort((a, b) => b.startDate - a.startDate);
  }

  // 從存儲加載租借數據
  loadRentalsFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('獲取租借歷史數據錯誤:', error);
      return [];
    }
  }

  // 創建測試租借數據
  createTestRentalData() {
    const createDate = (year, month, day) => new Date(year, month - 1, day).getTime();

    return [
      {
        id: 'rental_001',
        orderNumber: '#2025007',
        startDate: createDate(2025, 9, 23),
        endDate: createDate(2025, 9, 30),
        dueDate: createDate(2025, 9, 30),
        status: RENTAL_STATUS.ONGOING,
        items: ['Sony FX3 攝影機', '三腳架']
      },
      {
        id: 'rental_002',
        orderNumber: '#2025006',
        startDate: createDate(2025, 9, 20),
        endDate: createDate(2025, 9, 24),
        dueDate: createDate(2025, 9, 24),
        status: RENTAL_STATUS.ONGOING,
        items: ['Canon R5 相機', '鏡頭組']
      },
      {
        id: 'rental_003',
        orderNumber: '#2025005',
        startDate: createDate(2025, 9, 10),
        endDate: createDate(2025, 9, 15),
        dueDate: createDate(2025, 9, 15),
        status: RENTAL_STATUS.COMPLETED,
        items: ['無線麥克風組']
      },
      {
        id: 'rental_004',
        orderNumber: '#2025004',
        startDate: createDate(2025, 9, 5),
        endDate: createDate(2025, 9, 12),
        dueDate: createDate(2025, 9, 12),
        status: RENTAL_STATUS.COMPLETED,
        items: ['LED燈組', '反光板']
      }
    ];
  }

  // 保存租借歷史數據
  saveRentalHistoryData(rentals) {
    if (!this.storageKey) {
      console.warn('租借歷史管理器未初始化');
      return;
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(rentals));
    } catch (error) {
      console.error('保存租借歷史數據錯誤:', error);
    }
  }

  // 計算逾期信息 - 統一的邏輯處理
  calculateDueInfo(dueDate) {
    const now = Date.now();
    const diffMs = dueDate - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // 已逾期
    if (diffMs <= 0) {
      return {
        text: '已逾期',
        needsRedColor: true,
        isOverdue: true
      };
    }

    // 需要紅色警告（3天內或已逾期）
    const needsRedColor = diffDays <= DUE_WARNING.CRITICAL_DAYS;

    // 小於24小時顯示小時
    if (diffHours < DUE_WARNING.CRITICAL_HOURS) {
      const hours = diffHours <= 1 ? 1 : diffHours;
      return {
        text: `距離逾期剩下${hours}小時`,
        needsRedColor,
        isOverdue: false
      };
    }

    // 顯示天數
    return {
      text: `距離逾期剩下${diffDays}天`,
      needsRedColor,
      isOverdue: false
    };
  }

  // 格式化租借日期範圍
  formatRentalDateRange(startDate, endDate) {
    const formatDate = (timestamp) => {
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}/${month}/${day}`;
    };

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }

  // 跳轉到租借清單頁面
  goToRentalReceipt(rentalId) {
    console.log('跳轉到租借清單:', rentalId);
    window.location.href = `rental-receipt.html?rental_id=${rentalId}`;
  }

  // 處理續借請求
  handleExtendRental(rentalId) {
    console.log('續借請求:', rentalId);
    alert(`續借申請已提交！租借單號：${rentalId}`);
  }

  // 添加新的租借記錄
  addRentalRecord(rentalData) {
    const rentals = this.getRentalHistoryData();
    const newRental = {
      id: `rental_${Date.now()}`,
      orderNumber: rentalData.orderNumber || `#${Date.now()}`,
      startDate: rentalData.startDate,
      endDate: rentalData.endDate,
      dueDate: rentalData.dueDate || rentalData.endDate,
      status: rentalData.status || RENTAL_STATUS.ONGOING,
      items: rentalData.items || []
    };

    rentals.unshift(newRental);
    this.saveRentalHistoryData(rentals);
    return newRental;
  }

  // 更新租借狀態
  updateRentalStatus(rentalId, newStatus) {
    const rentals = this.getRentalHistoryData();
    const updatedRentals = rentals.map(rental =>
      rental.id === rentalId
        ? { ...rental, status: newStatus }
        : rental
    );

    this.saveRentalHistoryData(updatedRentals);
    return updatedRentals;
  }

  // 延長租借期限
  extendRentalPeriod(rentalId, newEndDate, newDueDate = null) {
    const rentals = this.getRentalHistoryData();
    const updatedRentals = rentals.map(rental =>
      rental.id === rentalId
        ? {
            ...rental,
            endDate: newEndDate,
            dueDate: newDueDate || newEndDate
          }
        : rental
    );

    this.saveRentalHistoryData(updatedRentals);
    return updatedRentals;
  }

  // 獲取特定狀態的租借記錄
  getRentalsByStatus(status) {
    const rentals = this.getRentalHistoryData();
    return rentals.filter(rental => rental.status === status);
  }

  // 獲取即將到期的租借記錄
  getUpcomingDueRentals(daysAhead = 3) {
    const rentals = this.getRentalsByStatus(RENTAL_STATUS.ONGOING);
    const cutoffTime = Date.now() + (daysAhead * 24 * 60 * 60 * 1000);

    return rentals.filter(rental => rental.dueDate <= cutoffTime);
  }

  // 獲取已逾期的租借記錄
  getOverdueRentals() {
    const rentals = this.getRentalsByStatus(RENTAL_STATUS.ONGOING);
    const now = Date.now();

    return rentals.filter(rental => rental.dueDate < now);
  }

  // 獲取租借統計信息
  getRentalStats() {
    const rentals = this.getRentalHistoryData();
    const ongoing = rentals.filter(r => r.status === RENTAL_STATUS.ONGOING);
    const completed = rentals.filter(r => r.status === RENTAL_STATUS.COMPLETED);
    const overdue = this.getOverdueRentals();

    return {
      total: rentals.length,
      ongoing: ongoing.length,
      completed: completed.length,
      overdue: overdue.length,
      upcomingDue: this.getUpcomingDueRentals().length
    };
  }
}

// 導出供其他文件使用
if (typeof window !== 'undefined') {
  window.RentalHistoryManager = RentalHistoryManager;
  window.RENTAL_STATUS = RENTAL_STATUS;
}