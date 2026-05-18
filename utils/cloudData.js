/**
 * 云数据库数据访问层
 * 统一管理 spots 和 restaurants 的数据获取
 * 
 * 使用方式：
 * const cloudData = require('./cloudData')
 * 
 * // 获取所有景点（带缓存）
 * const spots = await cloudData.getSpots()
 * 
 * // 获取餐厅列表（支持分类筛选）
 * const restaurants = await cloudData.getRestaurants({ category: '粤菜' })
 * 
 * // 附近查询（使用地理位置索引）
 * const nearbySpots = await cloudData.getNearbySpots(lat, lng, 5000) // 5公里内
 */

// ============================================================
// 配置
// ============================================================

const CLOUD_DB_NAME = 'spots'        // 景点集合名
const CLOUD_RESTAURANTS_NAME = 'restaurants'  // 餐厅集合名

// 缓存配置
const CACHE_DURATION = 24 * 60 * 60 * 1000  // 缓存有效期：1天（持久化缓存）
const STORAGE_KEY_SPOTS = 'cloudData_spots'         // 本地缓存key
const STORAGE_KEY_RESTAURANTS = 'cloudData_restaurants'  // 本地缓存key
const STORAGE_KEY_SPOTS_TIME = 'cloudData_spots_time'   // 缓存时间戳key
const STORAGE_KEY_RESTAURANTS_TIME = 'cloudData_restaurants_time'  // 缓存时间戳key
const STORAGE_KEY_VERSION = 'cloudData_version'  // 数据版本号key

// 数据版本（用于强制更新）
const DATA_VERSION = '1.0.0'

// ============================================================
// 内存缓存（作为二级缓存，提升性能）
// ============================================================

let _spotsCache = null
let _spotsCacheTime = 0
let _restaurantsCache = null
let _restaurantsCacheTime = 0

// ============================================================
// 本地缓存操作函数
// ============================================================

/**
 * 从本地缓存读取数据
 */
function loadFromStorage(key) {
  try {
    return wx.getStorageSync(key)
  } catch (e) {
    console.error('读取本地缓存失败:', key, e)
    return null
  }
}

/**
 * 写入本地缓存
 */
function saveToStorage(key, data) {
  try {
    wx.setStorageSync(key, data)
    return true
  } catch (e) {
    console.error('写入本地缓存失败:', key, e)
    return false
  }
}

/**
 * 清除本地缓存
 */
function clearStorage() {
  try {
    wx.removeStorageSync(STORAGE_KEY_SPOTS)
    wx.removeStorageSync(STORAGE_KEY_RESTAURANTS)
    wx.removeStorageSync(STORAGE_KEY_SPOTS_TIME)
    wx.removeStorageSync(STORAGE_KEY_RESTAURANTS_TIME)
    wx.removeStorageSync(STORAGE_KEY_VERSION)
    return true
  } catch (e) {
    console.error('清除本地缓存失败:', e)
    return false
  }
}

/**
 * 检查缓存是否有效
 */
function isCacheValid(cacheTime) {
  if (!cacheTime) return false
  return Date.now() - cacheTime < CACHE_DURATION
}

/**
 * 检查数据版本是否需要更新
 */
function checkVersion() {
  try {
    const version = wx.getStorageSync(STORAGE_KEY_VERSION)
    return version === DATA_VERSION
  } catch (e) {
    return false
  }
}

/**
 * 更新数据版本号
 */
function updateVersion() {
  try {
    wx.setStorageSync(STORAGE_KEY_VERSION, DATA_VERSION)
  } catch (e) {
    console.error('更新版本号失败:', e)
  }
}

// ============================================================
// 数据获取函数
// ============================================================

/**
 * 获取所有景点数据（带持久化缓存）
 * @param {boolean} forceRefresh - 是否强制刷新缓存
 * @param {boolean} backgroundUpdate - 是否后台静默更新
 */
