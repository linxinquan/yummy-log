/**
 * 统一数据访问层
 * 替代原来的 shopData.js、foodData.js、spotData.js
 * 使用 utils/unified-places.json 作为统一数据源
 * 
 * 使用方式：
 * const placesData = require('./placesData')
 * 
 * // 获取所有景点
 * const spots = placesData.getSpots()
 * 
 * // 获取所有美食
 * const foods = placesData.getFoods()
 * 
 * // 根据ID获取
 * const place = placesData.getPlaceById(100)
 */

// 读取统一数据源
// 注意：使用 unified-places-data.js（由 unified-places.json 转换而来）
// 因为微信小程序不支持直接用 require() 加载 .json 文件（非配置文件）
const rawPlaces = require('./unified-places-data')

// 将数据转换为统一格式：确保每条数据都有 lat 和 lng 字段
const realPlaces = rawPlaces.map(place => {
  const newPlace = { ...place }
  // 如果从 location.coordinates 格式转换（[longitude, latitude]）
  if (place.location && place.location.coordinates && place.location.coordinates.length >= 2) {
    newPlace.lng = place.location.coordinates[0]
    newPlace.lat = place.location.coordinates[1]
  }
  // 如果已经有 lat/lng 或 latitude/longitude，保持不变
  return newPlace
})

