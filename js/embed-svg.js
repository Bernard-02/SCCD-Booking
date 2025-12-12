// 動態載入並嵌入SVG以支援內部元素控制
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 載入SVG內容
        const response = await fetch('Area/A5F Area Homepage.svg');
        const svgContent = await response.text();

        // 找到SVG容器
        const container = document.querySelector('#homepage-map-container > div');
        if (!container) {
            console.error('SVG container not found');
            return;
        }

        // 插入SVG內容
        container.innerHTML = svgContent;

        // 找到SVG元素並設置樣式
        const svg = container.querySelector('svg');
        if (svg) {
            // 設置SVG樣式以保持65%寬度和居中
            svg.style.width = '100%';
            svg.style.height = 'auto';
            svg.style.display = 'block';

            // 為SVG添加ID以便CSS選擇
            svg.id = 'area-map-svg';
        }

        // 設置hover效果和數據管理
        setupAreaHoverEffects(svg);

        console.log('SVG loaded and embedded successfully');

    } catch (error) {
        console.error('Failed to load SVG:', error);
    }
});

// 區域名稱映射（中文和英文）
const areaNameMap = {
    'square': { zh: '中庭', en: 'Square' },
    'corridor': { zh: '走廊', en: 'Corridor' },
    'front-terrace': { zh: '前陽台', en: 'Front Terrace' },
    'back-terrace': { zh: '後陽台', en: 'Back Terrace' },
    'glass-wall': { zh: '玻璃牆', en: 'Glass Wall' },
    'pillar': { zh: '柱子', en: 'Pillar' }
};

