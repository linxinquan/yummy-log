/**
 * DAL 入口 — 集合名称常量 + 快捷获取 collection 引用
 *
 * 所有地方引用集合名都走这里，改名只需改一处。
 */

const { getDB } = require('./client')

// ─── 集合名称常量 ───────────────────────────────
const COLLECTIONS = {
  WANT_LIST:        'want_list',
  COLLECTED_LIST:   'collected_list',
  CHECKIN_RECORDS:  'checkin_records',
  ROUTES:           'routes',
  USER_ADDED_SHOPS: 'user_added_shops',
  USERS:            'users',
  PLACES:           'places',
}

/**
 * 快捷获取集合引用
 * @param {string} name - COLLECTIONS 中的集合名
 * @returns {wx.cloud.database.CollectionReference}
 */
function collection(name) {
  return getDB().collection(name)
}

// ─── 导出 ───────────────────────────────────────
module.exports = {
  COLLECTIONS,
  collection,
  getDB: require('./client').getDB,
}
