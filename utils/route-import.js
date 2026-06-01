const util = require('./util')

// 腾讯地图 API Key（逆地理编码）
const QQMAP_GEOCODER_KEY = 'YLBBZ-VLNWJ-HFSFO-5QBUJ-SJ633-CTBFF'

// userAddedShops 最大存储条数
const MAX_USER_ADDED_SHOPS = 200

// 输入文本最大长度（超过则截断并警告）
const MAX_INPUT_TEXT_LENGTH = 5000

/**
 * 调用腾讯地图地理编码API，将地址文本转为经纬度
 * @param {string} address - 地址文本
 * @returns {Promise<{lat: number, lng: number, success: boolean}>}
 */
function geocodeAddress(address = '') {
  const addr = String(address || '').trim()
  if (!addr) {
    return Promise.resolve({ lat: 0, lng: 0, success: false })
  }

  return new Promise((resolve) => {
    wx.request({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      data: {
        address: addr,
        key: QQMAP_GEOCODER_KEY
      },
      method: 'GET',
      success(res) {
        const data = res.data || {}
        if (data.status === 0 && data.result && data.result.location) {
          resolve({
            lat: data.result.location.lat,
            lng: data.result.location.lng,
            success: true
          })
        } else {
          resolve({ lat: 0, lng: 0, success: false })
        }
      },
      fail() {
        resolve({ lat: 0, lng: 0, success: false })
      }
    })
  })
}

/**
 * 批量地理编码（带并发控制，最多3个同时请求）
 * @param {Array<{name: string, address?: string}>} items - 待编码地点数组
 * @returns {Promise<Array>} - 附带经纬度的地点数组
 */
async function batchGeocodeItems(items = []) {
  if (!items || items.length === 0) return []

  const results = []
  const CONCURRENCY = 3

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY)
    const encoded = await Promise.all(
      batch.map(async (item) => {
        // 优先用地址编码，地址为空则尝试用店名+城市
        const queryAddr = item.address || `${item.name} 深圳`
        const geo = await geocodeAddress(queryAddr)
        return { ...item, _geoResolved: geo.success, ...geo }
      })
    )
    results.push(...encoded)
  }

  return results
}

// 导入路线时，如果文本里有"没有收录"的地点，
// 这里给它生成一组临时坐标，保证后面的路线页还能正常规划。
// 改进：加入随机角度偏移，避免所有点排成一条直线
function buildSyntheticImportLatLng(basePoint, index) {
  const seed = index + 1
  // 使用黄金角度 (~137.5°) 分散各点方向，避免线性排列
  const angle = (seed * 137.508) * Math.PI / 180
  // 距离随索引递增，约200-500米
  const distance = 0.0015 + (seed % 5) * 0.0008
  return {
    lat: Number((basePoint.lat + distance * Math.cos(angle)).toFixed(6)),
    lng: Number((basePoint.lng + distance * Math.sin(angle)).toFixed(6))
  }
}

/**
 * 获取用于 fallback 的基准坐标点
 * 优先级：用户实时定位 > 应用中心位置 > 深圳蛇口默认
 */
function getFallbackBasePoint() {
  return getApp().globalData.location
    || getApp().globalData.centerLocation
    || { lat: 22.4846, lng: 113.9046 }
}

// 根据地点数量给一个默认天数，避免导入后还要先手动补天数。
function buildImportedDayCount(placeCount) {
  const count = Math.max(1, parseInt(placeCount, 10) || 1)
  if (count <= 4) return 1
  if (count <= 8) return 2
  if (count <= 12) return 3
  return Math.min(Math.ceil(count / 4), 7)
}

// 把未收录地点转换成项目本地可识别的"临时美食地点"。
// 改进：优先使用腾讯地图逆地理编码获取真实坐标，
//       编码失败则 fallback 到用户定位附近的随机偏移点。
// TODO: 用AI搜索图片
async function buildImportedFoodItems(items = []) {
  if (!items || items.length === 0) return []

  const basePoint = getFallbackBasePoint()
  const timestamp = Date.now()

  // 批量调用逆地理编码获取真实坐标
  const geoCodedItems = await batchGeocodeItems(items)

  return geoCodedItems.map((item, index) => {
    let lat = item.lat
    let lng = item.lng

    // 如果逆地理编码失败，使用基于用户定位的随机偏移坐标
    if (!item._geoResolved || !lat || !lng) {
      const synthetic = buildSyntheticImportLatLng(basePoint, index)
      lat = synthetic.lat
      lng = synthetic.lng
    }

    return {
      id: `imported-route-${timestamp}-${index}`,
      name: item.name || `导入地点${index + 1}`,
      emoji: '🍜',
      rating: 0,
      price: 0,
      category: '其他',
      tags: ['导入路线'],
      address: item.address || '',
      lat,
      lng,
      hours: item.hours || '',
      dishes: Array.isArray(item.dishes) ? item.dishes : [],
      image: '/images/app-logo.jpg',
      logo: '/images/app-logo.jpg',
      isUserAdded: true,
      importSource: 'route-text',
      geoResolved: !!item._geoResolved // 标记是否通过地理编码解析成功
    }
  })
}

