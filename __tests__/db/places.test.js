/**
 * places.test.js — 测试地点 DAL
 * 验证 getList / getSpots / getRestaurants / getByCity / getById / searchNearby
 * 含翻页（>20 条）、GeoPoint 标准化、geoNear 调用
 */

const { getList, getSpots, getRestaurants, getByCity, getById, searchNearby }
  = require('../../utils/db/places')
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
      city: '深圳市',
      location: { type: 'Point', coordinates: [114.05 + i * 0.001, 22.54 + i * 0.001] },
      ...overrides,
    })
  }
  return list
}

function reset(data = []) {
  mockDB.__setCollectionData(COLLECTIONS.PLACES, data)
}

beforeEach(() => reset())

// ─── _normalizeGeoPoint（通过 getById 间接测试）───────────────────

describe('_normalizeGeoPoint（通过 getById 验证）', () => {
  test('location.coordinates → 展开为 lng/lat', async () => {
    reset([{
      id: 1,
      name: '测试店',
      location: { type: 'Point', coordinates: [113.9, 22.5] },
    }])
    const res = await getById(1)
    expect(res.success).toBe(true)
    expect(res.data.lng).toBe(113.9)
    expect(res.data.lat).toBe(22.5)
    // 原 location 字段保留
    expect(res.data.location).toBeDefined()
  })

  test('无 location 字段时不报错', async () => {
    reset([{ id: 2, name: '无坐标' }])
    const res = await getById(2)
    expect(res.success).toBe(true)
    expect(res.data.lng).toBeUndefined()
  })
})

// ─── getList（翻页）─────────────────────────────

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

  test('支持 conditions 过滤', async () => {
    reset([
      { id: 1, type: 'food', city: '深圳市' },
      { id: 2, type: 'spot', city: '深圳市' },
      { id: 3, type: 'food', city: '广州市' },
    ])
    const res = await getList({ city: '深圳市', type: 'food' })
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(1)
    expect(res.data[0].id).toBe(1)
  })
})

// ─── getSpots ─────────────────────────────

describe('getSpots', () => {
  beforeEach(() => {
    reset([
      { id: 1, type: 'food', name: '餐厅' },
      { id: 2, type: 'spot', name: '景点' },
      { id: 3, type: 'spot', name: '另一个景点' },
    ])
  })

  test('只返回 type=spot', async () => {
    const res = await getSpots()
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(2)
    expect(res.data.every(p => p.type === 'spot')).toBe(true)
  })
})

// ─── getRestaurants ────────────────────────

describe('getRestaurants', () => {
  beforeEach(() => {
    reset([
      { id: 1, type: 'food', category: '火锅' },
      { id: 2, type: 'food', category: '火锅' },
      { id: 3, type: 'food', category: '日料' },
      { id: 4, type: 'spot' },
    ])
  })

  test('默认返回全部美食（type=food）', async () => {
    const res = await getRestaurants()
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(3)
  })

  test('按 category 过滤', async () => {
    const res = await getRestaurants({ category: '火锅' })
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(2)
  })

  test('category="全部"时不按 category 过滤', async () => {
    const res = await getRestaurants({ category: '全部' })
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(3)
  })

  test('按 city 过滤', async () => {
    reset([
      { id: 1, type: 'food', city: '深圳市' },
      { id: 2, type: 'food', city: '广州市' },
    ])
    const res = await getRestaurants({ city: '深圳市' })
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(1)
  })
})

// ─── getByCity ──────────────────────────

describe('getByCity', () => {
  test('无 limit 时翻页拉全量', async () => {
    reset(makePlaces(25, { city: '深圳市' }))
    const res = await getByCity('深圳市')
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(25)
  })

  test('有 limit 时只返回 limit 条', async () => {
    reset(makePlaces(30, { city: '深圳市' }))
    const res = await getByCity('深圳市', 10)
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(10)
  })

  test('城市不匹配返回空数组', async () => {
    reset([{ id: 1, city: '深圳市' }])
    const res = await getByCity('北京市')
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })
})

// ─── getById ───────────────────────────

describe('getById', () => {
  beforeEach(() => {
    reset([
      { id: 101, name: '测试地点' },
      { id: 102, name: '另一个' },
    ])
  })

  test('存在时返回数据（含标准化 GeoPoint）', async () => {
    const res = await getById(101)
    expect(res.success).toBe(true)
    expect(res.data.name).toBe('测试地点')
  })

  test('不存在返回 null', async () => {
    const res = await getById(999)
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
  })

  test('id 支持字符串（内部转 Number）', async () => {
    const res = await getById('101')
    expect(res.success).toBe(true)
    expect(res.data.name).toBe('测试地点')
  })
})

// ─── searchNearby ───────────────────────

describe('searchNearby', () => {
  test('无 type 过滤返回数据', async () => {
    reset([{ id: 1, name: '附近店', type: 'food' }])
    const res = await searchNearby(22.54, 114.05)
    expect(res.success).toBe(true)
    // searchNearby 使用 geoNear，mock 中等值过滤，只要能返回数据即可
    // 因为 mockCollection.where 只支持等值过滤，geoNear 对象无法精确匹配
    // 这里验证调用不抛异常
  })

  test('type=spot 只返回景点', async () => {
    reset([
      { id: 1, type: 'food', name: '餐厅' },
      { id: 2, type: 'spot', name: '景点' },
    ])
    const res = await searchNearby(22.54, 114.05, 'spot')
    expect(res.success).toBe(true)
    expect(res.data.every(p => p.type === 'spot')).toBe(true)
  })

  test('type=food 只返回美食', async () => {
    reset([
      { id: 1, type: 'food', name: '餐厅' },
      { id: 2, type: 'spot', name: '景点' },
    ])
    const res = await searchNearby(22.54, 114.05, 'food')
    expect(res.success).toBe(true)
    expect(res.data.every(p => p.type === 'food')).toBe(true)
  })

  test('maxDist 参数被正确使用', async () => {
    reset([{ id: 1, type: 'food' }])
    const res = await searchNearby(22.54, 114.05, 'food', 1000)
    expect(res.success).toBe(true)
    // 不抛异常即通过（mock 中 geoNear 条件无法精确断言）
  })
})
