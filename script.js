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
                this.today = new Date();
                
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
            }
            
            render() {
                const currentMonth = new Date(this.currentYear, this.currentMonth);
                const nextMonth = new Date(this.currentYear, this.currentMonth + 1);
                
                this.container.innerHTML = `
                    <div class="custom-datepicker">
                        <div class="datepicker-header">
                            <button class="nav-arrow" id="prev-month">‹</button>
                            <div class="month-navigation">
                                <div class="month-title">${this.monthNames[currentMonth.getMonth()]}</div>
                                <div class="month-title">${this.monthNames[nextMonth.getMonth()]}</div>
                            </div>
                            <button class="nav-arrow" id="next-month">›</button>
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
                const startDate = new Date(firstDay);
                startDate.setDate(startDate.getDate() - firstDay.getDay());
                
                const days = [];
                const current = new Date(startDate);
                
                // 生成5週的日期（而非6週）
                for (let week = 0; week < 5; week++) {
                    for (let day = 0; day < 7; day++) {
                        const dayDate = new Date(current);
                        const isCurrentMonth = dayDate.getMonth() === month;
                        const isToday = this.isSameDay(dayDate, this.today);
                        const isPast = dayDate < this.today && !this.isSameDay(dayDate, this.today);
                        
                        // 檢查是否超過30天範圍（如果已選擇起租日）
                        let isOutOfRange = false;
                        if (this.startDate && !this.endDate) {
                            const daysDifference = Math.ceil((dayDate - this.startDate) / (1000 * 60 * 60 * 24));
                            isOutOfRange = daysDifference > 30;
                        }
                        
                        let classes = ['day'];
                        if (!isCurrentMonth) classes.push('other-month');
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
                                ${dayDate.getDate()}
                            </div>
                        `);
                        
                        current.setDate(current.getDate() + 1);
                    }
                }
                
                return `<div class="days-grid">${days.join('')}</div>`;
            }
            
            attachEvents() {
                // 導航按鈕事件
                this.container.querySelector('#prev-month').addEventListener('click', () => {
                    this.currentMonth--;
                    if (this.currentMonth < 0) {
                        this.currentMonth = 11;
                        this.currentYear--;
                    }
                    this.render();
                    this.attachEvents();
                });
                
                this.container.querySelector('#next-month').addEventListener('click', () => {
                    this.currentMonth++;
                    if (this.currentMonth > 11) {
                        this.currentMonth = 0;
                        this.currentYear++;
                    }
                    this.render();
                    this.attachEvents();
                });
                
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
            }
            
            isSameDay(date1, date2) {
                return date1.toDateString() === date2.toDateString();
            }
        }
        
        // 初始化日期選擇器
        new CustomDatePicker(datePickerContainer);
    }

    // 如果你的 script.js 也用於其他頁面，確保其他頁面的代碼不會因為找不到元素而出錯
    // 例如，處理 LOGIN 按鈕的邏輯等等...
});