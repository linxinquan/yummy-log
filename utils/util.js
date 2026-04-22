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
 * 提取地点的坐标
 */
function toLatLng(item) {
  return {
    lat: item.lat || item.latitude,
    lng: item.lng || item.longitude
  }
}

/**
 * 贪心最近邻 + 2-opt 优化路线规划算法
 * @param {Array} items - 地点数组
 * @param {Object} startPoint - 起点 {lat, lng}
 * @param {boolean} preserveOrder - true按原顺序，false贪心优化
 */
function planRoute(items, startPoint, preserveOrder = false) {
  if (!items || items.length === 0) return []
  if (items.length === 1) {
    const ll = toLatLng(items[0])
    items[0].distanceFromPrev = Math.round(getDistance(startPoint.lat, startPoint.lng, ll.lat, ll.lng))
    return items
  }

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

  // ── 1. 贪心最近邻生成初始路线 ──
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

  // ── 2. 2-opt 优化：交换反转减少总距离 ──
  const optimized = twoOptOptimize(route, startPoint, toLatLng)
  return optimized
}

/**
 * 2-opt 优化算法
 * 通过反转子路径来减少总行程距离
 */
function twoOptOptimize(route, startPoint, toLatLng) {
  if (route.length < 3) return route

  // 计算总距离（起点→各点→终点）
  function calcTotalDist(r, start) {
    let total = 0
    let prev = start
    for (const item of r) {
      const ll = toLatLng(item)
      total += getDistance(prev.lat, prev.lng, ll.lat, ll.lng)
      prev = ll
    }
    return total
  }

  // ── 双向优化：同时计算正反两个方向 ──
  // 方向1：从起点顺时针贪心
  let bestRoute1 = [...route]
  bestRoute1 = applyTwoOpt(bestRoute1, startPoint, calcTotalDist)

  // 方向2：从起点逆时针贪心（反转整个路线）
  let bestRoute2 = [...route].reverse()
  bestRoute2 = applyTwoOpt(bestRoute2, startPoint, calcTotalDist)

  // 选择总距离更短的方向
  const dist1 = calcTotalDist(bestRoute1, startPoint)
  const dist2 = calcTotalDist(bestRoute2, startPoint)

  const bestRoute = dist1 <= dist2 ? bestRoute1 : bestRoute2

  // 重新计算每段的 distanceFromPrev
  let prev = startPoint
  for (const item of bestRoute) {
    const ll = toLatLng(item)
    item.distanceFromPrev = Math.round(getDistance(prev.lat, prev.lng, ll.lat, ll.lng))
    prev = ll
  }

  return bestRoute
}

/**
 * 应用 2-opt 优化
 */
function applyTwoOpt(route, startPoint, calcTotalDist) {
  let improved = true
  let bestRoute = [...route]
  let bestDist = calcTotalDist(bestRoute, startPoint)
  const maxIterations = 100
  let iterations = 0

  while (improved && iterations < maxIterations) {
    improved = false
    iterations++

    for (let i = 0; i < bestRoute.length - 1; i++) {
      for (let j = i + 2; j < bestRoute.length; j++) {
        // 反转 i+1 到 j 之间的路段
        const newRoute = [...bestRoute]
        const reversed = newRoute.slice(i + 1, j + 1).reverse()
        for (let k = 0; k < reversed.length; k++) {
          newRoute[i + 1 + k] = reversed[k]
        }

        const newDist = calcTotalDist(newRoute, startPoint)
        if (newDist < bestDist) {
          bestRoute = newRoute
          bestDist = newDist
          improved = true
        }
      }
    }
  }

  return bestRoute
}

/**
 * 动态规划（DP）全局最优路线规划
 * 适用于地点数 ≤ 15 的情况
 * 公式：dp[mask][i] = min(dp[mask][i], dp[mask ^ (1<<i)][j] + dist[j][i])
 * @param {Array} items - 地点数组
 * @param {Object} startPoint - 起点 {lat, lng}
 * @returns {Array} 最优排序后的地点数组
 */
