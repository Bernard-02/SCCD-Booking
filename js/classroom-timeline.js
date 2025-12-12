// 教室時間軸管理
class ClassroomTimeline {
  constructor() {
    this.updateInterval = null;
    this.nowIndicator = null;
    this.tooltip = null;
    this.eventsData = this.generateEventsData();
  }

  // 生成事件數據（模擬課程和租借數據）
  generateEventsData() {
    return {
      'A503': [
        {
          type: 'course',
          title: '大一基礎攝影',
          startHour: 9,
          endHour: 12,
          description: '課程進行中'
        },
        {
          type: 'rental',
          title: 'A111144001',
          startHour: 14,
          endHour: 16,
          description: '學生租借中'
        }
      ],
      'A507': [
        {
          type: 'course',
          title: '新聞寫作',
          startHour: 8,
          endHour: 10,
          description: '課程進行中'
        },
        {
          type: 'course',
          title: '大二主軸課程',
          startHour: 13,
          endHour: 17,
          description: '課程進行中'
        }
      ],
      'A508': [
        {
          type: 'course',
          title: '媒體企劃',
          startHour: 10,
          endHour: 12,
          description: '課程進行中'
        },
        {
          type: 'rental',
          title: 'A111141025',
          startHour: 15,
          endHour: 18,
          description: '學生租借中'
        }
      ]
    };
  }

  // 初始化
  init() {
    // 創建單一的 NOW 指示器
    this.createNowIndicator();

    // 創建 tooltip
    this.createTooltip();

    // 創建夜間使用許可時段標籤
    this.createNightTimeLabels();

    // 更新時間軸
    this.updateAllTimelines();

    // 標記已占用的格子
    this.markOccupiedSlots();

    // 添加 hover 事件監聽
    this.addHoverListeners();

    // 每分鐘更新一次
    this.updateInterval = setInterval(() => {
      this.updateAllTimelines();
      this.markOccupiedSlots();
    }, 60000); // 60秒

    // 監聽視窗大小改變，重新計算 NOW 位置
    this.resizeHandler = () => {
      this.updateAllTimelines();
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  // 創建夜間使用許可時段標籤
  createNightTimeLabels() {
    const classrooms = document.querySelectorAll('.classroom-row');

    classrooms.forEach((classroom) => {
      const timeline = classroom.querySelector('.classroom-timeline');
      if (!timeline) return;

      const timelineLabels = timeline.querySelector('.timeline-labels');
      if (!timelineLabels) return;

      // 創建夜間使用許可時段標籤
      const nightLabel = document.createElement('div');
      nightLabel.className = 'night-time-label text-tiny';
      nightLabel.textContent = '夜間使用許可時段';

      // 將標籤添加到 timeline-labels 內部
      // CSS 的 grid-column: 19 / 25 會自動將它放在正確的位置（12AM-5AM）
      timelineLabels.appendChild(nightLabel);
    });
  }

  // 創建 tooltip 元素
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'time-slot-tooltip';
    document.body.appendChild(this.tooltip);
  }

  // 創建 NOW 指示器（只創建一次）
  createNowIndicator() {
    const wrapper = document.querySelector('.classroom-status-wrapper');
    if (!wrapper) return;

    this.nowIndicator = document.createElement('div');
    this.nowIndicator.className = 'now-indicator';

    const label = document.createElement('span');
    label.className = 'now-label text-tiny';
    this.nowIndicator.appendChild(label);

    wrapper.appendChild(this.nowIndicator);
  }

  // 更新所有教室的時間軸
  updateAllTimelines() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    // 更新所有教室的當前時間格子
    const classrooms = document.querySelectorAll('.classroom-row');
    classrooms.forEach((classroom) => {
      this.updateCurrentHourSlot(classroom, currentHour);
    });

    // 更新單一的 NOW 指示器
    this.updateNowIndicator(currentHour, currentMinutes);

    // 更新教室狀態
    this.updateClassroomStatus();
  }

  // 更新當前時間格子的高度
  updateCurrentHourSlot(classroomElement, currentHour) {
    const timeline = classroomElement.querySelector('.classroom-timeline');
    if (!timeline) return;

    const slots = timeline.querySelectorAll('.time-slot');

    // 移除所有現有的 current-hour class
    slots.forEach((slot) => {
      slot.classList.remove('current-hour');
    });

    // 找到對應當前小時的格子並添加 class
    slots.forEach((slot) => {
      const hour = parseInt(slot.getAttribute('data-hour'));
      if (hour === currentHour) {
        slot.classList.add('current-hour');
      }
    });
  }

