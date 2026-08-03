// Jest setup — 注入全局 wx 对象，使 DAL 模块中的 wx.cloud.database() 可用

const { createMockDB } = require('./db/helpers/mockDB')

// 创建可复用的 mock DB 实例
const mockDB = createMockDB()

// ─── 内存版本地存储 mock ─────────────────────────────
// util.js 的 loadData/saveData 依赖 wx.getStorageInfoSync / getStorageSync /
// setStorageSync，新增的 photoStorage / routeDataUtil 测试均依赖本地存储。
// 用内存 Map 实现，测试间通过 __resetStorage() 隔离。
const storageMap = new Map()

const mockStorage = {
  getStorageSync: jest.fn((key) => {
    return storageMap.has(key) ? storageMap.get(key) : ''
  }),
  setStorageSync: jest.fn((key, value) => {
    storageMap.set(key, value)
  }),
  removeStorageSync: jest.fn((key) => {
    storageMap.delete(key)
  }),
  getStorageInfoSync: jest.fn(() => ({
    keys: Array.from(storageMap.keys()),
    currentSize: 0,
    limitSize: 10240,
  })),
  // 测试辅助：清空存储
  __resetStorage() {
    storageMap.clear()
  },
}

// ─── fs mock ────────────────────────────────────────
// saveFile 回调式，返回持久化路径
const mockFS = {
  saveFile: jest.fn(({ success }) => {
    if (typeof success === 'function') success({ savedFilePath: 'persisted://mock' })
  }),
}

global.wx = {
  cloud: {
    database: jest.fn(() => mockDB),
    uploadFile: jest.fn(() => Promise.resolve({ fileID: 'cloud://mock-file' })),
  },
  getFileSystemManager: jest.fn(() => mockFS),
  // 本地存储
  getStorageSync: mockStorage.getStorageSync,
  setStorageSync: mockStorage.setStorageSync,
  removeStorageSync: mockStorage.removeStorageSync,
  getStorageInfoSync: mockStorage.getStorageInfoSync,
  // 图片压缩（photoStorage 用到，默认不改路径）
  compressImage: jest.fn(({ src, success }) => {
    if (typeof success === 'function') success({ tempFilePath: src })
  }),
}

// 用 globalThis 确保全局标识符可访问（Node 12+）
if (typeof globalThis !== 'undefined') {
  globalThis.wx = global.wx
}

// 让每个测试文件可以访问 mockDB / mockFS / mockStorage（用于断言）
global.__mockDB = mockDB
global.__mockFS = mockFS
global.__mockStorage = mockStorage
