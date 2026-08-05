/**
 * DAL — routes 集合操作
 *
 * 集合字段设计：
 *   _id, _openid（自动）,
 *   title: string, subtitle: string,
 *   coverImage: string, author: string, authorAvatar: string,
 *   city: string, dayCount: number,
 *   daySections: Array<{ id, title, countText, items: Array }>,
 *   isDraft: boolean, sourceType: 'ai'|'manual',
 *   createdAt: serverDate, updatedAt: serverDate
 *
 * 所有方法返回 { success, data, error }
 */

const { safeCall, withRetry } = require('./base')
const { COLLECTIONS, collection, getDB } = require('./index')

// ─── 查询 ─────────────────────────────────────

/**
 * 获取当前用户的所有路线（按 updatedAt 降序）
 * @returns {Promise<{success, data: Array, error}>}
 */
function getList() {
  return safeCall(async () => {
    const res = await withRetry(() =>
      collection(COLLECTIONS.ROUTES)
        .orderBy('updatedAt', 'desc')
        .get()
    )
    return res.data
  })
}

/**
 * 根据 ID 获取单条路线
 * @param {string} id - 路线 _id
 * @returns {Promise<{success, data: Object|null, error}>}
 */
function getById(id) {
  return safeCall(async () => {
    const res = await collection(COLLECTIONS.ROUTES)
      .doc(id)
      .get()
    return res.data || null
  })
}

// ─── 写入 ─────────────────────────────────────

/**
 * 添加路线
 * @param {Object} routeData - 路线数据
 * @param {string}  routeData.title
 * @param {string}  [routeData.subtitle]
 * @param {string}  [routeData.coverImage]
 * @param {string}  [routeData.author]
 * @param {string}  [routeData.authorAvatar]
 * @param {string}  [routeData.city]
 * @param {number}  [routeData.dayCount]
 * @param {Array}   [routeData.daySections]
 * @param {boolean} [routeData.isDraft]
 * @param {string}  [routeData.sourceType] - 'ai' | 'manual'
 * @returns {Promise<{success, data: string, error}>} data = 新路线 _id
 */
function add(routeData) {
  return safeCall(async () => {
    const doc = {
      title:       routeData.title || '未命名路线',
      subtitle:    routeData.subtitle || '',
      coverImage:   routeData.coverImage || '',
      author:      routeData.author || '',
      authorAvatar: routeData.authorAvatar || '',
      city:         routeData.city || '',
      dayCount:     routeData.dayCount || 1,
      daySections:  routeData.daySections || [],
      isDraft:      !!routeData.isDraft,
      sourceType:   routeData.sourceType || 'manual',
      createdAt:    getDB().serverDate(),
      updatedAt:    getDB().serverDate(),
    }
    const res = await collection(COLLECTIONS.ROUTES).add({ data: doc })
    return res._id
  })
}

/**
 * 更新路线
 * @param {string} id        - 路线 _id
 * @param {Object} patchData - 要更新的字段
 * @returns {Promise<{success, data: null, error}>}
 */
function update(id, patchData) {
  return safeCall(async () => {
    await collection(COLLECTIONS.ROUTES).doc(id).update({
      data: { ...patchData, updatedAt: getDB().serverDate() },
    })
  })
}

/**
 * 删除路线
 * @param {string} id - 路线 _id
 * @returns {Promise<{success, data: null, error}>}
 */
function remove(id) {
  return safeCall(async () => {
    await collection(COLLECTIONS.ROUTES).doc(id).remove()
  })
}

// ─── 导出 ─────────────────────────────────────
module.exports = {
  getList,
  getById,
  add,
  update,
  remove,
}
