// 日曆生成器
class CalendarGenerator {
    constructor() {
        this.currentDate = new Date();
        this.startDate = null;
        this.endDate = null;
        this.today = new Date();
        this.today.setHours(0, 0, 0, 0);

        // 先檢查並清理過期的進度（優先使用進度管理器）
        if (window.rentalProgressManager) {
            window.rentalProgressManager.checkAndClearExpiredProgress();
        }

        // 檢查是否有暫存的日期
        const cachedDates = localStorage.getItem('tempSelectedDates');
        if (cachedDates) {
            try {
                const dates = JSON.parse(cachedDates);
                if (dates.startDate) this.startDate = new Date(dates.startDate);
                if (dates.endDate) this.endDate = new Date(dates.endDate);

                // 檢查日期是否過期
                this.checkAndClearExpiredDates();
            } catch (error) {
                console.error('無法解析暫存日期:', error);
                localStorage.removeItem('tempSelectedDates');
            }
        }

        this.init();
    }

    // 檢查並清理過期的日期選擇
    checkAndClearExpiredDates() {
        if (!this.startDate) return;

        // 使用租借進度管理器檢查是否過期
        if (window.rentalProgressManager && window.rentalProgressManager.isProgressExpired()) {
            // 過期時清空日期選擇
            this.clearDateSelection();
            return;
        }

        // 檢查選擇的日期範圍是否已經過期
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (this.startDate < today) {
            // 起租日已經過去，清空選擇
            this.clearDateSelection();
            if (window.rentalProgressManager) {
                window.rentalProgressManager.clearAllRelatedData();
            }
            return;
        }
    }

    // 清空日期選擇
    clearDateSelection() {
        this.startDate = null;
        this.endDate = null;
        localStorage.removeItem('tempSelectedDates');
        localStorage.removeItem('dateSelectionTime');
    }


    init() {
        this.generateCalendar();
        this.bindEvents();
        // 初始化顯示與按鈕狀態
        this.updateDisplay();
        this.updateButtonState();
    }

    // 生成日曆
    generateCalendar() {
        const calendars = document.querySelectorAll('.flex-1.min-w-0.flex.flex-col');
        
        if (calendars.length >= 1) {
            this.generateMonthCalendar(calendars[0], this.currentDate);
        }
        
        if (calendars.length >= 2) {
            const nextMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
            this.generateMonthCalendar(calendars[1], nextMonth);
        }
        
        // 更新導航按鈕狀態
        this.updateNavigationButtons();
    }

    // 生成單個月曆
    generateMonthCalendar(container, date) {
        const month = date.getMonth();
        const year = date.getFullYear();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // 修正：重新調整星期計算，使星期日(0)對齊第一格
        let firstDayOfWeek = firstDay.getDay(); // 0=星期日, 1=星期一, ..., 6=星期六
        
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDayOfWeek); // 減去天數讓星期日對齊第一格
        
        // 更新月份標題
        const monthTitle = container.querySelector('.text-white.text-\\[2rem\\].font-normal');
        if (monthTitle) {
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            monthTitle.textContent = `${year} ${monthNames[month]}`;
        }

