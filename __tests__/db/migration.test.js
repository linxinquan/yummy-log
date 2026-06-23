/**
 * migration.test.js — 测试数据迁移工具
 * 需要 mock util.js（getWantList/loadData/saveData）
 *
 * 注意：migration.js 在顶层 require 了 wantList/collectedList 等 DAL，
 * 这些 DAL 又 require index.js → client.js，依赖 global.wx（由 setup.js 注入）。
 * 因此必须在 setup.js 之后 require migration，不能在文件顶部 require。
 */

const mockDB = global.__mockDB

// ─── Mock util.js ──────────────────────
// 必须在 require('../../utils/db/migration') 之前 setup

const mockGetWantList   = jest.fn(() => [])
const mockLoadData      = jest.fn((key, def) => def)
const mockSaveData      = jest.fn()

jest.mock('../../utils/util', () => ({
  getWantList:   () => mockGetWantList(),
  loadData:      (key, def) => mockLoadData(key, def),
  saveData:      (key, data) => mockSaveData(key, data),
}))

// 现在可以安全 require migration（此时 global.wx 已存在）
const { migrateAll, hasLocalData, clearLocalData } = require('../../utils/db/migration')

// ─── 辅助：重置所有 mock ─────────────────

beforeEach(() => {
  jest.clearAllMocks()
  mockGetWantList.mockReturnValue([])
  mockLoadData.mockImplementation((key, def) => def)
  mockSaveData.mockImplementation(() => {})
  // 清空 mockDB 各集合
  ;['want_list','collected_list','checkin_records','routes','user_added_shops']
    .forEach(name => {
      if (mockDB._collections[name]) mockDB._collections[name].__reset()
    })
})

// ─── hasLocalData ──────────────────────

describe('hasLocalData', () => {
  test('所有本地数据为空时返回 false', () => {
    // getWantList → [], loadData → []（各键默认值）
    mockGetWantList.mockReturnValue([])
    mockLoadData.mockImplementation((key, def) => {
      if (def !== undefined) return def
      return []
    })
    expect(hasLocalData()).toBe(false)
  })

  test('wantList 有数据时返回 true', () => {
    mockGetWantList.mockReturnValue(['p1', 'p2'])
    expect(hasLocalData()).toBe(true)
  })

  test('collectedFoods 有数据时返回 true', () => {
    mockGetWantList.mockReturnValue([])
    mockLoadData.mockImplementation((key) => {
      if (key === 'userCollectedFoods') return ['p1']
      return []
    })
    expect(hasLocalData()).toBe(true)
  })

  test('checkin_records 有数据时返回 true', () => {
    mockLoadData.mockImplementation((key) => {
      if (key === 'checkin_records') return [{ type: 'food' }]
      return []
    })
    expect(hasLocalData()).toBe(true)
  })
})

// ─── clearLocalData ────────────────────

describe('clearLocalData', () => {
  test('调用 saveData 清除所有本地键', () => {
    clearLocalData()
    expect(mockSaveData).toHaveBeenCalledWith('userWantList', [])
    expect(mockSaveData).toHaveBeenCalledWith('userCollectedFoods', [])
    expect(mockSaveData).toHaveBeenCalledWith('checkin_records', [])
    expect(mockSaveData).toHaveBeenCalledWith('savedRoutes', [])
    expect(mockSaveData).toHaveBeenCalledWith('userAddedShops', [])
  })
})

// ─── migrateAll ────────────────────────

describe('migrateAll', () => {
  test('默认选项：无本地数据时各 count 为 0', async () => {
    const res = await migrateAll()
    expect(res.success).toBe(true)
    expect(res.data.stats).toEqual({
      wantCount: 0,
      collectCount: 0,
      checkinCount: 0,
      routeCount: 0,
      shopCount: 0,
    })
  })

  test('迁移 wantList', async () => {
    mockGetWantList.mockReturnValue(['p1', 'p2'])
    const res = await migrateAll({ wantList: true })
    expect(res.success).toBe(true)
    expect(res.data.stats.wantCount).toBe(2)
    // 验证 wantListDal.add 被间接调用（数据已写入 mockDB）
    const data = mockDB.__getCollectionData('want_list')
    expect(data.length).toBe(2)
  })

  test('迁移 collectedList（food + spot）', async () => {
    mockLoadData.mockImplementation((key) => {
      if (key === 'userCollectedFoods') return ['f1']
      if (key === 'userCollectedSpots') return ['s1']
      return []
    })
    const res = await migrateAll({ collectedList: true })
    expect(res.success).toBe(true)
    expect(res.data.stats.collectCount).toBe(2)
    const data = mockDB.__getCollectionData('collected_list')
    expect(data.length).toBe(2)
  })

  test('迁移 checkinRecords', async () => {
    mockLoadData.mockImplementation((key) => {
      if (key === 'checkin_records') {
        return [{ type: 'food', spotName: '店', city: '深圳' }]
      }
      return []
    })
    const res = await migrateAll({ checkinRecords: true })
    expect(res.success).toBe(true)
    expect(res.data.stats.checkinCount).toBe(1)
    const data = mockDB.__getCollectionData('checkin_records')
    expect(data.length).toBe(1)
  })

  test('迁移 routes', async () => {
    mockLoadData.mockImplementation((key) => {
      if (key === 'savedRoutes') return [{ title: '路线A' }]
      return []
    })
    const res = await migrateAll({ routes: true })
    expect(res.success).toBe(true)
    expect(res.data.stats.routeCount).toBe(1)
    const data = mockDB.__getCollectionData('routes')
    expect(data.length).toBe(1)
  })

  test('迁移 userAddedShops', async () => {
    mockLoadData.mockImplementation((key) => {
      if (key === 'userAddedShops') return [{ name: '店铺A', type: 'food' }]
      return []
    })
    const res = await migrateAll({ userAddedShops: true })
    expect(res.success).toBe(true)
    expect(res.data.stats.shopCount).toBe(1)
    const data = mockDB.__getCollectionData('user_added_shops')
    expect(data.length).toBe(1)
  })

  test('onProgress 回调被调用', async () => {
    mockGetWantList.mockReturnValue(['p1'])
    const onProgress = jest.fn()
    await migrateAll({ wantList: true, onProgress })
    expect(onProgress).toHaveBeenCalled()
  })

  test('传入 false 可跳过某项迁移', async () => {
    mockGetWantList.mockReturnValue(['p1'])
    const res = await migrateAll({ wantList: false })
    expect(res.data.stats.wantCount).toBe(0)
    const data = mockDB.__getCollectionData('want_list')
    expect(data.length).toBe(0) // 未写入
  })
})
