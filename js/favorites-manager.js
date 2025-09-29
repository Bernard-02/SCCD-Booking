// 收藏管理器 - 負責處理收藏頁面的所有邏輯

// 常量定義 - 避免硬編碼
const ANIMATION_CONFIG = {
  ROW_DELAY: 300,
  CARD_DELAY: 150,
  BASE_DELAY: 200,
  ANIMATION_DURATION: 600,
  LAYOUT_SETTLE_DELAY: 150,
  INITIAL_DELAY: 50
};

const GRID_CONFIG = {
  EQUIPMENT_CARDS_PER_ROW: 5,
  CLASSROOM_CARDS_PER_ROW: 3
};

class FavoritesManager {
  constructor() {
    this.currentFilter = 'all';
    this.currentSearchTerm = '';
    this.isSelectionMode = false;
    this.selectedItems = new Set();
    this.pendingRemovals = new Map(); // 用於UNDO功能
  }

  // 生成收藏頁面HTML內容
  getFavoritesContent() {
    const favoriteEquipment = this.getFavoriteEquipmentData();
    const favoriteClassrooms = this.getFavoriteClassroomData();

    return `
      <div class="space-y-8">
        <div class="flex justify-between items-center">
          <h2 class="font-chinese text-white text-medium-title">收藏</h2>
          <div id="favorites-header-actions" class="flex items-center gap-4">
            <!-- 取消按鈕（選擇模式時顯示） -->
            <button id="cancel-selection-btn" class="page-button" style="display: none;">
              <div class="menu-item-wrapper">
                <span class="menu-text">(CANCEL)</span>
                <span class="menu-text-hidden">(CANCEL)</span>
              </div>
            </button>
          </div>
        </div>

        <!-- 設備區域 -->
        <div class="pb-8">
          <h3 class="font-chinese text-white text-content mb-6">設備</h3>

          <!-- 篩選器和搜索區域 -->
          <div class="flex justify-between items-center mb-8 equipment-filter-fade-in">
            <!-- 左側：篩選分類 -->
            <div class="sccd-filter-group gap-6">
              ${this.generateFilterButtons()}
            </div>

            <!-- 右側：搜尋 -->
            <div class="flex items-center gap-6">
              <div class="flex flex-col relative">
                <div class="relative">
                  <input type="text" id="favoritesSearchInput" class="bg-transparent border-b border-white text-white placeholder-transparent focus:outline-none focus:border-gray-300 pb-1 pl-0 transition-all duration-200" placeholder="" autocomplete="off" />
                  <span id="favoritesSearchLabel" class="absolute left-0 top-0 text-base font-['Inter',_sans-serif] font-medium uppercase tracking-wide pointer-events-none transition-all duration-200">SEARCH</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 設備卡片網格 -->
          <div class="grid grid-cols-5 gap-x-4 gap-y-12 mb-8" id="favorites-equipment-grid">
            <!-- 空狀態訊息 - 只有在沒有設備時才顯示 -->
            <div class="empty-state-message col-span-5 text-left" id="equipment-empty-message" style="display: ${favoriteEquipment.length === 0 ? 'block' : 'none'};">
              <p class="font-chinese text-gray-scale4 text-small-title">此分類目前還未有任何收藏</p>
            </div>

            ${favoriteEquipment.map((equipment, index) => this.generateEquipmentCard(equipment, index)).join('')}
          </div>
        </div>

        <!-- 教室區域 -->
        <div class="pb-24">
          <h3 class="font-chinese text-white text-content mb-6">教室</h3>

          <!-- 教室卡片網格 -->
          <div class="grid grid-cols-3 gap-x-6 gap-y-12 w-3/5" id="favorites-classroom-grid" style="min-height: 300px;">
            <!-- 空狀態訊息 -->
            <div class="empty-state-message col-span-3 text-left" id="classroom-empty-message" style="display: ${favoriteClassrooms.length === 0 ? 'block' : 'none'};">
              <p class="font-chinese text-gray-scale4 text-small-title">此分類目前還未有任何收藏</p>
            </div>

            ${favoriteClassrooms.map((classroom, index) => this.generateClassroomCard(classroom, index)).join('')}
          </div>
        </div>

        <!-- 底部操作欄（選擇模式時顯示） -->
        <div id="favorites-action-bar" class="fixed bottom-0 left-0 right-0 bg-black py-4 flex justify-end" style="display: flex; z-index: 50; padding-left: calc(1.5rem + 1.5rem); padding-right: calc(1.5rem + 1.5rem);">
          <button id="select-mode-btn" class="page-button" style="cursor: pointer;">
            <div class="menu-item-wrapper">
              <span class="menu-text">(SELECT)</span>
              <span class="menu-text-hidden">(SELECT)</span>
            </div>
          </button>
        </div>
      </div>
    `;
  }

  // 生成篩選按鈕HTML
  generateFilterButtons() {
    const categories = ['all', '線材', '工具', '延長線', '視聽類', '燈具', '畫板/展桌/展台', '機具'];

    return categories.map(category => {
      const isActive = category === 'all';
      const activeClass = isActive ? 'active' : '';
      const displayText = category === 'all' ? '全部' : category;

      return `
        <button class="text-small-title text-white cursor-pointer sccd-filter-item" data-category="${category}">
          <div class="menu-item-wrapper ${activeClass}">
            <span class="menu-text text-small-title">${displayText}</span>
            <span class="menu-text-hidden text-small-title">${displayText}</span>
          </div>
        </button>
      `;
    }).join('');
  }

