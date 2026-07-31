/**
 * routes.test.js — 测试路线 DAL（标准 CRUD）
 */

const { getList, getById, add, update, remove } = require('../../utils/db/routes')
const { COLLECTIONS } = require('../../utils/db/index')
const mockDB = global.__mockDB

function reset(data = []) {
  mockDB.__setCollectionData(COLLECTIONS.ROUTES, data)
}

beforeEach(() => reset())

// ─── getList ───────────────────────────

describe('getList', () => {
  test('空列表返回空数组', async () => {
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })

  test('按 updatedAt 降序', async () => {
    reset([
      { _id: '1', title: '旧', updatedAt: new Date('2025-01-01') },
      { _id: '2', title: '新', updatedAt: new Date('2025-01-03') },
    ])
    const res = await getList()
    expect(res.data[0]._id).toBe('2')
  })
})

// ─── getById ───────────────────────────

describe('getById', () => {
  beforeEach(() => {
    reset([{ _id: 'r1', title: '路线A' }, { _id: 'r2', title: '路线B' }])
  })

  test('存在时返回数据', async () => {
    const res = await getById('r1')
    expect(res.success).toBe(true)
    expect(res.data.title).toBe('路线A')
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
    const res = await add({ title: '我的路线', city: '深圳市' })
    expect(res.success).toBe(true)
    expect(res.data).toBeDefined()
    const data = mockDB.__getCollectionData(COLLECTIONS.ROUTES)
    expect(data.length).toBe(1)
    expect(data[0].title).toBe('我的路线')
    expect(data[0].sourceType).toBe('manual') // 默认值
  })

  test('默认值正确填充', async () => {
    const res = await add({})
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.ROUTES)
    expect(data[0].title).toBe('未命名路线')
    expect(data[0].dayCount).toBe(1)
    expect(data[0].isDraft).toBe(false)
    expect(data[0].sourceType).toBe('manual')
    expect(data[0].daySections).toEqual([])
  })
})

// ─── update ────────────────────────────

describe('update', () => {
  beforeEach(() => {
    reset([{ _id: 'r1', title: '旧标题' }])
  })

  test('更新成功', async () => {
    const res = await update('r1', { title: '新标题', city: '广州市' })
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.ROUTES)
    expect(data[0].title).toBe('新标题')
    expect(data[0].updatedAt).toBeDefined()
  })
})

// ─── remove ────────────────────────────

describe('remove', () => {
  test('删除成功', async () => {
    reset([{ _id: 'r1' }])
    const res = await remove('r1')
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.ROUTES)
    expect(data.length).toBe(0)
  })
})
