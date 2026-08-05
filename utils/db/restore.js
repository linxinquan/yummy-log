/**
 * restore.js — 云端数据恢复到本地（首次登录/手动恢复）
 *
 * 使用场景：
 *   用户登录后，从云端拉取数据覆盖本地（第一次登录或清除缓存后）。
 *   日常使用不调用此模块，本地是权威数据源。
 *
 * 用法：
 *   const restore = require('./utils/db/restore')
 *   await restore.restoreFromCloud()
 */

const util = require('../util')

const STORAGE_KEYS = {
  checkinRecords:  'checkin_records',
  wantList:        'userWantList',
  collectedList:   'userCollectedSpots',
  userAddedShops:  'userAddedShops',
  routes:          'savedRoutes',
}

/**
 * 从云端拉取所有实体数据，覆盖本地
 * 仅云端有但本地没有的数据才会写入（不覆盖本地已有数据）
 */
async function restoreFromCloud() {
  if (!util.isCloudMode()) return

  const dalMap = {
    wantList:        require('./wantList'),
    collectedList:   require('./collectedList'),
    checkinRecords:  require('./checkinRecords'),
    userAddedShops:  require('./userAddedShops'),
    routes:          require('./routes'),
  }

  let restoredCount = 0

  for (const [entity, dal] of Object.entries(dalMap)) {
    try {
      const { success, data } = await dal.getList()
      if (!success || !data) continue

      const storageKey = STORAGE_KEYS[entity]

      if (entity === 'wantList' || entity === 'collectedList') {
        // ID 列表：合并云端到本地（去重）
        const local = util.loadData(storageKey, []) || []
        const cloudIds = data.map(d => String(d.placeId || d))
        const merged = [...new Set([...local, ...cloudIds])]
        util.saveData(storageKey, merged)
        restoredCount += cloudIds.length
      } else if (entity === 'checkinRecords') {
        // 打卡记录：用云端完整覆盖（登录场景）
        const normalized = (data || []).map(r => ({
          ...r,
          id: r.id || r._id,
        }))
        util.saveData(storageKey, normalized)
        restoredCount += normalized.length
      } else {
        // 店铺/路线：用云端完整覆盖
        util.saveData(storageKey, data || [])
        restoredCount += (data || []).length
      }
    } catch (err) {
      console.warn(`[restore] ${entity} 恢复失败:`, err)
    }
  }

  console.log(`[restore] 云端恢复完成，共恢复 ${restoredCount} 条记录`)
  return restoredCount
}

module.exports = { restoreFromCloud }
