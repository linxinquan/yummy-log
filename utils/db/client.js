/**
 * Cloud Database Client — 单例模式
 * 所有 DAL 模块通过此文件获取 db 实例，避免重复初始化
 *
 * 兼容 Node 测试环境：优先使用 globalThis.wx（测试时注入），
 * 回退到小程序原生 wx 对象。
 */

let _db = null

// 兼容 Node 测试环境：globalThis.wx 由测试 setup 注入
// 小程序环境中 globalThis.wx 为 undefined，回退到全局 wx
const _wx = (typeof globalThis !== 'undefined' && globalThis.wx) || (typeof wx !== 'undefined' && wx) || {}

/**
 * 获取数据库实例（懒初始化）
 * @returns {Object} 数据库实例
 */
function getDB() {
  if (!_db) {
    _db = _wx.cloud.database()
  }
  return _db
}

/**
 * 获取数据库命令对象（用于高级查询）
 * @returns {Object} 数据库命令对象
 */
function getCmd() {
  return getDB().command
}

module.exports = {
  getDB,
  getCmd,
}
