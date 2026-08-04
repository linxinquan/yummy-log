/**
 * places.test.js — 测试地点 DAL
 *
 * 当前 places.js 仅导出 getList(conditions) 与 getByCity(city, limit)，
 * 内部负责翻页拉全量（PAGE_SIZE=20）与 GeoPoint 标准化（_normalizeGeoPoint）。
 */

const { getList, getByCity } = require('../../utils/db/places')
const { COLLECTIONS } = require('../../utils/db/index')
const mockDB = global.__mockDB

// 生成 n 条测试地点数据
function makePlaces(n, overrides = {}) {
  const list = []
  for (let i = 1; i <= n; i++) {
    list.push({
      id: i,
      name: `地点${i}`,
      type: i % 2 === 0 ? 'spot' : 'food',
      city: '深圳',
      ...overrides,
    })
  }
  return list
}

function reset(data = []) {
  mockDB.__setCollectionData(COLLECTIONS.PLACES, data)
}

beforeEach(() => reset())

// ─── getList ─────────────────────────────

describe('getList', () => {
  test('空数据返回空数组', async () => {
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })

  test('≤20 条一次拉完', async () => {
    reset(makePlaces(5))
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(5)
  })

  test('>20 条自动翻页拉全量', async () => {
    // 生成 45 条数据，需要 3 次翻页（20+20+5）
    reset(makePlaces(45))
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(45)
  })

  test('支持 conditions 等值过滤', async () => {
    reset([
      { id: 1, type: 'food', city: '深圳' },
      { id: 2, type: 'spot', city: '深圳' },
      { id: 3, type: 'food', city: '广州' },
    ])
    const res = await getList({ city: '深圳', type: 'food' })
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(1)
    expect(res.data[0].id).toBe(1)
  })

  test('GeoPoint 标准化：location.coordinates → lng/lat', async () => {
    reset([{
      id: 1,
      name: '测试店',
      location: { type: 'Point', coordinates: [113.9, 22.5] },
    }])
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data[0].lng).toBe(113.9)
    expect(res.data[0].lat).toBe(22.5)
    // 原 location 字段保留
    expect(res.data[0].location).toBeDefined()
  })

  test('无 location 字段时不设置 lng/lat', async () => {
    reset([{ id: 2, name: '无坐标' }])
    const res = await getList()
    expect(res.success).toBe(true)
    expect(res.data[0].lng).toBeUndefined()
    expect(res.data[0].lat).toBeUndefined()
  })
})

// ─── getByCity ──────────────────────────

describe('getByCity', () => {
  test('无 limit 时翻页拉全量', async () => {
    reset(makePlaces(25, { city: '深圳' }))
    const res = await getByCity('深圳')
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(25)
  })

  test('有 limit 时只返回 limit 条', async () => {
    reset(makePlaces(30, { city: '深圳' }))
    const res = await getByCity('深圳', 10)
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(10)
  })

  test('城市不匹配返回空数组', async () => {
    reset([{ id: 1, city: '深圳' }])
    const res = await getByCity('北京')
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })
})
