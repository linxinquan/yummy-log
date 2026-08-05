/**
 * wantList.test.js — 测试想去列表 DAL
 * 验证 getList / check / add（防重复）/ remove / toggle
 *
 * 注意：不使用 jest.resetModules()，避免顶层 require 顺序问题。
 * 每个测试通过 mockDB.__setCollectionData 重置 mock 数据。
 */

const { getList, check, add, remove, toggle } = require('../../utils/db/wantList')
const { COLLECTIONS } = require('../../utils/db/index')
const mockDB = global.__mockDB

// 每个测试前重置 want_list 集合数据
function resetWantList(data = []) {
  mockDB.__setCollectionData(COLLECTIONS.WANT_LIST, data)
}

beforeEach(() => {
  resetWantList()
})

// ─── getList ─────────────────────────────

describe('getList', () => {
  test('空列表返回空数组', async () => {
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })

  test('返回 {placeId, placeType} 对象数组，按 createdAt 降序', async () => {
    resetWantList([
      { _id: '1', placeId: 'p1', placeType: 'food', createdAt: new Date('2025-01-01') },
      { _id: '2', placeId: 'p2', placeType: 'food', createdAt: new Date('2025-01-03') },
      { _id: '3', placeId: 'p3', placeType: 'spot', createdAt: new Date('2025-01-02') },
    ])
    const res = await getList()
    expect(res.success).toBe(true)
    // orderBy('createdAt','desc') → 降序：p2, p3, p1；placeType 缺失时默认 food
    expect(res.data).toEqual([
      { placeId: 'p2', placeType: 'food' },
      { placeId: 'p3', placeType: 'spot' },
      { placeId: 'p1', placeType: 'food' },
    ])
  })

  test('异常时返回 success:false', async () => {
    resetWantList([{ _id: '1', placeId: 'p1', placeType: 'food' }])
    // 通过修改 mockCollection 的 get 方法模拟异常
    const coll = mockDB._collections[COLLECTIONS.WANT_LIST]
    const origGet = coll.get
    coll.get = async () => { throw new Error('network error') }
    const res = await getList()
    expect(res.success).toBe(false)
    expect(res.error).toBeDefined()
    coll.get = origGet
  })
})

// ─── check ───────────────────────────────

describe('check', () => {
  beforeEach(() => {
    resetWantList([
      { _id: '1', placeId: 'p1', placeType: 'food' },
      { _id: '2', placeId: 'p2', placeType: 'spot' },
    ])
  })

  test('存在时返回 true', async () => {
    const res = await check('p1', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBe(true)
  })

  test('不存在时返回 false', async () => {
    const res = await check('p999', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBe(false)
  })

  test('placeType 不匹配时返回 false', async () => {
    const res = await check('p2', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBe(false)
  })
})

// ─── add ─────────────────────────────────

describe('add', () => {
  test('新增成功返回 _id', async () => {
    resetWantList([])
    const res = await add('p1', 'food')
    expect(res.success).toBe(true)
    expect(res.data).not.toBeNull()
    const data = mockDB.__getCollectionData(COLLECTIONS.WANT_LIST)
    expect(data.length).toBe(1)
    expect(data[0].placeId).toBe('p1')
  })

  test('重复添加返回 null（防重复）', async () => {
    resetWantList([
      { _id: 'existing', placeId: 'p1', placeType: 'food' },
    ])
    const res = await add('p1', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
    const data = mockDB.__getCollectionData(COLLECTIONS.WANT_LIST)
    expect(data.length).toBe(1) // 条数不变
  })

  test('不同 placeType 可以重复添加', async () => {
    resetWantList([
      { _id: '1', placeId: 'p1', placeType: 'food' },
    ])
    const res = await add('p1', 'spot')
    expect(res.success).toBe(true)
    expect(res.data).not.toBeNull()
    const data = mockDB.__getCollectionData(COLLECTIONS.WANT_LIST)
    expect(data.length).toBe(2)
  })
})

// ─── remove ──────────────────────────────

describe('remove', () => {
  test('删除存在的记录返回删除条数', async () => {
    resetWantList([
      { _id: '1', placeId: 'p1', placeType: 'food' },
      { _id: '2', placeId: 'p2', placeType: 'food' },
    ])
    const res = await remove('p1', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBe(1)
    const data = mockDB.__getCollectionData(COLLECTIONS.WANT_LIST)
    expect(data.length).toBe(1)
  })

  test('删除不存在的记录返回 0', async () => {
    resetWantList([])
    const res = await remove('p999', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBe(0)
  })
})

// ─── toggle ─────────────────────────────

describe('toggle', () => {
  test('未想去 → 添加，返回 true', async () => {
    resetWantList([])
    const res = await toggle('p1', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.WANT_LIST)
    expect(data.length).toBe(1)
  })

  test('已想去 → 移除，返回 false', async () => {
    resetWantList([
      { _id: '1', placeId: 'p1', placeType: 'food', createdAt: new Date() },
    ])
    const res = await toggle('p1', 'food')
    expect(res.success).toBe(true)
    expect(res.data).toBe(false)
    const data = mockDB.__getCollectionData(COLLECTIONS.WANT_LIST)
    expect(data.length).toBe(0)
  })

  test('连续 toggle 两次回到初始状态', async () => {
    resetWantList([])
    const r1 = await toggle('p1', 'food')
    expect(r1.data).toBe(true)
    const r2 = await toggle('p1', 'food')
    expect(r2.data).toBe(false)
    const data = mockDB.__getCollectionData(COLLECTIONS.WANT_LIST)
    expect(data.length).toBe(0)
  })
})
