/* ===== A5F編號區頁面專用 JavaScript ===== */

// 區域資料對應
const areaMapping = {
  'Square_00000182511804602346659000000005465159496059156352_': {
    name: '中庭',
    english: 'Square',
    deposit: 1000,
    key: 'square',
    totalBlocks: 0  // 將在初始化時計算
  },
  'Corridor_00000054253696021401463270000011895499425825329057_': {
    name: '走廊',
    english: 'Corridor',
    deposit: 1000,
    key: 'corridor',
    totalBlocks: 0
  },
  'Front_Terrace_00000090268161127870382690000014504900871044795011_': {
    name: '前陽台',
    english: 'Front Terrace',
    deposit: 1000,
    key: 'front-terrace',
    totalBlocks: 0
  },
  'Back_Terrace_00000056418405994274588460000015042233556369055388_': {
    name: '後陽台',
    english: 'Back Terrace',
    deposit: 2000,
    key: 'back-terrace',
    totalBlocks: 0
  },
  'Glass_Wall_00000000186369360168713920000002393977063800030610_': {
    name: '玻璃牆',
    english: 'Glass Wall',
    deposit: 1000,
    key: 'glass-wall',
    totalBlocks: 0
  },
  'Pillar_00000105403812364892765500000010771666716634094254_': {
    name: '柱子',
    english: 'Pillar',
    deposit: 1000,
    key: 'pillar',
    totalBlocks: 0
  }
};

// 應用狀態
let isAreaSelected = false;
let currentSelectedAreaKey = null;
let selectedBlocks = [];
let submittedBlocks = [];
let cartBlocks = [];

// 輔助函數：檢查是否為格子元素
function isGridCellElement(id) {
  return (
    /^[A-Z]+\d+$/.test(id) ||
    /^\d+[A-Z]+$/.test(id) ||
    /^[A-Z]+\d+[A-Z]*$/.test(id) ||
    (id.length >= 2 && id.length <= 5 &&
     /[A-Z]/.test(id) && /\d/.test(id) &&
     !/[^A-Z0-9]/.test(id))
  );
}

// 禁用進場動畫
function disableFloatUpAnimations() {
  const floatUpElements = document.querySelectorAll('.float-up, .float-up-container');
  floatUpElements.forEach(element => {
    element.classList.remove('float-up', 'float-up-delay-1', 'float-up-delay-2', 'float-up-delay-3', 'float-up-delay-4', 'float-up-delay-5', 'float-up-delay-6', 'float-up-delay-7');
    element.style.opacity = '1';
    element.style.transform = 'translateY(0)';
    element.style.animation = 'none';
  });

  const calendarContainer = document.querySelector('.calendar-fade-in');
  if (calendarContainer) {
    calendarContainer.style.opacity = '1';
    calendarContainer.style.transform = 'translateY(0)';
    calendarContainer.style.animation = 'none';
  }

}

// 從rental list來時的放大動畫效果
function animateZoomEffect(areaKey, areaName) {

  const svg = document.getElementById('area-booking-svg');
  if (svg) {
    svg.style.transform = '';
    svg.style.transition = 'transform 0.8s ease-out';
  }

  setTimeout(() => {
    zoomToArea(areaKey, true);
  }, 100);

  setTimeout(() => {
    showLeftMenu();
    showRightInfoPanel();
    setMenuSelectedState(areaKey);
    setupGridCellClicking();
    updateSelectAllButtonState();
  }, 150);
}

// 初始化頁面
async function initNumberedAreaPage() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const fromRentalList = urlParams.get('from') === 'rental-list';

    if (fromRentalList) {
      disableFloatUpAnimations();
    }

    // 載入SVG內容
    const response = await fetch('Area/A5F Area Booking.svg');
    const svgContent = await response.text();

    const container = document.querySelector('.h-full.text-center.relative > div');
    if (!container) {
      console.error('SVG container not found');
      return;
    }

    container.innerHTML = svgContent;

    const svg = container.querySelector('svg');
    if (svg) {
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.style.display = 'block';
      svg.id = 'area-booking-svg';
      setupAreaInteractions(svg);
    }


    loadCartBlocks();
    checkAndNavigateToArea();
    setupBreadcrumbReset();
    setupBackButton();

    // 如果沒有進入特定區域，顯示購物車中的區塊
    const areaParam = urlParams.get('area');
    if (!areaParam) {
      setTimeout(() => {
        showCartBlocksInOverview();
      }, 100);
    }

  } catch (error) {
    console.error('Failed to load A5F Area Booking SVG:', error);
  }
}

