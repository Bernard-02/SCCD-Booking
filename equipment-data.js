// 設備數據庫
const EQUIPMENT_DATA = {
    'speaker-clamp-light': {
        id: 'speaker-clamp-light',
        category: '燈具',
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
    },
    'led-light': {
        id: 'led-light',
        category: '燈具',
        name: 'LED補光燈',
        status: '有現貨',
        statusColor: '#00ff80',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 4,
        deposit: 500,
        description: '專業LED補光燈，色溫可調，亮度均勻。適合人像攝影和產品拍攝，低功耗高效能。'
    },
    'folding-table': {
        id: 'folding-table',
        category: '展桌/畫板',
        name: '折疊展示桌',
        status: '有現貨',
        statusColor: '#00ff80',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 2,
        deposit: 500,
        description: '輕便折疊展示桌，適合展覽和活動使用。堅固耐用，收納方便，桌面平整光滑。'
    },
    'projector': {
        id: 'projector',
        category: '視聽類',
        name: '便攜式投影機',
        status: '已借出',
        statusColor: '#ff448a',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 1,
        deposit: 500,
        description: '高解析度便攜式投影機，支援多種輸入格式。輕巧便攜，適合簡報和小型放映使用。'
    },
    'electric-screwdriver': {
        id: 'electric-screwdriver',
        category: '工具',
        name: '電動螺絲起子',
        status: '有現貨',
        statusColor: '#00ff80',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 2,
        deposit: 500,
        description: '專業電動螺絲起子，扭力可調，適用於各種螺絲規格。電池續航力強，操作簡便。'
    },
    'heat-gun': {
        id: 'heat-gun',
        category: '機具',
        name: '熱風槍',
        status: '有現貨',
        statusColor: '#00ff80',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 1,
        deposit: 500,
        description: '工業級熱風槍，溫度可調，適用於塑形、除漆等作業。安全防護設計，操作穩定。'
    },
    'hdmi-cable': {
        id: 'hdmi-cable',
        category: '線材',
        name: 'HDMI傳輸線',
        status: '有現貨',
        statusColor: '#00ff80',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 8,
        deposit: 500,
        description: '高品質HDMI傳輸線，支援4K解析度。鍍金接頭，信號穩定，適合各種影音設備連接。'
    },
    'ring-light': {
        id: 'ring-light',
        category: '燈具',
        name: '環形補光燈',
        status: '有現貨',
        statusColor: '#00ff80',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 2,
        deposit: 500,
        description: '專業環形補光燈，光線柔和均勻。特別適合人像攝影和直播使用，可調節亮度和色溫。'
    },
    'professional-easel': {
        id: 'professional-easel',
        category: '展桌/畫板',
        name: '專業畫板',
        status: '已借出',
        statusColor: '#ff448a',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 3,
        deposit: 500,
        description: '專業級畫板，角度可調，高度可調整。適合各種繪畫和展示需求，穩固耐用。'
    },
    'wireless-microphone': {
        id: 'wireless-microphone',
        category: '視聽類',
        name: '無線麥克風',
        status: '有現貨',
        statusColor: '#00ff80',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 3,
        deposit: 500,
        description: '專業無線麥克風系統，音質清晰，抗干擾能力強。適合演講、表演和錄音使用。'
    },
    'utility-knife-set': {
        id: 'utility-knife-set',
        category: '工具',
        name: '美工刀組',
        status: '有現貨',
        statusColor: '#00ff80',
        mainImage: 'Images/Extension Cord.jpg',
        quantity: 5,
        deposit: 500,
        description: '專業美工刀組，包含多種刀片規格。切割精準，握感舒適，適合各種手作和設計工作。'
    }
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