function getSpots(forceRefresh = false, backgroundUpdate = false) {
  return new Promise((resolve, reject) => {
    // 1. 优先从内存缓存读取（最快）
    if (!forceRefresh && _spotsCache && isCacheValid(_spotsCacheTime)) {
      // 后台静默更新（不阻塞当前请求）
      if (backgroundUpdate) {
        updateSpotsInBackground()
      }
      resolve(_spotsCache)
      return
    }

    // 2. 尝试从本地缓存读取（秒开）
    if (!forceRefresh) {
      const localData = loadFromStorage(STORAGE_KEY_SPOTS)
      const localTime = loadFromStorage(STORAGE_KEY_SPOTS_TIME)
      
      if (localData && isCacheValid(localTime)) {
        // 恢复到内存缓存
        _spotsCache = localData
        _spotsCacheTime = localTime
        
        // 后台异步更新数据
        updateSpotsInBackground()
        
        console.log('[cloudData] 从本地缓存加载景点数据，共', localData.length, '条')
        resolve(localData)
        return
      }
    }

    // 3. 从云数据库加载
    fetchSpotsFromCloud(forceRefresh)
      .then(data => resolve(data))
      .catch(err => {
        // 降级方案：尝试使用本地缓存（即使过期）
        const localData = loadFromStorage(STORAGE_KEY_SPOTS)
        if (localData) {
          console.warn('[cloudData] 云数据库失败，使用本地缓存', err)
          _spotsCache = localData
          _spotsCacheTime = loadFromStorage(STORAGE_KEY_SPOTS_TIME) || Date.now()
          resolve(localData)
        } else {
          reject(err)
        }
      })
  })
}

/**
 * 从云数据库获取景点数据
 */
function fetchSpotsFromCloud(forceRefresh = false) {
  return new Promise((resolve, reject) => {
    const db = wx.cloud.database()
    db.collection(CLOUD_DB_NAME).get({
      success: res => {
        // 更新缓存
        _spotsCache = res.data
        _spotsCacheTime = Date.now()
        
        // 持久化到本地缓存
        saveToStorage(STORAGE_KEY_SPOTS, res.data)
        saveToStorage(STORAGE_KEY_SPOTS_TIME, _spotsCacheTime)
        updateVersion()
        
        console.log('[cloudData] 从云数据库加载景点数据，共', res.data.length, '条')
        resolve(res.data)
      },
      fail: err => {
        reject(err)
      }
    })
  })
}

/**
 * 后台静默更新景点数据
 */
function updateSpotsInBackground() {
  // 检查是否需要更新（超过1天未更新）
  const localTime = loadFromStorage(STORAGE_KEY_SPOTS_TIME)
  if (localTime && isCacheValid(localTime)) {
    // 缓存仍然有效，跳过更新
    return
  }

  console.log('[cloudData] 后台更新景点数据...')
  fetchSpotsFromCloud(true).catch(err => {
    console.warn('[cloudData] 后台更新景点数据失败', err)
  })
}

/**
 * 获取餐厅数据（带持久化缓存）
 * @param {Object} options - 查询选项
 * @param {string} options.category - 分类筛选
 * @param {string} options.city - 城市筛选
 * @param {boolean} forceRefresh - 是否强制刷新
 * @param {boolean} backgroundUpdate - 是否后台静默更新
 */