// 設置區域互動功能
function setupAreaInteractions(svg) {
  const tooltip = document.getElementById('area-tooltip');
  const areaGroups = [];

  Object.keys(areaMapping).forEach(areaId => {
    const group = svg.querySelector(`#${areaId}`);
    if (group) {
      group.classList.add('area-group');

      // 使用!important強制設置cursor樣式
      const setCursorRecursively = (element) => {
        element.style.setProperty('cursor', 'pointer', 'important');
        Array.from(element.children).forEach(child => {
          setCursorRecursively(child);
        });
      };
      setCursorRecursively(group);

      areaGroups.push(group);
    }
  });

  areaGroups.forEach(group => {
    const areaId = group.id;
    const areaData = areaMapping[areaId];

    if (!areaData) return;

    // 滑鼠進入事件
    group.addEventListener('mouseenter', (e) => {
      if (isAreaSelected) return;

      areaGroups.forEach(otherGroup => {
        if (otherGroup !== group) {
          otherGroup.classList.add('dimmed');
        }
      });

      updateTooltipContent(areaData);
      tooltip.classList.add('show');
      updateTooltipPosition(e);
    });

    // 滑鼠移動事件
    group.addEventListener('mousemove', (e) => {
      if (isAreaSelected) return;

      // 強制設置當前元素的cursor為pointer
      if (e.target) {
        e.target.style.setProperty('cursor', 'pointer', 'important');
      }

      if (tooltip.classList.contains('show')) {
        updateTooltipPosition(e);
      }
    });

    // 滑鼠離開事件
    group.addEventListener('mouseleave', () => {
      if (isAreaSelected) return;

      areaGroups.forEach(otherGroup => {
        otherGroup.classList.remove('dimmed');
      });

      tooltip.classList.remove('show');
    });

    // 點擊事件
    group.addEventListener('click', () => {
      if (!isAreaSelected) {
        enterAreaView(areaData.key, areaData.name);
      }
    });
  });

  window.areaGroups = areaGroups;
}

// 更新說明框內容
function updateTooltipContent(areaData) {
  document.getElementById('tooltip-area-name').textContent = areaData.name;
  document.getElementById('tooltip-area-english').textContent = areaData.english;
  document.getElementById('tooltip-deposit').textContent = `NT ${areaData.deposit.toLocaleString()}`;

  const projectPermissionElement = document.getElementById('tooltip-project-permission');
  if (areaData.key === 'corridor' || areaData.key === 'pillar') {
    projectPermissionElement.textContent = '*專案許可區';
    projectPermissionElement.style.display = 'block';
  } else if (areaData.key === 'glass-wall') {
    projectPermissionElement.textContent = '*Y4-Y7為專案許可區';
    projectPermissionElement.style.display = 'block';
  } else {
    projectPermissionElement.style.display = 'none';
  }
}

// 更新說明框位置
function updateTooltipPosition(e) {
  const tooltip = document.getElementById('area-tooltip');
  tooltip.style.left = e.clientX + 'px';
  tooltip.style.top = e.clientY + 'px';
}

// 進入區域詳細檢視
function enterAreaView(areaKey, areaName, fromRentalList = false) {
  isAreaSelected = true;
  currentSelectedAreaKey = areaKey;

  const tooltip = document.getElementById('area-tooltip');
  tooltip.classList.remove('show');

  setAreaSelectedState(areaKey);
  updateBreadcrumb(areaName);

  if (fromRentalList) {
    animateZoomEffect(areaKey, areaName);
  } else {
    showLeftMenu();
    showRightInfoPanel();
    setMenuSelectedState(areaKey);
    zoomToArea(areaKey);
    setupGridCellClicking();
    updateSelectAllButtonState();
  }

}

// 更新breadcrumb
function updateBreadcrumb(areaName) {
  const breadcrumbContainer = document.querySelector('.breadcrumb-inline');
  if (breadcrumbContainer) {
    let areaSeparator = breadcrumbContainer.querySelector('#area-separator');
    let areaItem = breadcrumbContainer.querySelector('#area-breadcrumb');

    if (!areaSeparator || !areaItem) {
      areaSeparator = document.createElement('span');
      areaSeparator.id = 'area-separator';
      areaSeparator.className = 'breadcrumb-separator text-breadcrumb';
      areaSeparator.textContent = '/';

      areaItem = document.createElement('span');
      areaItem.id = 'area-breadcrumb';
      areaItem.className = 'breadcrumb-item text-breadcrumb';

      breadcrumbContainer.appendChild(areaSeparator);
      breadcrumbContainer.appendChild(areaItem);
    }

    areaItem.textContent = areaName;
  }
}

// 顯示左側選單
function showLeftMenu() {
  const leftMenu = document.getElementById('left-overlay-menu');
  leftMenu.classList.add('show');
  setupLeftMenuInteractions();
}

// 顯示右側資訊面板
function showRightInfoPanel() {
  const rightPanel = document.getElementById('right-info-panel');
  rightPanel.classList.add('show');

  const projectPermissionSection = document.getElementById('project-permission-section');
  if (projectPermissionSection) {
    projectPermissionSection.classList.add('hidden');
    projectPermissionSection.style.display = 'none';
  }

  setupRightPanelInteractions();
  updateRightPanelInfo();
}

// 設置選單選中狀態
function setMenuSelectedState(areaKey) {
  const menuItems = document.querySelectorAll('.area-menu-item');
  menuItems.forEach(item => {
    item.classList.remove('selected');
    if (item.getAttribute('data-area') === areaKey) {
      item.classList.add('selected');
    }
  });
}

// 設置左側選單互動功能
function setupLeftMenuInteractions() {
  const menuItems = document.querySelectorAll('.area-menu-item');
  menuItems.forEach(item => {
    const newItem = item.cloneNode(true);
    item.parentNode.replaceChild(newItem, item);
  });

  const freshMenuItems = document.querySelectorAll('.area-menu-item');
  freshMenuItems.forEach(item => {
    item.addEventListener('click', () => {
      const areaKey = item.getAttribute('data-area');

      setMenuSelectedState(areaKey);
      currentSelectedAreaKey = areaKey;

      const areaData = Object.values(areaMapping).find(area => area.key === areaKey);
      if (areaData) {
        setAreaSelectedState(areaKey);
        updateBreadcrumb(areaData.name);
        zoomToArea(areaKey);
        setupGridCellClicking();
        updateSelectAllButtonState();
      }

    });
  });

  // 設置 SELECT ALL 按鈕
  setupSelectAllButton();
}

