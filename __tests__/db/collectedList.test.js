/**
 * collectedList.test.js — 测试收藏列表 DAL（纯 ID 列表，无 placeType）
 *
 * 与 want_list 不同，collected_list 只存 placeId，不区分美食/景点。
 * 覆盖：getList / check / add（幂等）/ toggle
 */

const { getList, check, add, remove, toggle } = require('../../utils/db/collectedList')
const { COLLECTIONS } = require('../../utils/db/index')
const mockDB = global.__mockDB

function reset(data = []) {
  mockDB.__setCollectionData(COLLECTIONS.COLLECTED_LIST, data)
}

beforeEach(() => reset())

// ─── getList ────────────────────────────

describe('getList', () => {
  test('空列表返回空数组', async () => {
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })

  test('返回全部收藏记录（完整对象数组），按 createdAt 降序', async () => {
    reset([
      { _id: '1', placeId: 'p1', createdAt: new Date('2025-01-03') },
      { _id: '2', placeId: 'p2', createdAt: new Date('2025-01-02') },
      { _id: '3', placeId: 'p3', createdAt: new Date('2025-01-01') },
    ])
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(3)
    expect(res.data[0].placeId).toBe('p1') // 最新在前
    expect(res.data[2].placeId).toBe('p3')
  })
})

// ─── check ───────────────────────────────

describe('check', () => {
  beforeEach(() => {
    reset([
      { _id: '1', placeId: 'p1' },
      { _id: '2', placeId: 'p2' },
    ])
  })

  test('已收藏返回 true', async () => {
    const res = await check('p1')
    expect(res.success).toBe(true)
    expect(res.data).toBe(true)
  })

  test('未收藏返回 false', async () => {
    const res = await check('p999')
    expect(res.success).toBe(true)
    expect(res.data).toBe(false)
  })
})

// ─── add ─────────────────────────────────

describe('add', () => {
  test('新增成功返回 _id，并写入 placeId 与 createdAt', async () => {
    reset([])
    const res = await add('p1')
    expect(res.success).toBe(true)
    expect(res.data).not.toBeNull()
    const data = mockDB.__getCollectionData(COLLECTIONS.COLLECTED_LIST)
    expect(data.length).toBe(1)
    expect(data[0].placeId).toBe('p1')
    expect(data[0].createdAt).toBeDefined()
  })

  test('重复添加返回 null（幂等），条数不变', async () => {
    reset([{ _id: 'existing', placeId: 'p1' }])
    const res = await add('p1')
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
    const data = mockDB.__getCollectionData(COLLECTIONS.COLLECTED_LIST)
    expect(data.length).toBe(1)
  })
})

// ─── remove ─────────────────────────────

describe('remove', () => {
  test('删除存在的记录返回删除条数', async () => {
    reset([{ _id: '1', placeId: 'p1' }])
    const res = await remove('p1')
    expect(res.success).toBe(true)
    expect(res.data).toBe(1)
    const data = mockDB.__getCollectionData(COLLECTIONS.COLLECTED_LIST)
    expect(data.length).toBe(0)
  })

  test('删除不存在的记录返回 0', async () => {
    reset([])
    const res = await remove('p999')
    expect(res.success).toBe(true)
    expect(res.data).toBe(0)
  })
})

// ─── toggle ─────────────────────────────

describe('toggle', () => {
  test('未收藏 → 添加，返回 true', async () => {
    reset([])
    const res = await toggle('p1')
    expect(res.success).toBe(true)
    expect(res.data).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.COLLECTED_LIST)
    expect(data.length).toBe(1)
    expect(data[0].placeId).toBe('p1')
  })

  test('已收藏 → 移除，返回 false', async () => {
    reset([{ _id: 'doc1', placeId: 'p1', createdAt: new Date() }])
    const res = await toggle('p1')
    expect(res.success).toBe(true)
    expect(res.data).toBe(false)
    const data = mockDB.__getCollectionData(COLLECTIONS.COLLECTED_LIST)
    expect(data.length).toBe(0)
  })
})
