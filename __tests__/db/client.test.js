/**
 * client.test.js — 测试 DAL 客户端单例
 * 验证 getDB() 单例模式、getCmd() 命令对象
 */

// setup.js 已在 setupFiles 中执行，global.wx 已注入
console.log('client.test.js: global.wx =', global.wx)
console.log('client.test.js: typeof wx =', typeof wx)

const { getDB, getCmd } = require('../../utils/db/client')
const mockDB = global.__mockDB

// ─── getDB 单例模式 ───────────────────────

describe('getDB', () => {
  test('首次调用初始化 _db', () => {
    const db = getDB()
    expect(db).toBeDefined()
    expect(mockDB.collection).toBeDefined() // mockDB 有 collection 方法
  })

  test('多次调用返回同一实例（单例）', () => {
    const db1 = getDB()
    const db2 = getDB()
    expect(db1).toBe(db2)
  })
})

// ─── getCmd ───────────────────────────────

describe('getCmd', () => {
  test('返回 command 对象', () => {
    const cmd = getCmd()
    expect(cmd).toBeDefined()
    expect(cmd.geoNear).toBeDefined()
    expect(cmd.ne).toBeDefined()
  })
})
