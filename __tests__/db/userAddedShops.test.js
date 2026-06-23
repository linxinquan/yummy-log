/**
 * userAddedShops.test.js — 测试用户添加店铺 DAL（标准 CRUD）
 */

const { getList, getById, add, update, remove } = require('../../utils/db/userAddedShops')
const { COLLECTIONS } = require('../../utils/db/index')
const mockDB = global.__mockDB

function reset(data = []) {
  mockDB.__setCollectionData(COLLECTIONS.USER_ADDED_SHOPS, data)
}

beforeEach(() => reset())

// ─── getList ─────────────────────────

describe('getList', () => {
  test('空列表返回空数组', async () => {
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })

  test('按 createdAt 降序', async () => {
    reset([
      { _id: '1', name: '旧店', createdAt: new Date('2025-01-01') },
      { _id: '2', name: '新店', createdAt: new Date('2025-01-03') },
    ])
    const res = await getList()
    expect(res.data[0]._id).toBe('2')
  })
})

// ─── getById ─────────────────────────

describe('getById', () => {
  beforeEach(() => {
    reset([{ _id: 's1', name: '店铺A' }, { _id: 's2', name: '店铺B' }])
  })

  test('存在时返回数据', async () => {
    const res = await getById('s1')
    expect(res.success).toBe(true)
    expect(res.data.name).toBe('店铺A')
  })

  test('不存在返回 null', async () => {
    const res = await getById('no')
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
  })
})

// ─── add ──────────────────────────────

describe('add', () => {
  test('添加成功返回 _id', async () => {
    const res = await add({ name: '新店铺', type: 'food' })
    expect(res.success).toBe(true)
    expect(res.data).toBeDefined()
    const data = mockDB.__getCollectionData(COLLECTIONS.USER_ADDED_SHOPS)
    expect(data.length).toBe(1)
    expect(data[0].name).toBe('新店铺')
    expect(data[0].type).toBe('food')
  })

  test('默认值正确填充', async () => {
    const res = await add({ name: '测试' })
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.USER_ADDED_SHOPS)
    expect(data[0].type).toBe('food')
    expect(data[0].tags).toEqual([])
    expect(data[0].category).toBe('')
  })
})

// ─── update ────────────────────────────

describe('update', () => {
  beforeEach(() => {
    reset([{ _id: 's1', name: '旧名' }])
  })

  test('更新成功', async () => {
    const res = await update('s1', { name: '新名', price: '¥100' })
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.USER_ADDED_SHOPS)
    expect(data[0].name).toBe('新名')
    expect(data[0].price).toBe('¥100')
  })
})

// ─── remove ────────────────────────────

describe('remove', () => {
  test('删除成功', async () => {
    reset([{ _id: 's1' }])
    const res = await remove('s1')
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.USER_ADDED_SHOPS)
    expect(data.length).toBe(0)
  })
})
