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

module.exports = {
  getPlacesByCity,
  getAllPlaces,
}
