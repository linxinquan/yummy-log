/**
 * SyncManager — 异步备份管理器
 *
 * 职责：
 *   读取本地权威数据，推送到云端做灾备。
 *   不拉取云端数据，不覆盖本地。
 *
 * 使用方式：
 *   // 写操作后调用（已在各 xxxAsync 函数中内置）
 *   syncManager.enqueuePush('wantList')
 *
 *   // 小程序 onHide 时全量备份
 *   syncManager.pushAll()
 *
 *   页面不再需要注册 syncManager.on/off
 */

const STORAGE_KEYS = {
  checkinRecords:  'checkin_records',
  wantList:        'userWantList',
  collectedList:   'userCollectedSpots',
  userAddedShops:  'userAddedShops',
  routes:          'savedRoutes',
}

class SyncManager {
  constructor() {
    this._pushTimers = new Map()
  }

  /**
   * 节流推送：2s 内同一实体只推一次
   * @param {string} entity
   */
  enqueuePush(entity) {
    if (this._pushTimers.has(entity)) {
      clearTimeout(this._pushTimers.get(entity))
    }
    this._pushTimers.set(entity, setTimeout(() => {
      this._pushTimers.delete(entity)
      this.push(entity)
    }, 2000))
  }

  /**
   * 立即推送单个实体到云端
   * @param {string} entity
   */
  async push(entity) {
    const util = require('../util')
    if (!util.isCloudMode()) return

    const dalMap = {
      wantList:        require('./wantList'),
      collectedList:   require('./collectedList'),
      checkinRecords:  require('./checkinRecords'),
      userAddedShops:  require('./userAddedShops'),
      routes:          require('./routes'),
    }
    const dal = dalMap[entity]
    if (!dal) return

    try {
      if (entity === 'wantList') {
        await this._syncIdListWithType(dal, util.loadData('userWantList', []))
      } else if (entity === 'collectedList') {
        await this._syncIdList(dal, util.loadData('userCollectedSpots', []))
      }
      // checkinRecords / userAddedShops / routes 已在各自的 xxxAsync 中直接推云端
    } catch (err) {
      console.warn(`[SyncManager] ${entity} 推送失败:`, err)
    }
  }

  /**
   * 全量推送所有实体（用于 App.onHide 兜底）
   */
  async pushAll() {
    const entities = Object.keys(STORAGE_KEYS)
    await Promise.allSettled(entities.map(e => this.push(e)))
  }

  // ID 列表同步（wantList：含 placeType）
  async _syncIdListWithType(dal, localIds) {
    const { success, data: cloudDocs } = await dal.getList()
    if (!success) return

    const localSet = new Set(localIds.map(String))
    const cloudMap = new Map()
    cloudDocs.forEach(d => cloudMap.set(d.placeId, d.placeType || 'food'))

    for (const id of localSet) {
      if (!cloudMap.has(id)) {
        await dal.add(id, 'food').catch(() => {})
      }
    }
    for (const [id, type] of cloudMap) {
      if (!localSet.has(id)) {
        await dal.remove(id, type).catch(() => {})
      }
    }
  }

  // ID 列表同步（collectedList：纯 ID，无 type）
  async _syncIdList(dal, localIds) {
    const { success, data: cloudDocs } = await dal.getList()
    if (!success) return

    const localSet = new Set(localIds.map(String))
    const cloudSet = new Set(cloudDocs.map(d => String(d.placeId)))

    for (const id of localSet) {
      if (!cloudSet.has(id)) {
        await dal.add(id).catch(() => {})
      }
    }
    for (const doc of cloudDocs) {
      if (!localSet.has(String(doc.placeId))) {
        await dal.remove(doc.placeId).catch(() => {})
      }
    }
  }
}

module.exports = new SyncManager()
