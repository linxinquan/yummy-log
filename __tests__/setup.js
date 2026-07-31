// Jest setup — 注入全局 wx 对象，使 DAL 模块中的 wx.cloud.database() 可用

const { createMockDB } = require('./db/helpers/mockDB')

// 创建可复用的 mock DB 实例
const mockDB = createMockDB()

// 注入全局 wx 对象（两种方式确保可用）
const mockFS = {
  // 模拟 fs.saveFile：回调式，返回持久化路径
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
}

// 用 globalThis 确保全局标识符可访问（Node 12+）
if (typeof globalThis !== 'undefined') {
  globalThis.wx = global.wx
}

// 让每个测试文件可以访问 mockDB / mockFS（用于断言）
global.__mockDB = mockDB
global.__mockFS = mockFS
