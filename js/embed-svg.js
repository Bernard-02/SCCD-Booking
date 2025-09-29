// 動態載入並嵌入SVG以支援內部元素控制
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 載入SVG內容
        const response = await fetch('Area/A5F Area Homepage.svg');
        const svgContent = await response.text();
        
        // 找到SVG容器
        const container = document.querySelector('.py-12.text-center.relative > div');
        if (!container) {
            console.error('SVG container not found');
            return;
        }
        
        // 插入SVG內容
        container.innerHTML = svgContent;
        
        // 找到SVG元素並設置樣式
        const svg = container.querySelector('svg');
        if (svg) {
            // 設置SVG樣式以保持50%寬度和居中
            svg.style.width = '100%';
            svg.style.height = 'auto';
            svg.style.display = 'block';
            
            // 為SVG添加ID以便CSS選擇
            svg.id = 'area-map-svg';
        }
        
        // 設置hover效果和toggle功能
        setupHoverEffects(svg);
        setupStatusToggle(svg);
        
        console.log('SVG loaded and embedded successfully');
        
    } catch (error) {
        console.error('Failed to load SVG:', error);
    }
});

function setupHoverEffects(svg) {
    if (!svg) return;

    const areaItems = document.querySelectorAll('.area-item');
    
    // 定義區域對應的SVG群組
    const areaMapping = {
        'square': 'Square_00000182511804602346659000000005465159496059156352_',
        'corridor': 'Corridor_00000054253696021401463270000011895499425825329057_',
        'front-terrace': 'Front_Terrace_00000090268161127870382690000014504900871044795011_',
        'back-terrace': 'Back_Terrace_00000056418405994274588460000015042233556369055388_',
        'glass-wall': 'Glass_Wall_00000000186369360168713920000002393977063800030610_',
        'pillar': 'Pillar_00000105403812364892765500000010771666716634094254_'
    };

    // 獲取所有SVG群組
    const allGroups = Object.values(areaMapping).map(id => svg.querySelector(`#${id}`)).filter(g => g);

    areaItems.forEach(item => {
        const areaType = item.getAttribute('data-area');
        const targetGroupId = areaMapping[areaType];
        const targetGroup = svg.querySelector(`#${targetGroupId}`);

        item.addEventListener('mouseenter', () => {
            // 其他說明行變淡
            areaItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.style.opacity = '0.3';
                }
            });

            // SVG中其他群組變淡，但保持Map_Base和Map_Outline正常
            allGroups.forEach(group => {
                if (group && group !== targetGroup) {
                    group.style.opacity = '0.3';
                }
            });

            // 如果Status圈圈是顯示狀態，也讓對應的Status群組變淡
            if (window.statusGroups && window.statusVisible && window.statusVisible()) {
                const targetStatusGroup = svg.querySelector(`#${window.statusMapping[areaType]}`);
                window.statusGroups.forEach(group => {
                    if (group && group !== targetStatusGroup) {
                        group.style.opacity = '0.3';
                    }
                });
            }
        });

        item.addEventListener('mouseleave', () => {
            // 恢復所有說明行正常狀態
            areaItems.forEach(otherItem => {
                otherItem.style.opacity = '1';
            });

            // 恢復所有SVG群組正常狀態
            allGroups.forEach(group => {
                if (group) {
                    group.style.opacity = '1';
                }
            });

            // 恢復所有Status群組正常狀態
            if (window.statusGroups) {
                window.statusGroups.forEach(group => {
                    if (group) {
                        group.style.opacity = '1';
                    }
                });
            }
        });
    });

    // 為所有群組添加過渡效果
    allGroups.forEach(group => {
        if (group) {
            group.style.transition = 'opacity 0.2s ease-in-out';
        }
    });
}

function setupStatusToggle(svg) {
    if (!svg) return;

    const toggleBtn = document.getElementById('status-toggle-btn');
    if (!toggleBtn) return;

    // 定義Status群組對應表
    const statusMapping = {
        'square': 'Square_Status',
        'corridor': 'Corridor_Status_00000048464755918564204620000017221934588794004625_',
        'front-terrace': 'Front_Terrace_Status',
        'back-terrace': 'Back_Terrace_Status',
        'glass-wall': 'Glass_Wall_Status',
        'pillar': 'Pillar_Status'
    };

    // 獲取所有Status群組
    const allStatusGroups = Object.values(statusMapping).map(id => svg.querySelector(`#${id}`)).filter(g => g);
    
    // 為Status群組添加過渡效果
    allStatusGroups.forEach(group => {
        if (group) {
            group.style.transition = 'opacity 0.2s ease-in-out';
        }
    });

    // 初始狀態：顯示Status圈圈
    let statusVisible = true;

    // Toggle按鈕點擊事件
    toggleBtn.addEventListener('click', () => {
        statusVisible = !statusVisible;
        
        allStatusGroups.forEach(group => {
            if (group) {
                group.style.display = statusVisible ? 'block' : 'none';
            }
        });

        // 更新按鈕視覺狀態和圓圈
        const circle = toggleBtn.querySelector('#toggle-circle');
        const text = toggleBtn.querySelector('#toggle-text');
        
        if (circle && text) {
            if (statusVisible) {
                // 顯示狀態：顯示圓圈，文字為SHOW
                circle.style.opacity = '1';
                text.textContent = 'SHOW';
            } else {
                // 隱藏狀態：隱藏圓圈，文字為HIDE
                circle.style.opacity = '0';
                text.textContent = 'HIDE';
            }
        }
        
        toggleBtn.style.opacity = statusVisible ? '1' : '0.7';
    });

    // 設置E1-E6區塊的同步邏輯
    setupE1E6Sync(svg);

    // 將狀態群組存儲到全局，讓hover效果可以使用
    window.statusGroups = allStatusGroups;
    window.statusMapping = statusMapping;
    window.statusVisible = () => statusVisible;
}

function setupE1E6Sync(svg) {
    if (!svg) return;

    // 定義E1-E6的圓圈對應關係（兩組圓圈需要同步狀態）
    const classroomPairs = {
        'E1': ['E1', 'E1_00000069393003187801415200000000757819064959134352_'],
        'E2': ['E2', 'E2_00000114034738795507172950000015764362749406898313_'],
        'E3': ['E3', 'E3_00000181791688046969608860000017061487258311259305_'],
        'E4': ['E4', 'E4_00000024693444027937028110000017774423499638507684_'],
        'E5': ['E5', 'E5_00000151513673862070966160000005847174897224359332_'],
        'E6': ['E6', 'E6_00000107570697433511568010000000779736690074171534_']
    };

    // 存儲教室配對關係，供其他功能使用（如後端數據更新時的同步）
    window.classroomPairs = classroomPairs;

    // 提供同步狀態更新的函數，供外部調用
    window.syncE1E6Status = function(classroom, status) {
        if (!classroomPairs[classroom]) return;
        
        const circleIds = classroomPairs[classroom];
        const circles = circleIds.map(id => svg.querySelector(`#${id}`)).filter(circle => circle);
        
        circles.forEach(circle => {
            circle.setAttribute('data-status', status);
            // 根據狀態更新視覺樣式
            if (status === 'booked') {
                circle.style.fill = '#ff4444'; // 紅色表示已租借
            } else if (status === 'available') {
                circle.style.fill = '#44ff44'; // 綠色表示可用
            }
        });
    };
}