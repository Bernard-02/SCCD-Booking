// 設備篩選器
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded'); // 調試用

    // 獲取所有篩選按鈕和設備卡片
    const filterButtons = document.querySelectorAll('.sccd-filter-item');
    const equipmentCards = document.querySelectorAll('.equipment-card');
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');

    // 桌面版狀態篩選按鈕
    const statusAvailableBtn = document.getElementById('status-available');
    const statusUnavailableBtn = document.getElementById('status-unavailable');

    // 當前選中的狀態（預設為有現貨）
    let currentSelectedStatus = '有現貨';

    // 保存當前選中的篩選器類別（用於恢復）
    let savedCategory = null;

    console.log('Found equipment cards:', equipmentCards.length); // 調試用

    // 顯示已收藏的設備 - 使用改進的三步驟動畫方法
    function showBookmarkedEquipment() {
        console.log('Showing bookmarked equipment'); // 調試用

        // 檢查登入狀態 - 只有常用設備分類需要檢查
        const isLoggedIn = window.AuthStorage && window.AuthStorage.isLoggedIn();
        if (!isLoggedIn) {
            showLoginPrompt();
            return;
        }

        // 從統一收藏管理器獲取設備收藏列表
        let bookmarks = [];
        if (window.unifiedBookmarkManager) {
            bookmarks = window.unifiedBookmarkManager.getEquipmentBookmarks();
        } else {
            console.warn('統一收藏管理器未初始化');
        }
        console.log('Bookmarks from localStorage:', bookmarks); // 調試用

        // 清除任何現有的提示
        const equipmentGrid = document.getElementById('equipment-grid');
        const existingPrompts = equipmentGrid.querySelectorAll('.login-prompt');
        existingPrompts.forEach(prompt => prompt.remove());

        // 第一步：立即移除所有卡片的布局影響，避免任何視覺跳躍
        equipmentCards.forEach(card => {
            card.classList.remove('animate-in');
            card.style.display = 'none';  // 立即移除布局影響
            card.style.opacity = '';  // 清除透明度
            card.style.transform = '';
        });

        // 第二步：短暫延遲後重新顯示符合條件的卡片（仍然透明，等待動畫）
        setTimeout(() => {
            let hasVisibleCards = false;

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

                    if (isBookmarked && statusMatch) {
                        card.style.display = 'flex';
                        card.style.opacity = '0';  // 顯示但透明，準備動畫
                        hasVisibleCards = true;
                    }
                } else {
                    console.log('No bookmark button found for card'); // 調試用
                }
            });

            // 如果沒有可見的收藏卡片，顯示空提示
            if (!hasVisibleCards) {
                showEmptyBookmarksPrompt();
            }

            // 第三步：等待布局完全穩定後觸發進場動畫
            setTimeout(() => {
                // 清除透明度，讓動畫系統接管
                equipmentCards.forEach(card => {
                    if (card.style.display === 'flex') {
                        card.style.opacity = '';  // 讓CSS動畫控制
                    }
                });

                // 重新計算行號並觸發動畫
                if (typeof window.recalculateRows === 'function') {
                    window.recalculateRows();
                }
            }, 150);  // 增加延遲確保布局完全穩定
        }, 50);  // 減少初始延遲
    }

    // 個別移除收藏卡片（帶動畫效果）
    function removeBookmarkedCard(equipmentName) {
        console.log('Removing bookmarked card:', equipmentName);

        // 找到對應的設備卡片
        let targetCard = null;
        equipmentCards.forEach(card => {
            const bookmarkBtn = card.querySelector('.bookmark-btn');
            if (bookmarkBtn && bookmarkBtn.dataset.equipment === equipmentName) {
                targetCard = card;
            }
        });

        if (targetCard && targetCard.style.display === 'flex') {
            // 添加淡出動畫類（使用rental-list的樣式）
            targetCard.classList.add('fade-out');

            // 等待動畫完成後隱藏卡片
            setTimeout(() => {
                targetCard.style.display = 'none';
                targetCard.classList.remove('fade-out');

                // 檢查是否還有其他可見的收藏卡片
                checkIfBookmarksEmpty();

                // 重新計算布局和動畫
                if (typeof window.recalculateRows === 'function') {
                    setTimeout(() => {
                        window.recalculateRows();
                    }, 50);
                }
            }, 500); // 等待0.5秒動畫完成
        }
    }

    // 檢查收藏是否為空，並顯示提示
    function checkIfBookmarksEmpty() {
        const activeWrapper = document.querySelector('.menu-item-wrapper.active');
        if (!activeWrapper) {
            return;
        }
        const activeButton = activeWrapper.closest('.sccd-filter-item');
        if (!activeButton || activeButton.dataset.category !== 'bookmarks') {
            return; // 不在常用設備分類
        }

        // 檢查是否有可見的設備卡片
        const visibleCards = Array.from(equipmentCards).filter(card =>
            card.style.display === 'flex'
        );

        if (visibleCards.length === 0) {
            // 沒有可見卡片，顯示空狀態提示
            showEmptyBookmarksPrompt();
        }
    }

    // 顯示空收藏提示（樣式和未登入提醒相同）
    function showEmptyBookmarksPrompt() {
        const equipmentGrid = document.getElementById('equipment-grid');
        const existingPrompt = equipmentGrid.querySelector('.login-prompt');

        // 如果已經有提示，就不重複創建
        if (existingPrompt) {
            return;
        }

        const promptDiv = document.createElement('div');
        promptDiv.className = 'login-prompt empty-state-message col-span-4 text-left';
        promptDiv.innerHTML = `
            <p class="font-chinese text-gray-scale4 text-small-title">目前沒有任何收藏的設備，請先收藏設備</p>
        `;

        equipmentGrid.appendChild(promptDiv);
    }

    // 初始化常用設備按鈕狀態和篩選 - 延遲執行以等待設備數據載入
    function initializeBookmarksFilter() {
        const bookmarksButton = document.querySelector('[data-category="bookmarks"]');
        if (bookmarksButton) {
            console.log('Found bookmarks button'); // 調試用
            const wrapper = bookmarksButton.querySelector('.menu-item-wrapper');
            if (wrapper) {
                wrapper.classList.add('active');
            }
            // 保存初始選中的類別
            savedCategory = 'bookmarks';
            showBookmarkedEquipment();
        } else {
            console.log('Bookmarks button not found'); // 調試用
        }
    }

    // 檢查設備數據是否已準備好，如果還沒準備好則等待
    if (window.equipmentDataReady) {
        initializeBookmarksFilter();
    } else {
        // 等待設備數據準備完成
        const checkDataReady = () => {
            if (window.equipmentDataReady) {
                initializeBookmarksFilter();
            } else {
                setTimeout(checkDataReady, 100);
            }
        };
        checkDataReady();
    }

    // 為每個篩選按鈕添加點擊事件
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            console.log('Filter button clicked:', this.dataset.category); // 調試用

            // 移除所有按鈕的 active 狀態
            filterButtons.forEach(btn => {
                const wrapper = btn.querySelector('.menu-item-wrapper');
                if (wrapper) {
                    wrapper.classList.remove('active');
                }
            });

            // 添加當前按鈕的 active 狀態
            const currentWrapper = this.querySelector('.menu-item-wrapper');
            if (currentWrapper) {
                currentWrapper.classList.add('active');
            }

            const category = this.dataset.category;

            // 更新保存的類別（用於搜尋後恢復）
            savedCategory = category;

            // 清空搜索框並恢復 label 顯示
            if (searchInput) {
                searchInput.value = '';
                const searchLabel = document.getElementById('searchLabel');
                if (searchLabel) {
                    searchLabel.style.display = 'block';
                    searchLabel.style.color = '#ffffff';
                    searchLabel.style.transform = 'translateX(0)';
                }
            }
            if (mobileSearchInput) {
                mobileSearchInput.value = '';
                const mobileSearchLabel = document.getElementById('mobileSearchLabel');
                if (mobileSearchLabel) {
                    mobileSearchLabel.style.display = 'block';
                    mobileSearchLabel.style.color = '#ffffff';
                    mobileSearchLabel.style.transform = 'translateX(0)';
                }
            }

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

        // 恢復到原本選項的函數
        function restoreOriginalFilter() {
            if (savedCategory) {
                // 先移除所有按鈕的 active 狀態
                filterButtons.forEach(btn => {
                    const wrapper = btn.querySelector('.menu-item-wrapper');
                    if (wrapper) {
                        wrapper.classList.remove('active');
                    }
                });

                // 根據保存的類別重新找到按鈕並添加 active 狀態
                const savedButton = Array.from(filterButtons).find(btn => btn.dataset.category === savedCategory);
                if (savedButton) {
                    const wrapper = savedButton.querySelector('.menu-item-wrapper');
                    if (wrapper) {
                        wrapper.classList.add('active');
                    }
                }

                // 恢復篩選
                if (savedCategory === 'bookmarks') {
                    showBookmarkedEquipment();
                } else {
                    filterByCategory(savedCategory);
                }
            }
        }

        // 監聽輸入事件
        input.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchText = this.value.toLowerCase().trim();

                // 如果搜索框為空，恢復到原本的選項
                if (!searchText) {
                    restoreOriginalFilter();
                    return;
                }

                // 搜尋時，保存當前選中的類別並取消所有篩選器的橫線
                const activeWrapper = document.querySelector('.menu-item-wrapper.active');
                if (activeWrapper) {
                    const activeButton = activeWrapper.closest('.sccd-filter-item');
                    if (activeButton) {
                        savedCategory = activeButton.dataset.category;
                    }
                    activeWrapper.classList.remove('active');
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

                // 顯示搜索結果 - 使用改進的三步驟動畫方法
                // 第一步：立即移除所有卡片的布局影響
                equipmentCards.forEach(card => {
                    card.classList.remove('animate-in');
                    card.style.display = 'none';
                    card.style.opacity = '';
                    card.style.transform = '';
                });

                // 第二步：短暫延遲後重新顯示符合條件的卡片（仍然透明，等待動畫）
                setTimeout(() => {
                    searchResults.forEach(result => {
                        if (result.score > 0) {
                            result.card.style.display = 'flex';
                            result.card.style.opacity = '0';  // 顯示但透明，準備動畫
                        }
                    });

                    // 第三步：等待布局完全穩定後觸發進場動畫
                    setTimeout(() => {
                        // 清除透明度，讓動畫系統接管
                        searchResults.forEach(result => {
                            if (result.score > 0 && result.card.style.display === 'flex') {
                                result.card.style.opacity = '';  // 讓CSS動畫控制
                            }
                        });

                        // 重新計算行號並觸發動畫
                        if (typeof window.recalculateRows === 'function') {
                            window.recalculateRows();
                        }
                    }, 150);
                }, 50);
            }, 300);
        });

        // 監聽離開搜尋欄事件（blur）
        input.addEventListener('blur', function() {
            // 短暫延遲檢查，避免點擊篩選器時的衝突
            setTimeout(() => {
                const searchText = this.value.toLowerCase().trim();
                // 只要搜尋欄為空且離開，就恢復原本選項
                if (!searchText) {
                    restoreOriginalFilter();
                }
            }, 100);
        });
    }

    // 設置桌面版和手機版搜索
    setupSearch(searchInput);
    setupSearch(mobileSearchInput);

    // 根據類別篩選設備 - 使用改進的三步驟動畫方法
    function filterByCategory(category) {
        console.log('Filtering by category:', category, 'Status:', currentSelectedStatus); // 調試用

        // 清除登入提示（如果存在）
        const existingPrompt = document.querySelector('.login-prompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }

        // 第一步：立即移除所有卡片的布局影響，避免任何視覺跳躍
        equipmentCards.forEach(card => {
            card.classList.remove('animate-in');
            card.style.display = 'none';  // 立即移除布局影響
            card.style.opacity = '';  // 清除透明度
            card.style.transform = '';
        });

        // 第二步：短暫延遲後重新顯示符合條件的卡片（仍然透明，等待動畫）
        setTimeout(() => {
            equipmentCards.forEach(card => {
                const cardCategory = card.dataset.category;
                const cardStatus = card.getAttribute('data-status');

                const categoryMatch = cardCategory === category;
                const statusMatch = cardStatus === currentSelectedStatus;

                if (categoryMatch && statusMatch) {
                    card.style.display = 'flex';
                    card.style.opacity = '0';  // 顯示但透明，準備動畫
                }
            });

            // 第三步：等待布局完全穩定後觸發進場動畫
            setTimeout(() => {
                // 清除透明度，讓動畫系統接管
                equipmentCards.forEach(card => {
                    if (card.style.display === 'flex') {
                        card.style.opacity = '';  // 讓CSS動畫控制
                    }
                });

                // 重新計算行號並觸發動畫
                if (typeof window.recalculateRows === 'function') {
                    window.recalculateRows();
                }
            }, 150);  // 增加延遲確保布局完全穩定
        }, 50);  // 減少初始延遲
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

    // 顯示登入提示
    function showLoginPrompt() {
        // 檢查是否已有登入提示，如果有則移除
        const existingPrompt = document.querySelector('.login-prompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }

        // 隱藏所有設備卡片
        equipmentCards.forEach(card => {
            card.classList.remove('animate-in');
            card.style.display = 'none';
            card.style.opacity = '';
            card.style.transform = '';
        });

        // 創建登入提示元素，使用與profile.html收藏頁面相同的樣式
        const promptDiv = document.createElement('div');
        promptDiv.className = 'login-prompt empty-state-message col-span-4 text-left';
        promptDiv.innerHTML = `
            <p class="font-chinese text-gray-scale4 text-small-title">請先登入以查看收藏的設備</p>
        `;

        // 將提示插入到設備網格中
        const equipmentGrid = document.getElementById('equipment-grid');
        if (equipmentGrid) {
            equipmentGrid.appendChild(promptDiv);
        }
    }

    // 應用當前篩選
    function applyCurrentFilter() {
        // 清除可能存在的登入提示
        const existingPrompt = document.querySelector('.login-prompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }

        const activeWrapper = document.querySelector('.menu-item-wrapper.active');
        const activeButton = activeWrapper ? activeWrapper.closest('.sccd-filter-item') : null;
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
    window.addEventListener('bookmarkUpdated', function(event) {
        console.log('Bookmark updated'); // 調試用
        // 如果當前是在常用設備分類，處理收藏變化
        const activeWrapper = document.querySelector('.menu-item-wrapper.active');
        const activeButton = activeWrapper ? activeWrapper.closest('.sccd-filter-item') : null;
        if (activeButton && activeButton.dataset.category === 'bookmarks') {
            // 檢查是否為移除操作
            if (event.detail && event.detail.action === 'remove') {
                // 使用動畫移除個別卡片
                removeBookmarkedCard(event.detail.itemName);
            } else {
                // 添加操作或初始化，重新篩選整個分類
                showBookmarkedEquipment();
            }
        }
    });

    // 監聽收藏狀態變化 - 支持全域 BookmarkManager
    window.addEventListener('storage', function(event) {
        if (event.key === 'sccd_bookmarks' || event.key?.startsWith('sccd_bookmarks_')) {
            console.log('Bookmarks storage changed'); // 調試用
            // 如果當前是在常用設備分類，則重新篩選
            const activeWrapper = document.querySelector('.menu-item-wrapper.active');
        const activeButton = activeWrapper ? activeWrapper.closest('.sccd-filter-item') : null;
            if (activeButton && activeButton.dataset.category === 'bookmarks') {
                showBookmarkedEquipment();
            }
        }
    });

    // 監聽全域 BookmarkManager 的事件
    window.addEventListener('bookmarkUpdated', function(event) {
        console.log('Bookmark updated via BookmarkManager'); // 調試用
        // 如果當前是在常用設備分類，處理收藏變化
        const activeWrapper = document.querySelector('.menu-item-wrapper.active');
        const activeButton = activeWrapper ? activeWrapper.closest('.sccd-filter-item') : null;
        if (activeButton && activeButton.dataset.category === 'bookmarks') {
            // 檢查是否為移除操作
            if (event.detail && event.detail.action === 'remove') {
                // 使用動畫移除個別卡片
                removeBookmarkedCard(event.detail.itemName);
            } else {
                // 添加操作或初始化，重新篩選整個分類
                showBookmarkedEquipment();
            }
        }
    });
});