/**
 * DAL — places 集合操作
 *
 * places 存放系统级地点数据（餐厅/景点），所有用户可读，无需 _openid 权限。
 *
 * 集合字段设计：
 *   id: number（业务主键）,
 *   name: string, 
 *   type: 'food'|'spot',
 *   displayCategory: string,
 *   subCategory: string,
 *   city: string, 
 *   district: string,
 *   address: string,
 *   lat: number, 
 *   lng: number,
 *   location: GeoPoint（腾讯地图坐标，用于 geoNear 查询）,
 *   desc: string, 
 *   tags: Array<string>,
 *   coverImage: string,
 *   openHours: string,
 *   free: boolean, 
 *   price: number|null,
 *   rating: number,
 *   checkInCount: number, 
 *   wantCount: number,
 *   createdAt: string, 
 *   updatedAt: string
 *
 * 所有方法返回 { success, data, error }
 */

const { safeCall, withRetry } = require('./base')
const { COLLECTIONS, collection, getDB } = require('./index')

const PAGE_SIZE = 20

// ─── 内部辅助：翻页拉取全量 ─────────────────────

/**
 * 翻页拉取所有匹配条件的数据，每页 20 条
 * @param {Object} [conditions={}]
 * @returns {Promise<Array>}
 */
async function _fetchAllPages(conditions = {}) {
  const all = []
  let offset = 0

  while (true) {
    let query = collection(COLLECTIONS.PLACES)
    if (Object.keys(conditions).length > 0) {
      query = query.where(conditions)
    }
    const res = await withRetry(() =>
      query.skip(offset).limit(PAGE_SIZE).get()
    )
    all.push(...res.data)
    if (res.data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}

/**
 * 标准化 GeoPoint → lat/lng
 */
function _normalizeGeoPoint(place) {
  const p = { ...place }
  if (place.location && place.location.coordinates && place.location.coordinates.length >= 2) {
    p.lng = place.location.coordinates[0]
    p.lat = place.location.coordinates[1]
  }
  return p
}

// ─── 查询 ───────────────────────────────────────

/**
 * 获取所有地点（全量翻页）
 * @returns {Promise<{success, data: Array, error}>}
 */
function getList(conditions = {}) {
  return safeCall(async () => {
    const raw = await _fetchAllPages(conditions)
    return raw.map(_normalizeGeoPoint)
  })
}

/**
 * 获取所有景点（type === 'spot'）
 * @returns {Promise<{success, data: Array, error}>}
 */
function getSpots() {
  return getList({ type: 'spot' })
}

/**
 * 获取所有美食（type === 'food'），支持分类/城市过滤
 * @param {Object} [options] - { category?, city? }
 * @returns {Promise<{success, data: Array, error}>}
 */
function getRestaurants(options = {}) {
  const conditions = { type: 'food' }
  if (options.category && options.category !== '全部') {
    conditions.category = options.category
  }
  if (options.city) {
    conditions.city = options.city
  }
  return getList(conditions)
}

/**
 * 按城市查询地点
 * @param {string} city       - 城市名（如 '深圳'）
 * @param {number} [limit]    - 最多返回条数，不传则翻页拉全量
 * @returns {Promise<{success, data: Array, error}>}
 */
function getByCity(city, limit) {
  return safeCall(async () => {
    const db = getDB()
    let query = collection(COLLECTIONS.PLACES).where({ city })

    if (limit) {
      const res = await withRetry(() =>
        query.limit(Math.min(limit, PAGE_SIZE)).get()
      )
      return (res.data || []).map(_normalizeGeoPoint)
    }

    // 翻页拉全量
    const raw = await _fetchAllPages({ city })
    return raw.map(_normalizeGeoPoint)
  })
}

/**
 * 根据业务 ID 获取单个地点
 * @param {number|string} id - 业务主键
 * @returns {Promise<{success, data: Object|null, error}>}
 */
function getById(id) {
  return safeCall(async () => {
    const res = await collection(COLLECTIONS.PLACES)
      .where({ id: Number(id) })
      .limit(1)
      .get()
    const place = res.data && res.data[0]
    return place ? _normalizeGeoPoint(place) : null
  })
}

/**
 * 附近地点查询
 * @param {number} lat         - 纬度
 * @param {number} lng         - 经度
 * @param {string} [type]      - 'spot'|'food'，不传则查全部
 * @param {number} [maxDist]   - 最大距离（米），默认 5000
 * @returns {Promise<{success, data: Array, error}>}
 */
function searchNearby(lat, lng, type = '', maxDist = 5000) {
  return safeCall(async () => {
    const db = getDB()
    const conditions = {}

    if (type === 'spot') conditions.type = 'spot'
    else if (type === 'food') conditions.type = 'food'

    conditions.location = db.command.geoNear({
      geometry: db.Geo.Point(lng, lat),
      maxDistance: maxDist,
      minDistance: 0,
    })

    const res = await withRetry(() =>
      collection(COLLECTIONS.PLACES)
        .where(conditions)
        .limit(PAGE_SIZE)
        .get()
    )

    return (res.data || []).map(_normalizeGeoPoint)
  })
}

// ─── 导出 ───────────────────────────────────────

module.exports = {
  getList,
  getSpots,
  getRestaurants,
  getByCity,
  getById,
  searchNearby,
}
