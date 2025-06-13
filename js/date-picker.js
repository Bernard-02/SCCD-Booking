/* ===== 日期選擇器功能 ===== */

// 手機版日期選擇器類別
class MobileDatePicker {
  constructor() {
    this.startDate = null;
    this.endDate = null;
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);
    
    // 月份名稱
    this.monthNames = [
      '一月', '二月', '三月', '四月', '五月', '六月',
      '七月', '八月', '九月', '十月', '十一月', '十二月'
    ];
    
    this.init();
  }
  
  init() {
    this.generateCalendar();
    this.updateDisplay();
    this.updateButtonState();
    this.attachEvents();
  }
  
  generateCalendar() {
    const calendarSlider = document.getElementById('mobile-calendar-slider');
    if (!calendarSlider) return;
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // 清空現有內容
    calendarSlider.innerHTML = '';
    
    // 生成當月及往後3個月的日曆（總共4個月）
    for (let i = 0; i <= 3; i++) {
      const monthDate = new Date(currentYear, currentMonth + i, 1);
      const monthCalendar = this.createMonthCalendar(monthDate);
      calendarSlider.appendChild(monthCalendar);
    }
  }
  
  createMonthCalendar(monthDate) {
    const monthContainer = document.createElement('div');
    monthContainer.className = 'month-calendar';
    
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    
    // 月份標題
    const monthTitle = document.createElement('div');
    monthTitle.className = 'month-title font-["Inter",_sans-serif] text-center text-lg font-medium mb-4 text-white';
    monthTitle.textContent = `${year}年${this.monthNames[month]}`;
    
    // 日曆網格
    const calendarGrid = document.createElement('div');
    calendarGrid.className = 'calendar-grid';
    
    // 獲取該月第一天是星期幾（0=星期日）
    const firstDay = new Date(year, month, 1).getDay();
    // 獲取該月有多少天
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // 填充空白日期（不顯示上個月日期）
    for (let i = 0; i < firstDay; i++) {
      const dateElement = document.createElement('div');
      dateElement.className = 'calendar-date';
      calendarGrid.appendChild(dateElement);
    }
    
    // 填充當月日期
    for (let day = 1; day <= daysInMonth; day++) {
      const dateElement = document.createElement('div');
      const currentDate = new Date(year, month, day);
      
      dateElement.className = 'calendar-date';
      dateElement.textContent = day;
      
      // 添加data屬性
      dateElement.dataset.year = year;
      dateElement.dataset.month = month;
      dateElement.dataset.day = day;
      
      // 檢查是否是今天
      if (currentDate.getTime() === this.today.getTime()) {
        dateElement.classList.add('today');
      }
      
      // 檢查是否是過去的日期
      const isPastDate = currentDate < this.today;
      
      // 檢查是否超過30天範圍（如果已選擇起租日）
      let isOutOfRange = false;
      if (this.startDate && !this.endDate) {
        const daysDifference = Math.ceil((currentDate - this.startDate) / (1000 * 60 * 60 * 24));
        isOutOfRange = daysDifference > 30;
      }
      
      if (isPastDate || isOutOfRange) {
        dateElement.classList.add('disabled');
      } else {
        // 添加點擊事件
        dateElement.addEventListener('click', () => {
          this.selectDate(year, month, day);
        });
      }
      
      // 為選擇狀態添加樣式
      if (this.startDate && this.isSameDay(currentDate, this.startDate)) {
        dateElement.classList.add('start-date');
      } else if (this.endDate && this.isSameDay(currentDate, this.endDate)) {
        dateElement.classList.add('end-date');
      } else if (this.startDate && this.endDate && 
                 currentDate > this.startDate && currentDate < this.endDate) {
        dateElement.classList.add('in-range');
      }
     
      calendarGrid.appendChild(dateElement);
    }
    
    monthContainer.appendChild(monthTitle);
    monthContainer.appendChild(calendarGrid);
    
    return monthContainer;
  }
  
  selectDate(year, month, day) {
    const clickedDate = new Date(year, month, day);
    
    // 使用與桌面版相同的邏輯
    if (this.startDate && this.endDate) {
      // 已經有完整範圍，重新開始選擇起租日
      this.startDate = clickedDate;
      this.endDate = null;
    } else if (!this.startDate) {
      // 沒有起租日，設置起租日
      this.startDate = clickedDate;
      this.endDate = null;
    } else if (clickedDate >= this.startDate) {
      // 檢查日期範圍是否超過30天
      const daysDifference = Math.ceil((clickedDate - this.startDate) / (1000 * 60 * 60 * 24));
      
      if (daysDifference <= 30) {
        // 有起租日且範圍在30天內，設置歸還日
        this.endDate = clickedDate;
      } else {
        // 超過30天，不執行任何動作
        return;
      }
    } else {
      // 如果選擇的日期早於起租日，重新設置起租日
      this.startDate = clickedDate;
      this.endDate = null;
    }
    
    this.updateDisplay();
    this.generateCalendar(); // 重新生成日曆以顯示30天限制
    this.updateButtonState();
  }
  
  updateDisplay() {
    const formatDate = (date) => {
      if (!date) return "---- / -- / --";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    };
    
    const startDateElement = document.getElementById('mobile-display-start-date');
    const endDateElement = document.getElementById('mobile-display-end-date');
    
    if (startDateElement) {
      startDateElement.textContent = formatDate(this.startDate);
    }
    if (endDateElement) {
      endDateElement.textContent = formatDate(this.endDate);
    }
    
    // 同步更新桌面版顯示
    const desktopStartDate = document.getElementById('display-start-date');
    const desktopEndDate = document.getElementById('display-end-date');
    if (desktopStartDate) {
      desktopStartDate.textContent = formatDate(this.startDate);
    }
    if (desktopEndDate) {
      desktopEndDate.textContent = formatDate(this.endDate);
    }
  }
  
  updateButtonState() {
    const resetButton = document.getElementById('mobile-reset-date-button');
    const confirmButton = document.getElementById('mobile-confirm-date-button');
    
    // 重設按鈕狀態
    if (this.startDate && resetButton) {
      resetButton.disabled = false;
      resetButton.classList.remove('opacity-30', 'cursor-not-allowed');
      resetButton.classList.add('cursor-pointer', 'opacity-100');
    } else if (resetButton) {
      resetButton.disabled = true;
      resetButton.classList.add('opacity-30', 'cursor-not-allowed');
      resetButton.classList.remove('cursor-pointer', 'opacity-100');
    }
    
    // 確定按鈕狀態
    if (this.startDate && this.endDate && confirmButton) {
      confirmButton.disabled = false;
      confirmButton.classList.remove('opacity-30', 'cursor-not-allowed');
      confirmButton.classList.add('cursor-pointer', 'opacity-100');
    } else if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.classList.add('opacity-30', 'cursor-not-allowed');
      confirmButton.classList.remove('cursor-pointer', 'opacity-100');
    }
  }
  
  attachEvents() {
    const resetButton = document.getElementById('mobile-reset-date-button');
    const confirmButton = document.getElementById('mobile-confirm-date-button');
    
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        if (!resetButton.disabled) {
          this.startDate = null;
          this.endDate = null;
          this.updateDisplay();
          this.generateCalendar(); // 重新生成日曆以移除30天限制
          this.updateButtonState();
        }
      });
    }
    
    if (confirmButton) {
      confirmButton.addEventListener('click', () => {
        if (!confirmButton.disabled && this.startDate && this.endDate) {
          // 跳轉到下一頁
          window.location.href = 'bookingresources.html';
        }
      });
    }
  }
  
  isSameDay(date1, date2) {
    return date1.getTime() === date2.getTime();
  }
}