// 演示数据：用来让探索页的大类更完整
const demoPlaces = [
  // 文化展馆
  { id: 901, name: '深圳美术馆', city: '深圳', category: '文化展馆', type: 'culture', lat: 22.5436, lng: 114.079, rating: 4.5, tags: ['展览', '艺术'], image: '/images/covers/01.jpeg', displayImage: '/images/covers/01.jpeg', displayCategory: '文化展馆' },
  { id: 902, name: '关山月美术馆', city: '深圳', category: '文化展馆', type: 'culture', lat: 22.541, lng: 114.038, rating: 4.6, tags: ['国画', '收藏'], image: '/images/covers/02.jpeg', displayImage: '/images/covers/02.jpeg', displayCategory: '文化展馆' },
  { id: 903, name: '深圳音乐厅', city: '深圳', category: '文化展馆', type: 'culture', lat: 22.544, lng: 114.042, rating: 4.7, tags: ['演出', '音乐'], image: '/images/covers/03.jpeg', displayImage: '/images/covers/03.jpeg', displayCategory: '文化展馆' },
  { id: 904, name: '何香凝美术馆', city: '深圳', category: '文化展馆', type: 'culture', lat: 22.532, lng: 113.986, rating: 4.4, tags: ['美术', '展览'], image: '/images/covers/04.jpeg', displayImage: '/images/covers/04.jpeg', displayCategory: '文化展馆' },
  { id: 905, name: '南山图书馆', city: '深圳', category: '文化展馆', type: 'culture', lat: 22.534915, lng: 113.922459, rating: 4.4, tags: ['图书', '阅读'], image: '/images/covers/04.jpeg', displayImage: '/images/covers/04.jpeg', displayCategory: '文化展馆' },
  
  // 自然户外
  { id: 911, name: '梧桐山国家森林公园', city: '深圳', category: '自然户外', type: 'outdoor', lat: 22.624, lng: 114.198, rating: 4.8, tags: ['登山', '观景'], image: '/images/covers/01.jpeg', displayImage: '/images/covers/01.jpeg', displayCategory: '自然户外' },
  { id: 912, name: '塘朗山郊野公园', city: '深圳', category: '自然户外', type: 'outdoor', lat: 22.542, lng: 113.958, rating: 4.5, tags: ['徒步', '骑行'], image: '/images/covers/02.jpeg', displayImage: '/images/covers/02.jpeg', displayCategory: '自然户外' },
  { id: 913, name: '深圳湾公园', city: '深圳', category: '自然户外', type: 'outdoor', lat: 22.498, lng: 113.914, rating: 4.7, tags: ['滨海', '跑步'], image: '/images/covers/03.jpeg', displayImage: '/images/covers/03.jpeg', displayCategory: '自然户外' },
  { id: 914, name: '梅林水库', city: '深圳', category: '自然户外', type: 'outdoor', lat: 22.568, lng: 114.032, rating: 4.6, tags: ['水库', '徒步'], image: '/images/covers/04.jpeg', displayImage: '/images/covers/04.jpeg', displayCategory: '自然户外' },
  
  // 购物
  { id: 921, name: '华润万象城', city: '深圳', category: '购物', type: 'shopping', lat: 22.541, lng: 114.063, rating: 4.8, tags: ['高端', '奢侈品'], image: '/images/covers/01.jpeg', displayImage: '/images/covers/01.jpeg', displayCategory: '购物' },
  { id: 922, name: '海岸城', city: '深圳', category: '购物', type: 'shopping', lat: 22.489, lng: 113.921, rating: 4.6, tags: ['餐饮', '娱乐'], image: '/images/covers/02.jpeg', displayImage: '/images/covers/02.jpeg', displayCategory: '购物' },
  { id: 923, name: '东门老街', city: '深圳', category: '购物', type: 'shopping', lat: 22.543, lng: 114.078, rating: 4.5, tags: ['老街', '小吃'], image: '/images/covers/03.jpeg', displayImage: '/images/covers/03.jpeg', displayCategory: '购物' },
  { id: 924, name: '益田假日广场', city: '深圳', category: '购物', type: 'shopping', lat: 22.535, lng: 113.988, rating: 4.7, tags: ['品牌', '餐饮'], image: '/images/covers/04.jpeg', displayImage: '/images/covers/04.jpeg', displayCategory: '购物' },
  
  // 酒店
  { id: 931, name: '深圳华侨城洲际大酒店', city: '深圳', category: '酒店', type: 'hotel', lat: 22.538, lng: 113.989, rating: 4.8, tags: ['五星', '豪华'], image: '/images/covers/01.jpeg', displayImage: '/images/covers/01.jpeg', displayCategory: '酒店', price: 1280 },
  { id: 932, name: '深圳湾安达仕酒店', city: '深圳', category: '酒店', type: 'hotel', lat: 22.501, lng: 113.912, rating: 4.9, tags: ['海景', '高端'], image: '/images/covers/02.jpeg', displayImage: '/images/covers/02.jpeg', displayCategory: '酒店', price: 1580 },
  { id: 933, name: '深圳柏悦酒店', city: '深圳', category: '酒店', type: 'hotel', lat: 22.542, lng: 114.061, rating: 4.7, tags: ['商务', '舒适'], image: '/images/covers/03.jpeg', displayImage: '/images/covers/03.jpeg', displayCategory: '酒店', price: 980 },
  { id: 934, name: '深圳大鹏古城民宿', city: '深圳', category: '酒店', type: 'hotel', lat: 22.628, lng: 114.335, rating: 4.6, tags: ['民宿', '古村'], image: '/images/covers/04.jpeg', displayImage: '/images/covers/04.jpeg', displayCategory: '酒店', price: 380 },
]

// 合并真实数据和演示数据
const allPlaces = [...realPlaces, ...demoPlaces]

// ============================================================
// 内存缓存（提升性能）
// ============================================================

let _spotsCache = null
let _foodsCache = null
let _placesMapCache = null  // id -> place

// ============================================================
// 核心函数
// ============================================================

/**
 * 获取所有数据
 */
function getAllPlaces() {
  return allPlaces
}

/**
 * 获取所有景点
 * @param {string} city - 可选，筛选城市
 * @returns {Array} 景点数组
 */
function getSpots(city) {
  if (!_spotsCache) {
    _spotsCache = allPlaces.filter(p => p.type === 'spot')
  }
  
  if (city) {
    return _spotsCache.filter(s => s.city === city)
  }
  
  return _spotsCache
}

/**
 * 获取所有美食
 * @param {string} city - 可选，筛选城市
 * @returns {Array} 美食数组
 */
function getFoods(city) {
  if (!_foodsCache) {
    _foodsCache = allPlaces.filter(p => p.type === 'food')
  }
  
  if (city) {
    return _foodsCache.filter(f => f.city === city)
  }
  
  return _foodsCache
}

