/**
 * migration.test.js — 测试数据迁移工具（当前仅迁移打卡记录）
 *
 * 数据决策（见 utils/db/migration.js）：
 * - 路线、添加店铺、想去列表、收藏列表 → 登录后直接丢弃
 * - 打卡记录 → 两阶段迁移（图片处理 + 写入云端）
 *
 * 依赖：
 * - utils/util（loadData / saveData）→ jest.mock
 * - wx.getFileSystemManager（saveFile）→ setup.js 注入的 global.__mockFS
 * - wx.cloud.uploadFile → setup.js 注入
 */

const mockLoadData = jest.fn()
const mockSaveData = jest.fn()

jest.mock('../../utils/util', () => ({
  loadData: (key, def) => mockLoadData(key, def),
  saveData: (key, data) => mockSaveData(key, data),
}))

const mockDB = global.__mockDB
const mockFS = global.__mockFS

const { migrateAll, hasLocalData, discardLocalLists, clearLocalData }
  = require('../../utils/db/migration')
const { COLLECTIONS } = require('../../utils/db/index')

beforeEach(() => {
  jest.clearAllMocks()
  mockLoadData.mockImplementation((key, def) => def)
  mockSaveData.mockImplementation(() => {})
  if (mockDB._collections[COLLECTIONS.CHECKIN_RECORDS]) {
    mockDB._collections[COLLECTIONS.CHECKIN_RECORDS].__reset()
  }
})

// ─── hasLocalData ──────────────────────

describe('hasLocalData', () => {
  test('checkin_records 为空 → false', () => {
    mockLoadData.mockImplementation((key, def) => {
      if (key === 'checkin_records') return []
      return def
    })
    expect(hasLocalData()).toBe(false)
  })

  test('checkin_records 有数据 → true', () => {
    mockLoadData.mockImplementation((key, def) => {
      if (key === 'checkin_records') return [{ type: 'food' }]
      return def
    })
    expect(hasLocalData()).toBe(true)
  })
})

// ─── discardLocalLists / clearLocalData ──

describe('discardLocalLists / clearLocalData', () => {
  test('discardLocalLists 清空全部本地列表键', () => {
    discardLocalLists()
    expect(mockSaveData).toHaveBeenCalledWith('userWantList', [])
    expect(mockSaveData).toHaveBeenCalledWith('userWantFoods', [])
    expect(mockSaveData).toHaveBeenCalledWith('userWantSpots', [])
    expect(mockSaveData).toHaveBeenCalledWith('userCollectedFoods', [])
    expect(mockSaveData).toHaveBeenCalledWith('userCollectedSpots', [])
    expect(mockSaveData).toHaveBeenCalledWith('savedRoutes', [])
    expect(mockSaveData).toHaveBeenCalledWith('userAddedShops', [])
  })

  test('clearLocalData 额外清空打卡与已到访记录', () => {
    clearLocalData()
    expect(mockSaveData).toHaveBeenCalledWith('checkin_records', [])
    expect(mockSaveData).toHaveBeenCalledWith('userCheckedIn', [])
  })
})

// ─── migrateAll ────────────────────────

describe('migrateAll', () => {
  test('无本地数据 → count 0，触发 done 进度，不写存储', async () => {
    const onProgress = jest.fn()
    const res = await migrateAll({ onProgress })
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ count: 0 })
    expect(onProgress).toHaveBeenCalledWith('done', 0, 0)
    expect(mockSaveData).not.toHaveBeenCalled()
  })

  test('迁移打卡记录：写入云端并返回条数，迁移后清空本地缓存', async () => {
    mockLoadData.mockImplementation((key, def) => {
      if (key === 'checkin_records') {
        return [{ type: 'food', spotName: '店', city: '深圳市' }]
      }
      return def
    })
    const res = await migrateAll()
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ count: 1 })
    const data = mockDB.__getCollectionData(COLLECTIONS.CHECKIN_RECORDS)
    expect(data.length).toBe(1)
    expect(data[0].spotName).toBe('店')
    expect(mockSaveData).toHaveBeenCalledWith('checkin_records', [])
    expect(mockSaveData).toHaveBeenCalledWith('userCheckedIn', [])
  })

  test('图片处理：photoPath 持久化并上传获取 cloudFileID', async () => {
    mockLoadData.mockImplementation((key, def) => {
      if (key === 'checkin_records') {
        return [{ type: 'food', photoPath: 'tmp://x.jpg', spotName: '带图' }]
      }
      return def
    })
    const res = await migrateAll()
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.CHECKIN_RECORDS)
    expect(data[0].photoPath).toBe('persisted://mock')
    expect(data[0].cloudFileID).toBe('cloud://mock-file')
  })

  test('已有 cloudFileID 时不重复上传', async () => {
    mockLoadData.mockImplementation((key, def) => {
      if (key === 'checkin_records') {
        return [{ type: 'food', photoPath: 'tmp://x.jpg', cloudFileID: 'cf-1' }]
      }
      return def
    })
    await migrateAll()
    const data = mockDB.__getCollectionData(COLLECTIONS.CHECKIN_RECORDS)
    expect(data[0].cloudFileID).toBe('cf-1')
    expect(global.wx.cloud.uploadFile).not.toHaveBeenCalled()
  })

  test('saveFile 失败时保留原路径继续迁移', async () => {
    mockLoadData.mockImplementation((key, def) => {
      if (key === 'checkin_records') {
        return [{ type: 'food', photoPath: 'tmp://broken.jpg' }]
      }
      return def
    })
    mockFS.saveFile.mockImplementation(({ fail }) => {
      if (typeof fail === 'function') fail(new Error('save failed'))
    })
    const res = await migrateAll()
    expect(res.success).toBe(true)
    const data = mockDB.__getCollectionData(COLLECTIONS.CHECKIN_RECORDS)
    expect(data[0].photoPath).toBe('tmp://broken.jpg')
    // 恢复默认实现，避免影响后续用例
    mockFS.saveFile.mockImplementation(({ success }) => {
      if (typeof success === 'function') success({ savedFilePath: 'persisted://mock' })
    })
  })

  test('onProgress 回调按阶段触发', async () => {
    mockLoadData.mockImplementation((key, def) => {
      if (key === 'checkin_records') {
        return [
          { type: 'food', spotName: '店1' },
          { type: 'spot', spotName: '店2' },
        ]
      }
      return def
    })
    const onProgress = jest.fn()
    await migrateAll({ onProgress })
    expect(onProgress).toHaveBeenCalledWith('photos', 1, 2)
    expect(onProgress).toHaveBeenCalledWith('photos', 2, 2)
    expect(onProgress).toHaveBeenCalledWith('checkins', 2, 2)
    expect(onProgress).toHaveBeenCalledWith('done', 2, 2)
  })
})
