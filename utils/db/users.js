/**
 * DAL — users 集合操作
 *
 * 集合字段设计：
 *   _id, _openid（自动）,
 *   nickName: string, avatarUrl: string,
 *   level: string, isVip: boolean,
 *   visits: number, days: number,
 *   createdAt: serverDate, updatedAt: serverDate, lastLoginAt: serverDate
 *
 * 所有方法返回 { success, data, error }
 */

const { safeCall } = require('./base')
const { COLLECTIONS, collection, getDB } = require('./index')

// ─── 查询 ─────────────────────────────────────

/**
 * 根据 _id 获取用户信息
 * @param {string} id - 用户 _id
 * @returns {Promise<{success, data: Object|null, error}>}
 */
function getById(id) {
  return safeCall(async () => {
    const res = await collection(COLLECTIONS.USERS)
      .doc(id)
      .get()
    return res.data || null
  })
}

// ─── 写入 ─────────────────────────────────────

/**
 * 更新用户信息（只能更新自己的，_openid 自动鉴权）
 * @param {string} id        - 用户 _id
 * @param {Object} patchData - 要更新的字段（nickName, avatarUrl 等）
 * @returns {Promise<{success, data: null, error}>}
 */
function update(id, patchData) {
  return safeCall(async () => {
    await collection(COLLECTIONS.USERS).doc(id).update({
      data: { ...patchData, updatedAt: getDB().serverDate() },
    })
  })
}

// ─── 导出 ─────────────────────────────────────
module.exports = {
  getById,
  update,
}
