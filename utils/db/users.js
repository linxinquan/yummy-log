/**
 * DAL — users 集合操作
 *
 * ⚠️ 重要：users 文档由 login 云函数创建，使用【手写 openid 字段】（不带下划线），
 *    文档里【没有 _openid】。因为云函数端写入不会自动注入 _openid。
 *    因此：
 *    - 前端安全规则需用 doc.openid == auth.openid 判定（不要用 doc._openid）
 *    - 前端不要直接 doc.get() 读 users（云函数端查询不受安全规则限制，
 *      前端直连会 Permission denied）；需要读用户数据时请走 login/getUserInfo 云函数
 *
 * 集合字段设计：
 *   _id, openid: string,            // 手写 openid，非系统 _openid
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
 * 更新用户信息
 * 注意：users 文档无 _openid，且云函数端更新不受前端安全规则限制。
 * 当前前端未使用本方法（用户数据统一由 login/getUserInfo 云函数管理）。
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
