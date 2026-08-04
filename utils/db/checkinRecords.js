/**
 * DAL — checkin_records 集合操作
 *
 * 集合字段设计：
 *   _id, _openid（自动）,
 *   type: 'food'|'spot',
 *   cloudFileID: string, spotName: string, address: string,
 *   latitude: number, longitude: number,
 *   description: string, date: string（ISO）,
 *   customRecordTimeLabel: string, city: string,
 *   relatedPlaceId: string,
 *   createdAt: serverDate
 *
 * 注意：云端不存 photoPath（本地沙盒路径 wxfile:// 是设备私有的，
 * 跨设备无效）。图片展示靠 cloudFileID；photoPath 仅保留在本地数据库，
 * 用于当前设备本地快速加载。
 *
 * 所有方法返回 { success, data, error }
 */

const { safeCall, withRetry } = require('./base')
const { COLLECTIONS, collection, getDB } = require('./index')

// ─── 查询 ─────────────────────────────────────

/**
 * 获取当前用户的所有打卡记录（按 date 降序）
 * @returns {Promise<{success, data: Array, error}>}
 */
function getList() {
  return safeCall(async () => {
    const res = await withRetry(() =>
      collection(COLLECTIONS.CHECKIN_RECORDS)
        .orderBy('date', 'desc')
        .get()
    )
    return res.data
  })
}

/**
 * 根据 ID 获取单条记录
 * @param {string} id - 记录 _id
 * @returns {Promise<{success, data: Object|null, error}>}
 */
function getById(id) {
  return safeCall(async () => {
    const res = await collection(COLLECTIONS.CHECKIN_RECORDS)
      .doc(id)
      .get()
    return res.data || null
  })
}

// ─── 写入 ─────────────────────────────────────

/**
 * 添加打卡记录
 * @param {Object} data - 记录数据（与 checkinUtil.saveCheckin 的输入格式一致）
 * @param {string} data.type          - 'food' | 'spot'
 * @param {string} [data.spotName]
 * @param {string} [data.address]
 * @param {number} [data.latitude]
 * @param {number} [data.longitude]
 * @param {string} [data.description]
 * @param {string} [data.date]       - ISO 字符串
 * @param {string} [data.customRecordTimeLabel]
 * @param {string} [data.city]
 * @param {string} [data.relatedPlaceId]
 * @param {string} [data.cloudFileID]
 * @returns {Promise<{success, data: string, error}>} data = 新记录 _id
 */
function add(data) {
  return safeCall(async () => {
    const doc = {
      type:                  data.type || 'food',
      // 云端不写 photoPath（设备私有路径，跨设备无效），仅存 cloudFileID
      cloudFileID:           data.cloudFileID || '',
      spotName:              data.spotName || '',
      address:               data.address || '',
      latitude:              data.latitude || null,
      longitude:             data.longitude || null,
      description:           data.description || '',
      date:                  data.date || new Date().toISOString(),
      customRecordTimeLabel: data.customRecordTimeLabel || '',
      city:                  data.city || '',
      relatedPlaceId:        data.relatedPlaceId || '',
      createdAt:             getDB().serverDate(),
    }
    const res = await collection(COLLECTIONS.CHECKIN_RECORDS).add({ data: doc })
    return res._id
  })
}

/**
 * 更新打卡记录
 * @param {string} id        - 记录 _id
 * @param {Object} patchData - 要更新的字段
 * @returns {Promise<{success, data: null, error}>}
 */
function update(id, patchData) {
  return safeCall(async () => {
    // 直接 doc(id).update()，存在性与 _openid 归属权由安全规则在服务端校验
    await collection(COLLECTIONS.CHECKIN_RECORDS).doc(id).update({
      data: { ...patchData },
    })
  })
}

/**
 * 删除打卡记录
 * @param {string} id - 记录 _id
 * @returns {Promise<{success, data: null, error}>}
 */
function remove(id) {
  return safeCall(async () => {
    await collection(COLLECTIONS.CHECKIN_RECORDS).doc(id).remove()
  })
}

// ─── 统计 ─────────────────────────────────────

/**
 * 获取打卡统计信息
 * @returns {Promise<{success, data: {totalCount, cityCount, spotCount, foodCount}, error}>}
 */
function getStats() {
  return safeCall(async () => {
    const res = await withRetry(() =>
      collection(COLLECTIONS.CHECKIN_RECORDS).get()
    )
    const cities = new Set()
    let spotCount = 0
    let foodCount = 0
    res.data.forEach(c => {
      if (c.city) cities.add(c.city)
      if (c.type === 'spot') spotCount++
      if (c.type === 'food')  foodCount++
    })
    return {
      totalCount: res.data.length,
      cityCount:  cities.size,
      spotCount,
      foodCount,
    }
  })
}

// ─── 导出 ─────────────────────────────────────
module.exports = {
  getList,
  getById,
  add,
  update,
  remove,
  getStats,
}
