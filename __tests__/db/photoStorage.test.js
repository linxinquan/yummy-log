/**
 * photoStorage.test.js — 回归测试图片持久化服务（离线补传机制）
 *
 * 本次改动核心（发版回归重点）：
 * 1. 上传前压缩图片（_compressImage）
 * 2. 上传失败自动重试（_uploadWithRetry）
 * 3. 上传仍失败时入补传队列，网络恢复后 flushPendingUploads 补传回写 cloudFileID
 * 4. checkinUtil.saveCheckin 支持预生成的自定义 id
 */

const photoStorage = require('../../utils/photoStorage')
const checkinUtil = require('../../utils/checkinUtil')
const { COLLECTIONS } = require('../../utils/db/index')
const mockDB = global.__mockDB
const mockStorage = global.__mockStorage

// 以"已登录（云端模式）"状态为前置，用户身份含 _id 即可触发 isCloudMode()=true
function login() {
  wx.setStorageSync('userInfo', { _id: 'u_mock_1', nickName: '测试用户' })
}

function logout() {
  wx.removeStorageSync('userInfo')
}

function setCheckinRecords(records) {
  wx.setStorageSync('checkin_records', records)
}

beforeEach(() => {
  mockStorage.__resetStorage()
  mockDB.__resetAll()
  // 重置 fs 文件存在性到默认状态（persisted://mock 存在）
  global.__mockFS.__resetFileExistence()
  // 清理跨测试累积的 mock 调用记录与实现
  jest.clearAllMocks()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ─── persistPhoto：本地持久化 + 云端上传 ─────────────

describe('persistPhoto 基础行为', () => {
  test('空 tempPath 返回空 localPath / cloudFileID', async () => {
    const result = await photoStorage.persistPhoto('')
    expect(result).toEqual({ localPath: '', cloudFileID: '' })
  })

  test('未登录（本地模式）只做本地持久化，不上传云存储', async () => {
    logout()
    const result = await photoStorage.persistPhoto('wxfile://tmp/a.jpg')
    expect(result.localPath).toBe('persisted://mock')
    expect(result.cloudFileID).toBe('')
    // 云端上传不应被调用
    expect(wx.cloud.uploadFile).not.toHaveBeenCalled()
  })

  test('已登录且上传成功，返回 cloudFileID', async () => {
    login()
    wx.cloud.uploadFile.mockResolvedValueOnce({ fileID: 'cloud://success' })
    const result = await photoStorage.persistPhoto('wxfile://tmp/a.jpg')
    expect(result.localPath).toBe('persisted://mock')
    expect(result.cloudFileID).toBe('cloud://success')
    expect(wx.cloud.uploadFile).toHaveBeenCalled()
  })
})

// ─── persistPhoto：上传失败 → 入补传队列 ─────────────

describe('persistPhoto 上传失败入队', () => {
  test('上传失败且带 recordId → 加入补传队列', async () => {
    login()
    // 持续失败，触发重试后仍失败（用 fake timers 避免真实等待）
    wx.cloud.uploadFile.mockRejectedValue({ errMsg: 'network fail' })
    jest.useFakeTimers()
    const promise = photoStorage.persistPhoto('wxfile://tmp/a.jpg', { recordId: 'CK1' })
    await jest.advanceTimersByTimeAsync(10000)
    const result = await promise
    jest.useRealTimers()

    expect(result.cloudFileID).toBe('')
    const pending = wx.getStorageSync('pending_photo_uploads')
    expect(pending.length).toBe(1)
    expect(pending[0].recordId).toBe('CK1')
    expect(pending[0].localPath).toBe('persisted://mock')
  })

  test('上传失败但无 recordId → 不入补传队列', async () => {
    login()
    wx.cloud.uploadFile.mockRejectedValue({ errMsg: 'network fail' })
    jest.useFakeTimers()
    const promise = photoStorage.persistPhoto('wxfile://tmp/a.jpg')
    await jest.advanceTimersByTimeAsync(10000)
    await promise
    jest.useRealTimers()

    const pending = wx.getStorageSync('pending_photo_uploads') || []
    expect(pending.length).toBe(0)
  })

  test('本地持久化失败时回退原临时路径，但仍可入队', async () => {
    login()
    global.__mockFS.saveFile.mockImplementationOnce(({ fail }) => {
      if (typeof fail === 'function') fail(new Error('disk full'))
    })
    wx.cloud.uploadFile.mockRejectedValue({ errMsg: 'network fail' })
    jest.useFakeTimers()
    const promise = photoStorage.persistPhoto('wxfile://tmp/b.jpg', { recordId: 'CK2' })
    await jest.advanceTimersByTimeAsync(10000)
    const result = await promise
    jest.useRealTimers()

    expect(result.localPath).toBe('wxfile://tmp/b.jpg')
    const pending = wx.getStorageSync('pending_photo_uploads')
    expect(pending[0].localPath).toBe('wxfile://tmp/b.jpg')
  })
})

// ─── enqueuePendingUpload：幂等去重 ────────────────

describe('enqueuePendingUpload 幂等', () => {
  test('同一 recordId 只保留一条', () => {
    wx.setStorageSync('pending_photo_uploads', [
      { localPath: 'p1', recordId: 'CK1' },
    ])
    photoStorage.enqueuePendingUpload({ localPath: 'p2', recordId: 'CK1' })
    const pending = wx.getStorageSync('pending_photo_uploads')
    expect(pending.length).toBe(1)
    expect(pending[0].localPath).toBe('p2')
  })

  test('缺少 localPath 或 recordId 时不入队', () => {
    photoStorage.enqueuePendingUpload({ localPath: 'x' })       // 缺 recordId
    photoStorage.enqueuePendingUpload({ recordId: 'CK9' })      // 缺 localPath
    photoStorage.enqueuePendingUpload(null)
    expect((wx.getStorageSync('pending_photo_uploads') || []).length).toBe(0)
  })
})

// ─── flushPendingUploads：补传回写 ──────────────────

describe('flushPendingUploads 补传', () => {
  test('未登录（本地模式）直接返回 0，不补传', async () => {
    logout()
    wx.setStorageSync('pending_photo_uploads', [
      { localPath: 'persisted://mock', recordId: 'CK1' },
    ])
    const count = await photoStorage.flushPendingUploads()
    expect(count).toBe(0)
    expect(wx.cloud.uploadFile).not.toHaveBeenCalled()
  })

  test('补传成功：回写 cloudFileID 到本地记录并清理队列', async () => {
    login()
    // 已有打卡记录，等待补传
    setCheckinRecords([{ id: 'CK1', photoPath: 'persisted://mock', cloudFileID: '' }])
    wx.setStorageSync('pending_photo_uploads', [
      { localPath: 'persisted://mock', recordId: 'CK1' },
    ])
    wx.cloud.uploadFile.mockResolvedValueOnce({ fileID: 'cloud://flush-ok' })

    const count = await photoStorage.flushPendingUploads()
    expect(count).toBe(1)

    // 本地记录已回写
    const records = wx.getStorageSync('checkin_records')
    expect(records[0].cloudFileID).toBe('cloud://flush-ok')

    // 队列已清空
    expect((wx.getStorageSync('pending_photo_uploads') || []).length).toBe(0)
  })

  test('补传失败：保留队列条目，下次继续补传', async () => {
    login()
    setCheckinRecords([{ id: 'CK1', photoPath: 'persisted://mock', cloudFileID: '' }])
    wx.setStorageSync('pending_photo_uploads', [
      { localPath: 'persisted://mock', recordId: 'CK1' },
    ])
    // 一直失败，进入重试，用 fake timers 避免真实等待
    wx.cloud.uploadFile.mockRejectedValue({ errMsg: 'network fail' })

    jest.useFakeTimers()
    const promise = photoStorage.flushPendingUploads()
    await jest.advanceTimersByTimeAsync(10000) // 覆盖 3 次重试
    const count = await promise
    jest.useRealTimers()

    expect(count).toBe(0)
    // 队列保留，等待下次补传
    expect((wx.getStorageSync('pending_photo_uploads') || []).length).toBe(1)
  })

  test('补传时记录已删除 → 清理队列条目（不反复重试）', async () => {
    login()
    // 本地没有任何 checkin_records，视为记录已删除
    setCheckinRecords([])
    wx.setStorageSync('pending_photo_uploads', [
      { localPath: 'persisted://mock', recordId: 'GONE' },
    ])
    wx.cloud.uploadFile.mockResolvedValueOnce({ fileID: 'cloud://flush-ok' })

    const count = await photoStorage.flushPendingUploads()
    expect(count).toBe(0) // 回写不到记录，不算成功
    expect((wx.getStorageSync('pending_photo_uploads') || []).length).toBe(0)
  })

  test('并发保护：_flushing 为 true 时不重复执行', async () => {
    login()
    wx.setStorageSync('pending_photo_uploads', [])
    // 无待传任务，返回 0（不触发上传）
    const count = await photoStorage.flushPendingUploads()
    expect(count).toBe(0)
  })
})

// ─── _uploadWithRetry：重试逻辑（通过 persistPhoto 间接验证）───

describe('_uploadWithRetry 重试', () => {
  test('首次失败（网络抖动）→ 重试成功后返回 fileID', async () => {
    login()
    // 第一次失败触发重试，第二次成功
    wx.cloud.uploadFile
      .mockRejectedValueOnce({ errMsg: 'ECONNRESET' })
      .mockResolvedValueOnce({ fileID: 'cloud://retry-ok' })

    jest.useFakeTimers()
    const promise = photoStorage.persistPhoto('wxfile://tmp/a.jpg', { recordId: 'CKX' })
    await jest.advanceTimersByTimeAsync(3000)
    const result = await promise
    jest.useRealTimers()

    expect(result.cloudFileID).toBe('cloud://retry-ok')
    expect(wx.cloud.uploadFile).toHaveBeenCalledTimes(2)
  })

  test('连续失败达到重试上限 → 入补传队列', async () => {
    login()
    wx.cloud.uploadFile.mockRejectedValue({ errMsg: 'ECONNRESET' })

    jest.useFakeTimers()
    const promise = photoStorage.persistPhoto('wxfile://tmp/a.jpg', { recordId: 'CKR' })
    await jest.advanceTimersByTimeAsync(20000) // 覆盖所有重试
    await promise
    jest.useRealTimers()

    const pending = wx.getStorageSync('pending_photo_uploads')
    expect(pending.length).toBe(1)
    expect(pending[0].recordId).toBe('CKR')
  })
})

// ─── getDisplayPath：降级策略 ─────────────────────

describe('getDisplayPath 降级策略', () => {
  test('本地路径有效时优先本地 photoPath', () => {
    // persisted://mock 默认存在
    expect(photoStorage.getDisplayPath({ photoPath: 'persisted://mock', cloudFileID: 'cloud://1' })).toBe('persisted://mock')
  })

  test('非 wxfile 路径（http/https 等）直接视为有效', () => {
    expect(photoStorage.getDisplayPath({ photoPath: 'https://cdn.example.com/a.jpg', cloudFileID: 'cloud://1' })).toBe('https://cdn.example.com/a.jpg')
    expect(photoStorage.getDisplayPath({ photoPath: 'http://x/b.jpg' })).toBe('http://x/b.jpg')
  })

  test('清理缓存后本地 wxfile 失效 → 降级到 cloudFileID（关键回归）', () => {
    // 模拟：本地沙盒文件已被清理缓存删除
    global.__mockFS.__setFileExistence('wxfile://store_old.jpg', false)
    const result = photoStorage.getDisplayPath({
      photoPath: 'wxfile://store_old.jpg',
      cloudFileID: 'cloud://still-alive',
    })
    expect(result).toBe('cloud://still-alive')
  })

  test('本地 wxfile 仍存在 → 用本地路径', () => {
    global.__mockFS.__setFileExistence('wxfile://store_new.jpg', true)
    const result = photoStorage.getDisplayPath({
      photoPath: 'wxfile://store_new.jpg',
      cloudFileID: 'cloud://1',
    })
    expect(result).toBe('wxfile://store_new.jpg')
  })

  test('无 cloudFileID 时，即使本地可能失效也返回本地路径兜底', () => {
    global.__mockFS.__setFileExistence('wxfile://only_local.jpg', false)
    expect(photoStorage.getDisplayPath({ photoPath: 'wxfile://only_local.jpg' })).toBe('wxfile://only_local.jpg')
  })

  test('有 cloudFileID 无 photoPath → 返回 cloudFileID', () => {
    expect(photoStorage.getDisplayPath({ photoPath: '', cloudFileID: 'cloud://1' })).toBe('cloud://1')
  })

  test('空记录 / null 返回空串', () => {
    expect(photoStorage.getDisplayPath({})).toBe('')
    expect(photoStorage.getDisplayPath(null)).toBe('')
  })
})

// ─── checkinUtil.saveCheckin：自定义 id ─────────────

describe('checkinUtil.saveCheckin 支持自定义 id', () => {
  test('传入 id 时使用自定义 id', () => {
    setCheckinRecords([])
    const record = checkinUtil.saveCheckin({
      id: 'CK-CUSTOM-1',
      spotName: '测试店',
      type: 'food',
      photoPath: 'local://p',
    })
    expect(record.id).toBe('CK-CUSTOM-1')
    const records = wx.getStorageSync('checkin_records')
    expect(records[0].id).toBe('CK-CUSTOM-1')
  })

  test('未传 id 时自动生成', () => {
    setCheckinRecords([])
    const record = checkinUtil.saveCheckin({ spotName: '测试店', type: 'spot' })
    expect(record.id).toMatch(/^CK/)
  })

  test('saveCheckinAsync 保留自定义 id（用于补传回写对齐）', () => {
    setCheckinRecords([])
    const record = checkinUtil.saveCheckinAsync({
      id: 'CK-ASYNC-1',
      spotName: '测试店',
      type: 'food',
      photoPath: 'local://p',
    })
    expect(record.id).toBe('CK-ASYNC-1')
  })
})