  // 生成設備卡片HTML
  generateEquipmentCard(equipment, index) {
    return `
      <div class="flex flex-col equipment-card favorites-equipment-card selectable-card"
           data-row="${Math.floor(index / GRID_CONFIG.EQUIPMENT_CARDS_PER_ROW) + 1}"
           data-category="${equipment.category}"
           data-name="${equipment.name}"
           data-type="equipment">
        <!-- 設備圖片容器 -->
        <div class="relative overflow-hidden aspect-[4/5]">
          <!-- 選擇模式的選擇框（左上角） -->
          <div class="selection-checkbox absolute top-2 left-2 w-5 h-5 rounded-full bg-transparent cursor-pointer z-10" style="display: none; border: 1px solid white;">
            <div class="selection-fill rounded-full bg-white" style="display: none; width: calc(100% - 4px); height: calc(100% - 4px); margin: 2px;"></div>
          </div>

          <!-- 背景圖片 -->
          <div class="absolute inset-0">
            <img
              src="${equipment.image}"
              alt="${equipment.name}"
              class="w-full h-full object-cover object-center"
            />
          </div>

          <!-- 頂部黑色到透明漸層 -->
          <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent"></div>
        </div>

        <!-- 底部產品資訊 -->
        <div class="flex justify-between items-start mt-4">
          <div class="flex-1">
            <div class="text-breadcrumb font-['Inter',_sans-serif] font-normal tracking-wide" style="color: #cccccc">
              ${equipment.category}
            </div>
            <div class="text-small-title font-['Inter',_sans-serif] font-medium text-white tracking-wide mt-1 pr-4">
              ${equipment.name}
            </div>
          </div>
          <div class="ml-2">
            <img
              src="Icons/Bookmark Sharp Fill.svg"
              alt="Remove from favorites"
              class="w-4 h-4 cursor-pointer hover:opacity-70 transition-opacity remove-favorite-btn bookmark-icon"
              data-type="equipment"
              data-equipment="${equipment.name}"
            />
          </div>
        </div>
      </div>
    `;
  }

  // 生成教室卡片HTML
  generateClassroomCard(classroom, index) {
    return `
      <div class="flex flex-col equipment-card favorites-classroom-card selectable-card"
           data-row="${Math.floor(index / GRID_CONFIG.CLASSROOM_CARDS_PER_ROW) + 1}"
           data-classroom="${classroom.name}"
           data-type="classroom">
        <!-- 教室圖片容器 -->
        <div class="relative overflow-hidden aspect-[4/5]">
          <!-- 選擇模式的選擇框（左上角） -->
          <div class="selection-checkbox absolute top-2 left-2 w-5 h-5 rounded-full bg-transparent cursor-pointer z-10" style="display: none; border: 1px solid white;">
            <div class="selection-fill rounded-full bg-white" style="display: none; width: calc(100% - 4px); height: calc(100% - 4px); margin: 2px;"></div>
          </div>

          <!-- 背景圖片 -->
          <div class="absolute inset-0">
            <img
              src="${classroom.image}"
              alt="${classroom.name}"
              class="w-full h-full object-cover object-center"
            />
          </div>

          <!-- 頂部黑色到透明漸層 -->
          <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent"></div>
        </div>

        <!-- 底部教室資訊 -->
        <div class="flex justify-between items-start mt-4">
          <div class="flex-1">
            <div class="text-small-title font-['Inter',_sans-serif] font-medium text-white tracking-wide">
              ${classroom.name}教室
            </div>
          </div>
          <div class="ml-2">
            <img
              src="Icons/Bookmark Sharp Fill.svg"
              alt="Remove from favorites"
              class="w-4 h-4 cursor-pointer hover:opacity-70 transition-opacity remove-favorite-btn bookmark-icon"
              data-type="classroom"
              data-classroom="${classroom.name}"
            />
          </div>
        </div>
      </div>
    `;
  }

  // 設置收藏頁面事件監聽器
  setupEventListeners() {
    this.setupFilterButtons();
    this.setupSearchInput();
    this.setupRemoveFavoriteButtons();
    this.setupSelectionMode();
    this.setupCardSelection();

    // 初始化時執行"全部"分類篩選，確保所有卡片都顯示
    this.filterFavoriteEquipment('all');

    // 每次切換到收藏頁面都觸發進場動畫（與分類篩選一致）
    this.triggerInitialAnimation();
  }

