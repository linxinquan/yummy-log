/**
 * util.js 数据库改造补丁
 * 
 * 使用方法：
 * 1. 将此文件内容替换到 utils/util.js 的对应位置
 * 2. 或者将此文件 import 到 utils/util.js 末尾
 * 
 * 主要改动：
 * - getSpotData() 改为优先从云数据库获取
 * - 添加云数据库兼容的辅助函数
 */

// ============================================================
// 导入云数据访问层
// ============================================================
const cloudData = require('./cloudData')

// ============================================================
// 修改后的 getSpotData - 支持异步获取
// ============================================================

let _spotData = null
let _spotDataLoaded = false

/**
 * 获取景点数据（同步版本，返回缓存）
 * 如果缓存不存在，返回空数组，页面应该调用 loadSpotData() 预加载
 */
function getSpotData() {
  if (!_spotData) {
    // 尝试从本地导入作为后备
    try {
      const localData = require('./spotData')
      _spotData = Array.isArray(localData) ? localData : (localData.spotData || [])
    } catch (e) {
      _spotData = []
    }
  }
  return _spotData
}

/**
 * 异步加载景点数据（从云数据库）
 * 页面 onShow 时调用
 */
function loadSpotData() {
  return cloudData.getSpots().then(data => {
    _spotData = data
    _spotDataLoaded = true
    return data
  }).catch(err => {
    console.error('加载景点数据失败，使用本地缓存:', err)
    return getSpotData()
  })
}

/**
 * 强制刷新景点数据
 */
function refreshSpotData() {
  return cloudData.getSpots(true).then(data => {
    _spotData = data
    return data
  })
}

// ============================================================
// 餐厅数据获取（云数据库版本）
// ============================================================

let _restaurantData = null

/**
 * 获取餐厅数据（同步版本，返回缓存）
 */
function getShopData() {
  if (!_restaurantData) {
    try {
      const localData = require('./shopData')
      _restaurantData = localData.shops || []
    } catch (e) {
      _restaurantData = []
    }
  }
  return _restaurantData
}

/**
 * 异步加载餐厅数据（从云数据库）
 */
function loadRestaurantData() {
  return cloudData.getRestaurants().then(data => {
    _restaurantData = data
    return data
  }).catch(err => {
    console.error('加载餐厅数据失败，使用本地缓存:', err)
    return getShopData()
  })
}

// ============================================================
// shopNameMap 辅助函数（用于攻略解析）
// ============================================================

let _shopNameMap = null

function getShopNameMap() {
  if (!_shopNameMap) {
    try {
      const localData = require('./shopData')
      _shopNameMap = localData.shopNameMap || {}
    } catch (e) {
      _shopNameMap = {}
    }
  }
  return _shopNameMap
}

/**
 * 从云数据库加载 shopNameMap
 * 需要额外维护一个 configs 集合来存储此数据
 */
async function loadShopNameMap() {
  // 如果云数据库有 configs 集合，可以从这里获取
  // 目前暂时使用本地数据
  return getShopNameMap()
}

// ============================================================
// 导出给页面使用的接口
// ============================================================

module.exports = {
  // 同步版本（返回缓存）
  getSpotData,
  getShopData,
  getShopNameMap,
  
  // 异步版本（从云数据库加载）
  loadSpotData,
  loadRestaurantData,
  loadShopNameMap,
  refreshSpotData,
  
  // 云数据访问层
  cloudData
}