// 設置 SELECT ALL 按鈕
function setupSelectAllButton() {
  const selectAllButton = document.getElementById('select-all-button');
  if (!selectAllButton) return;

  selectAllButton.addEventListener('click', () => {
    if (selectAllButton.disabled) return;
    selectAllAvailableBlocks();
  });
}

// 全選所有可用區塊
function selectAllAvailableBlocks() {
  if (!currentSelectedAreaKey) return;

  const svg = document.getElementById('area-booking-svg');
  if (!svg) return;

  const allElements = svg.querySelectorAll('[id]');

  // 找到當前區域的所有可用區塊
  allElements.forEach(element => {
    if (isGridCellElement(element.id)) {
      // 確認元素屬於當前區域
      let parent = element.parentElement;
      let belongsToCurrentArea = false;

      while (parent && parent !== svg) {
        if (parent.id && areaMapping[parent.id]) {
          const groupData = areaMapping[parent.id];
          if (groupData.key === currentSelectedAreaKey) {
            belongsToCurrentArea = true;
          }
          break;
        }
        parent = parent.parentElement;
      }

      // 如果屬於當前區域且不在購物車且未被租借，則選中
      if (belongsToCurrentArea &&
          !isBlockInCart(element.id, currentSelectedAreaKey) &&
          !isBlockSubmitted(element.id, currentSelectedAreaKey) &&
          !isBlockSelected(element.id, currentSelectedAreaKey)) {

        selectedBlocks.push({ areaKey: currentSelectedAreaKey, cellId: element.id });
        updateGridCellStyle(element.id, true);
      }
    }
  });

  updateRightPanelInfo();
  updateSelectAllButtonState();
}

// 更新 SELECT ALL 按鈕狀態
function updateSelectAllButtonState() {
  const selectAllButton = document.getElementById('select-all-button');
  if (!selectAllButton || !currentSelectedAreaKey) return;

  const svg = document.getElementById('area-booking-svg');
  if (!svg) return;

  // 檢查購物車中該區域是否已經是 ALL 狀態
  if (window.cartManager) {
    const cart = window.cartManager.getCart();
    const areaItem = cart.find(item =>
      item.category === 'area' && item.areaKey === currentSelectedAreaKey
    );

    if (areaItem) {
      const areaData = Object.values(areaMapping).find(area => area.key === currentSelectedAreaKey);
      // 如果購物車中的區塊數等於該區域總區塊數，說明已經是 ALL
      if (areaData && areaData.totalBlocks > 0 && areaItem.blocks.length === areaData.totalBlocks) {
        selectAllButton.disabled = true;
        return;
      }
    }
  }

  const allElements = svg.querySelectorAll('[id]');
  let totalAvailableBlocks = 0;
  let selectedAvailableBlocks = 0;

  // 計算可用區塊數量和已選中的可用區塊數量
  allElements.forEach(element => {
    if (isGridCellElement(element.id)) {
      let parent = element.parentElement;
      let belongsToCurrentArea = false;

      while (parent && parent !== svg) {
        if (parent.id && areaMapping[parent.id]) {
          const groupData = areaMapping[parent.id];
          if (groupData.key === currentSelectedAreaKey) {
            belongsToCurrentArea = true;
          }
          break;
        }
        parent = parent.parentElement;
      }

      if (belongsToCurrentArea) {
        // 只計算未在購物車且未被租借的區塊
        if (!isBlockInCart(element.id, currentSelectedAreaKey) &&
            !isBlockSubmitted(element.id, currentSelectedAreaKey)) {
          totalAvailableBlocks++;

          if (isBlockSelected(element.id, currentSelectedAreaKey)) {
            selectedAvailableBlocks++;
          }
        }
      }
    }
  });

  // 如果所有可用區塊都已選中，則禁用按鈕
  if (totalAvailableBlocks > 0 && selectedAvailableBlocks === totalAvailableBlocks) {
    selectAllButton.disabled = true;
  } else {
    selectAllButton.disabled = false;
  }
}

// 設置選中區域狀態
function setAreaSelectedState(selectedAreaKey) {
  if (window.areaGroups) {
    window.areaGroups.forEach(group => {
      const areaId = group.id;
      const areaData = areaMapping[areaId];

      if (areaData && areaData.key === selectedAreaKey) {
        group.classList.remove('dimmed');
        group.style.opacity = '1';
        group.style.pointerEvents = 'auto';
      } else {
        group.classList.add('dimmed');
        group.style.opacity = '0.3';
        group.style.pointerEvents = 'none';
      }
    });
  }

  const svg = document.getElementById('area-booking-svg');
  if (svg) {
    const selectedAreaId = Object.keys(areaMapping).find(id => areaMapping[id].key === selectedAreaKey);
    if (selectedAreaId) {
      const selectedGroup = svg.querySelector(`#${selectedAreaId}`);
      if (selectedGroup) {
        const selectedElements = selectedGroup.querySelectorAll('*');
        selectedElements.forEach(element => {
          element.style.opacity = '1';
        });
      }
    }
  }
}