// 模擬後端數據結構 (未來將從API獲取)
let areaBlocksData = {
    // 中庭 Square
    'A1': { area: 'square', status: 'available', user: null },
    'A2': { area: 'square', status: 'booked', user: 'A111144001' },
    'A3': { area: 'square', status: 'available', user: null },
    'A4': { area: 'square', status: 'available', user: null },
    'A5': { area: 'square', status: 'available', user: null },
    'A6': { area: 'square', status: 'available', user: null },
    'A7': { area: 'square', status: 'booked', user: 'A111155002' },
    'A8': { area: 'square', status: 'available', user: null },
    'A9': { area: 'square', status: 'available', user: null },
    'A10': { area: 'square', status: 'available', user: null },
    'A11': { area: 'square', status: 'available', user: null },
    'B1': { area: 'square', status: 'available', user: null },
    'B2': { area: 'square', status: 'available', user: null },
    'B3': { area: 'square', status: 'available', user: null },
    'B4': { area: 'square', status: 'available', user: null },
    'B5': { area: 'square', status: 'available', user: null },
    'B6': { area: 'square', status: 'available', user: null },
    'B7': { area: 'square', status: 'available', user: null },
    'B8': { area: 'square', status: 'available', user: null },
    'B9': { area: 'square', status: 'available', user: null },
    'B10': { area: 'square', status: 'available', user: null },
    'B11': { area: 'square', status: 'available', user: null },
    'C3': { area: 'square', status: 'available', user: null },
    'C4': { area: 'square', status: 'available', user: null },
    'C5': { area: 'square', status: 'available', user: null },
    'C6': { area: 'square', status: 'available', user: null },
    'C7': { area: 'square', status: 'available', user: null },
    'C8': { area: 'square', status: 'available', user: null },
    'C9': { area: 'square', status: 'available', user: null },
    'C10': { area: 'square', status: 'available', user: null },
    'C11': { area: 'square', status: 'available', user: null },
    'D3': { area: 'square', status: 'available', user: null },
    'D4': { area: 'square', status: 'available', user: null },
    'D5': { area: 'square', status: 'available', user: null },
    'D6': { area: 'square', status: 'available', user: null },
    'D7': { area: 'square', status: 'available', user: null },
    'D8': { area: 'square', status: 'available', user: null },
    'D9': { area: 'square', status: 'available', user: null },
    'D10': { area: 'square', status: 'available', user: null },
    'D11': { area: 'square', status: 'available', user: null },
    'E1': { area: 'square', status: 'available', user: null },
    'E2': { area: 'square', status: 'available', user: null },
    'E3': { area: 'square', status: 'available', user: null },
    'E4': { area: 'square', status: 'available', user: null },
    'E5': { area: 'square', status: 'available', user: null },
    'E6': { area: 'square', status: 'available', user: null },
    'E7': { area: 'square', status: 'available', user: null },
    'E8': { area: 'square', status: 'available', user: null },
    'E9': { area: 'square', status: 'available', user: null },
    'E10': { area: 'square', status: 'available', user: null },
    'E11': { area: 'square', status: 'available', user: null },

    // 走廊 Corridor
    'H1': { area: 'corridor', status: 'available', user: null },
    'H2': { area: 'corridor', status: 'available', user: null },
    'H3': { area: 'corridor', status: 'available', user: null },
    'H4': { area: 'corridor', status: 'available', user: null },
    'H5': { area: 'corridor', status: 'available', user: null },
    'H6': { area: 'corridor', status: 'available', user: null },
    'H7': { area: 'corridor', status: 'available', user: null },
    'H8': { area: 'corridor', status: 'available', user: null },
    'H9': { area: 'corridor', status: 'available', user: null },
    'H10': { area: 'corridor', status: 'available', user: null },
    'G5': { area: 'corridor', status: 'available', user: null },
    'G6': { area: 'corridor', status: 'available', user: null },
    'G7': { area: 'corridor', status: 'available', user: null },
    'G8': { area: 'corridor', status: 'available', user: null },
    'G9': { area: 'corridor', status: 'available', user: null },
    'G10': { area: 'corridor', status: 'available', user: null },

    // 前陽台 Front Terrace
    'K1': { area: 'front-terrace', status: 'available', user: null },
    'K2': { area: 'front-terrace', status: 'available', user: null },
    'K3': { area: 'front-terrace', status: 'available', user: null },
    'K4': { area: 'front-terrace', status: 'available', user: null },
    'K5': { area: 'front-terrace', status: 'available', user: null },
    'K6': { area: 'front-terrace', status: 'available', user: null },
    'K7': { area: 'front-terrace', status: 'available', user: null },
    'K8': { area: 'front-terrace', status: 'available', user: null },
    'K9': { area: 'front-terrace', status: 'available', user: null },
    'K10': { area: 'front-terrace', status: 'available', user: null },

    // 後陽台 Back Terrace
    'L1': { area: 'back-terrace', status: 'available', user: null },
    'L2': { area: 'back-terrace', status: 'available', user: null },
    'L3': { area: 'back-terrace', status: 'available', user: null },
    'L4': { area: 'back-terrace', status: 'available', user: null },
    'L5': { area: 'back-terrace', status: 'available', user: null },
    'L6': { area: 'back-terrace', status: 'available', user: null },

    // 玻璃牆 Glass Wall
    'Y1': { area: 'glass-wall', status: 'available', user: null },
    'Y2': { area: 'glass-wall', status: 'available', user: null },
    'Y3': { area: 'glass-wall', status: 'available', user: null },
    'Y4': { area: 'glass-wall', status: 'available', user: null },
    'Y5': { area: 'glass-wall', status: 'available', user: null },
    'Y6': { area: 'glass-wall', status: 'available', user: null },
    'Y7': { area: 'glass-wall', status: 'available', user: null },
    'Y8': { area: 'glass-wall', status: 'available', user: null },
    'Y9': { area: 'glass-wall', status: 'available', user: null },
    'Y10': { area: 'glass-wall', status: 'available', user: null },
    'Y11': { area: 'glass-wall', status: 'available', user: null },
    'Y12': { area: 'glass-wall', status: 'available', user: null },
    'Y13': { area: 'glass-wall', status: 'available', user: null },
    'Y14': { area: 'glass-wall', status: 'available', user: null },
    'Y15': { area: 'glass-wall', status: 'available', user: null },
    'Y16': { area: 'glass-wall', status: 'available', user: null },
    'Y17': { area: 'glass-wall', status: 'available', user: null },
    'Y18': { area: 'glass-wall', status: 'available', user: null },
    'Y19': { area: 'glass-wall', status: 'available', user: null },
    'Y20': { area: 'glass-wall', status: 'available', user: null },
    'Y21': { area: 'glass-wall', status: 'available', user: null },
    'Y22': { area: 'glass-wall', status: 'available', user: null },
    'Y23': { area: 'glass-wall', status: 'available', user: null },
    'Y24': { area: 'glass-wall', status: 'available', user: null },
    'Y25': { area: 'glass-wall', status: 'available', user: null },
    'Y26': { area: 'glass-wall', status: 'available', user: null },

    // 柱子 Pillar
    'Z1': { area: 'pillar', status: 'available', user: null },
    'Z2': { area: 'pillar', status: 'available', user: null },
    'Z3': { area: 'pillar', status: 'available', user: null },
    'Z4': { area: 'pillar', status: 'available', user: null },
    'Z5': { area: 'pillar', status: 'available', user: null },
    'Z6': { area: 'pillar', status: 'available', user: null },
    'Z7': { area: 'pillar', status: 'available', user: null },
    'Z8': { area: 'pillar', status: 'available', user: null },
    'Z9': { area: 'pillar', status: 'available', user: null },

    // 走廊 Corridor (J開頭)
    'J1': { area: 'corridor', status: 'available', user: null },
    'J2': { area: 'corridor', status: 'available', user: null },
    'J3': { area: 'corridor', status: 'available', user: null }
};

