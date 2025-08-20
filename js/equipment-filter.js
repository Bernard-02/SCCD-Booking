// 設備篩選器
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded'); // 調試用

    // 獲取所有篩選按鈕和設備卡片
    const filterButtons = document.querySelectorAll('.filter-button');
    const equipmentCards = document.querySelectorAll('.equipment-card');
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    
    // 桌面版狀態篩選按鈕
    const statusAvailableBtn = document.getElementById('status-available');
    const statusUnavailableBtn = document.getElementById('status-unavailable');
    
    // 當前選中的狀態（預設為有現貨）
    let currentSelectedStatus = '有現貨';

    console.log('Found equipment cards:', equipmentCards.length); // 調試用

    // 顯示已收藏的設備
    function showBookmarkedEquipment() {
        console.log('Showing bookmarked equipment'); // 調試用
        // 從 localStorage 獲取收藏列表，使用正確的鍵值
        const bookmarks = JSON.parse(localStorage.getItem('sccd_bookmarks') || '[]');
        console.log('Bookmarks from localStorage:', bookmarks); // 調試用

        equipmentCards.forEach(card => {
            // 獲取設備名稱
            const bookmarkBtn = card.querySelector('.bookmark-btn');
            if (bookmarkBtn) {
                const equipmentName = bookmarkBtn.dataset.equipment;
                const cardStatus = card.getAttribute('data-status');
                
                // 檢查設備是否在收藏列表中
                const isBookmarked = bookmarks.includes(equipmentName);
                // 檢查狀態是否匹配
                const statusMatch = cardStatus === currentSelectedStatus;
                
                console.log('Equipment:', equipmentName, 'Bookmarked:', isBookmarked, 'Status:', cardStatus, 'StatusMatch:', statusMatch); // 調試用
                card.style.display = (isBookmarked && statusMatch) ? 'flex' : 'none';
            } else {
                console.log('No bookmark button found for card'); // 調試用
                card.style.display = 'none';
            }
            card.classList.remove('animate-in');
        });

        // 重新計算行號並觸發動畫
        if (typeof window.recalculateRows === 'function') {
            window.recalculateRows();
        }
    }

    // 初始化時顯示常用設備並設置按鈕狀態
    const bookmarksButton = document.querySelector('[data-category="bookmarks"]');
    if (bookmarksButton) {
        console.log('Found bookmarks button'); // 調試用
        bookmarksButton.classList.add('filter-active', 'font-bold');
        bookmarksButton.classList.remove('font-normal');
    } else {
        console.log('Bookmarks button not found'); // 調試用
    }
    showBookmarkedEquipment();

    // 為每個篩選按鈕添加點擊事件
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            console.log('Filter button clicked:', this.dataset.category); // 調試用

            // 移除所有按鈕的 active 狀態
            filterButtons.forEach(btn => {
                btn.classList.remove('filter-active', 'font-bold');
                btn.classList.add('font-normal');
            });

            // 添加當前按鈕的 active 狀態
            this.classList.add('filter-active', 'font-bold');
            this.classList.remove('font-normal');

            const category = this.dataset.category;

            // 清空搜索框
            if (searchInput) searchInput.value = '';
            if (mobileSearchInput) mobileSearchInput.value = '';

            // 根據類別篩選
            if (category === 'bookmarks') {
                showBookmarkedEquipment();
            } else {
                filterByCategory(category);
            }
        });
    });

    // 搜索功能
    function setupSearch(input) {
        if (!input) return;

        let searchTimeout;
        input.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchText = this.value.toLowerCase().trim();
                
                // 如果搜索框為空，顯示當前選中類別的設備
                if (!searchText) {
                    const activeButton = document.querySelector('.filter-active');
                    if (activeButton) {
                        const category = activeButton.dataset.category;
                        if (category === 'bookmarks') {
                            showBookmarkedEquipment();
                        } else {
                            filterByCategory(category);
                        }
                    }
                    return;
                }

                // 搜索並排序結果
                const searchResults = Array.from(equipmentCards).map(card => {
                    const title = card.querySelector('.text-small-title').textContent.toLowerCase();
                    const exactMatch = title.includes(searchText);
                    const consecutiveMatch = title.includes(searchText);
                    const partialMatches = searchText.split('').filter(char => title.includes(char)).length;
                    
                    return {
                        card: card,
                        score: consecutiveMatch ? (searchText.length * 2) : partialMatches,
                        exactMatch: exactMatch
                    };
                }).sort((a, b) => b.score - a.score);

                // 顯示搜索結果
                equipmentCards.forEach(card => {
                    card.style.display = 'none';
                    card.classList.remove('animate-in');
                });

                searchResults.forEach(result => {
                    if (result.score > 0) {
                        result.card.style.display = 'flex';
                    }
                });

                // 重新計算行號並觸發動畫
                if (typeof window.recalculateRows === 'function') {
                    window.recalculateRows();
                }
            }, 300);
        });
    }

    // 設置桌面版和手機版搜索
    setupSearch(searchInput);
    setupSearch(mobileSearchInput);

    // 根據類別篩選設備
    function filterByCategory(category) {
        console.log('Filtering by category:', category, 'Status:', currentSelectedStatus); // 調試用
        equipmentCards.forEach(card => {
            const cardCategory = card.dataset.category;
            const cardStatus = card.getAttribute('data-status');
            
            const categoryMatch = cardCategory === category;
            const statusMatch = cardStatus === currentSelectedStatus;
            
            if (categoryMatch && statusMatch) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
            card.classList.remove('animate-in');
        });

        // 重新計算行號並觸發動畫
        if (typeof window.recalculateRows === 'function') {
            window.recalculateRows();
        }
    }

    // 桌面版狀態篩選按鈕事件處理
    if (statusAvailableBtn && statusUnavailableBtn) {
        // 設置初始狀態 - 有現貨為預設選中
        const availableWrapper = statusAvailableBtn.querySelector('.menu-item-wrapper');
        const unavailableWrapper = statusUnavailableBtn.querySelector('.menu-item-wrapper');
        
        if (availableWrapper && unavailableWrapper) {
            // 設置初始狀態：有現貨選中（active），已借出未選中但保持red-underline
            availableWrapper.classList.add('active');
            availableWrapper.classList.remove('red-underline');
            unavailableWrapper.classList.remove('active');
            unavailableWrapper.classList.add('red-underline');

            statusAvailableBtn.addEventListener('click', function() {
                console.log('Status filter clicked: 有現貨'); // 調試用
                currentSelectedStatus = '有現貨';
                
                // 更新按鈕狀態：有現貨選中，已借出未選中
                availableWrapper.classList.add('active');
                availableWrapper.classList.remove('red-underline');
                unavailableWrapper.classList.remove('active');
                unavailableWrapper.classList.add('red-underline');
                
                // 重新應用當前篩選
                applyCurrentFilter();
            });

            statusUnavailableBtn.addEventListener('click', function() {
                console.log('Status filter clicked: 已借出'); // 調試用
                currentSelectedStatus = '已借出';
                
                // 更新按鈕狀態：已借出選中且保持red-underline，有現貨未選中
                unavailableWrapper.classList.add('active');
                unavailableWrapper.classList.add('red-underline'); // 保持red-underline以顯示紅色
                availableWrapper.classList.remove('active');
                availableWrapper.classList.remove('red-underline');
                
                // 重新應用當前篩選
                applyCurrentFilter();
            });
        }
    }

    // 應用當前篩選
    function applyCurrentFilter() {
        const activeButton = document.querySelector('.filter-active');
        if (activeButton) {
            const category = activeButton.dataset.category;
            if (category === 'bookmarks') {
                showBookmarkedEquipment();
            } else {
                filterByCategory(category);
            }
        }
    }

    // 監聽收藏狀態變化
    window.addEventListener('bookmarkUpdated', function() {
        console.log('Bookmark updated'); // 調試用
        // 如果當前是在常用設備分類，則重新篩選
        const activeButton = document.querySelector('.filter-active');
        if (activeButton && activeButton.dataset.category === 'bookmarks') {
            showBookmarkedEquipment();
        }
    });

    // 監聽 localStorage 變化以同步收藏狀態
    window.addEventListener('storage', function(event) {
        if (event.key === 'sccd_bookmarks') {
            console.log('Bookmarks storage changed'); // 調試用
            // 如果當前是在常用設備分類，則重新篩選
            const activeButton = document.querySelector('.filter-active');
            if (activeButton && activeButton.dataset.category === 'bookmarks') {
                showBookmarkedEquipment();
            }
        }
    });
});