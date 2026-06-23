/**
 * DAL — collected_list 集合操作
 *
 * 集合字段设计：
 *   _id, _openid（自动）, placeId: string, createdAt: serverDate
 *
 * 所有方法返回 { success, data, error }
 */

const { safeCall, withRetry } = require('./base')
const { COLLECTIONS, collection, getDB } = require('./index')

const _ = getDB().command

// ─── 查询 ─────────────────────────────────────

/**
 * 获取当前用户的收藏列表（placeId 数组）
 * @returns {Promise<{success, data: string[], error}>}
 */
function getList() {
  return safeCall(async () => {
    const res = await withRetry(() =>
      collection(COLLECTIONS.COLLECTED_LIST).orderBy('createdAt', 'desc').get()
    )
    return res.data
  })
}

/**
 * 检查指定地点是否已收藏
 * @param {string} placeId
 * @returns {Promise<{success, data: boolean, error}>}
 */
function check(placeId) {
  return safeCall(async () => {
    const res = await collection(COLLECTIONS.COLLECTED_LIST)
      .where({ placeId: String(placeId) })
      .limit(1)
      .get()
    return res.data.length > 0
  })
}

// ─── 写入 ─────────────────────────────────────

/**
 * 切换收藏状态（核心方法）
 * @param {string} placeId
 * @returns {Promise<{success, data: boolean, error}>} data = true 表示已收藏
 */
function toggle(placeId) {
  return safeCall(async () => {
    const res = await collection(COLLECTIONS.COLLECTED_LIST)
      .where({ placeId: String(placeId) })
      .limit(1)
      .get()

    if (res.data.length > 0) {
      await collection(COLLECTIONS.COLLECTED_LIST)
        .doc(res.data[0]._id)
        .remove()
      return false
    }

    await collection(COLLECTIONS.COLLECTED_LIST).add({
      data: {
        placeId: String(placeId),
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
  toggle,
}