// 放大到指定區域
function zoomToArea(areaKey, animated = false) {
  const svg = document.getElementById('area-booking-svg');
  if (!svg) return;

  const zoomConfigs = {
    'square': { scale: 1.8, translateX: 7, translateY: 25 },
    'corridor': { scale: 1.8, translateX: 0, translateY: -24 },
    'front-terrace': { scale: 2, translateX: -16, translateY: -30 },
    'back-terrace': { scale: 2.3, translateX: 40, translateY: 10 },
    'glass-wall': { scale: 1, translateX: 25, translateY: -2 },
    'pillar': { scale: 1.2, translateX: -4, translateY: 10 }
  };

  const config = zoomConfigs[areaKey];
  if (config) {
    const transform = `scale(${config.scale}) translate(${config.translateX}%, ${config.translateY}%)`;

    if (animated) {
      svg.style.transition = 'transform 0.4s ease-out';
    }

    svg.style.transform = transform;
    svg.style.transformOrigin = 'center center';

  }
}

// 設置格子點擊功能
function setupGridCellClicking() {
  const svg = document.getElementById('area-booking-svg');
  if (!svg) return;

  clearAllGridCellListeners();

  const allElements = svg.querySelectorAll('[id]');
  let gridCellCount = 0;
  let currentAreaBlockCount = 0;

  // 先計算當前區域的格子數量
  allElements.forEach(element => {
    if (isGridCellElement(element.id)) {
      // 找到元素所屬的區域組
      let parent = element.parentElement;
      while (parent && parent !== svg) {
        if (parent.id && areaMapping[parent.id]) {
          const groupData = areaMapping[parent.id];
          if (groupData.key === currentSelectedAreaKey) {
            currentAreaBlockCount++;
          }
          break;
        }
        parent = parent.parentElement;
      }
    }
  });

  // 更新當前區域的總區塊數
  const areaData = Object.values(areaMapping).find(area => area.key === currentSelectedAreaKey);
  if (areaData) {
    areaData.totalBlocks = currentAreaBlockCount;
  }

  allElements.forEach(element => {
    const id = element.id;

    const isGridCell = isGridCellElement(id);

    if (isGridCell) {
      gridCellCount++;
      element.style.cursor = 'pointer';
      element.style.transition = 'opacity 0.2s ease';

      storeOriginalStyles(element);
      restoreOriginalStyles(element);
      element.style.filter = 'brightness(1)';

      const mouseEnterHandler = () => {
        if (isBlockSubmitted(element.id, currentSelectedAreaKey)) {
          return;
        }

        if (!isBlockSelected(element.id, currentSelectedAreaKey) && !isBlockInCart(element.id, currentSelectedAreaKey)) {
          applyColorToElement(element, '#00ff80');
          element.style.filter = 'brightness(0.7)';
        } else {
          element.style.filter = 'brightness(0.7)';
        }
      };

      const mouseLeaveHandler = () => {
        if (isBlockSubmitted(element.id, currentSelectedAreaKey)) {
          return;
        }

        if (!isBlockSelected(element.id, currentSelectedAreaKey) && !isBlockInCart(element.id, currentSelectedAreaKey)) {
          restoreOriginalStyles(element);
          element.style.filter = 'brightness(1)';
        } else {
          element.style.filter = 'brightness(1)';
        }
      };

      const clickHandler = (e) => {
        e.stopPropagation();

        if (isBlockSubmitted(element.id, currentSelectedAreaKey)) {
          return;
        }

        handleGridCellClick(element.id);
      };

      element.addEventListener('mouseenter', mouseEnterHandler);
      element.addEventListener('mouseleave', mouseLeaveHandler);
      element.addEventListener('click', clickHandler);

      element._gridEventHandlers = {
        mouseenter: mouseEnterHandler,
        mouseleave: mouseLeaveHandler,
        click: clickHandler
      };
    }
  });

  restoreCurrentAreaSelectedStyles();
}

// 處理格子點擊
function handleGridCellClick(cellId) {

  // 如果區塊在購物車中，點擊移除
  if (isBlockInCart(cellId, currentSelectedAreaKey)) {
    removeBlockFromCart(cellId, currentSelectedAreaKey);
    return;
  }

  const blockIndex = selectedBlocks.findIndex(block =>
    block.cellId === cellId && block.areaKey === currentSelectedAreaKey
  );

  if (blockIndex > -1) {
    selectedBlocks.splice(blockIndex, 1);
    updateGridCellStyle(cellId, false);
  } else {
    selectedBlocks.push({ areaKey: currentSelectedAreaKey, cellId: cellId });
    updateGridCellStyle(cellId, true);
  }

  updateRightPanelInfo();
  updateSelectAllButtonState();
}

// 設置右側面板互動功能
function setupRightPanelInteractions() {
  const clearButton = document.getElementById('clear-button');
  const addButton = document.getElementById('add-button');

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      if (!clearButton.disabled) {
        clearSelectedBlocks();
      }
    });
  }

  if (addButton) {
    addButton.addEventListener('click', () => {
      if (!addButton.disabled) {
        addToCart();
      }
    });
  }

  const projectCheckbox = document.getElementById('project-permission-checkbox');
  if (projectCheckbox) {
    projectCheckbox.addEventListener('change', () => {
      updateRightPanelInfo();
    });
  }
}