  // 更新 NOW 指示器
  updateNowIndicator(currentHour, currentMinutes) {
    if (!this.nowIndicator) return;

    // 更新標籤文字
    const label = this.nowIndicator.querySelector('.now-label');
    const timeString = this.formatTime(currentHour, currentMinutes);
    label.textContent = `NOW: ${timeString}`;

    // 計算位置
    const position = this.calculateNowPosition(currentHour, currentMinutes);
    this.nowIndicator.style.left = position;
  }

  // 計算 NOW 指示器的位置
  calculateNowPosition(currentHour, currentMinutes) {
    // 時間格子的順序：6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5
    // 找到對應當前小時的格子
    const firstClassroom = document.querySelector('.classroom-row');
    if (!firstClassroom) return '0px';

    // 找到當前小時對應的格子
    const currentSlot = firstClassroom.querySelector(`.time-slot[data-hour="${currentHour}"]`);
    if (!currentSlot) return '0px';

    // 獲取格子相對於 viewport 的位置
    const slotRect = currentSlot.getBoundingClientRect();
    const wrapperRect = document.querySelector('.classroom-status-wrapper').getBoundingClientRect();

    // 計算格子相對於 wrapper 的左邊距
    const slotLeftRelativeToWrapper = slotRect.left - wrapperRect.left;

    // 格子的寬度
    const slotWidth = slotRect.width;

    // 當前小時內的進度（0-1）
    const progressInSlot = currentMinutes / 60;

    // NOW 的位置 = 格子左邊距 + 格子內的進度
    const position = slotLeftRelativeToWrapper + (progressInSlot * slotWidth);

    return `${position}px`;
  }

  // 格式化時間顯示
  formatTime(hour, minutes) {
    const minuteStr = minutes.toString().padStart(2, '0');
    if (hour === 0) return `12:${minuteStr}AM`;
    if (hour < 12) return `${hour}:${minuteStr}AM`;
    if (hour === 12) return `12:${minuteStr}PM`;
    return `${hour - 12}:${minuteStr}PM`;
  }

  // 格式化小時時間顯示（不含分鐘）
  formatHour(hour) {
    if (hour === 0) return '12AM';
    if (hour < 12) return `${hour}AM`;
    if (hour === 12) return '12PM';
    return `${hour - 12}PM`;
  }

  // 標記已占用的格子
  markOccupiedSlots() {
    const now = new Date();
    const currentHour = now.getHours();

    const classrooms = document.querySelectorAll('.classroom-row');
    classrooms.forEach((classroom, index) => {
      const classroomName = ['A503', 'A507', 'A508'][index];
      const events = this.eventsData[classroomName] || [];
      const slots = classroom.querySelectorAll('.time-slot');

      slots.forEach((slot) => {
        const hour = parseInt(slot.getAttribute('data-hour'));

        // 檢查是否已過去
        // 12AM-5AM 是明天的時間，不算已過去
        // 只有 6AM 之後且小於當前時間才算已過去
        // 6AM-7AM 是清潔時段，保持原色
        const isPast = hour >= 6 && hour < currentHour;
        const isCleaningTime = hour === 6 || hour === 7;

        if (isPast && !isCleaningTime) {
          slot.classList.add('past');
        } else {
          slot.classList.remove('past');
        }

        // 檢查是否被占用
        const isOccupied = events.some(event =>
          hour >= event.startHour && hour < event.endHour
        );

        if (isOccupied) {
          slot.classList.add('occupied');
        } else {
          slot.classList.remove('occupied');
        }
      });
    });
  }

  // 添加 hover 事件監聽
  addHoverListeners() {
    const classrooms = document.querySelectorAll('.classroom-row');

    classrooms.forEach((classroom, index) => {
      const classroomName = ['A503', 'A507', 'A508'][index];
      const slots = classroom.querySelectorAll('.time-slot');

      slots.forEach((slot) => {
        slot.addEventListener('mouseenter', (e) => {
          this.showTooltip(e, slot, classroomName);
        });

        slot.addEventListener('mousemove', (e) => {
          this.updateTooltipPosition(e, slot);
        });

        slot.addEventListener('mouseleave', () => {
          this.hideTooltip();
        });
      });
    });
  }

  // 更新教室狀態為當前時間的狀態
  updateClassroomStatus() {
    const now = new Date();
    const currentHour = now.getHours();

    const classrooms = ['A503', 'A507', 'A508'];
    classrooms.forEach(classroomName => {
      const statusElement = document.getElementById(`status-${classroomName}`);
      if (!statusElement) return;

      // 檢查當前時間是否被占用
      const events = this.eventsData[classroomName] || [];
      const isOccupied = events.some(event =>
        currentHour >= event.startHour && currentHour < event.endHour
      );

      if (isOccupied) {
        statusElement.className = "status-indicator text-tiny rented";
        statusElement.textContent = '已借出';
      } else {
        statusElement.className = "status-indicator text-tiny";
        statusElement.textContent = '可租借';
      }
    });
  }