/**
 * 根据ID获取地点
 * @param {number} id - 地点ID
 * @returns {Object|null} 地点对象
 */
function getPlaceById(id) {
  if (!_placesMapCache) {
    _placesMapCache = {}
    allPlaces.forEach(p => {
      _placesMapCache[p.id] = p
    })
  }
  
  return _placesMapCache[id] || null
}

/**
 * 根据名称获取地点
 * @param {string} name - 地点名称
 * @returns {Object|null} 地点对象
 */
function getPlaceByName(name) {
  return allPlaces.find(p => p.name === name) || null
}

/**
 * 搜索地点（按名称、标签、描述）
 * @param {string} keyword - 搜索关键词
 * @param {string} type - 可选，筛选类型 'spot' 或 'food'
 * @returns {Array} 匹配的地点数组
 */
function searchPlaces(keyword, type) {
  const lowerKeyword = keyword.toLowerCase()
  
  return allPlaces.filter(p => {
    // 类型筛选
    if (type && p.type !== type) return false
    
    // 名称匹配
    if (p.name && p.name.toLowerCase().includes(lowerKeyword)) return true
    
    // 标签匹配
    if (p.tags && p.tags.some(t => t.toLowerCase().includes(lowerKeyword))) return true
    
    // 描述匹配
    if (p.desc && p.desc.toLowerCase().includes(lowerKeyword)) return true
    
    // 分类匹配
    if (p.category && p.category.toLowerCase().includes(lowerKeyword)) return true
    
    return false
  })
}

/**
 * 获取地点分类列表
 * @param {string} type - 'spot' 或 'food'
 * @returns {Array} 分类数组
 */
function getCategories(type) {
  const places = type === 'spot' ? getSpots() : getFoods()
  const categories = new Set()
  
  places.forEach(p => {
    if (p.category) {
      categories.add(p.category)
    }
  })
  
  return Array.from(categories)
}

/**
 * 获取城市列表
 * @param {string} type - 可选，筛选类型 'spot' 或 'food'
 * @returns {Array} 城市数组
 */
function getCities(type) {
  const places = type ? (type === 'spot' ? getSpots() : getFoods()) : allPlaces
  const cities = new Set()
  
  places.forEach(p => {
    if (p.city) {
      cities.add(p.city)
    }
  })
  
  return Array.from(cities)
}

// ============================================================
// 兼容旧接口的包装函数
// ============================================================

/**
 * 兼容旧接口：获取蛇口美食（shopData.shops）
 * @deprecated 请使用 getFoods('深圳') 代替
 */
function getSnakePortShops() {
  return getFoods('深圳').filter(f => 
    f.district === '蛇口' || 
    (f.address && f.address.includes('蛇口'))
  )
}

/**
 * 兼容旧接口：获取美食名称映射（shopData.shopNameMap）
 * @deprecated 请使用 getPlaceByName() 代替
 */
function getShopNameMap() {
  const map = {}
  getFoods().forEach(f => {
    map[f.id] = f.name
  })
  return map
}

/**
 * 兼容旧接口：获取深圳美食（foodData.foods）
 * @deprecated 请使用 getFoods('深圳') 代替
 */
function getShenzhenFoods() {
  return getFoods('深圳')
}

/**
 * 兼容旧接口：获取深圳景点（spotData）
 * @deprecated 请使用 getSpots('深圳') 代替
 */
function getShenzhenSpots() {
  return getSpots('深圳')
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  // 核心函数
  getAllPlaces,
  getSpots,
  getFoods,
  getPlaceById,
  getPlaceByName,
  searchPlaces,
  getCategories,
  getCities,
  
  // 兼容旧接口（逐步废弃）
  getSnakePortShops,
  getShopNameMap,
  getShenzhenFoods,
  getShenzhenSpots,
  
  // 直接导出数据（兼容旧代码）
  get spots() { return getSpots() },
  get foods() { return getFoods() },
  get shops() { return getSnakePortShops() },
  get shopNameMap() { return getShopNameMap() }
}
