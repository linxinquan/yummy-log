/**
 * DAL — want_list 集合操作
 *
 * 集合字段设计：
 *   _id, _openid（自动）, placeId: string, placeType: 'food'|'spot', createdAt: serverDate
 *
 * 所有方法返回 { success, data, error }
 * 业务层无需 try-catch。
 */

const { safeCall, withRetry } = require('./base')
const { COLLECTIONS, collection, getDB } = require('./index')

const _ = getDB().command

// ─── 查询 ─────────────────────────────────────

/**
 * 获取当前用户的想去列表（placeId 数组）
 * @returns {Promise<{success, data: string[], error}>}
 */
function getList() {
  return safeCall(async () => {
    const res = await withRetry(() =>
      collection(COLLECTIONS.WANT_LIST)
        .orderBy('createdAt', 'desc')
        .get()
    )
    return res.data.map(item => item.placeId)
  })
}

/**
 * 检查指定地点是否已在想去列表
 * @param {string} placeId
 * @param {string} placeType - 'food' | 'spot'
 * @returns {Promise<{success, data: boolean, error}>}
 */
function check(placeId, placeType = 'food') {
  return safeCall(async () => {
    const res = await collection(COLLECTIONS.WANT_LIST)
      .where({
        placeId: String(placeId),
        placeType,
      })
      .limit(1)
      .get()
    return res.data.length > 0
  })
}

// ─── 写入 ─────────────────────────────────────

/**
 * 添加想去
 * @param {string} placeId
 * @param {string} placeType - 'food' | 'spot'
 * @returns {Promise<{success, data: string|null, error}>} data = 新记录 _id
 */
function add(placeId, placeType = 'food') {
  return safeCall(async () => {
    // 防重复
    const existing = await collection(COLLECTIONS.WANT_LIST)
      .where({
        placeId: String(placeId),
        placeType,
      })
      .limit(1)
      .get()
    if (existing.data.length > 0) return null

    const res = await collection(COLLECTIONS.WANT_LIST).add({
      data: {
        placeId: String(placeId),
        placeType,
        createdAt: getDB().serverDate(),
      },
    })
    return res._id
  })
}

/**
 * 移除想去
 * @param {string} placeId
 * @param {string} placeType - 'food' | 'spot'
 * @returns {Promise<{success, data: number, error}>} data = 删除条数
 */
function remove(placeId, placeType = 'food') {
  return safeCall(async () => {
    const res = await collection(COLLECTIONS.WANT_LIST)
      .where({
        placeId: String(placeId),
        placeType,
      })
      .remove()
    return res.stats.removed
  })
}

/**
 * 切换想去状态（核心方法，业务层优先调用此函数）
 * @param {string} placeId
 * @param {string} placeType - 'food' | 'spot'
 * @returns {Promise<{success, data: boolean, error}>} data = true 表示已想去
 */
function toggle(placeId, placeType = 'food') {
  return safeCall(async () => {
    // 尝试原子删除：记录存在则删除，不存在则无影响
    const removeRes = await collection(COLLECTIONS.WANT_LIST)
      .where({
        placeId: String(placeId),
        placeType,
      })
      .remove()

    if (removeRes.stats.removed > 0) {
      // 已想去 → 取消成功
      return false
    }

    // 未想去 → 添加
    await collection(COLLECTIONS.WANT_LIST).add({
      data: {
        placeId: String(placeId),
        placeType,
        createdAt: getDB().serverDate(),
      },
    })
    return true
  })
}

// ─── 导出 ─────────────────────────────────────
module.exports = {
  getList,
  check,
  add,
  remove,
  toggle,
}
