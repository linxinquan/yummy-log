/**
 * DAL — places 集合操作
 *
 * places 存放系统级地点数据（餐厅/景点），所有用户可读，无需 _openid 权限。
 * 注意：地点详情与"附近"功能均走本地 placesData 缓存（见 utils/placesData.js），
 * 本 DAL 仅提供全量列表与按城市查询两类云端读取。
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
 *   location: GeoPoint（腾讯地图坐标，标准化为 lat/lng）,
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
const { COLLECTIONS, collection } = require('./index')

const PAGE_SIZE = 20

// ─── 内部辅助：翻页拉取全量 ─────────────────────

/**
 * 翻页拉取所有匹配条件的数据，每页 20 条
 * @param {Object} [conditions={}]
 * @param {number} [max=0] - 最多返回条数，0 表示拉全量
 * @returns {Promise<Array>}
 */
async function _fetchAllPages(conditions = {}, max = 0) {
  const all = []
  let offset = 0

  while (true) {
    const batch = max > 0 ? Math.min(PAGE_SIZE, max - all.length) : PAGE_SIZE
    let query = collection(COLLECTIONS.PLACES)
    if (Object.keys(conditions).length > 0) {
      query = query.where(conditions)
    }
    const res = await withRetry(() =>
      query.skip(offset).limit(batch).get()
    )
    all.push(...res.data)
    if (res.data.length < batch) break
    if (max > 0 && all.length >= max) break
    offset += batch
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
 * 按城市查询地点
 * @param {string} city       - 城市名（如 '深圳'）
 * @param {number} [limit]    - 最多返回条数，不传则翻页拉全量
 * @returns {Promise<{success, data: Array, error}>}
 */
function getByCity(city, limit) {
  return safeCall(async () => {
    // limit 透传给 _fetchAllPages：需要超过一页时分批累加，而不是被 PAGE_SIZE 截断
    const raw = await _fetchAllPages({ city }, limit || 0)
    return raw.map(_normalizeGeoPoint)
  })
}

// ─── 导出 ───────────────────────────────────────

module.exports = {
  getList,
  getByCity,
}