// 日期同步功能
function syncDateDisplays() {
  const startDate = document.getElementById('display-start-date');
  const endDate = document.getElementById('display-end-date');
  const mobileStartDate = document.getElementById('mobile-display-start-date');
  const mobileEndDate = document.getElementById('mobile-display-end-date');
  
  if (startDate && mobileStartDate) {
    mobileStartDate.textContent = startDate.textContent;
  }
  if (endDate && mobileEndDate) {
    mobileEndDate.textContent = endDate.textContent;
  }
}

// 初始化函數
function initDatePicker() {
  // 監聽日期變化
  const observer = new MutationObserver(syncDateDisplays);
  const startDateElement = document.getElementById('display-start-date');
  const endDateElement = document.getElementById('display-end-date');
  
  if (startDateElement) {
    observer.observe(startDateElement, { childList: true, subtree: true });
  }
  if (endDateElement) {
    observer.observe(endDateElement, { childList: true, subtree: true });
  }
  
  // 初始同步
  syncDateDisplays();
  
  // 初始化手機版日期選擇器
  const mobileDatePicker = new MobileDatePicker();
  
  return mobileDatePicker;
}

// 全域函數
window.MobileDatePicker = MobileDatePicker;
window.initDatePicker = initDatePicker;
window.syncDateDisplays = syncDateDisplays;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  initDatePicker();
}); 