  // 顯示 tooltip
  showTooltip(event, slot, classroomName) {
    const hour = parseInt(slot.getAttribute('data-hour'));
    const now = new Date();
    const currentHour = now.getHours();

    // 檢查是否已過去
    // 12AM-5AM 是明天的時間，不算已過去
    const isPast = hour >= 6 && hour < currentHour;

    // 檢查是否是夜間使用時段（12AM-5AM）
    const isNightTime = hour >= 0 && hour <= 5;

    // 獲取事件數據
    const events = this.eventsData[classroomName] || [];
    const currentEvent = events.find(event =>
      hour >= event.startHour && hour < event.endHour
    );

    // 6AM-7AM 是清潔時段（只有兩個格子）
    const isCleaningTime = hour === 6 || hour === 7;

    let tooltipHTML = '';

    if (isPast && !isCleaningTime) {
      // 已過去的時間（非清潔時段）
      if (currentEvent) {
        const startTime = this.formatHour(currentEvent.startHour);
        const endTime = this.formatHour(currentEvent.endHour);
        tooltipHTML = `
          <div class="tooltip-status ended">已結束</div>
          <div class="tooltip-event">${currentEvent.title}</div>
          <div class="tooltip-time">${startTime}-${endTime}</div>
        `;
      } else {
        // 已過去但沒有事件
        tooltipHTML = `
          <div class="tooltip-status ended">已結束</div>
          <div class="tooltip-event">無事件</div>
        `;
      }
    } else if (isCleaningTime) {
      // 6AM-7AM 清潔時段
      tooltipHTML = `
        <div class="tooltip-status closed">清潔淨空時段</div>
        <div class="tooltip-event">此時段不可租借</div>
        <div class="tooltip-time">6AM-8AM</div>
      `;
    } else if (currentEvent) {
      // 已借出
      const startTime = this.formatHour(currentEvent.startHour);
      const endTime = this.formatHour(currentEvent.endHour);
      const nightTimeText = isNightTime ? '<div class="tooltip-time">12AM-5AM</div>' : '';
      tooltipHTML = `
        <div class="tooltip-status occupied">已借出${isNightTime ? ' | 夜間使用許可' : ''}</div>
        <div class="tooltip-event">${currentEvent.title}</div>
        <div class="tooltip-time">${startTime}-${endTime}</div>
        ${nightTimeText}
      `;
    } else {
      // 可租借
      const nightTimeText = isNightTime ? '<div class="tooltip-time">12AM-5AM</div>' : '';
      tooltipHTML = `
        <div class="tooltip-status available">可租借${isNightTime ? ' | 夜間使用許可' : ''}</div>
        <div class="tooltip-event">此教室可租借使用</div>
        ${nightTimeText}
      `;
    }

    this.tooltip.innerHTML = tooltipHTML;
    this.tooltip.classList.add('visible');
    this.updateTooltipPosition(event, slot);
  }

  // 更新 tooltip 位置
  updateTooltipPosition(event, slot) {
    const offset = 15; // 偏移量
    const viewportWidth = window.innerWidth;
    const tooltipWidth = this.tooltip.offsetWidth;
    const tooltipHeight = this.tooltip.offsetHeight;

    // 檢查是否是最後兩個格子（4 = 4AM, 5 = 5AM）
    const hour = slot ? parseInt(slot.getAttribute('data-hour')) : -1;
    const isLastTwoSlots = hour === 4 || hour === 5;

    let left, top;

    if (isLastTwoSlots) {
      // 最後兩個格子：顯示在游標左上角
      left = event.clientX - tooltipWidth - offset;
      top = event.clientY - tooltipHeight - offset;
    } else {
      // 其他格子：顯示在游標右上角
      left = event.clientX + offset;
      top = event.clientY - tooltipHeight - offset;
    }

    // 確保不超出左邊界
    if (left < 0) {
      left = offset;
    }

    // 確保不超出右邊界
    if (left + tooltipWidth > viewportWidth) {
      left = viewportWidth - tooltipWidth - offset;
    }

    // 確保不超出上邊界
    if (top < 0) {
      top = offset;
    }

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  // 隱藏 tooltip
  hideTooltip() {
    this.tooltip.classList.remove('visible');
  }

  // 清理
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }
}

// 當 DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
  const timeline = new ClassroomTimeline();
  timeline.init();
});
