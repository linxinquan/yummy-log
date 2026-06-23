/**
 * index.test.js — 测试 DAL 入口模块
 * 验证 COLLECTIONS 常量、collection() 辅助函数
 */

// setup.js 已在 setupFilesAfterSetup 中执行，global.wx 已注入

const { COLLECTIONS, collection, getDB } = require('../../utils/db/index')
const mockDB = global.__mockDB

// ─── COLLECTIONS 常量 ─────────────────────

describe('COLLECTIONS', () => {
  test('包含 7 个集合名常量', () => {
    const keys = Object.keys(COLLECTIONS)
    expect(keys).toEqual([
      'WANT_LIST',
      'COLLECTED_LIST',
      'CHECKIN_RECORDS',
      'ROUTES',
      'USER_ADDED_SHOPS',
      'USERS',
      'PLACES',
    ])
  })

  test('常量值符合命名规范（snake_case）', () => {
    Object.values(COLLECTIONS).forEach(val => {
      expect(val).toMatch(/^[a-z_]+$/)
    })
  })
})

// ─── collection() ──────────────────────────

describe('collection()', () => {
  beforeEach(() => {
    mockDB.__resetAll()
  })

  test('调用 getDB().collection(name)', () => {
    const coll = collection(COLLECTIONS.CHECKIN_RECORDS)
    expect(coll).toBeDefined()
    expect(mockDB.collection).toHaveBeenCalledWith(COLLECTIONS.CHECKIN_RECORDS)
  })

  test('不同集合名返回不同 collection 实例', () => {
    const coll1 = collection(COLLECTIONS.WANT_LIST)
    const coll2 = collection(COLLECTIONS.PLACES)
    expect(coll1).not.toBe(coll2)
  })
})
