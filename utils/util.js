// 觅食迹 - 工具函数库
const syncManager = require('./db/syncManager')

/**
 * 计算两点之间的距离（米）
 * 使用 Haversine 公式
 */
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 贪心最近邻路线规划算法（统一版）
 * @param {Array} shops - 店铺数组
 * @param {Object} startPoint - 起点 {lat, lng}
 * @returns {Array} 排序后的店铺数组
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return Math.round(meters) + 'm'
  } else {
    return (meters / 1000).toFixed(1) + 'km'
  }
}

/**
 * 估算出行时间
 * @param {number} meters - 距离（米）
 * @param {string} mode - 出行方式：drive/drive 或 transit/公共交通
 */
function estimateTime(meters, mode = 'drive') {
  // 驾车：3分钟/公里，公共交通：5分钟/公里，步行：12分钟/公里
  let speed = 3
  if (mode === 'transit') speed = 5
  if (mode === 'walk') speed = 12
  
  const minutes = Math.round(meters / 1000 * speed)
  if (minutes < 60) {
    return minutes + '分钟'
  } else {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours + '小时' + (mins > 0 ? mins + '分钟' : '')
  }
}

/**
 * 解析攻略文本（支持多种格式）
 * @param {string} text - 用户粘贴的攻略文本
 * @returns {Object} { foundShops: [], notFoundShops: [] }
*/
function parseBlockBasedGuide(text) {
  const foundShops = []
  const notFoundShops = []

  const placesData = require('./placesData')
  const shops = placesData.getFoods()
  const shopNameMap = {}
  shops.forEach(shop => {
    shopNameMap[shop.id] = shop.name
  })

  // 清理文本
  text = text.trim()
  
  // ========== 分割成多个店铺块 ==========
  // 优先按 ✅ 分隔
  let blocks = text.split(/✅/).filter(b => b.trim())
  
  // 如果 ✅ 只有一个，分隔失败，尝试其他方法
  // 尝试按 📍 分隔（保留分隔符）
  if (blocks.length <= 1) {
    const parts = text.split(/(?=📍)/).filter(p => p.trim())
    if (parts.length > 1) blocks = parts
  }
  
  // 尝试按 👏 或 👋 分隔
  if (blocks.length <= 1) {
    const parts = text.split(/(?=[👏👋])/).filter(p => p.trim())
    if (parts.length > 1) blocks = parts
  }

  // ========== 解析每一个店铺块 ==========
  blocks.forEach(block => {
    block = block.trim()
    if (!block) return
    
    let rawName = ''
    let address = ''
    let hours = ''
    let dishes = []
    
    // ========== 提取店名 ==========
    // 取第一行作为店名候选
    let firstLine = block.split('\n')[0].trim()
    
    // 去掉深圳X年老字号
    firstLine = firstLine.replace(/深圳\d+[+-]?年老字号/gi, '')
    
    // 去掉各种括号内容（分店名），如（蛇口店）
    firstLine = firstLine.replace(/[（(][^）)]*[）)]\s*/g, '')
    firstLine = firstLine.replace(/\([^)]*\)\s*/g, '')
    
    // 去掉 emoji 和特殊符号
    firstLine = firstLine.replace(/[✅✔️✓•●◇○❗!#⭐🌟]+/g, '')
    
    // 去掉常见后缀
    firstLine = firstLine
      .replace(/老字号/gi, '')
      .replace(/·/g, '')
      .trim()
    
    // 提取纯店名（取第一个逗号/句号前的部分）
    const nameParts = firstLine.split(/[，,。\s]{1,2}/)
    rawName = nameParts[0].trim()
    
    // ========== 提取地址 ==========
    const addressMatch = block.match(/📍[：:]?\s*(.+?)(?:\n|⏰|👏|👋)/) ||
                        block.match(/地址[：:]\s*(.+?)(?:[\n,]|$)/i)
    if (addressMatch) {
      address = addressMatch[1].replace(/[#*]/g, '').trim()
    }
    
    // ========== 提取营业时间 ==========
    const hoursMatch = block.match(/⏰[：:]?\s*(.+?)(?:\n|👏|👋|推荐|$)/) ||
                       block.match(/营业[：:]\s*(.+?)(?:[\n]|推荐|$)/i)
    if (hoursMatch) {
      hours = hoursMatch[1].replace(/[#*]/g, '').trim()
    }
    
    // ========== 提取推荐菜 ==========
    const dishesMatch = block.match(/[👏👋][🏻]?[：:]?\s*推荐(?:菜)?[：:]?\s*(.+?)(?:\n|$)/) ||
                        block.match(/推荐[：:]\s*(.+?)(?:\n|$)/i)
    if (dishesMatch) {
      const dishesText = dishesMatch[1].replace(/[#*]/g, '').trim()
      dishes = dishesText.split(/[、,，和与]/).map(d => d.trim()).filter(d => d && d.length > 1)
    }
    
    // ========== 店铺匹配 ==========
    if (!rawName || rawName.length < 2 || rawName.length > 20) return
    
    let matchedShop = null
    const cleanName = rawName.replace(/\s+/g, '').toLowerCase()
    
    // 1. 别名映射表匹配（最优先）
    for (const [alias, fullName] of Object.entries(shopNameMap)) {
      const cleanAlias = alias.replace(/\s+/g, '').toLowerCase()
      if (cleanName.includes(cleanAlias) || 
          cleanAlias.includes(cleanName) ||
          cleanName.includes(cleanAlias.replace(/店/g, ''))) {
        matchedShop = shops.find(s => s.name === fullName)
        if (matchedShop) break
      }
    }
    
    // 2. 关键词匹配（核心词匹配）
    if (!matchedShop) {
      matchedShop = shops.find(s => {
        const sName = s.name.replace(/\s+/g, '').toLowerCase()
        // 提取核心词（去掉"蛇口"、"老字号"等前缀）
        const coreName = sName.replace(/蛇口|老字号|酒楼|餐厅|饭店/g, '')
        const cleanCore = cleanName.replace(/老字号|酒楼|餐厅|饭店/g, '')
        return (coreName.length >= 2 && (cleanCore.includes(coreName) || coreName.includes(cleanCore))) ||
               (cleanName.includes(sName.replace(/店/g, '')) || sName.includes(cleanName.replace(/店/g, '')))
      })
    }
    
    // 3. 通用模糊匹配
    if (!matchedShop) {
      matchedShop = shops.find(s => {
        const sName = s.name.replace(/\s+/g, '').toLowerCase()
        return sName.includes(cleanName) || 
               cleanName.includes(sName) ||
               (cleanName.length >= 2 && (sName.includes(cleanName.replace(/店/g, '')) || cleanName.includes(sName.replace(/店/g, ''))))
      })
    }
    
    // ========== 去重并加入结果 ==========
    if (matchedShop) {
      if (!foundShops.find(s => s.id === matchedShop.id)) {
        foundShops.push(matchedShop)
      }
    } else if (rawName) {
      // 新店去重
      const existingIndex = notFoundShops.findIndex(s => 
        s.name.includes(rawName) || rawName.includes(s.name) ||
        s.name.replace(/\s/g, '').includes(rawName.replace(/\s/g, ''))
      )
      if (existingIndex >= 0) {
        const existing = notFoundShops[existingIndex]
        if (!existing.address && address) existing.address = address
        if (hours) existing.hours = hours
        if (existing.dishes.length === 0 && dishes.length > 0) existing.dishes = dishes
      } else {
        notFoundShops.push({
          name: rawName,
          address: address,
          dishes: dishes,
          hours: hours,
          source: 'guide'
        })
      }
    }
  })

  return { foundShops, notFoundShops }
}

/**
 * 生成导航链接
 */
function getNavigationUrl(shop, mode = 'drive') {
  const { lat, lng, name, address } = shop
  const coord = `${lat},${lng}`
  
  // 高德地图
  const gaodeUrl = `https://uri.amap.com/navigation?to=${lng},${lat},${name}&mode=${mode === 'transit' ? 'bus' : 'car'}&callnative=1`
  
  // 微信内置导航（使用内置能力）
  const wechatUrl = `/pages/navigation/navigation?latitude=${lat}&longitude=${lng}&name=${encodeURIComponent(name)}`

  return { gaodeUrl, wechatUrl }
}

/**
 * 打开微信内置导航（推荐）- 调起真实导航
 * 使用 wx.openLocation 显示位置，用户点击导航按钮后调起导航
 */
function openWechatNavigation(shop) {
  const { lat, lng, name, address } = shop
  
  wx.openLocation({
    latitude: lat,
    longitude: lng,
    name: name,
    address: address || '蛇口美食',
    scale: 16,
    success: () => {
      console.log('位置已打开，请在地图中点击"导航"按钮')
    },
    fail: (err) => {
      console.error('打开位置失败', err)
      wx.showToast({ 
        title: '请检查位置权限', 
        icon: 'none' 
      })
    }
  })
}

/**
 * 直接调起高德地图导航（真实导航，一键直达）
 */
function openGaodeNavigation(lat, lng, name) {
  // 高德 URL Scheme - 直接调起高德APP
  // Android: androidamap://path?sourceApplication=appname&dlat=xx&dlon=xx&dname=xx&dev=0&m=0
  // iOS: iosamap://path?sourceApplication=appname&dlat=xx&dlon=xx&dname=xx&dev=0&m=0
  
  // Android 高德
  const androidUrl = `androidamap://route/plan/?dlat=${lat}&dlon=${lng}&dname=${encodeURIComponent(name)}&dev=0&m=0`
  // iOS 高德
  const iosUrl = `iosamap://path?sourceApplication=${encodeURIComponent('觅食图')}&dlat=${lat}&dlon=${lng}&dname=${encodeURIComponent(name)}&dev=0&m=0`
  
  // 先尝试调起高德小程序
  wx.navigateToMiniProgram({
    appId: 'wxbfe0acb99cce0a56', // 高德地图小程序
    extraData: {
      latitude: lat,
      longitude: lng,
      name: name,
      mode: 'driving'
    },
    success: () => {
      console.log('打开高德小程序成功')
    },
    fail: () => {
      // 回退：打开微信位置，用户可手动选导航
      wx.showModal({
        title: '即将打开导航',
        content: `将导航到：${name}\n如未安装高德地图，将打开位置页面`,
        confirmText: '确定',
        success: (res) => {
          if (res.confirm) {
            // 直接使用微信导航（最可靠）
            openWechatNavigation({ lat, lng, name, address: name })
          }
        }
      })
    }
  })
}

/**
 * 直接调起百度地图导航
 */
function openBaiduNavigation(lat, lng, name) {
  // 打开微信位置（最可靠的方式）
  openWechatNavigation({ lat, lng, name, address: name })
}

/**
 * 直接调起腾讯地图导航
 */
function openTencentNavigation(lat, lng, name) {
  // 打开微信位置（最可靠的方式）
  openWechatNavigation({ lat, lng, name, address: name })
}

/**
 * 一键导航到店铺 - 智能选择最佳导航方式
 */
function openDirectNavigation(shop) {
  const { lat, lng, name, address } = shop
  
  wx.showActionSheet({
    itemList: ['🚗 驾车导航', '🚶 步行导航', '🚌 公交导航'],
    success: (res) => {
      // 直接打开微信位置，用户可选择导航方式
      // 微信内置会根据出行方式自动调起对应导航
      openWechatNavigation({ lat, lng, name, address: address || name })
    },
    fail: () => {
      // 用户取消，直接打开位置
      openWechatNavigation({ lat, lng, name, address: address || name })
    }
  })
}

/**
 * 打开外部导航（选择导航应用）
 */
function openNavigation(shop) {
  const { lat, lng, name, address } = shop
  
  wx.showActionSheet({
    itemList: ['🗺️ 微信导航（推荐）', '🧭 高德地图', '📍 百度地图'],
    success: (res) => {
      switch (res.tapIndex) {
        case 0: // 微信导航
          openWechatNavigation(shop)
          break
        case 1: // 高德
          openGaodeNavigation(lat, lng, name)
          break
        case 2: // 百度
          openBaiduNavigation(lat, lng, name)
          break
      }
    }
  })
}

// 把名称、地址这类字符串做一层统一清洗，
// 方便后面做"同一个地点"的模糊匹配。
function normalizeCompareText(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[·•,，。！!？?、\-—_]/g, '')
    .trim()
}

// 读取系统里所有"可识别的地点"。
// 这里统一合并：内置美食、扩展美食、用户导入美食、内置景点。
function getAllKnownPlaces() {
  const placesData = require('./placesData')
  const foods = [...placesData.getFoods(), ...(loadData('userAddedShops', []) || [])]
    .map(item => ({ ...item, type: item.type || 'food' }))
  const spots = placesData.getSpots().map(item => ({ ...item, type: 'spot' }))
  return foods.concat(spots)
}

// 根据打卡记录里的名称、地址、类型，尽量匹配到系统已知地点。
// 匹配成功后，足迹页和详情跳转就可以继续复用已有页面。
function findKnownPlace(payload = {}, preferredType = '') {
  const allPlaces = getAllKnownPlaces()
  const type = preferredType || payload.type || ''
  const sourceName = normalizeCompareText(payload.name || payload.spotName || '')
  const sourceAddress = normalizeCompareText(payload.address || '')
  const sourceId = payload.relatedPlaceId || payload.placeId || payload.id

  if (sourceId !== undefined && sourceId !== null && sourceId !== '') {
    const byId = allPlaces.find(item => String(item.id) === String(sourceId))
    if (byId) return byId
  }

  const candidates = type
    ? allPlaces.filter(item => item.type === type)
    : allPlaces

  const exactMatch = candidates.find(item => normalizeCompareText(item.name) === sourceName)
  if (exactMatch) return exactMatch

  const fuzzyMatch = candidates.find(item => {
    const itemName = normalizeCompareText(item.name)
    const itemAddress = normalizeCompareText(item.address || '')
    if (!itemName || !sourceName) return false
    const hitByName = itemName.includes(sourceName) || sourceName.includes(itemName)
    const hitByAddress = sourceAddress && itemAddress
      ? (sourceAddress.includes(itemAddress) || itemAddress.includes(sourceAddress))
      : false
    return hitByName || hitByAddress
  })

  return fuzzyMatch || null
}

// 把一条打卡记录转成"足迹页/已去过"可直接显示的统一地点结构。
function buildFootprintItem(record = {}) {
  const matchedPlace = findKnownPlace(record, record.type)
  const fallbackType = record.type === 'spot' ? 'spot' : 'food'
  const fallbackName = record.spotName || record.name || '未命名地点'
  const fallbackAddress = record.address || ''
  const fallbackImage = record.photoPath || '/images/app-logo.jpg'

  if (matchedPlace) {
    return {
      ...matchedPlace,
      type: matchedPlace.type || fallbackType,
      coverImage: fallbackImage,
      image: fallbackImage,
      address: matchedPlace.address || fallbackAddress,
      lat: matchedPlace.lat || matchedPlace.latitude || record.latitude || 0,
      lng: matchedPlace.lng || matchedPlace.longitude || record.longitude || 0,
      checkedInAt: record.date || '',
      checkedInRecordId: record.id,
      detailSource: 'catalog'
    }
  }

  return {
    id: `footprint-${record.id || Date.now()}`,
    name: fallbackName,
    type: fallbackType,
    category: fallbackType === 'spot' ? '景点' : '美食',
    coverImage: fallbackImage,
    image: fallbackImage,
    address: fallbackAddress,
    lat: record.latitude || 0,
    lng: record.longitude || 0,
    rating: '',
    tags: ['已去过'],
    desc: record.description || '',
    openHours: '',
    free: fallbackType === 'spot',
    price: '',
    checkedInAt: record.date || '',
    checkedInRecordId: record.id,
    detailSource: 'record'
  }
}

// 手动添加的足迹单独存一份，避免污染“我的采集”的图片列表和地图。
function getManualFootprintRecords() {
  return loadData('manual_footprint_records', []) || []
}

// 统一给足迹原始记录生成一个稳定 key。
// 这样做迁移和去重时，就不会因为 id 不同把同一地点重复写进去。
function buildFootprintRecordKey(record = {}) {
  return [
    String(record.type || 'spot'),
    normalizeCompareText(record.spotName || record.name || ''),
    normalizeCompareText(record.address || ''),
    String(record.latitude || ''),
    String(record.longitude || '')
  ].join(':')
}

// 这批历史遗留数据的共同点是：
// 1. 曾经被误写进了 checkin_records
// 2. 没有照片，也没有云端图片 id
// 3. 当时“添加足迹”只写景点类型，所以这里一并用 type=spot 收口
function isLegacyManualFootprintRecord(record = {}) {
  const hasPhoto = Boolean(record.photoPath || record.cloudFileID)
  const hasLocation = Number(record.latitude) || Number(record.longitude)
  return record.type === 'spot' && !hasPhoto && Boolean(hasLocation)
}

let _isMigratingLegacyFootprints = false

// 自动把历史上误写进采集记录的“足迹”迁出来。
// 迁移后：
// - 采集页只保留真正的采集记录
// - 足迹页继续能读到这些地点，不丢数据
function migrateLegacyFootprintsFromCheckins() {
  if (_isMigratingLegacyFootprints) return 0

  const checkinRecords = loadData('checkin_records', []) || []
  if (!checkinRecords.length) return 0

  const manualRecords = getManualFootprintRecords()
  const manualRecordKeys = new Set(manualRecords.map(item => buildFootprintRecordKey(item)))
  const nextCheckins = []
  const nextManualRecords = manualRecords.slice()
  let movedCount = 0

  _isMigratingLegacyFootprints = true
  try {
    checkinRecords.forEach(record => {
      if (!isLegacyManualFootprintRecord(record)) {
        nextCheckins.push(record)
        return
      }

      const recordKey = buildFootprintRecordKey(record)
      if (!manualRecordKeys.has(recordKey)) {
        nextManualRecords.push({
          id: record.id || ('FP' + Date.now().toString(36).toUpperCase()),
          type: 'spot',
          spotName: record.spotName || record.name || '',
          address: record.address || '',
          latitude: Number(record.latitude) || 0,
          longitude: Number(record.longitude) || 0,
          description: record.description || '',
          date: record.date || new Date().toISOString(),
          city: record.city || ''
        })
        manualRecordKeys.add(recordKey)
      }
      movedCount += 1
    })

    if (movedCount > 0) {
      saveData('checkin_records', nextCheckins)
      saveData('manual_footprint_records', nextManualRecords)
    }
  } finally {
    _isMigratingLegacyFootprints = false
  }

  if (movedCount > 0) {
    syncLegacyCheckedInFromRecords()
  }

  return movedCount
}

// 新增一条“手动足迹”记录：
// 这里只保存地点本身，不要求照片，也不进入采集记录。
function saveManualFootprintRecord(data = {}) {
  const manualRecords = getManualFootprintRecords()
  const record = {
    id: 'FP' + Date.now().toString(36).toUpperCase(),
    type: data.type || 'spot',
    spotName: data.spotName || '',
    address: data.address || '',
    latitude: Number(data.latitude) || 0,
    longitude: Number(data.longitude) || 0,
    description: data.description || '',
    date: data.date || new Date().toISOString(),
    city: data.city || ''
  }

  manualRecords.unshift(record)
  saveData('manual_footprint_records', manualRecords)
  // 老页面如果还在读 userCheckedIn，这里也顺手同步一下。
  syncLegacyCheckedInFromRecords()
  return record
}

// 足迹页的真实来源分成两部分：
// 1. 采集打卡生成的记录
// 2. 地图选点新增的手动足迹
function getFootprintSourceRecords() {
  migrateLegacyFootprintsFromCheckins()
  const checkinRecords = loadData('checkin_records', []) || []
  const manualRecords = getManualFootprintRecords()
  // 采集记录放前面，和手动足迹重复时优先保留采集那条。
  return checkinRecords.concat(manualRecords)
}

// 统一读取"足迹/已去过"的真实数据源。
// 这里把“采集记录”和“手动足迹”合并后再去重，避免同一地点重复展示。
function getFootprintItems() {
  const records = getFootprintSourceRecords()
  const seenKeys = new Set()
  const items = []

  records.forEach(record => {
    const place = buildFootprintItem(record)
    const uniqueKey = place.detailSource === 'catalog'
      ? `${place.type}:${place.id}`
      : `${place.type}:${normalizeCompareText(place.name)}:${normalizeCompareText(place.address)}`

    if (seenKeys.has(uniqueKey)) return
    seenKeys.add(uniqueKey)
    items.push(place)
  })

  return items
}

// 兼容旧页面：把"已去过"的历史存储同步成当前足迹结果。
// 旧逻辑只支持存地点 id，所以这里只同步系统里能识别到的地点。
function syncLegacyCheckedInFromRecords() {
  const footprintItems = getFootprintItems()
  const legacyIds = footprintItems
    .filter(item => item.detailSource === 'catalog')
    .map(item => String(item.id))
  saveData('userCheckedIn', legacyIds)
  return legacyIds
}

/**
 * 存储数据到本地
 */
function saveData(key, data) {
  try {
    wx.setStorageSync(key, data)
    return true
  } catch (e) {
    console.error('存储失败:', e)
    return false
  }
}

/**
 * 读取本地数据
 */
function loadData(key, defaultValue = null) {
  try {
    const storageInfo = wx.getStorageInfoSync ? wx.getStorageInfoSync() : { keys: [] }
    if (!storageInfo.keys || storageInfo.keys.indexOf(key) === -1) {
      return defaultValue
    }
    return wx.getStorageSync(key)
  } catch (e) {
    console.error('读取失败:', e)
    return defaultValue
  }
}

// 统一登录校验：
// 想去、收藏这些"用户动作"都先走这里，避免每个页面各写一套提示。
function requireLogin(options = {}) {
  const {
    toastText = '请先登录',
    duration = 1500
  } = options
  if (isCloudMode()) return true
  wx.showToast({
    title: toastText,
    icon: 'none',
    duration
  })
  return false
}

/**
 * 显示加载提示
 */
function showLoading(title = '加载中...') {
  wx.showLoading({ title, mask: true })
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  wx.hideLoading()
}

/**
 * 显示成功提示
 */
function showSuccess(title = '成功') {
  wx.showToast({ title, icon: 'success', duration: 1500 })
}

/**
 * 显示错误提示
 */
function showError(title = '出错了') {
  wx.showToast({ title, icon: 'error', duration: 2000 })
}

/**
 * 获取用户想去/到访列表
 */
function getUserShops() {
  return loadData('userShops', {
    likedShops: [],    // 想去的店铺ID列表
    checkedInShops: {} // {shopId: {rating, comment, date}}
  })
}

/**
 * 生成百度全景静态图 URL
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @param {number} width - 图片宽度
 * @param {number} height - 图片高度
 * @returns {string} 全景图 URL
 */
function getBaiduPanoramaUrl(lat, lng, width = 400, height = 300) {
  const ak = 'KuGlOjdoC0kmGUbU1Tw2OQyK6LKQ6gGa'
  // 使用 GCJ02 坐标系（微信小程序原生坐标系）
  return `https://api.map.baidu.com/panorama/v2?ak=${ak}&width=${width}&height=${height}&location=${lng},${lat}&coordtype=gcj02ll&fov=180`
}

/**
 * 生成腾讯地图静态图 URL（带标记点）
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @param {number} width - 图片宽度
 * @param {number} height - 图片高度
 * @returns {string} 静态图 URL
 */
function getTencentStaticUrl(lat, lng, width = 200, height = 200) {
  const key = 'YLOBZ-VDFWB-AMSUJ-JCOQQ-GJ633-CTBR5'
  return `https://apis.map.qq.com/ws/staticmap/v2?center=${lat},${lng}&zoom=16&size=${width}x${height}&markers=${lat},${lng},red&key=${key}`
}

// ============================================================
// 景点数据加载
// ============================================================
let _spotData = null

function getSpotData() {
  if (!_spotData) {
    const placesData = require('./placesData')
    _spotData = placesData.getSpots()
  }
  return _spotData || []
}

// ============================================================
// 想去功能（统一美食和景点，不区分类型）
// 存储格式：userWantList 存储 ID 列表（String[]）
// 迁移：首次访问时自动合并旧格式 userWantFoods + userWantSpots
// ============================================================

/**
 * 迁移旧数据：将 userWantFoods + userWantSpots 合并为 userWantList
 * 返回合并后的 ID 列表（去重）
 */
function _migrateWantList() {
  const oldFoods = loadData('userWantFoods', [])
  const oldSpots = loadData('userWantSpots', [])
  const merged = [...oldFoods, ...oldSpots].map(v => String(v))
  // 去重
  const unique = [...new Set(merged)]
  if (unique.length > 0) {
    saveData('userWantList', unique)
  }
  return unique
}

/**
 * 获取想去列表（ID 数组）
 * 自动迁移旧数据格式
 */
function getWantList() {
  // 优先读新格式
  let list = loadData('userWantList', null)
  if (list !== null) {
    return list.map(v => String(v))
  }
  // 旧格式：迁移
  return _migrateWantList()
}

/**
 * 切换想去状态（添加/移除）
 * @param {string|number} id - 地点 ID
 * @returns {boolean} - 当前是否已想去
 */
function toggleWant(id) {
  const list = getWantList()
  const strId = String(id)
  const idx = list.indexOf(strId)
  if (idx > -1) {
    list.splice(idx, 1)
  } else {
    list.push(strId)
  }
  saveData('userWantList', list)
  return list.includes(strId)
}

/**
 * 检查是否已想去
 * @param {string|number} id - 地点 ID
 * @returns {boolean}
 */
function isWant(id) {
  return getWantList().indexOf(String(id)) > -1
}

// 导出统一接口（不再区分类型）
const toggleLike = toggleWant
const isLiked = isWant

// ============================================================
// 收藏功能（支持美食和景点）
// ============================================================

function toggleCollect(id) {
  const list = loadData('userCollectedSpots', [])
  const strId = String(id)
  const idx = list.findIndex(v => String(v) === strId)
  if (idx > -1) {
    list.splice(idx, 1)
  } else {
    list.push(strId)
  }
  saveData('userCollectedSpots', list)
  return list.includes(strId)
}

function isCollected(id) {
  return loadData('userCollectedSpots', []).some(v => String(v) === String(id))
}

// ============================================================
// 路线规划（统一支持美食和景点）
// ============================================================

/**
 * 贪心最近邻路线规划算法（统一版）
 * @param {Array} items - 地点数组
 * @param {Object} startPoint - 起点 {lat, lng}
 * @param {boolean} preserveOrder - true按原顺序，false贪心优化
 * @returns {Array} 规划后的地点数组，每项附加 distanceFromPrev（距上一个点的距离，单位米）；
 *                  空数组返回 []，单元素直接返回原数组
 */
function planRoute(items, startPoint, preserveOrder = false) {
  if (!items || items.length === 0) return []
  if (items.length === 1) return items

  const toLatLng = (item) => ({
    lat: item.lat || item.latitude,
    lng: item.lng || item.longitude
  })

  if (preserveOrder) {
    let prev = startPoint
    return items.map(item => {
      const ll = toLatLng(item)
      const dist = getDistance(prev.lat, prev.lng, ll.lat, ll.lng)
      item.distanceFromPrev = Math.round(dist)
      prev = ll
      return item
    })
  }

  const route = []
  const remaining = [...items]
  let current = startPoint

  while (remaining.length > 0) {
    let nearestIndex = 0
    let nearestDist = Infinity
    remaining.forEach((item, index) => {
      const ll = toLatLng(item)
      const dist = getDistance(current.lat, current.lng, ll.lat, ll.lng)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIndex = index
      }
    })
    const nearest = remaining.splice(nearestIndex, 1)[0]
    const ll = toLatLng(nearest)
    nearest.distanceFromPrev = Math.round(nearestDist)
    route.push(nearest)
    current = ll
  }
  return route
}

// ============================================================
// 附近景点
// ============================================================

function getNearbySpots(lat, lng, limit = 20) {
  const spots = getSpotData().filter(s => s.lat && s.lng)
  return spots
    .map(s => ({ ...s, distance: getDistance(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
}

// ============================================================
// 景点分类颜色
// ============================================================

const SPOT_CATEGORY_COLORS = {
  '公园': '#4CAF50', '海滨': '#2196F3', '山景': '#FF9800',
  '主题乐园': '#E91E63', '历史文化': '#795548', '艺术': '#9C27B0',
  '展馆': '#607D8B', '特色小镇': '#FF5722', '地标': '#FFC107',
  '商业': '#9E9E9E', '体育': '#00BCD4', '文化': '#3F51B5', '度假': '#009688'
}

function getSpotCategoryColor(category) {
  return SPOT_CATEGORY_COLORS[category] || '#95A5A6'
}

/**
 * 将城市全称转换为简称
 * @param {string} fullCityName - 城市全称，如"深圳市"
 * @returns {string} 城市简称，如"深圳"
 */
function getCityShortName(fullCityName) {
  const cityMap = {
    '香港特别行政区': '香港', '上海市': '上海', '北京市': '北京', '广州市': '广州',
    '杭州市': '杭州', '台北市': '台北', '澳门特别行政区': '澳门', '成都市': '成都',
    '厦门市': '厦门', '南京市': '南京', '苏州市': '苏州', '福州市': '福州',
    '台州市': '台州', '台南市': '台南', '台中市': '台中', '高雄市': '高雄',
    '温州市': '温州', '泉州市': '泉州', '扬州市': '扬州', '常州市': '常州',
    '新北市': '新北', '新竹县': '新竹县', '新竹市': '新竹', '宁德市': '宁德',
    '惠州市': '惠州', '乌兰察布市': '乌兰察布', '深圳市': '深圳'
  }
  return cityMap[fullCityName] || fullCityName.replace(/[市县特别行政区]$/, '')
}

/**
 * 根据城市短名（如'深圳'）反查完整名称（如'深圳市'）
 * @param {string} shortName - 城市短名
 * @returns {string} 城市完整名称
 */
function getCityFullName(shortName) {
  if (!shortName) return '广州市'
  // 如果已经是完整名称，直接返回
  if (/[市县特别行政区]$/.test(shortName)) return shortName
  // 在 GUANGDONG_CITIES 中查找匹配
  const found = GUANGDONG_CITIES.find(c => c.name === shortName)
  return found ? found.fullName : shortName + '市'
}


/**
 * 城市数据工具函数
 * 包含觅食图城市列表和生成城市选项的函数
 */

// 觅食图城市列表
const GUANGDONG_CITIES = [
  { id: 1, name: '香港', fullName: '香港特别行政区', lat: 22.3193, lng: 114.1694, bgColor: '#E8D5D5' },
  { id: 2, name: '上海', fullName: '上海市', lat: 31.2304, lng: 121.4737, bgColor: '#DAE5E8' },
  { id: 3, name: '北京', fullName: '北京市', lat: 39.9042, lng: 116.4074, bgColor: '#E4D8DC' },
  { id: 4, name: '广州', fullName: '广州市', lat: 23.1291, lng: 113.2644, bgColor: '#DBE8DD', wantCount: 8970 },
  { id: 5, name: '杭州', fullName: '杭州市', lat: 30.2741, lng: 120.1551, bgColor: '#DCE5DE' },
  { id: 6, name: '台北', fullName: '台北市', lat: 25.0330, lng: 121.5654, bgColor: '#D8E3E8' },
  { id: 7, name: '澳门', fullName: '澳门特别行政区', lat: 22.1987, lng: 113.5439, bgColor: '#E3DBE6' },
  { id: 8, name: '成都', fullName: '成都市', lat: 30.5728, lng: 104.0668, bgColor: '#E6DBD8' },
  { id: 9, name: '厦门', fullName: '厦门市', lat: 24.4798, lng: 118.0894, bgColor: '#DAE5E8' },
  { id: 10, name: '南京', fullName: '南京市', lat: 32.0603, lng: 118.7969, bgColor: '#E5DFDA' },
  { id: 11, name: '苏州', fullName: '苏州市', lat: 31.2990, lng: 120.5853, bgColor: '#DCE5E3' },
  { id: 12, name: '福州', fullName: '福州市', lat: 26.0745, lng: 119.2965, bgColor: '#DCE3E8' },
  { id: 13, name: '台州', fullName: '台州市', lat: 28.6564, lng: 121.4208, bgColor: '#E6DDE2' },
  { id: 14, name: '台南', fullName: '台南市', lat: 22.9999, lng: 120.2270, bgColor: '#E6E0DA' },
  { id: 15, name: '台中', fullName: '台中市', lat: 24.1477, lng: 120.6736, bgColor: '#DCE7E0' },
  { id: 16, name: '高雄', fullName: '高雄市', lat: 22.6273, lng: 120.3014, bgColor: '#D9E3E8' },
  { id: 17, name: '温州', fullName: '温州市', lat: 27.9939, lng: 120.6994, bgColor: '#E4DCE3' },
  { id: 18, name: '泉州', fullName: '泉州市', lat: 24.8746, lng: 118.6759, bgColor: '#E3DFDB' },
  { id: 19, name: '扬州', fullName: '扬州市', lat: 32.3936, lng: 119.4213, bgColor: '#DCE5E1' },
  { id: 20, name: '常州', fullName: '常州市', lat: 31.8101, lng: 119.9736, bgColor: '#D7E2E6' },
  { id: 21, name: '新北', fullName: '新北市', lat: 25.0620, lng: 121.4570, bgColor: '#E2DEE0' },
  { id: 22, name: '新竹县', fullName: '新竹县', lat: 24.8393, lng: 121.0020, bgColor: '#E0E0E0' },
  { id: 23, name: '新竹', fullName: '新竹市', lat: 24.8036, lng: 120.9686, bgColor: '#DCE5DE' },
  { id: 24, name: '宁德', fullName: '宁德市', lat: 26.6657, lng: 119.5482, bgColor: '#E6DBD8' },
  { id: 25, name: '惠州', fullName: '惠州市', lat: 23.1118, lng: 114.4168, bgColor: '#DCE3E8' },
  { id: 26, name: '乌兰察布', fullName: '乌兰察布市', lat: 41.0006, lng: 113.1336, bgColor: '#E0E6DC' },
  { id: 27, name: '深圳', fullName: '深圳市', lat: 22.5431, lng: 114.0579, bgColor: '#DAE5E8', wantCount: 8270 }
]

/**
 * 生成城市选项列表，为每个城市添加封面图
 * @param {Array} coverPool - 封面图池，用于为城市分配封面图
 * @returns {Array} 带有 coverImage 的城市选项列表
 */
function getCityOptions(coverPool) {
  const safeCoverPool = coverPool || []
  return GUANGDONG_CITIES.map((city, index) => ({
    ...city,
    wantCount: city.wantCount || (2000 + Math.floor(Math.random() * 4001)),
    coverImage: safeCoverPool[index % safeCoverPool.length] || '/images/app-logo.jpg'
  }))
}



// ============================================================
// 云端数据访问层（DAL）— 已登录用户走云端，未登录继续读本地
// ============================================================
let _dbWantList = null
let _dbCollectedList = null
let _dbUserAddedShops = null
let _dbRoutes = null
let _dbCheckinRecords = null

function _getDbWantList() {
  if (!_dbWantList) _dbWantList = require('./db/wantList')
  return _dbWantList
}

function _getDbCollectedList() {
  if (!_dbCollectedList) _dbCollectedList = require('./db/collectedList')
  return _dbCollectedList
}

function _getDbUserAddedShops() {
  if (!_dbUserAddedShops) _dbUserAddedShops = require('./db/userAddedShops')
  return _dbUserAddedShops
}

function _getDbRoutes() {
  if (!_dbRoutes) _dbRoutes = require('./db/routes')
  return _dbRoutes
}

function _getDbCheckinRecords() {
  if (!_dbCheckinRecords) _dbCheckinRecords = require('./db/checkinRecords')
  return _dbCheckinRecords
}

/**
 * 判断当前是否已真实登录（云端模式）
 *
 * 旧版假登录只存了 { nickName, avatarUrl }，没有 _id / openid，
 * 如果无真实云端身份，视为未登录（走本地模式）。
 * @returns {boolean}
 */
function isCloudMode() {
  const info = loadData('userInfo', null)
  return !!(info && (info._id || info.openid))
}

// 内部快捷引用，给 _isCloudMode 保留别名兼容
const _isCloudMode = isCloudMode

// ─── 想去（云端异步版）────────────────────────


/**
 * 获取想去列表（纯本地）
 * @returns {string[]}
 */
function getWantListAsync() {
  return getWantList()
}

/**
 * 切换想去状态（本地优先 + 后台同步）
 * @param {string|number} id
 * @param {string} [placeType='food']
 * @returns {boolean} true = 已想去
 */
function toggleWantAsync(id) {
  const strId = String(id)
  // 1. 立即翻转变更（零等待）
  const list = getWantList()
  const idx = list.indexOf(strId)
  let isWantNow
  if (idx > -1) { list.splice(idx, 1); isWantNow = false }
  else          { list.push(strId); isWantNow = true }
  saveData('userWantList', list)

  // 2. 后台异步推云端（节流，不等待结果）
  if (_isCloudMode()) {
    syncManager.enqueuePush('wantList')
  }

  return isWantNow
}

/**
 * 检查是否已想去（读本地）
 * @param {string|number} id
 * @returns {boolean}
 */
function isWantAsync(id) {
  return isWant(id)
}

// ─── 收藏（云端异步版）────────────────────────

/**
 * 获取所有收藏 ID（纯本地）
 * @returns {string[]}
 */
function getCollectedListAsync() {
  return [
    ...loadData('userCollectedFoods', []),
    ...loadData('userCollectedSpots', [])
  ].map(v => String(v))
}

/**
 * 切换收藏状态（本地优先 + 后台同步）
 * @param {string|number} id
 * @returns {boolean} true = 已收藏
 */
function toggleCollectAsync(id) {
  const strId = String(id)
  // 1. 立即翻转本地
  const list = loadData('userCollectedSpots', [])
  const idx = list.findIndex(v => String(v) === strId)
  let isNow
  if (idx > -1) { list.splice(idx, 1); isNow = false }
  else          { list.push(strId); isNow = true }
  saveData('userCollectedSpots', list)

  // 2. 后台异步推云端（节流）
  if (_isCloudMode()) {
    syncManager.enqueuePush('collectedList')
  }

  return isNow
}

/**
 * 检查是否已收藏（读本地）
 * @param {string|number} id
 * @returns {boolean}
 */
function isCollectedAsync(id) {
  return isCollected(id)
}

// ─── 用户自建店铺（云端异步版）─────────────────────

/**
 * 获取当前用户的自建店铺列表（纯本地）
 * @returns {Array}
 */
function getUserShopsAsync() {
  return loadData('userAddedShops', [])
}

/**
 * 删除用户自建店铺（本地优先 + 后台同步）
 * @param {string} id - 店铺 _id
 * @returns {boolean}
 */
function deleteUserShopAsync(id) {
  // 1. 立即删除本地
  const list = loadData('userAddedShops', [])
  const filtered = list.filter(s => String(s._id) !== String(id) && String(s.id) !== String(id))
  saveData('userAddedShops', filtered)

  // 2. 后台推云端
  if (_isCloudMode()) {
    _getDbUserAddedShops().remove(id).catch(err => {
      console.warn('[util] 云端删除店铺失败，本地已删除:', err)
    })
  }
  return true
}

// ─── 路线（云端异步版）────────────────────────

/**
 * 获取当前用户的路线列表（纯本地）
 * @returns {Array}
 */
function getRoutesAsync() {
  return loadData('savedRoutes', [])
}

/**
 * 删除路线（本地优先 + 后台同步）
 * @param {string} id - 路线 _id
 * @returns {boolean}
 */
function deleteRouteAsync(id) {
  // 1. 立即删除本地
  const list = loadData('savedRoutes', [])
  const filtered = list.filter(r => String(r._id) !== String(id) && String(r.id) !== String(id))
  saveData('savedRoutes', filtered)

  // 2. 后台推云端
  if (_isCloudMode()) {
    _getDbRoutes().remove(id).catch(err => {
      console.warn('[util] 云端删除路线失败，本地已删除:', err)
    })
  }
  return true
}

/**
 * 保存/新增路线（本地优先 + 后台同步）
 * @param {Object} routeData - 路线数据
 * @returns {Object} 保存后的路线
 */
function saveRouteAsync(routeData) {
  // 1. 立即写本地
  // 如果本地已经有同一条路线（同 id 或同 _id），这里直接覆盖，
  // 避免上层已经先写过一次本地后，又在这里追加出重复卡片。
  const list = loadData('savedRoutes', [])
  const idx = list.findIndex(route =>
    String(route.id) === String(routeData.id) ||
    (routeData._id && String(route._id) === String(routeData._id))
  )
  if (idx > -1) {
    list[idx] = { ...list[idx], ...routeData }
  } else {
    list.push(routeData)
  }
  saveData('savedRoutes', list)

  // 2. 后台推云端
  if (_isCloudMode()) {
    const { _openid, ...cleanData } = routeData
    _getDbRoutes().add(cleanData).then(res => {
      if (res.success && res.data) {
        // 用云端 _id 更新本地缓存
        const updatedList = loadData('savedRoutes', [])
        const idx = updatedList.findIndex(r => String(r.id) === String(routeData.id))
        if (idx > -1) {
          updatedList[idx] = { ...updatedList[idx], _id: res.data }
          saveData('savedRoutes', updatedList)
        }
      }
    }).catch(err => {
      console.warn('[util] 云端保存路线失败，数据已在本地:', err)
    })
  }
  return routeData
}

/**
 * 更新路线（本地优先 + 后台同步）
 * @param {string|number} id - 路线 _id 或本地 id
 * @param {Object} patchData - 要更新的字段
 * @returns {Object|null}
 */
function updateRouteAsync(id, patchData) {
  // 1. 立即更新本地
  const list = loadData('savedRoutes', [])
  const idx = list.findIndex(r => String(r._id) === String(id) || String(r.id) === String(id))
  if (idx > -1) {
    list[idx] = { ...list[idx], ...patchData }
    saveData('savedRoutes', list)
  } else {
    return null
  }

  // 2. 后台推云端
  if (_isCloudMode()) {
    const cloudId = patchData._id || id
    const { _openid, _id: _patchId, ...cleanData } = patchData
    _getDbRoutes().update(cloudId, cleanData).catch(err => {
      console.warn('[util] 云端更新路线失败，本地已更新:', err)
    })
  }

  return list[idx] || null
}

// ─── 足迹（云端异步版）────────────────────────

/**
 * 获取足迹/已去过列表（纯本地）
 * 从本地打卡记录派生，按地点去重
 * @returns {Array}
 */
function getFootprintItemsAsync() {
  return getFootprintItems()
}

/**
 * 获取足迹原始记录（纯本地）
 * @returns {Array}
 */
function getFootprintSourceRecordsAsync() {
  return getFootprintSourceRecords()
}

/**
 * 保存手动足迹（纯本地）
 * @param {Object} data - 地点数据
 * @returns {Object}
 */
function saveManualFootprintAsync(data) {
  return saveManualFootprintRecord(data)
}

// ─── 云存储 fileID → 临时 URL ──────────────────

/**
 * 批量将 cloud:// 文件 ID 转为可访问的临时 HTTPS URL
 * 使用 wx.cloud.getTempFileURL 转换
 * 非 cloud:// 的 URL 原样保留
 * 
 * @param {string[]} fileIDs - 云文件 ID 数组
 * @returns {Promise<Object<string, string>>} fileID → tempURL 映射
 */
async function resolveCloudFileIDs(fileIDs) {
  if (!fileIDs || fileIDs.length === 0) return {}
  const cloudIDs = fileIDs.filter(id => id && typeof id === 'string' && id.startsWith('cloud://'))
  if (cloudIDs.length === 0) return {}
  try {
    const res = await wx.cloud.getTempFileURL({ fileList: cloudIDs })
    const map = {}
    if (res && res.fileList) {
      res.fileList.forEach(item => { map[item.fileID] = item.tempFileURL || item.fileID })
    }
    return map
  } catch (err) {
    console.warn('[util] getTempFileURL 失败:', err)
    return {}
  }
}

/**
 * 将对象数组中指定字段的 cloud:// 地址批量转为临时 URL
 * 原地修改（mutable）传入的数组对象
 * 
 * @param {Object[]} items - 数据对象数组
 * @param {string|string[]} urlFields - 要转换的字段名，如 'coverImage' 或 ['coverImage', 'avatarUrl']
 * @returns {Promise<void>}
 */
async function resolveCloudUrls(items, urlFields) {
  if (!items || items.length === 0) return
  const fields = Array.isArray(urlFields) ? urlFields : [urlFields]
  const allFileIDs = []
  items.forEach(item => {
    fields.forEach(field => {
      const val = item[field]
      if (val && typeof val === 'string' && val.startsWith('cloud://')) {
        allFileIDs.push(val)
      }
    })
  })
  if (allFileIDs.length === 0) return
  const urlMap = await resolveCloudFileIDs(allFileIDs)
  items.forEach(item => {
    fields.forEach(field => {
      if (item[field] && urlMap[item[field]]) {
        item[field] = urlMap[item[field]]
      }
    })
  })
}

// ─── 导出扩展 ─────────────────────────────────

module.exports = {
  getDistance,
  planRoute,
  formatDistance,
  estimateTime,
  parseBlockBasedGuide,
  getNavigationUrl,
  openWechatNavigation,
  openGaodeNavigation,
  openDirectNavigation,
  getBaiduPanoramaUrl,
  getTencentStaticUrl,
  openNavigation,
  saveData,
  loadData,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  getUserShops,
  findKnownPlace,
  getFootprintItems,
  getFootprintSourceRecords,
  migrateLegacyFootprintsFromCheckins,
  syncLegacyCheckedInFromRecords,
  requireLogin,
  toggleLike,
  isLiked,
  toggleCollect,
  isCollected,
  getSpotData,
  getNearbySpots,
  getSpotCategoryColor,
  SPOT_CATEGORY_COLORS,
  getCityShortName,
  getCityFullName,
  getWantList,
  toggleWant,
  isWant,
  getCityOptions,
  // 云端异步版
  getWantListAsync,
  toggleWantAsync,
  isWantAsync,
  getCollectedListAsync,
  toggleCollectAsync,
  isCollectedAsync,
  getUserShopsAsync,
  deleteUserShopAsync,
  getRoutesAsync,
  saveRouteAsync,
  updateRouteAsync,
  deleteRouteAsync,
  getFootprintItemsAsync,
  getFootprintSourceRecordsAsync,
  saveManualFootprintAsync,
  // 登录状态判断
  isCloudMode,
  // 云存储 fileID 转换
  resolveCloudFileIDs,
  resolveCloudUrls,
}
