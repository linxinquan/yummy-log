/**
 * restore.test.js — 测试云端数据恢复到本地（restoreFromCloud）
 *
 * 使用场景：用户登录后从云端拉取数据覆盖本地（首次登录/清除缓存后）。
 * 行为：
 * - wantList / collectedList：云端 ID 合并到本地（去重）
 * - checkinRecords：云端完整覆盖，并归一化 id（无 id 时取 _id）
 * - userAddedShops / routes：云端完整覆盖
 *
 * 依赖：
 * - utils/util（isCloudMode / loadData / saveData）→ jest.mock
 * - 各 DAL 模块真实加载（走 mockDB 的集合数据）
 */

const mockIsCloudMode = jest.fn()
const mockLoadData = jest.fn()
const mockSaveData = jest.fn()

jest.mock('../../utils/util', () => ({
  isCloudMode: () => mockIsCloudMode(),
  loadData: (key, def) => mockLoadData(key, def),
  saveData: (key, data) => mockSaveData(key, data),
}))

const mockDB = global.__mockDB
const { restoreFromCloud } = require('../../utils/db/restore')

const COLLECTION_NAMES = ['want_list', 'collected_list', 'checkin_records', 'routes', 'user_added_shops']

beforeEach(() => {
  jest.clearAllMocks()
  mockIsCloudMode.mockReturnValue(true)
  mockLoadData.mockReturnValue([])
  mockSaveData.mockImplementation(() => {})
  COLLECTION_NAMES.forEach(name => {
    if (mockDB._collections[name]) mockDB._collections[name].__reset()
  })
})

describe('restoreFromCloud', () => {
  test('非云模式直接返回，不读写本地', async () => {
    mockIsCloudMode.mockReturnValue(false)
    const result = await restoreFromCloud()
    expect(result).toBeUndefined()
    expect(mockSaveData).not.toHaveBeenCalled()
  })

  test('wantList：云端 ID 合并到本地（去重）', async () => {
    mockDB.__setCollectionData('want_list', [
      { _id: 'a', placeId: 'p1', placeType: 'food' },
      { _id: 'b', placeId: 'p2', placeType: 'food' },
    ])
    mockLoadData.mockImplementation((key, def) => {
      if (key === 'userWantList') return ['p2', 'p3']
      return def
    })
    const result = await restoreFromCloud()
    expect(mockSaveData).toHaveBeenCalledWith('userWantList', ['p2', 'p3', 'p1'])
    expect(result).toBe(2) // 仅统计云端新增条数
  })

  test('collectedList：云端 ID 合并到本地（去重）', async () => {
    mockDB.__setCollectionData('collected_list', [
      { _id: 'a', placeId: 'c1' },
      { _id: 'b', placeId: 'c2' },
    ])
    mockLoadData.mockImplementation((key, def) => {
      if (key === 'userCollectedSpots') return ['c2', 'c3']
      return def
    })
    await restoreFromCloud()
    expect(mockSaveData).toHaveBeenCalledWith('userCollectedSpots', ['c2', 'c3', 'c1'])
  })

  test('checkinRecords：云端完整覆盖，并归一化 id（无 id 时取 _id）', async () => {
    mockDB.__setCollectionData('checkin_records', [
      { _id: 'a', spotName: '店A' },
      { _id: 'b', spotName: '店B', id: 'custom-id' },
    ])
    await restoreFromCloud()
    const saved = mockSaveData.mock.calls.find(c => c[0] === 'checkin_records')
    expect(saved).toBeDefined()
    expect(saved[1].length).toBe(2)
    expect(saved[1][0].id).toBe('a')
    expect(saved[1][1].id).toBe('custom-id')
  })

  test('routes / userAddedShops：云端完整覆盖本地', async () => {
    mockDB.__setCollectionData('routes', [{ _id: 'r1', title: '路线A' }])
    mockDB.__setCollectionData('user_added_shops', [{ _id: 's1', name: '店铺A' }])
    await restoreFromCloud()
    expect(mockSaveData).toHaveBeenCalledWith('savedRoutes', [{ _id: 'r1', title: '路线A' }])
    expect(mockSaveData).toHaveBeenCalledWith('userAddedShops', [{ _id: 's1', name: '店铺A' }])
  })

  test('某实体查询失败时跳过，不影响其他实体', async () => {
    mockDB.__setCollectionData('want_list', [
      { _id: 'a', placeId: 'p1', placeType: 'food' },
    ])
    const coll = mockDB._collections['checkin_records']
    const origGet = coll.get
    coll.get = async () => { throw new Error('boom') }
    const result = await restoreFromCloud()
    expect(result).toBeGreaterThanOrEqual(1) // wantList 仍恢复成功
    coll.get = origGet
  })
})
