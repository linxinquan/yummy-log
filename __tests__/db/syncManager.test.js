/**
 * syncManager.test.js — 测试异步备份管理器（本地 → 云端推送）
 *
 * 职责：读取本地权威数据推送到云端，不拉取、不覆盖本地。
 * 覆盖：push（wantList 带 placeType / collectedList 纯 ID）、pushAll、enqueuePush 节流。
 *
 * 依赖：
 * - utils/util（isCloudMode / loadData）→ jest.mock
 * - 真实 DAL（wantList / collectedList）走 mockDB
 */

const mockIsCloudMode = jest.fn()
const mockLoadData = jest.fn()

jest.mock('../../utils/util', () => ({
  isCloudMode: () => mockIsCloudMode(),
  loadData: (key, def) => mockLoadData(key, def),
}))

const mockDB = global.__mockDB
const manager = require('../../utils/db/syncManager')
const { COLLECTIONS } = require('../../utils/db/index')

beforeEach(() => {
  jest.clearAllMocks()
  mockIsCloudMode.mockReturnValue(true)
  mockLoadData.mockReturnValue([])
  ;['want_list', 'collected_list'].forEach(name => {
    if (mockDB._collections[name]) mockDB._collections[name].__reset()
  })
})

// ─── push（wantList，带 placeType）───────

describe('push wantList', () => {
  test('非云模式直接返回，不读写数据', async () => {
    mockIsCloudMode.mockReturnValue(false)
    mockDB.__setCollectionData('want_list', [{ _id: 'a', placeId: 'p1', placeType: 'food' }])
    await manager.push('wantList')
    expect(mockDB.__getCollectionData('want_list').length).toBe(1) // 未变
  })

  test('本地新增 → 云端补写；云端多余 → 云端删除', async () => {
    mockDB.__setCollectionData('want_list', [
      { _id: 'a', placeId: 'p1', placeType: 'food' },
    ])
    mockLoadData.mockImplementation((key, def) => {
      if (key === 'userWantList') return ['p2']
      return def
    })
    await manager.push('wantList')
    const data = mockDB.__getCollectionData('want_list')
    expect(data.length).toBe(1)
    expect(data[0].placeId).toBe('p2')
  })

  test('本地为空 → 删除全部云端记录', async () => {
    mockDB.__setCollectionData('want_list', [
      { _id: 'a', placeId: 'p1', placeType: 'food' },
      { _id: 'b', placeId: 'p2', placeType: 'spot' },
    ])
    await manager.push('wantList')
    expect(mockDB.__getCollectionData('want_list').length).toBe(0)
  })
})

// ─── push（collectedList，纯 ID）─────────

describe('push collectedList', () => {
  test('纯 ID 同步：补写本地缺失，删除云端多余', async () => {
    mockDB.__setCollectionData('collected_list', [{ _id: 'a', placeId: 'c1' }])
    mockLoadData.mockImplementation((key, def) => {
      if (key === 'userCollectedSpots') return ['c2']
      return def
    })
    await manager.push('collectedList')
    const data = mockDB.__getCollectionData('collected_list')
    expect(data.length).toBe(1)
    expect(data[0].placeId).toBe('c2')
  })
})

// ─── pushAll ────────────────────────────

describe('pushAll', () => {
  test('遍历所有实体，不抛异常', async () => {
    mockDB.__setCollectionData('want_list', [{ _id: 'a', placeId: 'p1', placeType: 'food' }])
    await manager.pushAll()
    // wantList 本地为空 → 云端清空；checkinRecords/userAddedShops/routes 为 no-op
    expect(mockDB.__getCollectionData('want_list').length).toBe(0)
  })
})

// ─── enqueuePush 节流 ───────────────────

describe('enqueuePush', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  test('2s 内多次调用同一实体只推送一次', async () => {
    jest.useFakeTimers()
    const pushSpy = jest.spyOn(manager, 'push').mockResolvedValue(undefined)
    manager.enqueuePush('wantList')
    manager.enqueuePush('wantList') // 覆盖上一个定时器
    manager.enqueuePush('collectedList')
    jest.advanceTimersByTime(2000)
    expect(pushSpy).toHaveBeenCalledTimes(2) // wantList + collectedList 各一次
    pushSpy.mockRestore()
  })

  test('未到 2s 不触发，到点后触发一次', async () => {
    jest.useFakeTimers()
    const pushSpy = jest.spyOn(manager, 'push').mockResolvedValue(undefined)
    manager.enqueuePush('wantList')
    jest.advanceTimersByTime(1500)
    expect(pushSpy).not.toHaveBeenCalled()
    jest.advanceTimersByTime(500)
    expect(pushSpy).toHaveBeenCalledTimes(1)
    pushSpy.mockRestore()
  })
})
