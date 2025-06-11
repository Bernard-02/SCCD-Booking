document.addEventListener('DOMContentLoaded', function () {
    // 確認我們在 booking.html 頁面並且相關元素存在
    const datePickerContainer = document.getElementById('date-picker-container');
    const displayStartDate = document.getElementById('display-start-date');
    const displayEndDate = document.getElementById('display-end-date');

    if (datePickerContainer && displayStartDate && displayEndDate) {
        
        // 客製化日期選擇器類別
        class CustomDatePicker {
            constructor(container, options = {}) {
                this.container = container;
                this.startDate = null;
                this.endDate = null;
                this.currentMonth = new Date().getMonth();
                this.currentYear = new Date().getFullYear();
                // 記錄起始月份（當前月份），用於限制導航範圍
                this.baseMonth = new Date().getMonth();
                this.baseYear = new Date().getFullYear();
                this.today = new Date();
                this.confirmButton = document.getElementById('confirm-date-button');
                this.resetButton = document.getElementById('reset-date-button');
                
                // 月份和星期的中文名稱
                this.monthNames = [
                    '一月', '二月', '三月', '四月', '五月', '六月',
                    '七月', '八月', '九月', '十月', '十一月', '十二月'
                ];
                this.weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                
                this.init();
            }
            
            init() {
                this.render();
                this.attachEvents();
                this.updateButtonState();
                this.updateNavigationButtons();
                this.attachResetEvent();
            }
            
            render() {
                const currentMonth = new Date(this.currentYear, this.currentMonth);
                const nextMonth = new Date(this.currentYear, this.currentMonth + 1);
                
                this.container.innerHTML = `
                    <div class="custom-datepicker">
                        <div class="datepicker-header">
                            <button class="nav-arrow" id="prev-month">
                                <svg viewBox="0 0 30 22">
                                    <line x1="25" y1="11" x2="4" y2="11" stroke="white" stroke-width="1"/>
                                    <line x1="10" y1="5" x2="4" y2="11" stroke="white" stroke-width="1"/>
                                    <line x1="10" y1="17" x2="4" y2="11" stroke="white" stroke-width="1"/>
                                </svg>
                            </button>
                            <div class="month-navigation">
                                <div class="month-title">${this.monthNames[currentMonth.getMonth()]}</div>
                                <div class="month-title">${this.monthNames[nextMonth.getMonth()]}</div>
                            </div>
                            <button class="nav-arrow" id="next-month">
                                <svg viewBox="0 0 30 22">
                                    <line x1="4" y1="11" x2="25" y2="11" stroke="white" stroke-width="1"/>
                                    <line x1="19" y1="5" x2="25" y2="11" stroke="white" stroke-width="1"/>
                                    <line x1="19" y1="17" x2="25" y2="11" stroke="white" stroke-width="1"/>
                                </svg>
                            </button>
                        </div>
                        <div class="calendars-container">
                            <div class="calendar-month">
                                ${this.renderWeekdays()}
                                ${this.renderMonth(currentMonth)}
                            </div>
                            <div class="calendar-month">
                                ${this.renderWeekdays()}
                                ${this.renderMonth(nextMonth)}
                            </div>
                        </div>
                    </div>
                `;
            }
            
            renderWeekdays() {
                return `
                    <div class="weekdays">
                        ${this.weekdays.map(day => `<div class="weekday">${day}</div>`).join('')}
                    </div>
                `;
            }
            
            renderMonth(date) {
                const year = date.getFullYear();
                const month = date.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const daysInMonth = lastDay.getDate();
                
                const days = [];
                
                // 在月份開始前填入空格子以對齊星期
                const startDayOfWeek = firstDay.getDay();
                for (let i = 0; i < startDayOfWeek; i++) {
                    days.push(`<div class="day empty-day"></div>`);
                }
                
                // 只顯示當前月份的日期
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayDate = new Date(year, month, day);
                    const isToday = this.isSameDay(dayDate, this.today);
                    const isPast = dayDate < this.today && !this.isSameDay(dayDate, this.today);
                    
                    // 檢查是否超過30天範圍（如果已選擇起租日）
                    let isOutOfRange = false;
                    if (this.startDate && !this.endDate) {
                        const daysDifference = Math.ceil((dayDate - this.startDate) / (1000 * 60 * 60 * 24));
                        isOutOfRange = daysDifference > 30;
                    }
                    
                    let classes = ['day'];
                    if (isToday) classes.push('today');
                    if (isPast || isOutOfRange) classes.push('disabled');
                    
                    // 檢查選擇狀態
                    if (this.startDate && this.isSameDay(dayDate, this.startDate)) {
                        classes.push('start-range');
                    }
                    if (this.endDate && this.isSameDay(dayDate, this.endDate)) {
                        classes.push('end-range');
                    }
                    if (this.startDate && this.endDate && 
                        dayDate > this.startDate && dayDate < this.endDate) {
                        classes.push('in-range');
                    }
                    
                    // 使用本地日期格式避免時區問題
                    const dateString = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
                    
                    days.push(`
                        <div class="${classes.join(' ')}" 
                             data-date="${dateString}"
                             data-year="${dayDate.getFullYear()}"
                             data-month="${dayDate.getMonth()}"
                             data-day="${dayDate.getDate()}">
                            ${day}
                        </div>
                    `);
                }
                
                return `<div class="days-grid">${days.join('')}</div>`;
            }
            
            attachEvents() {
                // 導航按鈕事件
                const prevButton = this.container.querySelector('#prev-month');
                const nextButton = this.container.querySelector('#next-month');
                
                if (prevButton) {
                    prevButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Previous month clicked'); // 調試用
                        
                        // 檢查是否可以往前導航（不能早於起始月份）
                        if (this.canNavigatePrevious()) {
                            this.currentMonth--;
                            if (this.currentMonth < 0) {
                                this.currentMonth = 11;
                                this.currentYear--;
                            }
                            this.render();
                            this.attachEvents();
                            this.updateNavigationButtons();
                        }
                    });
                }
                
                if (nextButton) {
                    nextButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Next month clicked'); // 調試用
                        
                        // 檢查是否可以往後導航（最多到起始月份+3個月）
                        if (this.canNavigateNext()) {
                            this.currentMonth++;
                            if (this.currentMonth > 11) {
                                this.currentMonth = 0;
                                this.currentYear++;
                            }
                            this.render();
                            this.attachEvents();
                            this.updateNavigationButtons();
                        }
                    });
                }
                
                // 日期點擊事件
                this.container.querySelectorAll('.day:not(.disabled)').forEach(dayEl => {
                    dayEl.addEventListener('click', (e) => {
                        // 使用data屬性直接創建日期，避免時區問題
                        const year = parseInt(e.target.dataset.year);
                        const month = parseInt(e.target.dataset.month);
                        const day = parseInt(e.target.dataset.day);
                        const clickedDate = new Date(year, month, day);
                        this.selectDate(clickedDate);
                    });
                });
            }
            
            selectDate(date) {
                // 修改邏輯：如果已經有完整的範圍選擇，重新開始
                if (this.startDate && this.endDate) {
                    // 已經有完整範圍，重新開始選擇起租日
                    this.startDate = date;
                    this.endDate = null;
                } else if (!this.startDate) {
                    // 沒有起租日，設置起租日
                    this.startDate = date;
                    this.endDate = null;
                } else if (date >= this.startDate) {
                    // 檢查日期範圍是否超過30天
                    const daysDifference = Math.ceil((date - this.startDate) / (1000 * 60 * 60 * 24));
                    
                    if (daysDifference <= 30) {
                        // 有起租日且範圍在30天內，設置歸還日
                        this.endDate = date;
                    } else {
                        // 超過30天，不執行任何動作，可以選擇提供用戶反饋
                        console.log('選擇的日期範圍不能超過30天');
                        return; // 直接返回，不更新顯示
                    }
                } else {
                    // 如果選擇的日期早於起租日，重新設置起租日
                    this.startDate = date;
                    this.endDate = null;
                }
                
                this.updateDisplay();
                this.render();
                this.attachEvents();
            }
            
            updateDisplay() {
                const formatDate = (date) => {
                    if (!date) return "---- / -- / --";
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}/${month}/${day}`;
                };
                
                displayStartDate.textContent = formatDate(this.startDate);
                displayEndDate.textContent = formatDate(this.endDate);
                
                // 更新按鈕狀態
                this.updateButtonState();
            }
            
            updateButtonState() {
                // 處理確定日期按鈕
                if (this.startDate && this.endDate && this.confirmButton) {
                    // 兩個日期都已選擇，啟用按鈕
                    this.confirmButton.disabled = false;
                    this.confirmButton.className = "bg-white text-black opacity-100 font-['Inter',_sans-serif] font-normal py-3 px-8 transition-all text-lg cursor-pointer hover:opacity-60";
                    
                    // 移除舊的事件監聽器並添加新的
                    this.confirmButton.onclick = () => {
                        window.location.href = 'bookingresources.html';
                    };
                } else if (this.confirmButton) {
                    // 日期未完全選擇，禁用按鈕
                    this.confirmButton.disabled = true;
                    this.confirmButton.className = "bg-white text-black opacity-30 font-['Inter',_sans-serif] font-normal py-3 px-8 transition-all text-lg cursor-not-allowed hover:opacity-60";
                    this.confirmButton.onclick = null;
                }
                
                // 處理重設日期按鈕
                if (this.startDate && this.resetButton) {
                    // 至少有起租日被選擇，啟用重設按鈕
                    this.resetButton.disabled = false;
                    this.resetButton.className = "border border-white bg-transparent text-white opacity-100 font-['Inter',_sans-serif] font-normal py-3 px-8 text-lg cursor-pointer button-animated mb-4";
                    this.resetButton.style.position = "relative";
                    this.resetButton.style.overflow = "hidden";
                } else if (this.resetButton) {
                    // 沒有日期被選擇，禁用重設按鈕
                    this.resetButton.disabled = true;
                    this.resetButton.className = "border border-white bg-transparent text-white opacity-30 font-['Inter',_sans-serif] font-normal py-3 px-8 text-lg cursor-not-allowed button-animated mb-4";
                    this.resetButton.style.position = "relative";
                    this.resetButton.style.overflow = "hidden";
                }
            }
            
            attachResetEvent() {
                if (this.resetButton) {
                    this.resetButton.addEventListener('click', () => {
                        if (!this.resetButton.disabled) {
                            // 先執行重設邏輯
                            this.startDate = null;
                            this.endDate = null;
                            this.updateDisplay();
                            this.render();
                            this.attachEvents();
                            this.updateButtonState();
                            
                            // 然後執行往下滑動畫
                            const buttonFill = this.resetButton.querySelector('.button-bg-fill');
                            if (buttonFill && window.gsap) {
                                gsap.to(buttonFill, {
                                    height: '0%',
                                    duration: 0.5,
                                    ease: "power2.out"
                                });
                                
                                // 同時讓文字顏色恢復
                                this.resetButton.classList.remove('white-text');
                            }
                        }
                    });
                }
            }
            
            isSameDay(date1, date2) {
                return date1.toDateString() === date2.toDateString();
            }
            
            // 檢查是否可以往前導航
            canNavigatePrevious() {
                // 不能早於起始月份
                const currentMonthIndex = this.currentYear * 12 + this.currentMonth;
                const baseMonthIndex = this.baseYear * 12 + this.baseMonth;
                return currentMonthIndex > baseMonthIndex;
            }
            
            // 檢查是否可以往後導航
            canNavigateNext() {
                // 最多只能看到起始月份+2個月（因為顯示兩個月，所以當前月份最多是起始月份+2）
                const currentMonthIndex = this.currentYear * 12 + this.currentMonth;
                const baseMonthIndex = this.baseYear * 12 + this.baseMonth;
                return currentMonthIndex < baseMonthIndex + 2; // 最多顯示到第4個月
            }
            
            // 更新導航按鈕狀態
            updateNavigationButtons() {
                const prevButton = this.container.querySelector('#prev-month');
                const nextButton = this.container.querySelector('#next-month');
                
                if (prevButton) {
                    if (this.canNavigatePrevious()) {
                        prevButton.disabled = false;
                        prevButton.style.opacity = '1';
                        prevButton.style.cursor = 'pointer';
                    } else {
                        prevButton.disabled = true;
                        prevButton.style.opacity = '0.3';
                        prevButton.style.cursor = 'not-allowed';
                    }
                }
                
                if (nextButton) {
                    if (this.canNavigateNext()) {
                        nextButton.disabled = false;
                        nextButton.style.opacity = '1';
                        nextButton.style.cursor = 'pointer';
                    } else {
                        nextButton.disabled = true;
                        nextButton.style.opacity = '0.3';
                        nextButton.style.cursor = 'not-allowed';
                    }
                }
            }
        }
        
        // 初始化日期選擇器
        new CustomDatePicker(datePickerContainer);
    }

    // 如果你的 script.js 也用於其他頁面，確保其他頁面的代碼不會因為找不到元素而出錯
    // 例如，處理 LOGIN 按鈕的邏輯等等...
});