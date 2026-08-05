/**
 * users.test.js — 测试用户 DAL
 * 只暴露 getById 和 update 两个方法
 */

const { getById, update } = require('../../utils/db/users')
const { COLLECTIONS } = require('../../utils/db/index')
const mockDB = global.__mockDB

function reset(data = []) {
  mockDB.__setCollectionData(COLLECTIONS.USERS, data)
}

beforeEach(() => reset())

// ─── getById ─────────────────────────

describe('getById', () => {
  beforeEach(() => {
    reset([
      { _id: 'u1', nickName: '小明', level: 'Lv.1' },
      { _id: 'u2', nickName: '小红', isVip: true },
    ])
  })

  test('存在时返回用户数据', async () => {
    const res = await getById('u1')
    expect(res.success).toBe(true)
    expect(res.data.nickName).toBe('小明')
  })

  test('不存在返回 null', async () => {
    const res = await getById('no')
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
  })
})

// ─── update ───────────────────────────

describe('update', () => {
  beforeEach(() => {
    reset([{ _id: 'u1', nickName: '旧名', level: 'Lv.1' }])
  })

  test('更新成功并自动设置 updatedAt', async () => {
    const res = await update('u1', { nickName: '新名', level: 'Lv.2' })
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.USERS)
    expect(data[0].nickName).toBe('新名')
    expect(data[0].level).toBe('Lv.2')
    expect(data[0].updatedAt).toBeDefined()
  })

  test('更新不存在的 id 不报错（服务端安全规则兜底）', async () => {
    // mockCollection.doc(id).update() 对不存在的 id 返回 updated: 0
    const res = await update('no', { nickName: 'x' })
    expect(res.success).toBe(true)
  })
})
