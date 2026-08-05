/**
 * DAL 入口 — 集合名称常量 + 快捷获取 collection 引用
 *
 * 所有地方引用集合名都走这里，改名只需改一处。
 */

const { getDB } = require('./client')

// ─── 集合名称常量 ───────────────────────────────
// ⚠️ 注意 users 集合：文档由 login 云函数创建，用【手写 openid 字段】（不带
//    下划线），没有 _openid。前端不要直接 doc.get() 读 users（会受安全规则
//    限制），统一走 login/getUserInfo 云函数。详见 utils/db/users.js。
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