function planRouteDP(items, startPoint) {
  if (!items || items.length === 0) return []
  if (items.length === 1) {
    const ll = toLatLng(items[0])
    items[0].distanceFromPrev = Math.round(getDistance(startPoint.lat, startPoint.lng, ll.lat, ll.lng))
    return items
  }
  if (items.length > 15) {
    console.warn('DP算法不适用于超过15个地点，自动切换到贪心算法')
    return planRoute(items, startPoint, false)
  }

  const n = items.length

  // 预处理：获取所有点的坐标
  const coords = items.map(item => toLatLng(item))

  // 预计算距离矩阵（n+1 x n+1，索引0为起点）
  const dist = []
  for (let i = 0; i <= n; i++) {
    dist[i] = []
    for (let j = 0; j <= n; j++) {
      if (i === 0 && j === 0) {
        dist[i][j] = 0
      } else if (i === 0) {
        dist[i][j] = getDistance(startPoint.lat, startPoint.lng, coords[j - 1].lat, coords[j - 1].lng)
      } else if (j === 0) {
        dist[i][j] = getDistance(coords[i - 1].lat, coords[i - 1].lng, startPoint.lat, startPoint.lng)
      } else {
        dist[i][j] = getDistance(coords[i - 1].lat, coords[i - 1].lng, coords[j - 1].lat, coords[j - 1].lng)
      }
    }
  }

  // dp[mask][i] = 从起点出发，经过mask表示的集合中的点，最后到达点i的最小距离
  // mask的第j位表示第j个点是否已访问（j从0开始对应点0）
  const dp = []
  const fullMask = (1 << n) - 1

  // 初始化：所有点到起点的距离
  for (let i = 0; i <= fullMask; i++) {
    dp[i] = []
    for (let j = 0; j < n; j++) {
      dp[i][j] = Infinity
    }
  }

  // base case: 只访问一个点i时，从起点到点i的距离
  for (let i = 0; i < n; i++) {
    dp[1 << i][i] = dist[0][i + 1]
  }

  // DP递推
  for (let mask = 1; mask <= fullMask; mask++) {
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue

      const prevMask = mask ^ (1 << i)
      if (prevMask === 0) continue

      for (let j = 0; j < n; j++) {
        if (j === i) continue
        if (!(prevMask & (1 << j))) continue

        const candidate = dp[prevMask][j] + dist[j + 1][i + 1]
        if (candidate < dp[mask][i]) {
          dp[mask][i] = candidate
        }
      }
    }
  }

  // 找到最终最优解：从所有点回到起点的最小距离对应的最后一个点
  let lastPoint = 0
  let minDist = Infinity
  for (let i = 0; i < n; i++) {
    const totalDist = dp[fullMask][i] + dist[i + 1][0]
    if (totalDist < minDist) {
      minDist = totalDist
      lastPoint = i
    }
  }

  // 回溯：重建最优路径
  const optimalOrder = []
  let currentMask = fullMask
  let current = lastPoint

  while (currentMask > 0) {
    optimalOrder.unshift(current)
    const prevMask = currentMask ^ (1 << current)

    if (prevMask === 0) break

    // 找到上一个点
    let prev = 0
    let minPrevDist = Infinity
    for (let j = 0; j < n; j++) {
      if (j === current) continue
      if (prevMask & (1 << j)) {
        const d = dp[prevMask][j] + dist[j + 1][current + 1]
        if (d < minPrevDist) {
          minPrevDist = d
          prev = j
        }
      }
    }

    current = prev
    currentMask = prevMask
  }

  // 根据最优顺序重新排列items
  const result = optimalOrder.map(idx => ({ ...items[idx] }))

  // 计算每段的distanceFromPrev
  let prevPt = startPoint
  for (const item of result) {
    const ll = toLatLng(item)
    item.distanceFromPrev = Math.round(getDistance(prevPt.lat, prevPt.lng, ll.lat, ll.lng))
    prevPt = ll
  }

  return result
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
// 天气相关
// ============================================================

// Open-Meteo WMO 天气代码 → emoji 映射
const WEATHER_ICON_MAP = {
  0: '☀️',   // 晴
  1: '🌤️',  // 基本晴
  2: '⛅', 3: '☁️',  // 多云
  45: '🌫️', 48: '🌫️',  // 雾
  51: '🌧️', 53: '🌧️', 55: '🌧️',  // 小/中/大毛毛雨
  56: '🌨️', 57: '🌨️',  // 冻毛毛雨
  61: '🌧️', 63: '🌧️', 65: '🌧️',  // 小/中/大雨
  66: '🌨️', 67: '🌨️',  // 冻雨
  71: '🌨️', 73: '🌨️', 75: '❄️',  // 小/中/大雪
  77: '🌨️',  // 雪粒
  80: '🌦️', 81: '🌧️', 82: '⛈️',  // 小/中/大阵雨
  85: '🌨️', 86: '❄️',  // 小/大雪阵
  95: '⛈️', 96: '⛈️', 99: '⛈️'  // 雷暴
}

/**
 * 根据 Open-Meteo WMO 天气代码获取图标
 * @param {number} weatherCode - WMO 天气代码
 * @returns {string} emoji 图标
 */
function getWeatherIcon(weatherCode) {
  return WEATHER_ICON_MAP[weatherCode] || '🌡️'
}

/**
 * 加载天气信息（统一入口）
 * @param {Function} callback - 回调函数，接收 (icon, temp)
 * @param {Object} location - 位置信息 {lat, lng}，默认使用 app.globalData.location
 */
function loadWeather(callback, location) {
  const app = getApp()
  const loc = location || app.globalData.location
  if (!loc) return

  wx.request({
    url: 'https://api.open-meteo.com/v1/forecast',
    data: {
      latitude: loc.lat,
      longitude: loc.lng,
      current_weather: true,
      temperature_unit: 'celsius'
    },
    success: (res) => {
      if (res.data && res.data.current_weather) {
        const weather = res.data.current_weather
        const icon = getWeatherIcon(weather.weathercode)
        const temp = Math.round(weather.temperature) + '°C'
        if (callback) callback(icon, temp)
      }
    },
    fail: () => {
      // 静默失败
    }
  })
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
  planRouteDP,
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
  SPOT_CATEGORY_COLORS,
  // 天气
  getWeatherIcon,
  loadWeather
}