        // 生成日期格子
        const gridContainer = container.querySelector('.grid.grid-cols-7.grid-rows-6');
        if (gridContainer) {
            gridContainer.innerHTML = '';
            
            // 添加星期標題 (星期日開始: S M T W T F S)
            const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
            weekdays.forEach(day => {
                const dayElement = document.createElement('div');
                dayElement.className = 'text-left text-white text-[3.5rem] font-semibold font-[\'Inter\',_sans-serif] tracking-tighter leading-none py-1 min-w-0';
                dayElement.textContent = day;
                gridContainer.appendChild(dayElement);
            });

            // 計算這個月需要多少格子
            const daysInMonth = lastDay.getDate();
            const totalNeededCells = firstDayOfWeek + daysInMonth;
            const rowsNeeded = Math.ceil(totalNeededCells / 7);
            
            // 總是生成42個格子（6行），但只在前面幾行顯示日期
            let currentDate = new Date(startDate);
            
            for (let i = 0; i < 42; i++) { // 總是6週 x 7天
                const dayElement = document.createElement('div');
                dayElement.className = 'text-left text-white text-[3.5rem] font-semibold font-[\'Inter\',_sans-serif] tracking-tighter leading-none py-1 min-w-0';
                
                // 檢查是否在前面需要顯示日期的行中
                const isInActiveRows = i < (rowsNeeded * 7);
                
                if (isInActiveRows) {
                    const dayNumber = currentDate.getDate();
                    const isCurrentMonth = currentDate.getMonth() === month;
                    
                    if (isCurrentMonth) {
                        // 當前月份的日期
                        const currentDateOnly = new Date(currentDate);
                        currentDateOnly.setHours(0, 0, 0, 0);
                        const isPastDate = currentDateOnly < this.today;
                        
                        // 檢查是否超過30天範圍（如果已選擇起租日）
                        let isOutOfRange = false;
                        if (this.startDate && !this.endDate) {
                            const daysDifference = Math.ceil((currentDateOnly - this.startDate) / (1000 * 60 * 60 * 24));
                            isOutOfRange = daysDifference > 30;
                        }
                        
                        if (isPastDate || isOutOfRange) {
                            // 過去的日期或超出範圍：灰色，不可點擊
                            dayElement.classList.add('text-gray-500');
                            dayElement.innerHTML = `
                                <div class="date-number-wrapper">
                                    <span class="date-number-text">${dayNumber}</span>
                                    <span class="date-number-hidden">${dayNumber}</span>
                                </div>
                            `;
                        } else {
                            // 今天及未來的日期：可點擊
                            dayElement.classList.add('cursor-pointer');
                            dayElement.innerHTML = `
                                <div class="date-number-wrapper">
                                    <span class="date-number-text">${dayNumber}</span>
                                    <span class="date-number-hidden">${dayNumber}</span>
                                </div>
                            `;
                            
                            // 添加日期數據
                            const year = currentDate.getFullYear();
                            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                            const day = String(currentDate.getDate()).padStart(2, '0');
                            dayElement.dataset.date = `${year}-${month}-${day}`;
                            
                            // 檢查是否為今天
                            if (currentDateOnly.getTime() === this.today.getTime()) {
                                dayElement.classList.add('today');
                            }
                            
                            // 檢查選擇狀態
                            if (this.startDate && this.endDate && this.isSameDay(this.startDate, this.endDate) && 
                                this.isSameDay(currentDateOnly, this.startDate)) {
                                // 起租日和歸還日是同一天
                                dayElement.classList.add('same-day-selected');
                            } else if (this.startDate && this.isSameDay(currentDateOnly, this.startDate)) {
                                dayElement.classList.add('start-date');
                                // 如果沒有歸還日，或者歸還日就是起租日，則添加 only-start 類
                                if (!this.endDate || this.isSameDay(this.startDate, this.endDate)) {
                                    dayElement.classList.add('only-start');
                                }
                            } else if (this.endDate && this.isSameDay(currentDateOnly, this.endDate)) {
                                dayElement.classList.add('end-date');
                            } else if (this.startDate && this.endDate && 
                                       currentDateOnly > this.startDate && currentDateOnly < this.endDate) {
                                dayElement.classList.add('in-range');
                            }
                        }
                    } else {
                        // 其他月份的日期：不顯示數字，不可點擊
                        // 保持空白
                    }
                    
                    currentDate.setDate(currentDate.getDate() + 1);
                } else {
                    // 第6行的空白格子，不需要任何內容
                }
                
                gridContainer.appendChild(dayElement);
            }
        }
    }

    // 綁定事件
    bindEvents() {
        document.addEventListener('click', (e) => {
            const dateElement = e.target.closest('.cursor-pointer');
            if (dateElement && !dateElement.classList.contains('text-gray-500')) {
                this.selectDate(dateElement);
            }
        });

        // 添加 hover 預覽效果
        document.addEventListener('mouseover', (e) => {
            const dateElement = e.target.closest('.cursor-pointer');
            if (dateElement && !dateElement.classList.contains('text-gray-500')) {
                if (this.startDate && !this.endDate) {
                    this.showHoverPreview(dateElement);
                } else if (this.startDate && this.endDate && this.isSameDay(this.startDate, this.endDate)) {
                    // 當起租日和歸還日是同一天時，hover到該日期顯示右半邊預覽
                    const selectedDate = dateElement.dataset.date;
                    if (selectedDate) {
                        const [year, month, day] = selectedDate.split('-').map(Number);
                        const hoverDate = new Date(year, month - 1, day);
                        hoverDate.setHours(0, 0, 0, 0);
                        
                        // 只有當hover到同一天時才顯示預覽
                        if (this.isSameDay(hoverDate, this.startDate)) {
                            this.showSameDayHoverPreview(dateElement);
                        }
                    }
                }
            }
        });

        document.addEventListener('mouseout', (e) => {
            const dateElement = e.target.closest('.cursor-pointer');
            if (dateElement) {
                this.hideHoverPreview();
                this.hideSameDayHoverPreview();
            }
        });

        // 重置按鈕
        const resetButtons = document.querySelectorAll('#reset-date-button, #mobile-reset-date-button');
        resetButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetSelection();
            });
        });

        // 確認按鈕
        const confirmButtons = document.querySelectorAll('#confirm-date-button, #mobile-confirm-date-button');
        confirmButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.confirmSelection();
            });
        });

        // 月份導航按鈕
        const prevButtons = document.querySelectorAll('.nav-arrow.prev');
        const nextButtons = document.querySelectorAll('.nav-arrow.next');
        
        prevButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (!button.disabled) {
                    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                    this.generateCalendar();
                }
            });
        });
        
        nextButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (!button.disabled) {
                    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                    this.generateCalendar();
                }
            });
        });
    }

    // 選擇日期
    selectDate(dateElement) {
        const selectedDate = dateElement.dataset.date;
        if (!selectedDate) return;

        // 解析日期
        const [year, month, day] = selectedDate.split('-').map(Number);
        const clickedDate = new Date(year, month - 1, day);
        clickedDate.setHours(0, 0, 0, 0);

        // 使用與原本相同的邏輯
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
                
                // 更新所有在範圍內的日期，添加實心綠色橫線
                const allDateElements = document.querySelectorAll('.cursor-pointer[data-date]');
                allDateElements.forEach(element => {
                    const elementDate = element.dataset.date;
                    if (elementDate) {
                        const [eYear, eMonth, eDay] = elementDate.split('-').map(Number);
                        const elementDateObj = new Date(eYear, eMonth - 1, eDay);
                        elementDateObj.setHours(0, 0, 0, 0);

                        // 如果是起租日且有歸還日（不是同一天），添加完整橫線
                        if (this.isSameDay(elementDateObj, this.startDate) && !this.isSameDay(this.startDate, this.endDate)) {
                            element.classList.add('complete-line');
                        }
                        // 如果是範圍內的日期，添加實心綠色橫線
                        else if (elementDateObj > this.startDate && elementDateObj < this.endDate) {
                            element.classList.add('in-range');
                        }
                    }
                });
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
        
        // 保存選擇的日期到暫存
        if (this.startDate || this.endDate) {
            localStorage.setItem('tempSelectedDates', JSON.stringify({
                startDate: this.startDate ? this.startDate.toISOString() : null,
                endDate: this.endDate ? this.endDate.toISOString() : null
            }));
            // 更新選擇時間戳
            localStorage.setItem('dateSelectionTime', Date.now().toString());
        } else {
            localStorage.removeItem('tempSelectedDates');
            localStorage.removeItem('dateSelectionTime');
        }
    }

    // 更新日期顯示
    updateDisplay() {
        const formatDate = (date) => {
            if (!date) return "----/--/--";
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}/${month}/${day}`;
        };
        
        const startDateElement = document.getElementById('display-start-date');
        const endDateElement = document.getElementById('display-end-date');
        
        if (startDateElement) {
            startDateElement.textContent = formatDate(this.startDate);
        }
        if (endDateElement) {
            endDateElement.textContent = formatDate(this.endDate);
        }
        
        // 同步更新手機版顯示
        const mobileStartDate = document.getElementById('mobile-display-start-date');
        const mobileEndDate = document.getElementById('mobile-display-end-date');
        if (mobileStartDate) {
            mobileStartDate.textContent = formatDate(this.startDate);
        }
        if (mobileEndDate) {
            mobileEndDate.textContent = formatDate(this.endDate);
        }
    }

    // 更新按鈕狀態
    updateButtonState() {
        const resetButtons = document.querySelectorAll('#reset-date-button, #mobile-reset-date-button');
        const confirmButtons = document.querySelectorAll('#confirm-date-button, #mobile-confirm-date-button');
        
        // 重設按鈕狀態
        resetButtons.forEach(button => {
            if (this.startDate) {
                button.disabled = false;
                button.classList.remove('opacity-30', 'cursor-not-allowed');
                button.classList.add('cursor-pointer', 'opacity-100');
            } else {
                button.disabled = true;
                button.classList.add('opacity-30', 'cursor-not-allowed');
                button.classList.remove('cursor-pointer', 'opacity-100');
            }
        });
        
        // 確定按鈕狀態
        confirmButtons.forEach(button => {
            if (this.startDate && this.endDate) {
                button.disabled = false;
                button.classList.remove('opacity-30', 'cursor-not-allowed');
                button.classList.add('cursor-pointer', 'opacity-100');
            } else {
                button.disabled = true;
                button.classList.add('opacity-30', 'cursor-not-allowed');
                button.classList.remove('cursor-pointer', 'opacity-100');
            }
        });
    }

    // 重置選擇
    resetSelection() {
        this.startDate = null;
        this.endDate = null;
        this.updateDisplay();
        this.generateCalendar(); // 重新生成日曆以移除30天限制
        this.updateButtonState();
        
        // 清除暫存的日期和時間戳
        localStorage.removeItem('tempSelectedDates');
        localStorage.removeItem('dateSelectionTime');
    }

    // 確認選擇
    confirmSelection() {
        if (this.startDate && this.endDate) {
            // 保存選擇的日期到 localStorage
            const rentalDateData = {
                startDate: this.startDate.toISOString(),
                endDate: this.endDate.toISOString()
            };
            localStorage.setItem('selectedRentalDates', JSON.stringify(rentalDateData));

            // 每次按OKAY時都重新開始24小時倒計時
            if (window.rentalProgressManager) {
                // 重新開始日期選擇流程（重設24小時計時器）
                window.rentalProgressManager.startDateSelection();
                // 然後立即完成日期選擇
                window.rentalProgressManager.completeDateSelection();
            }

            // 跳轉到下一頁
            window.location.href = 'bookingresources.html';
        } else {
            // 未選擇完整範圍時不做事（不要 alert）
        }
    }

    // 比較兩個日期是否相同
    isSameDay(date1, date2) {
        return date1.getTime() === date2.getTime();
    }

    // 顯示 hover 預覽效果
    showHoverPreview(hoverElement) {
        if (!this.startDate || this.endDate) return;

        const selectedDate = hoverElement.dataset.date;
        if (!selectedDate) return;

        const [year, month, day] = selectedDate.split('-').map(Number);
        const hoverDate = new Date(year, month - 1, day);
        hoverDate.setHours(0, 0, 0, 0);

        // 只有當 hover 日期大於等於起租日時才顯示預覽
        if (hoverDate < this.startDate) return;

        // 檢查是否超過30天範圍
        const daysDifference = Math.ceil((hoverDate - this.startDate) / (1000 * 60 * 60 * 24));
        if (daysDifference > 30) return;

        // 移除之前的預覽效果
        this.hideHoverPreview();

        // 添加預覽效果到範圍內的所有日期
        const allDateElements = document.querySelectorAll('.cursor-pointer[data-date]');
        allDateElements.forEach(element => {
            const elementDate = element.dataset.date;
            if (elementDate) {
                const [eYear, eMonth, eDay] = elementDate.split('-').map(Number);
                const elementDateObj = new Date(eYear, eMonth - 1, eDay);
                elementDateObj.setHours(0, 0, 0, 0);

                // 如果是起租日或者在起租日之後的日期，都添加預覽效果
                if (elementDateObj >= this.startDate && elementDateObj <= hoverDate) {
                    element.classList.add('hover-preview');
                }
            }
        });
    }

    // 隱藏 hover 預覽效果
    hideHoverPreview() {
        const previewElements = document.querySelectorAll('.hover-preview');
        previewElements.forEach(element => {
            element.classList.remove('hover-preview');
        });
    }

    // 顯示同一天的 hover 預覽效果
    showSameDayHoverPreview(hoverElement) {
        if (!this.startDate || !this.endDate || !this.isSameDay(this.startDate, this.endDate)) return;

        const selectedDate = hoverElement.dataset.date;
        if (!selectedDate) return;

        const [year, month, day] = selectedDate.split('-').map(Number);
        const hoverDate = new Date(year, month - 1, day);
        hoverDate.setHours(0, 0, 0, 0);

        // 只有當 hover 到同一天時才顯示預覽
        if (this.isSameDay(hoverDate, this.startDate)) {
            // 移除之前的預覽效果
            this.hideSameDayHoverPreview();
            
            // 添加同一天預覽效果
            hoverElement.classList.add('same-day-hover-preview');
        }
    }

    // 隱藏同一天的 hover 預覽效果
    hideSameDayHoverPreview() {
        const previewElements = document.querySelectorAll('.same-day-hover-preview');
        previewElements.forEach(element => {
            element.classList.remove('same-day-hover-preview');
        });
    }

    // 更新導航按鈕狀態
    updateNavigationButtons() {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        const prevButtons = document.querySelectorAll('.nav-arrow.prev');
        const nextButtons = document.querySelectorAll('.nav-arrow.next');
        
        // 檢查是否可以往前導航（不能早於當前月份前一個月）
        const canGoPrev = (this.currentDate.getFullYear() > currentYear) || 
                         (this.currentDate.getFullYear() === currentYear && this.currentDate.getMonth() > currentMonth - 1);
        
        // 檢查是否可以往後導航（第一個月不能超過當前月份+1）
        // 因為我們顯示兩個月，所以第一個月最多是當前月份+1，第二個月就是當前月份+2
        const canGoNext = (this.currentDate.getFullYear() < currentYear) || 
                         (this.currentDate.getFullYear() === currentYear && this.currentDate.getMonth() < currentMonth + 1);
        
        prevButtons.forEach(button => {
            if (canGoPrev) {
                button.disabled = false;
                button.classList.remove('opacity-30', 'cursor-not-allowed');
                button.classList.add('cursor-pointer', 'opacity-100');
            } else {
                button.disabled = true;
                button.classList.add('opacity-30', 'cursor-not-allowed');
                button.classList.remove('cursor-pointer', 'opacity-100');
            }
        });
        
        nextButtons.forEach(button => {
            if (canGoNext) {
                button.disabled = false;
                button.classList.remove('opacity-30', 'cursor-not-allowed');
                button.classList.add('cursor-pointer', 'opacity-100');
            } else {
                button.disabled = true;
                button.classList.add('opacity-30', 'cursor-not-allowed');
                button.classList.remove('cursor-pointer', 'opacity-100');
            }
        });
    }
}

// 初始化日曆
document.addEventListener('DOMContentLoaded', function() {
    new CalendarGenerator();
});
