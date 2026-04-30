// 觅食迹 - 工具函数库

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
    return meters + 'm'
  } else {
    return (meters / 1000).toFixed(1) + 'km'
  }
}

/**
 * 估算出行时间
 * @param {number} meters - 距离（米）
 * @param {string} mode - 出行方式：drive/drive 或 transit/地铁
 */
function estimateTime(meters, mode = 'drive') {
  // 驾车：3分钟/公里，地铁：5分钟/公里，步行：12分钟/公里
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

  const shopData = require('./shopData')
  const { shops, shopNameMap } = shopData

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
    return wx.getStorageSync(key) || defaultValue
  } catch (e) {
    console.error('读取失败:', e)
    return defaultValue
  }
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
    _spotData = require('./spotData')
  }
  return _spotData.spotData || []
}

// ============================================================
// 景点想去（收藏）功能
// ============================================================

function getWantSpots() {
  const list = loadData('userWantSpots', [])
  // 统一转为字符串
  return list.map(v => String(v))
}

function toggleSpotLike(spotId) {
  const list = getWantSpots()
  const strId = String(spotId)
  const idx = list.indexOf(strId)
  if (idx > -1) {
    list.splice(idx, 1)
  } else {
    list.push(strId)
  }
  saveData('userWantSpots', list)
  return list.indexOf(strId) > -1
}

function isSpotLiked(spotId) {
  return getWantSpots().indexOf(String(spotId)) > -1
}

// ============================================================
// 通用想去（支持美食和景点）
// ============================================================

function toggleLike(id, type = 'food') {
  const key = type === 'food' ? 'userWantFoods' : 'userWantSpots'
  const list = loadData(key, [])
  // 统一转为字符串比较和存储，避免类型不一致
  const strId = String(id)
  const idx = list.findIndex(v => String(v) === strId)
  if (idx > -1) {
    list.splice(idx, 1)
  } else {
    list.push(strId)
  }
  saveData(key, list)
  return list.includes(strId)
}

function isLiked(id, type = 'food') {
  const key = type === 'food' ? 'userWantFoods' : 'userWantSpots'
  return (loadData(key, [])).indexOf(id) > -1
}

// ============================================================
// 路线规划（统一支持美食和景点）
// ============================================================

/**
 * 贪心最近邻路线规划算法（统一版）
 * @param {Array} items - 地点数组
 * @param {Object} startPoint - 起点 {lat, lng}
 * @param {boolean} preserveOrder - true按原顺序，false贪心优化
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

module.exports = {
  getDistance,
  planRoute,
  formatDistance,
  estimateTime,
  parseBlockBasedGuide,
  getNavigationUrl,
  openWechatNavigation,
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
  toggleLike,
  isLiked,
  getWantSpots,
  toggleSpotLike,
  isSpotLiked,
  getSpotData,
  getNearbySpots,
  getSpotCategoryColor,
  SPOT_CATEGORY_COLORS
}