// 更新右側面板資訊
function updateRightPanelInfo() {
  const rentalNumbers = document.getElementById('rental-block-numbers');
  const totalDeposit = document.getElementById('total-deposit');

  if (rentalNumbers) {
    if (selectedBlocks.length > 0) {
      const groupedBlocks = groupBlocksByArea();
      const displayText = Object.entries(groupedBlocks).map(([areaKey, blocks]) => {
        const areaName = getAreaNameByKey(areaKey);
        const areaData = Object.values(areaMapping).find(area => area.key === areaKey);

        // 檢查是否選中了該區域的所有區塊
        if (areaData && areaData.totalBlocks > 0 && blocks.length === areaData.totalBlocks) {
          return `${areaName}: ALL`;
        } else {
          return `${areaName}: ${blocks.join(', ')}`;
        }
      }).join('\n');

      rentalNumbers.innerHTML = displayText.replace(/\n/g, '<br>');
    } else {
      rentalNumbers.textContent = '--';
    }
  }

  if (totalDeposit) {
    const total = calculateTotalDeposit();
    totalDeposit.textContent = `NT ${total.toLocaleString()}`;
  }

  const clearButton = document.getElementById('clear-button');
  const addButton = document.getElementById('add-button');

  if (clearButton) {
    clearButton.disabled = selectedBlocks.length === 0;
  }

  if (addButton) {
    if (selectedBlocks.length > 0) {
      const hasPermissionBlocks = hasProjectPermissionBlocks();
      if (hasPermissionBlocks) {
        const checkbox = document.getElementById('project-permission-checkbox');
        addButton.disabled = !(checkbox && checkbox.checked);
      } else {
        addButton.disabled = false;
      }
    } else {
      addButton.disabled = true;
    }
  }

  // 管理專案許可區確認checkbox的顯示
  const projectPermissionSection = document.getElementById('project-permission-section');
  if (projectPermissionSection) {
    const hasPermissionBlocks = hasProjectPermissionBlocks();

    if (hasPermissionBlocks && selectedBlocks.length > 0) {
      projectPermissionSection.classList.remove('hidden');
      projectPermissionSection.style.display = 'flex';
    } else {
      projectPermissionSection.classList.add('hidden');
      projectPermissionSection.style.display = 'none';
      const checkbox = document.getElementById('project-permission-checkbox');
      if (checkbox) {
        checkbox.checked = false;
      }
    }
  }
}

// 檢測是否選中了專案許可區的格子
function hasProjectPermissionBlocks() {
  if (selectedBlocks.length === 0) {
    return false;
  }

  return selectedBlocks.some(block => {
    if (block.areaKey === 'corridor') {
      return true;
    }

    if (block.areaKey === 'pillar') {
      return true;
    }

    if (block.areaKey === 'glass-wall' && ['Y4', 'Y5', 'Y6', 'Y7'].includes(block.cellId)) {
      return true;
    }

    return false;
  });
}

