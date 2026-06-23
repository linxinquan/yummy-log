/**
 * collectedList.test.js — 测试收藏列表 DAL
 * 验证 getList（含 placeType 过滤）/ check / add（防重复）/ remove / toggle
 */

let collectedList, mockDB, mockCollection

beforeEach(() => {
  jest.resetModules()
  mockDB = global.__mockDB
  mockDB.__resetAll()
  mockCollection = mockDB.collection('collected_list')
  ;({ getList, check, add, remove, toggle } = require('../../utils/db/collectedList'))
})

// ─── getList ────────────────────────────

describe('getList', () => {
  const mockData = [
    { _id: '1', placeId: 'p1', placeType: 'food', createdAt: new Date('2025-01-03') },
    { _id: '2', placeId: 'p2', placeType: 'spot', createdAt: new Date('2025-01-02') },
    { _id: '3', placeId: 'p3', placeType: 'food', createdAt: new Date('2025-01-01') },
  ]

  test('无参数时返回全部记录（完整对象数组）', async () => {
    mockCollection.__setData(mockData)
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(3)
    // 降序：p1, p2, p3
    expect(res.data[0].placeId).toBe('p1')
  })

  test('placeType="food" 只返回美食', async () => {
    mockCollection.__setData(mockData)
    const res = await getList('food')
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(2)
    expect(res.data.every(r => r.placeType === 'food')).toBe(true)
  })

  test('placeType="spot" 只返回景点', async () => {
    mockCollection.__setData(mockData)
    const res = await getList('spot')
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(1)
    expect(res.data[0].placeType).toBe('spot')
  })

  test('空列表返回空数组', async () => {
    mockCollection.__setData([])
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })
})

// ─── check ───────────────────────────────

describe('check', () => {
  beforeEach(() => {
    mockCollection.__setData([
      { _id: '1', placeId: 'p1', placeType: 'food' },
      { _id: '2', placeId: 'p2', placeType: 'spot' },
    ])
  })

  test('已收藏返回 true', async () => {
    const res = await check('p1', 'food')
    expect(res.data).toBe(true)
  })

  test('未收藏返回 false', async () => {
    const res = await check('p999', 'food')
    expect(res.data).toBe(false)
  })

  test('placeType 不匹配返回 false', async () => {
    const res = await check('p2', 'food')
    expect(res.data).toBe(false)
  })
})

// ─── add ─────────────────────────────────

describe('add', () => {
  test('新增成功返回 _id', async () => {
    mockCollection.__setData([])
    const res = await add('p1', 'food')
    expect(res.success).toBe(true)
    expect(res.data).not.toBeNull()
    expect(mockCollection.__getData().length).toBe(1)
  })

  test('重复添加返回 null', async () => {
    mockCollection.__setData([
      { _id: 'existing', placeId: 'p1', placeType: 'food' },
    ])
    const res = await add('p1', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
  })
})

// ─── remove ──────────────────────────────

describe('remove', () => {
  test('删除存在的记录返回删除条数', async () => {
    mockCollection.__setData([
      { _id: '1', placeId: 'p1', placeType: 'food' },
    ])
    const res = await remove('p1', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBe(1)
    expect(mockCollection.__getData().length).toBe(0)
  })

  test('删除不存在的记录返回 0', async () => {
    mockCollection.__setData([])
    const res = await remove('p999', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBe(0)
  })
})

// ─── toggle ─────────────────────────────

describe('toggle', () => {
  test('未收藏 → 添加，返回 true', async () => {
    mockCollection.__setData([])
    const res = await toggle('p1', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBe(true)
    expect(mockCollection.__getData().length).toBe(1)
  })

  test('已收藏 → 移除（通过 get + doc().remove），返回 false', async () => {
    mockCollection.__setData([
      { _id: 'doc1', placeId: 'p1', placeType: 'food', createdAt: new Date() },
    ])
    const res = await toggle('p1', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBe(false)
    expect(mockCollection.__getData().length).toBe(0)
  })
})