function getRestaurants(options = {}, forceRefresh = false, backgroundUpdate = false) {
  return new Promise((resolve, reject) => {
    const hasFilter = options.category || options.city
    
    // 1. 优先从内存缓存读取（无筛选条件时）
    if (!forceRefresh && !hasFilter && _restaurantsCache && isCacheValid(_restaurantsCacheTime)) {
      if (backgroundUpdate) {
        updateRestaurantsInBackground()
      }
      resolve(_restaurantsCache)
      return
    }

    // 2. 尝试从本地缓存读取（无筛选条件时）
    if (!forceRefresh && !hasFilter) {
      const localData = loadFromStorage(STORAGE_KEY_RESTAURANTS)
      const localTime = loadFromStorage(STORAGE_KEY_RESTAURANTS_TIME)
      
      if (localData && isCacheValid(localTime)) {
        // 恢复到内存缓存
        _restaurantsCache = localData
        _restaurantsCacheTime = localTime
        
        // 后台异步更新数据
        updateRestaurantsInBackground()
        
        console.log('[cloudData] 从本地缓存加载餐厅数据，共', localData.length, '条')
        resolve(localData)
        return
      }
    }

    // 3. 从云数据库加载
    fetchRestaurantsFromCloud(options, forceRefresh)
      .then(data => resolve(data))
      .catch(err => {
        // 降级方案：尝试使用本地缓存（即使过期）
        if (!hasFilter) {
          const localData = loadFromStorage(STORAGE_KEY_RESTAURANTS)
          if (localData) {
            console.warn('[cloudData] 云数据库失败，使用本地缓存', err)
            _restaurantsCache = localData
            _restaurantsCacheTime = loadFromStorage(STORAGE_KEY_RESTAURANTS_TIME) || Date.now()
            resolve(localData)
            return
          }
        }
        reject(err)
      })
  })
}

/**
 * 从云数据库获取餐厅数据
 */
function fetchRestaurantsFromCloud(options = {}, forceRefresh = false) {
  return new Promise((resolve, reject) => {
    const db = wx.cloud.database()
    let query = db.collection(CLOUD_RESTAURANTS_NAME)

    if (options.category && options.category !== '全部') {
      query = query.where({
        category: options.category
      })
    }

    if (options.city) {
      query = query.where({
        city: options.city
      })
    }

    query.get({
      success: res => {
        const hasFilter = options.category || options.city
        
        // 无筛选条件时，更新缓存
        if (!hasFilter) {
          _restaurantsCache = res.data
          _restaurantsCacheTime = Date.now()
          
          // 持久化到本地缓存
          saveToStorage(STORAGE_KEY_RESTAURANTS, res.data)
          saveToStorage(STORAGE_KEY_RESTAURANTS_TIME, _restaurantsCacheTime)
          updateVersion()
        }
        
        console.log('[cloudData] 从云数据库加载餐厅数据，共', res.data.length, '条')
        resolve(res.data)
      },
      fail: err => {
        reject(err)
      }
    })
  })
}

/**
 * 后台静默更新餐厅数据
 */
function updateRestaurantsInBackground() {
  // 检查是否需要更新（超过1天未更新）
  const localTime = loadFromStorage(STORAGE_KEY_RESTAURANTS_TIME)
  if (localTime && isCacheValid(localTime)) {
    // 缓存仍然有效，跳过更新
    return
  }

  console.log('[cloudData] 后台更新餐厅数据...')
  fetchRestaurantsFromCloud({}, true).catch(err => {
    console.warn('[cloudData] 后台更新餐厅数据失败', err)
  })
}

/**
 * 根据ID获取单个景点
 * @param {number} id - 景点ID（原数据结构中的id字段）
 */