  // 設置篩選按鈕事件
  setupFilterButtons() {
    const filterButtons = document.querySelectorAll('#content-area .sccd-filter-item');
    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.updateFilterButtonStates(filterButtons, button);
        const category = button.dataset.category;
        this.currentFilter = category;
        this.filterFavoriteEquipment(category);
      });
    });
  }

  // 更新篩選按鈕狀態 - 簡化重複邏輯
  updateFilterButtonStates(buttons, activeButton) {
    // 移除所有按鈕的 active 狀態
    buttons.forEach(btn => {
      const wrapper = btn.querySelector('.menu-item-wrapper');
      if (wrapper) {
        wrapper.classList.remove('active');
      }
    });

    // 添加當前按鈕的 active 狀態
    const currentWrapper = activeButton.querySelector('.menu-item-wrapper');
    if (currentWrapper) {
      currentWrapper.classList.add('active');
    }
  }

  // 設置搜索輸入框事件
  setupSearchInput() {
    const searchInput = document.getElementById('favoritesSearchInput');
    const searchLabel = document.getElementById('favoritesSearchLabel');

    if (!searchInput || !searchLabel) return;

    searchInput.addEventListener('input', (e) => {
      this.currentSearchTerm = e.target.value;
      this.searchFavoriteEquipment(e.target.value);
    });

    // 搜索欄位焦點事件 - 提取成可重用的函數
    this.setupSearchFieldEffects(searchInput, searchLabel);
  }

  // 搜索欄位特效 - 可重用的函數
  setupSearchFieldEffects(input, label) {
    const showCursor = () => {
      label.style.color = '#d4d4d8';
      label.style.transform = 'translateX(8px)';
    };

    const hideCursor = () => {
      if (input.value === '') {
        label.style.color = '#ffffff';
        label.style.transform = 'translateX(0)';
      }
    };

    const toggleLabel = () => {
      label.style.opacity = input.value !== '' ? '0' : '1';
    };

    input.addEventListener('mouseenter', showCursor);
    input.addEventListener('focus', showCursor);
    input.addEventListener('mouseleave', hideCursor);
    input.addEventListener('blur', hideCursor);
    input.addEventListener('input', toggleLabel);
  }

  // 設置移除收藏按鈕事件
  setupRemoveFavoriteButtons() {
    const removeFavoriteBtns = document.querySelectorAll('.remove-favorite-btn');
    removeFavoriteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const itemName = btn.dataset.equipment || btn.dataset.classroom;
        this.removeFavorite(type, itemName);
      });
    });
  }

  // 篩選收藏設備 - 簡化邏輯
  filterFavoriteEquipment(category) {
    const equipmentCards = document.querySelectorAll('.favorites-equipment-card');

    this.hideAllCards(equipmentCards);

    setTimeout(() => {
      const visibleCount = this.showFilteredCards(equipmentCards, category);
      this.updateEmptyState('equipment', visibleCount);

      setTimeout(() => {
        this.resetCardStyles(equipmentCards);
        // 篩選時觸發動畫（用戶主動切換篩選選項）
        this.recalculateRowsAndAnimate('equipment');
      }, ANIMATION_CONFIG.LAYOUT_SETTLE_DELAY);
    }, ANIMATION_CONFIG.INITIAL_DELAY);
  }

  // 搜索收藏設備 - 簡化邏輯
  searchFavoriteEquipment(searchTerm) {
    const equipmentCards = document.querySelectorAll('.favorites-equipment-card');
    const searchLower = searchTerm.toLowerCase().trim();

    // 如果搜索詞為空，恢復到當前篩選狀態
    if (!searchLower) {
      this.filterFavoriteEquipment(this.currentFilter);
      return;
    }

    this.hideAllCards(equipmentCards);

    setTimeout(() => {
      const visibleCount = this.showSearchedCards(equipmentCards, searchLower);
      this.updateEmptyState('equipment', visibleCount);

      // 重置篩選器狀態
      this.resetFilterButtons();

      setTimeout(() => {
        this.resetCardStyles(equipmentCards);
        // 搜尋時觸發動畫（用戶主動搜尋）
        this.recalculateRowsAndAnimate('equipment');
      }, ANIMATION_CONFIG.LAYOUT_SETTLE_DELAY);
    }, ANIMATION_CONFIG.INITIAL_DELAY);
  }

  // 通用函數：隱藏所有卡片
  hideAllCards(cards) {
    cards.forEach(card => {
      card.classList.remove('animate-in');
      card.style.display = 'none';
      card.style.opacity = '';
      card.style.transform = '';
    });
  }

  // 通用函數：顯示篩選後的卡片
  showFilteredCards(cards, category) {
    let visibleCount = 0;
    cards.forEach(card => {
      const cardCategory = card.dataset.category;
      if (category === 'all' || cardCategory === category) {
        card.style.display = 'flex';
        card.style.opacity = '0';
        visibleCount++;
      }
    });
    return visibleCount;
  }

  // 通用函數：顯示搜索後的卡片
  showSearchedCards(cards, searchTerm) {
    let visibleCount = 0;
    cards.forEach(card => {
      const equipmentName = card.dataset.name.toLowerCase();
      if (equipmentName.includes(searchTerm)) {
        card.style.display = 'flex';
        card.style.opacity = '0';
        visibleCount++;
      }
    });
    return visibleCount;
  }

  // 通用函數：重置卡片樣式
  resetCardStyles(cards) {
    cards.forEach(card => {
      if (card.style.display === 'flex') {
        card.style.opacity = '';
      }
    });
  }

  // 重置篩選器按鈕
  resetFilterButtons() {
    const filterButtons = document.querySelectorAll('#content-area .sccd-filter-item');
    filterButtons.forEach(btn => {
      const wrapper = btn.querySelector('.menu-item-wrapper');
      if (wrapper) {
        wrapper.classList.remove('active');
      }
    });
  }

  // 更新空狀態訊息
  updateEmptyState(type, visibleCount) {
    const emptyMessage = document.getElementById(`${type}-empty-message`);
    if (emptyMessage) {
      emptyMessage.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }

  // 移除收藏 - 支持是否顯示toast的參數
  removeFavorite(type, itemName, showToast = true) {
    try {
      if (type === 'equipment') {
        this.removeEquipmentFavorite(itemName, showToast);
      } else if (type === 'classroom') {
        this.removeClassroomFavorite(itemName, showToast);
      }

      // 只有在showToast為true時才顯示toast通知
      if (showToast) {
        this.showRemoveToast(type, itemName);
      }
    } catch (error) {
      console.error('移除收藏錯誤:', error);
    }

    // 移除不必要的 checkEmptyState 調用，因為在具體的移除方法中已經處理
  }

  // 顯示移除收藏的toast通知
  showRemoveToast(type, itemName) {
    const message = type === 'equipment' ?
      `該設備已取消收藏` :
      `該教室已取消收藏`;

    // 創建帶UNDO的toast
    this.createUndoToastForRemoval(message, type, itemName);
  }

  // 為書籤移除創建帶UNDO功能的toast
  createUndoToastForRemoval(message, type, itemName) {
    // 移除現有的toast
    const existingToast = document.getElementById('removal-undo-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // 創建toast容器（使用common.css的toast樣式）
    const toast = document.createElement('div');
    toast.id = 'removal-undo-toast';
    toast.className = 'toast';

    // 創建內容容器
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'flex items-center gap-4';

    // 創建消息文字
    const messageP = document.createElement('p');
    messageP.textContent = message;

    // 創建UNDO按鈕
    const undoBtn = document.createElement('button');
    undoBtn.className = 'font-english font-medium text-tiny uppercase tracking-wide hover:opacity-70 transition-opacity';
    undoBtn.style.color = '#000000';
    undoBtn.style.marginLeft = '1rem';
    undoBtn.textContent = 'UNDO';
    undoBtn.onclick = () => {
      this.undoBookmarkRemoval(type, itemName);
      toast.classList.add('fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    };
    // 確保按鈕可以被點擊
    undoBtn.style.cursor = 'pointer';
    undoBtn.style.pointerEvents = 'auto';

    contentWrapper.appendChild(messageP);
    contentWrapper.appendChild(undoBtn);
    toast.appendChild(contentWrapper);
    document.body.appendChild(toast);

    // 顯示toast
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // 3秒後自動消失
    setTimeout(() => {
      if (toast.parentNode && !toast.classList.contains('fade-out')) {
        toast.classList.add('fade-out');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }
    }, 3000);
  }

  // 撤銷書籤移除操作
  undoBookmarkRemoval(type, itemName) {
    // 使用統一方法添加bookmark
    this.performBookmarkOperation(() => {
      if (window.unifiedBookmarkManager) {
        const bookmarkName = type === 'equipment' ? itemName : `${itemName} 教室`;
        window.unifiedBookmarkManager.addBookmark(bookmarkName);
      }
    });

    // 動態重新生成並插入卡片，而不是重新載入整個頁面
    this.restoreRemovedCard(type, itemName);
  }

  // 設置選擇模式事件
  setupSelectionMode() {
    // SELECT/DELETE 按鈕事件
    const selectModeBtn = document.getElementById('select-mode-btn');
    const cancelBtn = document.getElementById('cancel-selection-btn');

    if (selectModeBtn) {
      selectModeBtn.addEventListener('click', () => {
        if (this.isSelectionMode) {
          this.deleteSelectedItems();
        } else {
          this.toggleSelectionMode();
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.exitSelectionMode();
      });
    }
  }

  // 設置卡片選擇事件
  setupCardSelection() {
    const cards = document.querySelectorAll('.selectable-card');
    cards.forEach(card => {
      // 點擊卡片選擇
      card.addEventListener('click', (e) => {
        if (this.isSelectionMode) {
          e.preventDefault();
          this.toggleCardSelection(card);
        }
      });

      // 點擊選擇框選擇
      const checkbox = card.querySelector('.selection-checkbox');
      if (checkbox) {
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.isSelectionMode) {
            this.toggleCardSelection(card);
          }
        });
      }
    });
  }

  // 切換選擇模式
  toggleSelectionMode() {
    this.isSelectionMode = !this.isSelectionMode;

    if (this.isSelectionMode) {
      this.enterSelectionMode();
    } else {
      this.exitSelectionMode();
    }
  }

  // 進入選擇模式
  enterSelectionMode() {
    this.isSelectionMode = true;

    // 更新按鈕文字
    const selectBtn = document.getElementById('select-mode-btn');
    if (selectBtn) {
      const textSpans = selectBtn.querySelectorAll('.menu-text, .menu-text-hidden');
      textSpans.forEach(span => span.textContent = '(DELETE)');
    }

    // 顯示取消按鈕
    const cancelBtn = document.getElementById('cancel-selection-btn');
    if (cancelBtn) {
      cancelBtn.style.display = 'block';
    }

    // 隱藏所有書籤圖標
    const bookmarkIcons = document.querySelectorAll('.bookmark-icon');
    bookmarkIcons.forEach(icon => {
      icon.style.display = 'none';
    });

    // 顯示所有選擇框
    const checkboxes = document.querySelectorAll('.selection-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.style.display = 'block';
    });

    // 添加選擇模式下的pointer cursor
    const cards = document.querySelectorAll('.selectable-card');
    cards.forEach(card => {
      card.style.cursor = 'pointer';
    });

    this.updateSelectionUI();
  }

  // 退出選擇模式
  exitSelectionMode() {
    this.isSelectionMode = false;
    this.selectedItems.clear();

    // 更新按鈕文字
    const selectBtn = document.getElementById('select-mode-btn');
    if (selectBtn) {
      const textSpans = selectBtn.querySelectorAll('.menu-text, .menu-text-hidden');
      textSpans.forEach(span => span.textContent = '(SELECT)');
    }

    // 隱藏取消按鈕
    const cancelBtn = document.getElementById('cancel-selection-btn');
    if (cancelBtn) {
      cancelBtn.style.display = 'none';
    }

    // 顯示所有書籤圖標
    const bookmarkIcons = document.querySelectorAll('.bookmark-icon');
    bookmarkIcons.forEach(icon => {
      icon.style.display = 'block';
    });

    // 隱藏所有選擇框
    const checkboxes = document.querySelectorAll('.selection-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.style.display = 'none';
      // 清除選中狀態
      const fill = checkbox.querySelector('.selection-fill');
      if (fill) {
        fill.style.display = 'none';
      }
    });

    // 移除選擇模式下的pointer cursor
    const cards = document.querySelectorAll('.selectable-card');
    cards.forEach(card => {
      card.style.cursor = '';
    });

    this.updateSelectionUI();
  }

  // 切換卡片選中狀態
  toggleCardSelection(card) {
    const itemId = this.getCardItemId(card);
    const checkbox = card.querySelector('.selection-checkbox');
    const fill = checkbox?.querySelector('.selection-fill');

    if (this.selectedItems.has(itemId)) {
      // 取消選中
      this.selectedItems.delete(itemId);
      if (fill) {
        fill.style.display = 'none';
      }
    } else {
      // 選中
      this.selectedItems.add(itemId);
      if (fill) {
        fill.style.display = 'block';
      }
    }

    this.updateSelectionUI();
  }

  // 獲取卡片項目ID
  getCardItemId(card) {
    const type = card.dataset.type;
    if (type === 'equipment') {
      return `equipment:${card.dataset.name}`;
    } else if (type === 'classroom') {
      return `classroom:${card.dataset.classroom}`;
    }
    return null;
  }

  // 更新選擇UI狀態
  updateSelectionUI() {
    const selectedCount = this.selectedItems.size;

    // 更新DELETE按鈕狀態
    const selectBtn = document.getElementById('select-mode-btn');
    if (selectBtn && this.isSelectionMode) {
      if (selectedCount > 0) {
        selectBtn.disabled = false;
        selectBtn.style.opacity = '';
        selectBtn.style.cursor = '';
      } else {
        selectBtn.disabled = true;
        selectBtn.style.opacity = '0.5';
        selectBtn.style.cursor = 'not-allowed';
      }
    }
  }

  // 刪除選中的項目
  deleteSelectedItems() {
    if (this.selectedItems.size === 0) return;

    // 顯示確認對話框
    this.showDeleteConfirmationModal();
  }

  // 顯示刪除確認對話框
  showDeleteConfirmationModal() {
    // 凍結背景滾動
    document.body.style.overflow = 'hidden';

    // 創建overlay
    const overlay = document.createElement('div');
    overlay.id = 'delete-confirmation-overlay';
    overlay.className = 'fixed inset-0 flex items-center justify-center';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '1000';

    // 創建模態框
    const modal = document.createElement('div');
    modal.className = 'bg-black p-6 max-w-md mx-4';
    modal.style.border = '1px solid white';
    modal.style.borderRadius = '0';

    // 標題
    const title = document.createElement('h3');
    title.className = 'font-chinese text-white text-content mb-2';
    title.textContent = '取消收藏';

    // 內容
    const content = document.createElement('p');
    content.className = 'font-chinese text-white text-small-title mb-6';
    content.textContent = '確定要取消收藏選擇的項目嗎？';

    // 按鈕容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-between gap-4';

    // 取消按鈕
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'page-button';
    cancelBtn.innerHTML = `
      <div class="menu-item-wrapper">
        <span class="menu-text">(CANCEL)</span>
        <span class="menu-text-hidden">(CANCEL)</span>
      </div>
    `;
    cancelBtn.onclick = () => {
      // 恢復背景滾動
      document.body.style.overflow = '';
      document.body.removeChild(overlay);
    };

    // 刪除按鈕
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'page-button';
    deleteBtn.innerHTML = `
      <div class="menu-item-wrapper">
        <span class="menu-text">(DELETE)</span>
        <span class="menu-text-hidden">(DELETE)</span>
      </div>
    `;
    deleteBtn.onclick = () => {
      // 恢復背景滾動
      document.body.style.overflow = '';
      document.body.removeChild(overlay);
      this.executeSelectedItemsDeletion();
    };

    // 組裝模態框
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(deleteBtn);
    modal.appendChild(title);
    modal.appendChild(content);
    modal.appendChild(buttonContainer);
    overlay.appendChild(modal);

    // 添加到頁面
    document.body.appendChild(overlay);

    // 禁用點擊overlay外部關閉
    // overlay.addEventListener('click', (e) => {
    //   if (e.target === overlay) {
    //     document.body.removeChild(overlay);
    //   }
    // });
  }

  // 執行選中項目的刪除
  executeSelectedItemsDeletion() {
    const itemsToDelete = Array.from(this.selectedItems);
    let completedDeletions = 0;

    itemsToDelete.forEach(itemId => {
      this.removeItemWithAnimation(itemId, false); // 不顯示individual toast
    });

    // 延遲顯示統一的toast（等待所有動畫完成）
    setTimeout(() => {
      this.showBatchUndoToast(itemsToDelete);
    }, 350); // 稍微晚於動畫完成時間

    // 清空選擇
    this.selectedItems.clear();
    this.exitSelectionMode();
  }

  // 帶動畫地移除項目
  removeItemWithAnimation(itemId, showToast = true) {
    const [type, name] = itemId.split(':');

    // 找到對應的卡片
    let card;
    if (type === 'equipment') {
      card = document.querySelector(`[data-name="${name}"][data-type="equipment"]`);
    } else if (type === 'classroom') {
      card = document.querySelector(`[data-classroom="${name}"][data-type="classroom"]`);
    }

    if (card) {
      // 儲存移除信息供UNDO使用
      this.pendingRemovals.set(itemId, {
        type,
        name,
        element: card.cloneNode(true),
        timestamp: Date.now()
      });

      // Fade out 動畫
      card.style.transition = 'opacity 0.3s ease-out';
      card.style.opacity = '0';

      setTimeout(() => {
        // 使用統一方法移除bookmark
        this.performBookmarkOperation(() => {
          if (window.unifiedBookmarkManager) {
            const bookmarkName = type === 'equipment' ? name : `${name} 教室`;
            window.unifiedBookmarkManager.removeBookmark(bookmarkName);
          }
        });

        // 移除DOM元素
        if (card.parentNode) {
          card.parentNode.removeChild(card);
        }

        // 檢查空狀態
        this.checkEmptyState();

        // 只在需要時顯示toast通知
        if (showToast) {
          this.showUndoToast(type, name, itemId);
        }
      }, 300);
    }
  }

  // 顯示批量刪除的可撤銷toast通知
  showBatchUndoToast(deletedItemIds) {
    const count = deletedItemIds.length;
    const message = count === 1 ? '該項目已取消收藏' : `${count}個項目已取消收藏`;

    this.createUndoToast(message, () => {
      // 恢復所有被刪除的項目
      deletedItemIds.forEach(itemId => {
        this.undoRemoval(itemId);
      });
    });
  }

  // 顯示可撤銷的toast通知
  showUndoToast(type, name, itemId) {
    const message = type === 'equipment' ?
      `該設備已取消收藏` :
      `該教室已取消收藏`;

    this.createUndoToast(message, () => {
      this.undoRemoval(itemId);
    });
  }

  // 創建帶UNDO功能的toast（用於選擇刪除）
  createUndoToast(message, undoCallback) {
    // 移除現有的toast
    const existingToast = document.getElementById('selection-undo-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // 創建toast容器（使用common.css的toast樣式）
    const toast = document.createElement('div');
    toast.id = 'selection-undo-toast';
    toast.className = 'toast';

    // 創建內容容器
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'flex items-center gap-4';

    // 創建消息文字
    const messageP = document.createElement('p');
    messageP.textContent = message;

    // 創建UNDO按鈕
    const undoBtn = document.createElement('button');
    undoBtn.className = 'font-english font-medium text-tiny uppercase tracking-wide hover:opacity-70 transition-opacity';
    undoBtn.style.color = '#000000';
    undoBtn.style.marginLeft = '1rem';
    undoBtn.textContent = 'UNDO';
    undoBtn.onclick = () => {
      undoCallback();
      toast.classList.add('fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
        this.cleanupPendingRemovals();
      }, 300);
    };
    // 確保按鈕可以被點擊
    undoBtn.style.cursor = 'pointer';
    undoBtn.style.pointerEvents = 'auto';

    contentWrapper.appendChild(messageP);
    contentWrapper.appendChild(undoBtn);
    toast.appendChild(contentWrapper);
    document.body.appendChild(toast);

    // 顯示toast
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // 3秒後自動消失
    setTimeout(() => {
      if (toast.parentNode && !toast.classList.contains('fade-out')) {
        toast.classList.add('fade-out');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
          this.cleanupPendingRemovals();
        }, 300);
      }
    }, 3000);
  }

  // 撤銷移除操作
  undoRemoval(itemId) {
    const pendingRemoval = this.pendingRemovals.get(itemId);
    if (!pendingRemoval) return;

    const { type, name } = pendingRemoval;

    // 使用統一方法添加bookmark
    this.performBookmarkOperation(() => {
      if (window.unifiedBookmarkManager) {
        const bookmarkName = type === 'equipment' ? name : `${name} 教室`;
        window.unifiedBookmarkManager.addBookmark(bookmarkName);
      }
    });

    // 清理pending removal
    this.pendingRemovals.delete(itemId);

    // 動態重新生成並插入卡片，而不是重新載入整個頁面
    this.restoreRemovedCard(type, name);
  }

  // 動態恢復被移除的卡片
  restoreRemovedCard(type, itemName) {
    if (type === 'equipment') {
      // 先檢查是否已經存在相同的卡片，避免重複
      const existingCard = document.querySelector(`[data-equipment="${itemName}"][data-type="equipment"]`);
      if (existingCard) {
        console.log(`設備卡片已存在，不重複創建: ${itemName}`);
        return;
      }

      // 找到設備數據
      const equipmentData = this.getAllEquipmentData().find(eq => eq.name === itemName);
      if (equipmentData) {
        const grid = document.getElementById('favorites-equipment-grid');
        const existingCards = grid.querySelectorAll('.favorites-equipment-card');

        // 創建新卡片
        const newCardHTML = this.generateEquipmentCard(equipmentData, existingCards.length);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newCardHTML;
        const newCard = tempDiv.firstElementChild;

        // 插入到網格中
        const emptyMessage = document.getElementById('equipment-empty-message');
        if (emptyMessage && emptyMessage.style.display !== 'none') {
          emptyMessage.style.display = 'none';
        }

        grid.appendChild(newCard);

        // 重新設置事件監聽器
        this.setupRemoveFavoriteButtonForCard(newCard);
        this.setupCardSelectionForCard(newCard);

        // 添加進場動畫
        setTimeout(() => {
          newCard.classList.add('animate-in');
        }, 50);
      }
    } else if (type === 'classroom') {
      // 先檢查是否已經存在相同的卡片，避免重複
      const existingCard = document.querySelector(`[data-classroom="${itemName}"][data-type="classroom"]`);
      if (existingCard) {
        console.log(`教室卡片已存在，不重複創建: ${itemName}`);
        return;
      }

      // 找到教室數據
      const classroomData = this.getAllClassroomData().find(cr => cr.name === itemName);
      if (classroomData) {
        const grid = document.getElementById('favorites-classroom-grid');
        const existingCards = grid.querySelectorAll('.favorites-classroom-card');

        // 創建新卡片
        const newCardHTML = this.generateClassroomCard(classroomData, existingCards.length);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newCardHTML;
        const newCard = tempDiv.firstElementChild;

        // 插入到網格中
        const emptyMessage = document.getElementById('classroom-empty-message');
        if (emptyMessage && emptyMessage.style.display !== 'none') {
          emptyMessage.style.display = 'none';
        }

        grid.appendChild(newCard);

        // 重新設置事件監聽器
        this.setupRemoveFavoriteButtonForCard(newCard);
        this.setupCardSelectionForCard(newCard);

        // 添加進場動畫
        setTimeout(() => {
          newCard.classList.add('animate-in');
        }, 50);
      }
    }

    // 重新檢查空狀態
    this.checkEmptyState();
  }

  // 為單個卡片設置移除收藏按鈕事件
  setupRemoveFavoriteButtonForCard(card) {
    const removeFavoriteBtn = card.querySelector('.remove-favorite-btn');
    if (removeFavoriteBtn) {
      removeFavoriteBtn.addEventListener('click', () => {
        const type = removeFavoriteBtn.dataset.type;
        const itemName = removeFavoriteBtn.dataset.equipment || removeFavoriteBtn.dataset.classroom;
        this.removeFavorite(type, itemName);
      });
    }
  }

  // 為單個卡片設置選擇事件
  setupCardSelectionForCard(card) {
    // 點擊卡片選擇
    card.addEventListener('click', (e) => {
      if (this.isSelectionMode) {
        e.preventDefault();
        this.toggleCardSelection(card);
      }
    });

    // 點擊選擇框選擇
    const checkbox = card.querySelector('.selection-checkbox');
    if (checkbox) {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isSelectionMode) {
          this.toggleCardSelection(card);
        }
      });
    }
  }

  // 統一的書籤操作方法 - 避免重複的內部標志設置
  performBookmarkOperation(operation) {
    // 標記為內部操作，防止觸發全局同步
    if (window.profilePage) {
      window.profilePage.isInternalBookmarkChange = true;
    }
    operation();
  }

  // 統一的卡片查詢方法
  findCard(type, itemName) {
    if (type === 'equipment') {
      return document.querySelector(`[data-equipment="${itemName}"]`)?.closest('.favorites-equipment-card');
    } else if (type === 'classroom') {
      return document.querySelector(`[data-classroom="${itemName}"]`)?.closest('.favorites-classroom-card');
    }
    return null;
  }

  // 清理過期的pending removals
  cleanupPendingRemovals() {
    const now = Date.now();
    const expiredItems = [];

    this.pendingRemovals.forEach((removal, itemId) => {
      if (now - removal.timestamp > 3000) { // 3秒過期
        expiredItems.push(itemId);
      }
    });

    expiredItems.forEach(itemId => {
      this.pendingRemovals.delete(itemId);
    });
  }

  // 移除設備收藏
  removeEquipmentFavorite(itemName, showToast = true) {
    // 使用統一方法移除bookmark
    this.performBookmarkOperation(() => {
      if (window.unifiedBookmarkManager) {
        window.unifiedBookmarkManager.removeBookmark(itemName);
      }
    });

    // 只在showToast為true時才做動畫和移除DOM
    if (showToast) {
      const card = this.findCard('equipment', itemName);
      if (card) {
        card.classList.add('fade-out');
        setTimeout(() => {
          card.remove();
          this.checkEmptyState();
        }, 500);
      }
    }
  }

  // 移除教室收藏
  removeClassroomFavorite(itemName, showToast = true) {
    const classroomEquipmentName = `${itemName} 教室`;

    // 使用統一方法移除bookmark
    this.performBookmarkOperation(() => {
      if (window.unifiedBookmarkManager) {
        window.unifiedBookmarkManager.removeBookmark(classroomEquipmentName);
      }
    });

    // 只在showToast為true時才做動畫和移除DOM
    if (showToast) {
      const card = this.findCard('classroom', itemName);
      if (card) {
        card.classList.add('fade-out');
        setTimeout(() => {
          card.remove();
          this.checkEmptyState();
        }, 500);
      }
    }
  }

  // 檢查空狀態並顯示訊息（個別移除時不觸發動畫）
  checkEmptyState() {
    const equipmentCards = document.querySelectorAll('.favorites-equipment-card');
    const visibleCount = Array.from(equipmentCards).filter(card => {
      // 排除正在fade-out的卡片
      if (card.classList.contains('fade-out')) {
        return false;
      }
      // 檢查卡片是否真正可見
      const computedStyle = window.getComputedStyle(card);
      return computedStyle.display !== 'none';
    }).length;

    this.updateEmptyState('equipment', visibleCount);
    // 不觸發動畫，只更新空狀態顯示
  }

  // 觸發初始動畫
  triggerInitialAnimation() {
    if (window.innerWidth < 768) return;

    const equipmentCards = document.querySelectorAll('.favorites-equipment-card');
    const classroomCards = document.querySelectorAll('.favorites-classroom-card');

    // 確保所有卡片都有 equipment-card class
    [...equipmentCards, ...classroomCards].forEach(card => {
      if (!card.classList.contains('equipment-card')) {
        card.classList.add('equipment-card');
      }
    });

    setTimeout(() => {
      this.triggerCardGroupAnimation(equipmentCards);

      const equipmentAnimationDuration = this.calculateAnimationDuration(equipmentCards);
      setTimeout(() => {
        this.triggerCardGroupAnimation(classroomCards);
      }, equipmentAnimationDuration);
    }, ANIMATION_CONFIG.BASE_DELAY);
  }

  // 觸發卡片組動畫 - 簡化版本
  triggerCardGroupAnimation(cards) {
    const visibleCards = Array.from(cards).filter(card =>
      window.getComputedStyle(card).display !== 'none'
    );

    if (visibleCards.length === 0) return;

    // 重置動畫狀態
    visibleCards.forEach(card => {
      card.classList.remove('animate-in');
      card.style.opacity = '';
      card.style.visibility = 'visible';
      card.style.transform = '';
    });

    // 按行分組並觸發動畫
    this.animateCardsByRows(visibleCards);
  }

  // 按行觸發動畫 - 提取公共邏輯
  animateCardsByRows(cards) {
    const rowGroups = this.groupCardsByRow(cards);

    Object.keys(rowGroups)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach((rowNumber, rowIndex) => {
        const rowCards = rowGroups[rowNumber];

        rowCards.forEach((card, cardIndex) => {
          setTimeout(() => {
            card.classList.add('animate-in');
          }, (rowIndex * ANIMATION_CONFIG.ROW_DELAY) + (cardIndex * ANIMATION_CONFIG.CARD_DELAY) + ANIMATION_CONFIG.BASE_DELAY);
        });
      });
  }

  // 按行分組卡片
  groupCardsByRow(cards) {
    const rowGroups = {};
    cards.forEach(card => {
      const row = parseInt(card.getAttribute('data-row'));
      if (!rowGroups[row]) rowGroups[row] = [];
      rowGroups[row].push(card);
    });
    return rowGroups;
  }

  // 計算動畫持續時間
  calculateAnimationDuration(cards) {
    const visibleCards = Array.from(cards).filter(card =>
      window.getComputedStyle(card).display !== 'none'
    );

    if (visibleCards.length === 0) return 0;

    const maxRow = Math.max(...visibleCards.map(card => parseInt(card.getAttribute('data-row'))));
    const lastRowCards = visibleCards.filter(card => parseInt(card.getAttribute('data-row')) === maxRow);

    return ANIMATION_CONFIG.BASE_DELAY +
           (maxRow * ANIMATION_CONFIG.ROW_DELAY) +
           ((lastRowCards.length - 1) * ANIMATION_CONFIG.CARD_DELAY) +
           ANIMATION_CONFIG.ANIMATION_DURATION;
  }

  // 重新計算行號並觸發動畫
  recalculateRowsAndAnimate(type) {
    if (window.innerWidth < 768) return;

    const cards = type === 'equipment'
      ? document.querySelectorAll('.favorites-equipment-card')
      : document.querySelectorAll('.favorites-classroom-card');

    const visibleCards = Array.from(cards).filter(card =>
      window.getComputedStyle(card).display !== 'none'
    );

    if (visibleCards.length === 0) return;

    // 強制重排確保位置穩定
    visibleCards.forEach(card => card.offsetHeight);

    requestAnimationFrame(() => {
      // 重新計算行號
      const cardsPerRow = type === 'equipment' ? GRID_CONFIG.EQUIPMENT_CARDS_PER_ROW : GRID_CONFIG.CLASSROOM_CARDS_PER_ROW;
      visibleCards.forEach((card, index) => {
        const row = Math.floor(index / cardsPerRow);
        card.setAttribute('data-row', row);
      });

      // 重置動畫狀態
      visibleCards.forEach(card => {
        card.classList.remove('animate-in');
        card.style.opacity = '';
        card.style.visibility = 'visible';
        card.style.transform = '';
      });

      // 觸發動畫
      setTimeout(() => {
        this.animateCardsByRows(visibleCards);
      }, 100);
    });
  }

  // 獲取收藏設備數據
  getFavoriteEquipmentData() {
    let userBookmarks = [];
    try {
      if (window.unifiedBookmarkManager) {
        userBookmarks = window.unifiedBookmarkManager.getEquipmentBookmarks();
      }
    } catch (error) {
      console.error('獲取設備收藏數據錯誤:', error);
    }

    return this.getAllEquipmentData().filter(equipment =>
      userBookmarks.includes(equipment.name)
    );
  }

  // 獲取收藏教室數據
  getFavoriteClassroomData() {
    let classroomBookmarks = [];
    try {
      if (window.unifiedBookmarkManager) {
        classroomBookmarks = window.unifiedBookmarkManager.getClassroomBookmarksShort();
      }
    } catch (error) {
      console.error('獲取教室收藏數據錯誤:', error);
    }

    return this.getAllClassroomData().filter(classroom =>
      classroomBookmarks.includes(classroom.name)
    );
  }

  // 獲取所有設備數據 - 從常量提取
  getAllEquipmentData() {
    return [
      { name: '黑色喇叭夾燈 長支架', category: '燈具', image: 'Images/Extension Cord.webp' },
      { name: '三孔六座延長線', category: '線材', image: 'Images/Extension Cord.webp' },
      { name: '長桿筒狀夾燈(可伸縮)【白光】', category: '燈具', image: 'Images/Extension Cord.webp' },
      { name: 'H字牆 / 92*200', category: '畫板/展桌/展台', image: 'Images/Extension Cord.webp' },
      { name: 'KINYO PS 285B 立體擴大音響', category: '視聽類', image: 'Images/Extension Cord.webp' },
      { name: '鋁梯 / 115', category: '工具', image: 'Images/Extension Cord.webp' },
      { name: '雷射切割機', category: '機具', image: 'Images/Extension Cord.webp' },
      { name: '品字電源線 一般（黑）', category: '線材', image: 'Images/Extension Cord.webp' },
      { name: '米家檯燈', category: '燈具', image: 'Images/Extension Cord.webp' },
      { name: '畫板', category: '畫板/展桌/展台', image: 'Images/Extension Cord.webp' },
      { name: '電腦螢幕', category: '視聽類', image: 'Images/Extension Cord.webp' },
      { name: '大型購物推車（銀色）', category: '工具', image: 'Images/Extension Cord.webp' }
    ];
  }

  // 獲取所有教室數據 - 從常量提取
  getAllClassroomData() {
    return [
      { name: 'A503', image: 'Images/A503.webp', equipmentName: 'A503 教室' },
      { name: 'A507', image: 'Images/A507.webp', equipmentName: 'A507 教室' },
      { name: 'A508', image: 'Images/A508.webp', equipmentName: 'A508 教室' }
    ];
  }

  // 同步收藏數據變化
  syncFavorites() {
    try {
      if (window.sccdBookmarkManager) {
        window.sccdBookmarkManager.updateCurrentUser();
      }
    } catch (error) {
      console.error('同步收藏數據錯誤:', error);
    }
  }
}

// 導出供其他文件使用
if (typeof window !== 'undefined') {
  window.FavoritesManager = FavoritesManager;
}