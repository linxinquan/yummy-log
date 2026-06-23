/**
 * 云数据库数据访问层（places DAL 薄封装层）
 *
 * 保持原有导出接口不变，内部实现全部委托给 places DAL。
 * 调用方（placesData.js）无需做任何改动。
 *
 * 与用户数据 DAL 的区别：
 * - places 集合所有用户可读，无需 _openid 权限
 * - 查询结果统一做 GeoPoint → lat/lng 标准化
 */

const placesDal = require('./db/places')

/**
 * 从 DAL 结果中安全提取数据数组
 */
function _unwrap(result) {
  return result.success ? result.data : []
}

/**
 * 获取所有景点（type === 'spot'）
 * @returns {Promise<Array>}
 */
function getSpots() {
  return placesDal.getSpots().then(_unwrap)
}

/**
 * 获取餐厅列表（type === 'food'）
 * @param {Object} [options] - { category?, city? }
 * @returns {Promise<Array>}
 */
function getRestaurants(options = {}) {
  return placesDal.getRestaurants(options).then(_unwrap)
}

/**
 * 按城市查询地点（支持限制条数）
 * @param {string} city     - 城市名
 * @param {number} [limit]  - 最多返回条数
 * @returns {Promise<Array>}
 */
function getPlacesByCity(city, limit) {
  return placesDal.getByCity(city, limit).then(result =>
    result.success ? result.data : []
  )
}

/**
 * 获取所有地点（全量）
 * @returns {Promise<Array>}
 */
function getAllPlaces() {
  return placesDal.getList().then(_unwrap)
}

/**
 * 根据业务 ID 获取单个地点
 * @param {number|string} id
 * @returns {Promise<Object|null>}
 */
function getPlaceById(id) {
  return placesDal.getById(id).then(result =>
    result.success ? result.data : null
  )
}

/**
 * 附近景点查询
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} [maxDistance=5000]
 * @returns {Promise<Array>}
 */
function getNearbySpots(latitude, longitude, maxDistance) {
  return placesDal.searchNearby(latitude, longitude, 'spot', maxDistance).then(_unwrap)
}

/**
 * 附近餐厅查询
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} [maxDistance=3000]
 * @returns {Promise<Array>}
 */
function getNearbyRestaurants(latitude, longitude, maxDistance) {
  return placesDal.searchNearby(latitude, longitude, 'food', maxDistance).then(_unwrap)
}

module.exports = {
  getSpots,
  getRestaurants,
  getPlacesByCity,
  getAllPlaces,
  getPlaceById,
  getNearbySpots,
  getNearbyRestaurants,
}