// 把新导入的临时地点合并进 userAddedShops：
// 同名同地址的旧记录直接复用，避免越导越多重复项。
// 改进：增加存储上限保护（MAX_USER_ADDED_SHOPS），超限时按导入时间淘汰最旧的记录。
function mergeImportedFoodItems(importedItems = []) {
  const existingItems = util.loadData('userAddedShops', []) || []
  const resultItems = []
  let nextUserAddedShops = existingItems.slice()

  importedItems.forEach(importedItem => {
    // 去重：同名同地址视为同一地点
    const duplicated = nextUserAddedShops.find(item => {
      const sameName = String(item.name || '').trim() === String(importedItem.name || '').trim()
      const sameAddress = String(item.address || '').trim() === String(importedItem.address || '').trim()
      return sameName && sameAddress
    })

    if (duplicated) {
      resultItems.push(duplicated)
      return
    }

    nextUserAddedShops.push(importedItem)
    resultItems.push(importedItem)
  })

  // 存储上限保护：超过 MAX_USER_ADDED_SHOPS 时淘汰最早的记录
  if (nextUserAddedShops.length > MAX_USER_ADDED_SHOPS) {
    // 按时间戳排序（id 格式为 imported-route-{timestamp}-{index}）
    nextUserAddedShops.sort((a, b) => {
      const timeA = parseInt(String(a.id || '').split('-')[2] || '0', 10)
      const timeB = parseInt(String(b.id || '').split('-')[2] || '0', 10)
      return timeA - timeB
    })
    // 保留最新的 MAX_USER_ADDED_SHOPS 条
    nextUserAddedShops = nextUserAddedShops.slice(-MAX_USER_ADDED_SHOPS)
    console.log(`[route-import] userAddedShops 超限，已自动清理至 ${MAX_USER_ADDED_SHOPS} 条`)
  }

  util.saveData('userAddedShops', nextUserAddedShops)
  return resultItems
}

// 解析攻略文本：
// 1. 输入长度校验与截断
// 2. 找系统已收录地点
// 3. 未收录地点通过逆地理编码获取坐标，失败则 fallback 到随机偏移
// 4. 合并去重后返回可直接带去路线页的 id 列表
async function parseRouteTextToIds(text = '') {
  const content = String(text || '').trim()
  if (!content) {
    return {
      routeIds: [],
      dayCount: 1,
      foundItems: [],
      importedItems: [],
      totalCount: 0,
      warning: null
    }
  }

  // 输入长度校验：超长文本截断并返回警告信息
  let processedContent = content
  let warning = null
  if (content.length > MAX_INPUT_TEXT_LENGTH) {
    processedContent = content.substring(0, MAX_INPUT_TEXT_LENGTH)
    warning = `输入内容过长(${content.length}字)，已截断至${MAX_INPUT_TEXT_LENGTH}字处理`
    console.warn('[route-import]', warning)
  }

  const parsedResult = util.parseBlockBasedGuide(processedContent)
  const foundItems = parsedResult.foundShops || []

  // 异步构建导入项（含逆地理编码）
  const rawImportedItems = await buildImportedFoodItems(parsedResult.notFoundShops || [])
  const importedItems = mergeImportedFoodItems(rawImportedItems)
  const routeItems = foundItems.concat(importedItems)

  // 统计地理编码成功率
  const geoSuccessCount = importedItems.filter(item => item.geoResolved).length

  return {
    routeIds: routeItems.map(item => item.id),
    dayCount: buildImportedDayCount(routeItems.length),
    foundItems,
    importedItems,
    totalCount: routeItems.length,
    warning,
    geoStats: importedItems.length > 0
      ? { total: importedItems.length, resolved: geoSuccessCount }
      : null
  }
}

// 判断输入是不是"只有一个链接"。
function isPureLinkText(text = '') {
  return /^https?:\/\/\S+$/i.test(String(text || '').trim())
}

// 前端统一解析导入内容：
// 1. 普通正文直接返回
// 2. 纯链接则调用云函数先提取正文
async function resolveRouteImportText(inputText = '') {
  const content = String(inputText || '').trim()
  if (!content) {
    return {
      success: false,
      text: '',
      sourceType: 'empty',
      message: '请先粘贴内容'
    }
  }

  if (!isPureLinkText(content)) {
    return {
      success: true,
      text: content,
      sourceType: 'text'
    }
  }

  if (!wx.cloud || !wx.cloud.callFunction) {
    return {
      success: false,
      text: '',
      sourceType: 'link',
      message: '当前环境不支持链接解析'
    }
  }

  try {
    const response = await wx.cloud.callFunction({
      name: 'extractRouteFromLink',
      data: {
        url: content
      }
    })
    const result = response && response.result ? response.result : {}
    if (!result.success || !result.text) {
      return {
        success: false,
        text: '',
        sourceType: 'link',
        message: result.message || '链接正文提取失败'
      }
    }
    return {
      success: true,
      text: result.text,
      sourceType: result.sourceType || 'link'
    }
  } catch (error) {
    return {
      success: false,
      text: '',
      sourceType: 'link',
      message: '链接解析失败，请稍后重试'
    }
  }
}

module.exports = {
  buildImportedDayCount,
  parseRouteTextToIds,
  isPureLinkText,
  resolveRouteImportText,
  geocodeAddress,
  batchGeocodeItems
}
