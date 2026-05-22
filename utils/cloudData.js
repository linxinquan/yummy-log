/**
 * 云数据库数据访问层（实时加载，无缓存）
 * 统一管理 places 集合的数据获取（景点 + 美食已合并）
 */

// ============================================================
// 配置
// ============================================================

const CLOUD_COLLECTION = 'places'  // 统一集合名（景点 type='spot'，美食 type='food'）
const PAGE_SIZE = 20  // 微信云开发客户端 SDK 单次最多返回 20 条

// ============================================================
// 全量拉取（skip 翻页，每页最多 20 条）
// ============================================================

/**
 * 翻页拉取全量数据：每次 skip + limit 20，直到拿不到数据为止
 * 每轮重新构造 query，避免 SDK 链式复用 .skip() 的坑
 */
function fetchAllFromCloud(collectionName, conditions) {
  return new Promise((resolve, reject) => {
    const db = wx.cloud.database()
    const all = []

    function makeQuery() {
      return conditions
        ? db.collection(collectionName).where(conditions)
        : db.collection(collectionName)
    }

    function fetchPage(offset) {
      console.log('[cloudData] fetchPage offset:', offset)
      makeQuery()
        .skip(offset)
        .limit(PAGE_SIZE)
        .get({
          success: res => {
            const chunk = res.data || []
            console.log('[cloudData] 本页:', chunk.length, '累计:', all.length + chunk.length)
            all.push(...chunk)
            if (chunk.length < PAGE_SIZE) {
              console.log('[cloudData] 拉取完毕，总计:', all.length)
              resolve(all)
            } else {
              fetchPage(offset + PAGE_SIZE)
            }
          },
          fail: err => {
            console.error('[cloudData] 翻页失败 offset=', offset, err)
            reject(err)
          }
        })
    }

    fetchPage(0)
  })
}

// ============================================================
// 数据获取（全部实时查云数据库）
// ============================================================

/**
 * 获取所有景点（type === 'spot'）
 */
function getSpots() {
  return fetchAllFromCloud(CLOUD_COLLECTION, { type: 'spot' })
}

/**
 * 获取餐厅列表（type === 'food'）
 * @param {Object} options - { category?, city? }
 */
function getRestaurants(options = {}) {
  const conditions = { type: 'food' }
  if (options.category && options.category !== '全部') {
    conditions.category = options.category
  }
  if (options.city) {
    conditions.city = options.city
  }
  return fetchAllFromCloud(CLOUD_COLLECTION, conditions)
}

/**
 * 按城市查询地点（支持限制条数，用于首屏快速加载）
 * @param {string} city - 城市名（如 '深圳'）
 * @param {number} [limit] - 最多返回条数，不传则翻页拉全量
 */
function getPlacesByCity(city, limit) {
  if (limit) {
    // 单次查询，不翻页
    return new Promise((resolve, reject) => {
      wx.cloud.database()
        .collection(CLOUD_COLLECTION)
        .where({ city })
        .limit(Math.min(limit, PAGE_SIZE))
        .get({
          success: res => resolve(res.data || []),
          fail: reject
        })
    })
  }
  return fetchAllFromCloud(CLOUD_COLLECTION, { city })
}

/**
 * 获取所有地点（全量）
 */
function getAllPlaces() {
  return fetchAllFromCloud(CLOUD_COLLECTION, null)
}

/**
 * 根据ID获取单个地点
 */
function getPlaceById(id) {
  return new Promise((resolve, reject) => {
    const db = wx.cloud.database()
    db.collection(CLOUD_COLLECTION).where({ id: Number(id) }).limit(1).get({
      success: res => resolve(res.data[0] || null),
      fail: reject
    })
  })
}

/**
 * 附近景点查询
 */
function getNearbySpots(latitude, longitude, maxDistance = 5000) {
  return new Promise((resolve, reject) => {
    const db = wx.cloud.database()
    db.collection(CLOUD_COLLECTION).where({
      type: 'spot',
      location: db.command.geoNear({
        geometry: db.Geo.Point(longitude, latitude),
        maxDistance: maxDistance,
        minDistance: 0
      })
    }).limit(PAGE_SIZE).get({
      success: res => resolve(res.data),
      fail: err => {
        console.error('附近景点查询失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 附近餐厅查询
 */
function getNearbyRestaurants(latitude, longitude, maxDistance = 3000) {
  return new Promise((resolve, reject) => {
    const db = wx.cloud.database()
    db.collection(CLOUD_COLLECTION).where({
      type: 'food',
      location: db.command.geoNear({
        geometry: db.Geo.Point(longitude, latitude),
        maxDistance: maxDistance,
        minDistance: 0
      })
    }).limit(PAGE_SIZE).get({
      success: res => resolve(res.data),
      fail: err => {
        console.error('附近餐厅查询失败:', err)
        reject(err)
      }
    })
  })
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  getSpots,
  getRestaurants,
  getPlacesByCity,
  getAllPlaces,
  getPlaceById,
  getNearbySpots,
  getNearbyRestaurants
}
