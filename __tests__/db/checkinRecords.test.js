/**
 * checkinRecords.test.js — 测试打卡记录 DAL
 * 验证 getList / getById / add / update / remove / getStats
 */

const { getList, getById, add, update, remove, getStats } = require('../../utils/db/checkinRecords')
const { COLLECTIONS } = require('../../utils/db/index')
const mockDB = global.__mockDB

function reset(data = []) {
  mockDB.__setCollectionData(COLLECTIONS.CHECKIN_RECORDS, data)
}

beforeEach(() => reset())

// ─── getList ───────────────────────────

describe('getList', () => {
  test('空列表返回空数组', async () => {
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })

  test('按 date 降序返回', async () => {
    reset([
      { _id: '1', type: 'food', date: '2025-01-01T00:00:00Z' },
      { _id: '2', type: 'spot', date: '2025-01-03T00:00:00Z' },
      { _id: '3', type: 'food', date: '2025-01-02T00:00:00Z' },
    ])
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data[0]._id).toBe('2') // 最新的在前
    expect(res.data[2]._id).toBe('1') // 最旧的在最后
  })
})

// ─── getById ───────────────────────────

describe('getById', () => {
  beforeEach(() => {
    reset([
      { _id: 'rec1', type: 'food', description: '好吃' },
      { _id: 'rec2', type: 'spot', description: '好玩' },
    ])
  })

  test('存在的记录返回数据', async () => {
    const res = await getById('rec1')
    expect(res.success).toBe(true)
    expect(res.data.description).toBe('好吃')
  })

  test('不存在返回 null', async () => {
    const res = await getById('no_exist')
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
  })
})

// ─── add ──────────────────────────────

describe('add', () => {
  test('添加成功返回 _id', async () => {
    const res = await add({
      type: 'food',
      spotName: '测试店',
      city: '深圳市',
    })
    expect(res.success).toBe(true)
    expect(res.data).toBeDefined()
    const data = mockDB.__getCollectionData(COLLECTIONS.CHECKIN_RECORDS)
    expect(data.length).toBe(1)
    expect(data[0].spotName).toBe('测试店')
    expect(data[0].type).toBe('food')
  })

  test('默认值正确填充', async () => {
    const res = await add({ type: 'spot' })
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.CHECKIN_RECORDS)
    const record = data[0]
    // 云端不写 photoPath（设备私有路径），仅存 cloudFileID
    expect(record.photoPath).toBeUndefined()
    expect(record.cloudFileID).toBe('')
    expect(record.address).toBe('')
    expect(record.description).toBe('')
    expect(record.city).toBe('')
    expect(record.createdAt).toBeDefined() // serverDate mock
  })
})

// ─── update ────────────────────────────

describe('update', () => {
  beforeEach(() => {
    reset([
      { _id: 'rec1', type: 'food', description: '旧描述' },
    ])
  })

  test('更新成功', async () => {
    const res = await update('rec1', { description: '新描述', city: '广州市' })
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.CHECKIN_RECORDS)
    expect(data[0].description).toBe('新描述')
    expect(data[0].city).toBe('广州市')
  })
})

// ─── remove ────────────────────────────

describe('remove', () => {
  test('删除成功', async () => {
    reset([{ _id: 'rec1', type: 'food' }])
    const res = await remove('rec1')
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.CHECKIN_RECORDS)
    expect(data.length).toBe(0)
  })
})

// ─── getStats ──────────────────────────

describe('getStats', () => {
  test('空数据时各项为 0', async () => {
    reset([])
    const res = await getStats()
    expect(res.success).toBe(true)
    expect(res.data).toEqual({
      totalCount: 0,
      cityCount: 0,
      spotCount: 0,
      foodCount: 0,
    })
  })

  test('正确统计', async () => {
    reset([
      { _id: '1', type: 'food', city: '深圳市' },
      { _id: '2', type: 'spot', city: '深圳市' },
      { _id: '3', type: 'food', city: '广州市' },
      { _id: '4', type: 'food', city: '' }, // 无 city，不计入 cityCount
    ])
    const res = await getStats()
    expect(res.success).toBe(true)
    expect(res.data.totalCount).toBe(4)
    expect(res.data.cityCount).toBe(2) // 深圳市、广州市
    expect(res.data.spotCount).toBe(1)
    expect(res.data.foodCount).toBe(3)
  })
})
