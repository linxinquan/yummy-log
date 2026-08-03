// subpackages/checkin/utils/photoStorage.js
// 复用主包权威版本，避免重复维护同一套上传逻辑。
// 统一具备：压缩上传、失败自动重试、离线补传队列。
module.exports = require('../../../utils/photoStorage')