// 區域群組ID映射
const areaGroupIds = {
    'square': 'Square',
    'corridor': 'Corridor',
    'front-terrace': 'Front_Terrace',
    'back-terrace': 'Back_Terrace',
    'glass-wall': 'Glass_Wall',
    'pillar': 'Pillar'
};

function setupAreaHoverEffects(svg) {
    if (!svg) return;

    const tooltip = document.getElementById('area-hover-tooltip');
    if (!tooltip) return;

    // 存儲所有區域群組元素
    const allAreaGroups = {};

    // 獲取所有區域群組
    Object.keys(areaGroupIds).forEach(areaKey => {
        const groupIdPattern = areaGroupIds[areaKey];
        // 查找包含該模式的群組
        const groups = svg.querySelectorAll(`g[id*="${groupIdPattern}"]`);

        groups.forEach(group => {
            const groupId = group.id;
            // 排除 Status 群組
            if (!groupId.includes('Status')) {
                if (!allAreaGroups[areaKey]) {
                    allAreaGroups[areaKey] = [];
                }
                allAreaGroups[areaKey].push(group);
            }
        });
    });

    // 為每個區域設置hover效果
    Object.keys(allAreaGroups).forEach(areaKey => {
        const groups = allAreaGroups[areaKey];

        groups.forEach(group => {
            // 設置該群組內所有子元素的顏色和hover事件
            const childElements = group.querySelectorAll('rect, polygon, path, circle');

            childElements.forEach(element => {
                const blockId = element.id;

                // 只處理有ID且在數據中的元素
                if (blockId && areaBlocksData[blockId]) {
                    const blockData = areaBlocksData[blockId];

                    // 根據狀態設置初始顏色
                    element.classList.add('area-block');
                    if (blockData.status === 'available') {
                        element.style.fill = 'var(--color-success)';
                    } else if (blockData.status === 'booked') {
                        element.style.fill = 'var(--color-error)';
                    }

                    // 為每個格子添加hover事件
                    element.addEventListener('mouseenter', (e) => {
                        showTooltip(e, blockId, blockData);
                        // 將當前區域外的其他區域變暗
                        dimOtherAreas(areaKey, allAreaGroups);
                    });

                    element.addEventListener('mousemove', (e) => {
                        updateTooltipPosition(e, tooltip);
                    });

                    element.addEventListener('mouseleave', () => {
                        hideTooltip();
                        // 恢復所有區域的不透明度
                        resetAreasOpacity(allAreaGroups);
                    });
                }
            });
        });
    });

    // 處理群組：E1-E6 和 H1-H10
    setupGroupBlocks(svg, tooltip, allAreaGroups);
}

