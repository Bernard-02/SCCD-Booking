// 設備數據庫
const EQUIPMENT_DATA = {
    'speaker-clamp-light': {
        id: 'speaker-clamp-light',
        category: '喇叭夾燈',
        name: '黑色喇叭夾燈',
        status: '有現貨',
        statusColor: '#00ff80',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 3,
        deposit: 500,
        description: '這款黑色喇叭夾燈專為媒體製作而設計，提供穩定的照明效果。適合各種拍攝場景，輕巧便攜，夾具堅固耐用。'
    },
    'extension-cord': {
        id: 'extension-cord',
        category: '線材',
        name: '專業延長線',
        status: '有現貨',
        statusColor: '#00ff80',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 5,
        deposit: 500,
        description: '高品質專業延長線，適用於各種攝影設備供電需求。多重安全保護，確保設備安全運行。'
    }
    // 可以繼續添加更多設備...
};

// 獲取設備數據的輔助函數
function getEquipmentById(equipmentId) {
    return EQUIPMENT_DATA[equipmentId] || null;
}

function getAllEquipment() {
    return Object.values(EQUIPMENT_DATA);
}

function getEquipmentByCategory(category) {
    return Object.values(EQUIPMENT_DATA).filter(equipment => equipment.category === category);
} 