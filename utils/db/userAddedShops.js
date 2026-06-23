/**
 * DAL — user_added_shops 集合操作
 *
 * 集合字段设计：
 *   _id, _openid（自动）,
 *   name: string, address: string,
 *   lat: number, lng: number,
 *   type: 'food'|'spot',
 *   category: string, price: string,
 *   rating: string, tags: Array<string>,
 *   coverImage: string,
 *   createdAt: serverDate
 *
 * 所有方法返回 { success, data, error }
 */

const { safeCall, withRetry } = require('./base')
const { COLLECTIONS, collection, getDB } = require('./index')

// ─── 查询 ─────────────────────────────────────

/**
 * 获取当前用户添加的所有店铺（按 createdAt 降序）
 * @returns {Promise<{success, data: Array, error}>}
 */
function getList() {
  return safeCall(async () => {
    const res = await withRetry(() =>
      collection(COLLECTIONS.USER_ADDED_SHOPS)
        .orderBy('createdAt', 'desc')
        .get()
    )
    return res.data
  })
}

/**
 * 根据 ID 获取单个店铺
 * @param {string} id - 店铺 _id
 * @returns {Promise<{success, data: Object|null, error}>}
 */
function getById(id) {
  return safeCall(async () => {
    const res = await collection(COLLECTIONS.USER_ADDED_SHOPS)
      .doc(id)
      .get()
    return res.data || null
  })
}

// ─── 写入 ─────────────────────────────────────

/**
 * 添加店铺
 * @param {Object} shopData - 店铺数据
 * @param {string} shopData.name
 * @param {string} [shopData.address]
 * @param {number} [shopData.lat]
 * @param {number} [shopData.lng]
 * @param {string} [shopData.type]     - 'food' | 'spot'
 * @param {string} [shopData.category]
 * @param {string} [shopData.price]
 * @param {string} [shopData.rating]
 * @param {Array}  [shopData.tags]
 * @param {string} [shopData.coverImage]
 * @returns {Promise<{success, data: string, error}>} data = 新店铺 _id
 */
function add(shopData) {
  return safeCall(async () => {
    const doc = {
      name:       shopData.name || '',
      address:    shopData.address || '',
      lat:        shopData.lat || null,
      lng:        shopData.lng || null,
      type:       shopData.type || 'food',
      category:   shopData.category || '',
      price:      shopData.price || '',
      rating:     shopData.rating || '',
      tags:       Array.isArray(shopData.tags) ? shopData.tags : [],
      coverImage: shopData.coverImage || '',
      createdAt:  getDB().serverDate(),
    }
    const res = await collection(COLLECTIONS.USER_ADDED_SHOPS).add({ data: doc })
    return res._id
  })
}

/**
 * 更新店铺
 * @param {string} id        - 店铺 _id
 * @param {Object} patchData - 要更新的字段
 * @returns {Promise<{success, data: null, error}>}
 */
function update(id, patchData) {
  return safeCall(async () => {
    await collection(COLLECTIONS.USER_ADDED_SHOPS).doc(id).update({
      data: { ...patchData },
    })
  })
}

/**
 * 删除店铺
 * @param {string} id - 店铺 _id
 * @returns {Promise<{success, data: null, error}>}
 */
function remove(id) {
  return safeCall(async () => {
    await collection(COLLECTIONS.USER_ADDED_SHOPS).doc(id).remove()
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