// 處理特殊群組區塊 (E1-E6, H1-H10)
function setupGroupBlocks(svg, tooltip, allAreaGroups) {
    // E1-E6 群組映射
    const eGroups = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];

    // H1-H10 群組映射
    const hGroups = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10'];

    // 處理 E 群組 (屬於 square)
    eGroups.forEach(groupId => {
        const groupElement = svg.querySelector(`#${groupId}`);
        if (groupElement && areaBlocksData[groupId]) {
            const blockData = areaBlocksData[groupId];

            // 設置群組內所有元素的顏色
            const childElements = groupElement.querySelectorAll('rect, polygon, path');
            childElements.forEach(el => {
                el.classList.add('area-block');
                if (blockData.status === 'available') {
                    el.style.fill = 'var(--color-success)';
                } else if (blockData.status === 'booked') {
                    el.style.fill = 'var(--color-error)';
                }
            });

            // 為整個群組添加 hover 事件
            groupElement.addEventListener('mouseenter', (e) => {
                showTooltip(e, groupId, blockData);
                // E群組屬於 square 區域
                dimOtherAreas('square', allAreaGroups);
            });

            groupElement.addEventListener('mousemove', (e) => {
                updateTooltipPosition(e, tooltip);
            });

            groupElement.addEventListener('mouseleave', () => {
                hideTooltip();
                resetAreasOpacity(allAreaGroups);
            });
        }
    });

    // 處理 H 群組 (屬於 corridor)
    hGroups.forEach(groupId => {
        const groupElement = svg.querySelector(`#${groupId}`);
        if (groupElement && areaBlocksData[groupId]) {
            const blockData = areaBlocksData[groupId];

            // 設置群組內所有元素的顏色
            const childElements = groupElement.querySelectorAll('rect, polygon, path');
            childElements.forEach(el => {
                el.classList.add('area-block');
                if (blockData.status === 'available') {
                    el.style.fill = 'var(--color-success)';
                } else if (blockData.status === 'booked') {
                    el.style.fill = 'var(--color-error)';
                }
            });

            // 為整個群組添加 hover 事件
            groupElement.addEventListener('mouseenter', (e) => {
                showTooltip(e, groupId, blockData);
                // H群組屬於 corridor 區域
                dimOtherAreas('corridor', allAreaGroups);
            });

            groupElement.addEventListener('mousemove', (e) => {
                updateTooltipPosition(e, tooltip);
            });

            groupElement.addEventListener('mouseleave', () => {
                hideTooltip();
                resetAreasOpacity(allAreaGroups);
            });
        }
    });
}

function showTooltip(event, blockId, blockData) {
    const tooltip = document.getElementById('area-hover-tooltip');
    if (!tooltip) return;

    // 更新狀態文字和顏色
    const statusElement = tooltip.querySelector('.tooltip-status');
    const statusText = blockData.status === 'available' ? '可租借' : '已借出';
    statusElement.textContent = statusText;
    statusElement.className = 'tooltip-status font-chinese text-tiny ' + blockData.status;

    // 更新區域名稱
    const areaInfo = areaNameMap[blockData.area] || { zh: blockData.area, en: blockData.area };
    tooltip.querySelector('.tooltip-area-name').textContent = areaInfo.zh;
    tooltip.querySelector('.tooltip-area-english').textContent = areaInfo.en;

    // 更新編號
    tooltip.querySelector('.tooltip-block-id').textContent = blockId;

    // 如果是已借出狀態，顯示使用者學號（不需要"使用者："前綴）
    const userElement = tooltip.querySelector('.tooltip-user');
    if (blockData.status === 'booked' && blockData.user) {
        userElement.textContent = blockData.user;
        userElement.style.display = 'block';
    } else {
        userElement.style.display = 'none';
    }

    // 更新位置並顯示
    updateTooltipPosition(event, tooltip);
    tooltip.classList.add('show');
}