function getSpotById(id) {
  return new Promise((resolve, reject) => {
    const db = wx.cloud.database()
    db.collection(CLOUD_DB_NAME).where({
      id: Number(id)
    }).get({
      success: res => {
        resolve(res.data[0] || null)
      },
      fail: err => {
        console.error('获取景点详情失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 根据ID获取餐厅
 * @param {number} id - 餐厅ID
 */
function getRestaurantById(id) {
  return new Promise((resolve, reject) => {
    const db = wx.cloud.database()
    db.collection(CLOUD_RESTAURANTS_NAME).where({
      id: Number(id)
    }).get({
      success: res => {
        resolve(res.data[0] || null)
      },
      fail: err => {
        console.error('获取餐厅详情失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 附近景点查询
 * @param {number} latitude - 纬度
 * @param {number} longitude - 经度
 * @param {number} maxDistance - 最大距离（米）
 */
function getNearbySpots(latitude, longitude, maxDistance = 5000) {
  return new Promise((resolve, reject) => {
    const db = wx.cloud.database()
    db.collection(CLOUD_DB_NAME).where({
      location: db.command.geoNear({
        geometry: db.Geo.Point(longitude, latitude),
        maxDistance: maxDistance,
        minDistance: 0
      })
    }).get({
      success: res => {
        resolve(res.data)
      },
      fail: err => {
        console.error('附近景点查询失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 附近餐厅查询
 * @param {number} latitude - 纬度
 * @param {number} longitude - 经度
 * @param {number} maxDistance - 最大距离（米）
 */
function getNearbyRestaurants(latitude, longitude, maxDistance = 3000) {
  return new Promise((resolve, reject) => {
    const db = wx.cloud.database()
    db.collection(CLOUD_RESTAURANTS_NAME).where({
      location: db.command.geoNear({
        geometry: db.Geo.Point(longitude, latitude),
        maxDistance: maxDistance,
        minDistance: 0
      })
    }).get({
      success: res => {
        resolve(res.data)
      },
      fail: err => {
        console.error('附近餐厅查询失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 清除所有缓存（内存 + 本地）
 */
function clearCache() {
  // 清除内存缓存
  _spotsCache = null
  _spotsCacheTime = 0
  _restaurantsCache = null
  _restaurantsCacheTime = 0
  
  // 清除本地缓存
  clearStorage()
  
  console.log('[cloudData] 已清除所有缓存')
}

/**
 * 预加载数据（在 app.js 中调用）
 * 优先使用本地缓存，后台静默更新
 */
function preloadData() {
  console.log('[cloudData] 开始预加载数据...')
  
  // 并行加载景点和餐厅数据
  Promise.all([
    getSpots(false, true),  // 后台更新
    getRestaurants({}, false, true)  // 后台更新
  ]).then(([spots, restaurants]) => {
    console.log('[cloudData] 预加载完成 - 景点:', spots.length, '餐厅:', restaurants.length)
  }).catch(err => {
    console.warn('[cloudData] 预加载失败', err)
  })
}

/**
 * 强制刷新所有数据
 */
function refreshAllData() {
  console.log('[cloudData] 强制刷新所有数据...')
  
  return Promise.all([
    getSpots(true),
    getRestaurants({}, true)
  ]).then(([spots, restaurants]) => {
    console.log('[cloudData] 刷新完成 - 景点:', spots.length, '餐厅:', restaurants.length)
    return { spots, restaurants }
  })
}

/**
 * 获取缓存状态
 */
function getCacheStatus() {
  const spotsTime = _spotsCacheTime || loadFromStorage(STORAGE_KEY_SPOTS_TIME)
  const restaurantsTime = _restaurantsCacheTime || loadFromStorage(STORAGE_KEY_RESTAURANTS_TIME)
  
  return {
    spots: {
      memory: !!_spotsCache,
      local: !!loadFromStorage(STORAGE_KEY_SPOTS),
      time: spotsTime ? new Date(spotsTime).toLocaleString() : null,
      valid: isCacheValid(spotsTime)
    },
    restaurants: {
      memory: !!_restaurantsCache,
      local: !!loadFromStorage(STORAGE_KEY_RESTAURANTS),
      time: restaurantsTime ? new Date(restaurantsTime).toLocaleString() : null,
      valid: isCacheValid(restaurantsTime)
    },
    version: loadFromStorage(STORAGE_KEY_VERSION)
  }
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  // 数据获取
  getSpots,
  getRestaurants,
  getSpotById,
  getRestaurantById,
  getNearbySpots,
  getNearbyRestaurants,
  
  // 缓存管理
  clearCache,
  preloadData,
  refreshAllData,
  getCacheStatus,
  
  // 直接导出缓存，方便读取
  get spotsCache() { return _spotsCache },
  get restaurantsCache() { return _restaurantsCache }
}