// 添加到購物車
function addToCart() {
  if (selectedBlocks.length === 0) {
    return;
  }


  const groupedBlocks = groupBlocksByArea();

  Object.entries(groupedBlocks).forEach(([areaKey, blocks]) => {
    const areaData = Object.values(areaMapping).find(area => area.key === areaKey);
    if (!areaData) return;

    if (window.cartManager) {
      const cart = window.cartManager.getCart();

      // 查找購物車中是否已有此區域的項目
      const existingItem = cart.find(item =>
        item.category === 'area' && item.areaKey === areaKey
      );

      if (existingItem) {
        // 合併區塊：將新區塊加入已存在的項目
        blocks.forEach(blockId => {
          if (!existingItem.blocks.includes(blockId)) {
            existingItem.blocks.push(blockId);
          }
        });

        // 重新排序區塊
        const sortedBlocks = sortBlockIds([...existingItem.blocks]);
        existingItem.blocks = sortedBlocks;

        // 更新名稱和押金
        if (areaData.totalBlocks > 0 && existingItem.blocks.length === areaData.totalBlocks) {
          existingItem.name = `${areaData.name} (ALL)`;
        } else {
          existingItem.name = `${areaData.name} (${sortedBlocks.join(', ')})`;
        }
        existingItem.deposit = areaData.deposit * existingItem.blocks.length;

        // 保存更新後的購物車
        window.cartManager.saveCart(cart);
      } else {
        // 創建新項目
        let displayName;
        if (areaData.totalBlocks > 0 && blocks.length === areaData.totalBlocks) {
          displayName = `${areaData.name} (ALL)`;
        } else {
          displayName = `${areaData.name} (${blocks.join(', ')})`;
        }

        const cartItem = {
          id: `${areaKey}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: displayName,
          category: 'area',
          deposit: areaData.deposit * blocks.length,
          image: '',
          quantity: 1,
          areaKey: areaKey,
          blocks: blocks
        };

        window.cartManager.addAreaToCart(cartItem);
      }
    }
  });

  selectedBlocks.forEach(block => {
    const exists = cartBlocks.some(cartBlock =>
      cartBlock.areaKey === block.areaKey && cartBlock.cellId === block.cellId
    );

    if (!exists) {
      cartBlocks.push({
        areaKey: block.areaKey,
        cellId: block.cellId
      });
    }
  });

  showAddedToCartToast();
  clearRightPanelDisplay();

}

// 顯示加入購物車成功的 toast
function showAddedToCartToast() {
  const blockNumbers = selectedBlocks.map(block => block.cellId).sort();

  let message;
  if (blockNumbers.length <= 3) {
    message = `已成功加入${blockNumbers.join('、')}到租借清單！`;
  } else {
    const displayNumbers = blockNumbers.slice(0, 3).join('、');
    message = `已成功加入${displayNumbers}等編號到租借清單！`;
  }

  if (window.showBookmarkToast) {
    window.showBookmarkToast(message, 'success');
  } else if (window.showToast) {
    window.showToast(message, 'success');
  }
}

// 清除選中的區塊
function clearSelectedBlocks() {
  selectedBlocks.forEach(block => {
    const svg = document.getElementById('area-booking-svg');
    if (svg) {
      const element = svg.querySelector(`#${block.cellId}`);
      if (element) {
        restoreOriginalStyles(element);
        element.style.filter = 'brightness(1)';
      }
    }
  });

  selectedBlocks = [];

  const rentalNumbers = document.getElementById('rental-block-numbers');
  const totalDeposit = document.getElementById('total-deposit');
  const clearButton = document.getElementById('clear-button');
  const addButton = document.getElementById('add-button');

  if (rentalNumbers) {
    rentalNumbers.textContent = '--';
  }

  if (totalDeposit) {
    totalDeposit.textContent = 'NT 0';
  }

  if (clearButton) {
    clearButton.disabled = true;
  }

  if (addButton) {
    addButton.disabled = true;
  }

  const projectPermissionSection = document.getElementById('project-permission-section');
  const checkbox = document.getElementById('project-permission-checkbox');
  if (projectPermissionSection) {
    projectPermissionSection.style.display = 'none';
  }
  if (checkbox) {
    checkbox.checked = false;
  }

  updateSelectAllButtonState();

}

// 清除右側面板顯示
function clearRightPanelDisplay() {
  const rentalNumbers = document.getElementById('rental-block-numbers');
  const totalDeposit = document.getElementById('total-deposit');
  const addButton = document.getElementById('add-button');
  const clearButton = document.getElementById('clear-button');
  const projectPermissionSection = document.getElementById('project-permission-section');
  const checkbox = document.getElementById('project-permission-checkbox');

  if (rentalNumbers) {
    rentalNumbers.textContent = '--';
  }

  if (totalDeposit) {
    totalDeposit.textContent = 'NT 0';
  }

  if (addButton) {
    addButton.disabled = true;
  }

  if (clearButton) {
    clearButton.disabled = true;
  }

  if (projectPermissionSection) {
    projectPermissionSection.style.display = 'none';
  }

  if (checkbox) {
    checkbox.checked = false;
  }

  selectedBlocks = [];

}

// 檢查 URL 參數並自動導航到指定區域
function checkAndNavigateToArea() {
  const urlParams = new URLSearchParams(window.location.search);
  const areaParam = urlParams.get('area');
  const fromRentalList = urlParams.get('from') === 'rental-list';

  if (areaParam) {
    const areaData = Object.values(areaMapping).find(area => area.key === areaParam);

    if (areaData) {
      if (fromRentalList) {
        enterAreaView(areaParam, areaData.name, true);
      } else {
        setTimeout(() => {
          enterAreaView(areaParam, areaData.name);
        }, 100);
      }
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// 載入購物車中的區域區塊
function loadCartBlocks() {
  if (!window.cartManager) return;

  const cart = window.cartManager.getCart();
  const areaItems = cart.filter(item => item.category === 'area');

  areaItems.forEach(item => {
    if (item.blocks && item.areaKey) {
      item.blocks.forEach(blockId => {
        const exists = cartBlocks.some(cartBlock =>
          cartBlock.areaKey === item.areaKey && cartBlock.cellId === blockId
        );

        if (!exists) {
          cartBlocks.push({
            areaKey: item.areaKey,
            cellId: blockId
          });
        }
      });
    }
  });

}

// 設置breadcrumb重置功能
function setupBreadcrumbReset() {
  const mainBreadcrumb = document.getElementById('main-breadcrumb');
  if (mainBreadcrumb) {
    mainBreadcrumb.addEventListener('click', () => {
      resetToInitialState();
    });
  }
}

// 設置BACK按鈕功能
function setupBackButton() {
  const backButton = document.getElementById('back-button');
  if (backButton) {
    backButton.addEventListener('click', () => {
      resetToInitialState();
    });
  }
}

// 重置到初始狀態
function resetToInitialState() {
  isAreaSelected = false;
  currentSelectedAreaKey = null;

  const leftMenu = document.getElementById('left-overlay-menu');
  leftMenu.classList.remove('show');

  const rightPanel = document.getElementById('right-info-panel');
  rightPanel.classList.remove('show');

  const svg = document.getElementById('area-booking-svg');
  if (svg) {
    svg.style.transform = '';
  }

  const areaSeparator = document.querySelector('#area-separator');
  const areaItem = document.querySelector('#area-breadcrumb');
  if (areaSeparator) areaSeparator.remove();
  if (areaItem) areaItem.remove();

  const menuItems = document.querySelectorAll('.area-menu-item');
  menuItems.forEach(item => {
    item.classList.remove('selected');
  });

  if (window.areaGroups) {
    window.areaGroups.forEach(group => {
      group.classList.remove('dimmed');
      group.style.opacity = '1';
      group.style.pointerEvents = 'auto';
    });
  }

  removeGridCellInteractions();

  // 顯示購物車中的區塊（綠色）
  showCartBlocksInOverview();

  const tooltip = document.getElementById('area-tooltip');
  tooltip.classList.remove('show');

}

// 移除格子互動功能
function removeGridCellInteractions() {
  clearAllGridCellListeners();
  clearSelectedBlocks();
  restoreAllGridCellsToOriginalState();

}

// 輔助函數們
function clearAllGridCellListeners() {
  const svg = document.getElementById('area-booking-svg');
  if (!svg) return;

  const allElements = svg.querySelectorAll('[id]');

  allElements.forEach(element => {
    const id = element.id;

    const isGridCell = isGridCellElement(id);

    if (isGridCell && element._gridEventHandlers) {
      element.removeEventListener('mouseenter', element._gridEventHandlers.mouseenter);
      element.removeEventListener('mouseleave', element._gridEventHandlers.mouseleave);
      element.removeEventListener('click', element._gridEventHandlers.click);

      delete element._gridEventHandlers;

      element.style.cursor = '';
      element.style.transition = '';
      element.style.filter = '';
    }
  });

}

function restoreAllGridCellsToOriginalState() {
  const svg = document.getElementById('area-booking-svg');
  if (!svg) return;

  const allElements = svg.querySelectorAll('[id]');

  allElements.forEach(element => {
    const id = element.id;

    const isGridCell = isGridCellElement(id);

    if (isGridCell) {
      restoreOriginalStyles(element);
      element.style.filter = 'brightness(1)';
      element.style.opacity = '1';
      element.style.cursor = '';
    }
  });

}

function showCartBlocksInOverview() {
  const svg = document.getElementById('area-booking-svg');
  if (!svg) return;

  // 為購物車中的所有區塊添加綠色顯示（但不添加點擊事件）
  cartBlocks.forEach(block => {
    const element = svg.querySelector(`#${block.cellId}`);
    if (element) {
      applyColorToElement(element, '#00ff80');
      element.style.filter = 'brightness(1)';
      element.style.opacity = '1';
      element.style.cursor = 'default'; // 設為默認游標，表示不可點擊
    }
  });
}

function storeOriginalStyles(element) {
  const allElements = [element, ...element.querySelectorAll('*')];
  allElements.forEach(el => {
    if (!el.dataset.originalFill) {
      el.dataset.originalFill = el.getAttribute('fill') || '';
    }
    if (!el.dataset.originalStroke) {
      el.dataset.originalStroke = el.getAttribute('stroke') || '';
    }
    if (!el.dataset.originalStyle) {
      el.dataset.originalStyle = el.getAttribute('style') || '';
    }
    const computedStyle = window.getComputedStyle(el);
    if (!el.dataset.computedFill) {
      el.dataset.computedFill = computedStyle.fill || '';
    }
  });
}

function applyColorToElement(element, color) {
  const allElements = [element, ...element.querySelectorAll('*')];
  allElements.forEach(el => {
    el.setAttribute('fill', color);
    el.style.setProperty('fill', color, 'important');

    if (el.dataset.originalStroke && el.dataset.originalStroke !== '' && el.dataset.originalStroke !== 'none') {
      el.setAttribute('stroke', color);
      el.style.setProperty('stroke', color, 'important');
    }

    if (el.hasAttribute('stop-color')) el.setAttribute('stop-color', color);
    if (el.hasAttribute('flood-color')) el.setAttribute('flood-color', color);
  });
}

function restoreOriginalStyles(element) {
  const allElements = [element, ...element.querySelectorAll('*')];
  allElements.forEach(el => {
    const originalFill = el.dataset.originalFill;
    if (originalFill && originalFill !== '' && originalFill !== 'none') {
      el.setAttribute('fill', originalFill);
    } else {
      el.removeAttribute('fill');
    }

    const originalStroke = el.dataset.originalStroke;
    if (originalStroke && originalStroke !== '' && originalStroke !== 'none') {
      el.setAttribute('stroke', originalStroke);
    } else {
      el.removeAttribute('stroke');
    }

    el.style.removeProperty('fill');
    el.style.removeProperty('stroke');
    el.style.removeProperty('color');
  });
}

function isBlockSelected(cellId, areaKey) {
  return selectedBlocks.some(block => block.cellId === cellId && block.areaKey === areaKey);
}

function isBlockInCart(cellId, areaKey) {
  return cartBlocks.some(block => block.cellId === cellId && block.areaKey === areaKey);
}

function isBlockSubmitted(cellId, areaKey) {
  return submittedBlocks.some(block => block.cellId === cellId && block.areaKey === areaKey);
}

function updateGridCellStyle(cellId, isSelected, isSubmitted = false) {
  const svg = document.getElementById('area-booking-svg');
  if (!svg) return;

  const element = svg.querySelector(`#${cellId}`);
  if (!element) {
    console.warn(`找不到格子元素: ${cellId}`);
    return;
  }

  if (isSubmitted || isBlockSubmitted(cellId, currentSelectedAreaKey)) {
    applyColorToElement(element, '#ff448a');
    element.style.filter = 'brightness(1)';
    setCursorForElementAndChildren(element, 'not-allowed');
  } else if (isSelected) {
    applyColorToElement(element, '#00ff80');
    element.style.filter = 'brightness(1)';
    element.style.opacity = '1';
    setCursorForElementAndChildren(element, 'pointer');
  } else if (isBlockInCart(cellId, currentSelectedAreaKey)) {
    applyColorToElement(element, '#00ff80');
    element.style.filter = 'brightness(1)';
    element.style.opacity = '1';
    setCursorForElementAndChildren(element, 'pointer'); // 改為可點擊
  } else {
    restoreOriginalStyles(element);
    element.style.filter = 'brightness(1)';
    element.style.opacity = '1';
    setCursorForElementAndChildren(element, 'pointer');
  }
}

function setCursorForElementAndChildren(element, cursor) {
  element.style.cursor = cursor;
  const children = element.querySelectorAll('*');
  children.forEach(child => {
    child.style.cursor = cursor;
  });
}

function restoreCurrentAreaSelectedStyles() {
  if (!currentSelectedAreaKey) return;

  const currentAreaBlocks = selectedBlocks.filter(block => block.areaKey === currentSelectedAreaKey);
  currentAreaBlocks.forEach(block => {
    updateGridCellStyle(block.cellId, true);
  });

  const currentAreaCartBlocks = cartBlocks.filter(block => block.areaKey === currentSelectedAreaKey);
  currentAreaCartBlocks.forEach(block => {
    updateGridCellStyle(block.cellId, false);
  });

  const currentAreaSubmittedBlocks = submittedBlocks.filter(block => block.areaKey === currentSelectedAreaKey);
  currentAreaSubmittedBlocks.forEach(block => {
    updateGridCellStyle(block.cellId, false, true);
  });

}

function sortBlockIds(blockIds) {
  return blockIds.sort((a, b) => {
    // 提取字母和數字部分
    const matchA = a.match(/^([A-Z]+)(\d+)$/);
    const matchB = b.match(/^([A-Z]+)(\d+)$/);

    if (!matchA || !matchB) {
      return a.localeCompare(b);
    }

    const [, letterA, numA] = matchA;
    const [, letterB, numB] = matchB;

    // 先比較字母
    if (letterA !== letterB) {
      return letterA.localeCompare(letterB);
    }

    // 字母相同，比較數字
    return parseInt(numA) - parseInt(numB);
  });
}

function groupBlocksByArea() {
  const grouped = {};
  selectedBlocks.forEach(block => {
    if (!grouped[block.areaKey]) {
      grouped[block.areaKey] = [];
    }
    grouped[block.areaKey].push(block.cellId);
  });

  // 對每個區域的區塊編號進行排序
  Object.keys(grouped).forEach(areaKey => {
    grouped[areaKey] = sortBlockIds(grouped[areaKey]);
  });

  return grouped;
}

function getAreaNameByKey(areaKey) {
  const areaData = Object.values(areaMapping).find(area => area.key === areaKey);
  return areaData ? areaData.name : areaKey;
}

function calculateTotalDeposit() {
  const total = selectedBlocks.reduce((sum, block) => {
    const areaData = Object.values(areaMapping).find(area => area.key === block.areaKey);
    const deposit = areaData ? areaData.deposit : 1000;
    return sum + deposit;
  }, 0);

  // 押金總額不超過5000
  return Math.min(total, 5000);
}

// 從購物車移除區塊
function removeBlockFromCart(cellId, areaKey) {
  // 從 cartBlocks 移除
  const cartBlockIndex = cartBlocks.findIndex(block =>
    block.cellId === cellId && block.areaKey === areaKey
  );

  if (cartBlockIndex === -1) return;

  cartBlocks.splice(cartBlockIndex, 1);

  // 從購物車管理器中移除
  if (window.cartManager) {
    const cart = window.cartManager.getCart();
    let itemToRemove = null;
    let cartUpdated = false;

    // 找到包含此區塊的項目
    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      if (item.category === 'area' && item.areaKey === areaKey && item.blocks && item.blocks.includes(cellId)) {
        // 從區塊列表中移除此區塊
        const blockIndex = item.blocks.indexOf(cellId);
        item.blocks.splice(blockIndex, 1);
        cartUpdated = true;

        // 如果這個區域沒有區塊了，標記要移除
        if (item.blocks.length === 0) {
          itemToRemove = item.id;
        } else {
          // 更新名稱和押金
          const areaData = Object.values(areaMapping).find(area => area.key === areaKey);
          if (areaData) {
            const sortedBlocks = sortBlockIds([...item.blocks]);

            // 檢查剩餘區塊是否等於總區塊數
            if (areaData.totalBlocks > 0 && item.blocks.length === areaData.totalBlocks) {
              item.name = `${areaData.name} (ALL)`;
            } else {
              item.name = `${areaData.name} (${sortedBlocks.join(', ')})`;
            }
            item.deposit = areaData.deposit * item.blocks.length;
          }
        }
        break;
      }
    }

    // 如果需要移除整個項目
    if (itemToRemove) {
      const updatedCart = cart.filter(item => item.id !== itemToRemove);
      window.cartManager.saveCart(updatedCart);
    } else if (cartUpdated) {
      // 只是更新區塊列表
      window.cartManager.saveCart(cart);
    }
  }

  // 更新顯示
  const svg = document.getElementById('area-booking-svg');
  if (svg) {
    const element = svg.querySelector(`#${cellId}`);
    if (element) {
      // 移除平面圖上的點擊事件
      if (element._overviewClickHandler) {
        element.removeEventListener('click', element._overviewClickHandler);
        delete element._overviewClickHandler;
      }

      // 恢復原始樣式
      if (currentSelectedAreaKey === areaKey) {
        // 在區域詳細檢視中
        updateGridCellStyle(cellId, false);
      } else {
        // 在平面圖中
        restoreOriginalStyles(element);
        element.style.filter = 'brightness(1)';
        element.style.opacity = '1';
      }
    }
  }

  // 顯示提示
  if (window.showBookmarkToast) {
    window.showBookmarkToast(`已從租借清單移除 ${cellId}`, 'success');
  } else if (window.showToast) {
    window.showToast(`已從租借清單移除 ${cellId}`, 'success');
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  initNumberedAreaPage();
});