function updateTooltipPosition(event, tooltip) {
    // 將tooltip放在cursor右下角，並往上偏移一些
    const offsetX = 15;
    const offsetY = -20; // 負值表示往上移動

    tooltip.style.left = (event.clientX + offsetX) + 'px';
    tooltip.style.top = (event.clientY + offsetY) + 'px';
}

function hideTooltip() {
    const tooltip = document.getElementById('area-hover-tooltip');
    if (tooltip) {
        tooltip.classList.remove('show');
    }
}

// 將當前區域外的其他區域變暗（不透明度設為0.5）
function dimOtherAreas(currentAreaKey, allAreaGroups) {
    Object.keys(allAreaGroups).forEach(areaKey => {
        const groups = allAreaGroups[areaKey];

        groups.forEach(group => {
            if (areaKey !== currentAreaKey) {
                // 其他區域：設置不透明度為0.5
                group.style.opacity = '0.5';
            } else {
                // 當前區域：保持不透明度為1
                group.style.opacity = '1';
            }
        });
    });
}

// 恢復所有區域的不透明度
function resetAreasOpacity(allAreaGroups) {
    Object.keys(allAreaGroups).forEach(areaKey => {
        const groups = allAreaGroups[areaKey];

        groups.forEach(group => {
            group.style.opacity = '1';
        });
    });
}

// ===== 後台API集成接口 =====

/**
 * 從後台API獲取區塊數據
 * 未來替換為實際的API調用
 */
async function fetchAreaBlocksData() {
    try {
        // TODO: 替換為實際的API endpoint
        // const response = await fetch('/api/area-blocks/status');
        // const data = await response.json();
        // areaBlocksData = data;

        // 目前使用模擬數據
        console.log('Using mock data for area blocks');
        return areaBlocksData;
    } catch (error) {
        console.error('Failed to fetch area blocks data:', error);
        return areaBlocksData; // 返回默認數據
    }
}

/**
 * 更新單個區塊的狀態
 * @param {string} blockId - 區塊ID (例如: 'A1', 'B2')
 * @param {string} status - 狀態 ('available' 或 'booked')
 * @param {string|null} user - 使用者學號（如果status為'booked'）
 */
function updateBlockStatus(blockId, status, user = null) {
    if (areaBlocksData[blockId]) {
        areaBlocksData[blockId].status = status;
        areaBlocksData[blockId].user = user;

        // 更新SVG視覺
        const svg = document.getElementById('area-map-svg');
        if (svg) {
            // 嘗試直接找元素
            let element = svg.querySelector(`#${blockId}`);

            // 如果是群組元素（E1-E6, H1-H10），更新群組內所有子元素
            if (element && element.tagName === 'g') {
                const childElements = element.querySelectorAll('rect, polygon, path');
                childElements.forEach(child => {
                    if (status === 'available') {
                        child.style.fill = 'var(--color-success)';
                    } else if (status === 'booked') {
                        child.style.fill = 'var(--color-error)';
                    }
                });
            } else if (element) {
                // 單個元素
                if (status === 'available') {
                    element.style.fill = 'var(--color-success)';
                } else if (status === 'booked') {
                    element.style.fill = 'var(--color-error)';
                }
            }
        }

        console.log(`Block ${blockId} updated to ${status}`, user ? `by ${user}` : '');
    }
}

/**
 * 批量更新區塊狀態
 * @param {Array} updates - 更新數組，每個元素格式：{blockId, status, user}
 */
function batchUpdateBlockStatus(updates) {
    updates.forEach(update => {
        updateBlockStatus(update.blockId, update.status, update.user);
    });
}

// 將API函數暴露到全局，供其他模塊使用
window.AreaBlocksAPI = {
    fetchAreaBlocksData,
    updateBlockStatus,
    batchUpdateBlockStatus,
    getData: () => areaBlocksData
};
