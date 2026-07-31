const path = require('path')

// rootDir 设为项目根目录（即 __tests__ 的父目录）
const projectRoot = path.resolve(__dirname, '..')

module.exports = {
  testEnvironment: 'node',
  rootDir: projectRoot,
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.js'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
  setupFiles: [path.resolve(projectRoot, '__tests__', 'setup.js')],
  verbose: true,
}
