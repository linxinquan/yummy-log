// utils/checkinUtil.js - 打卡采集数据层
// 腾讯地图逆地理接口（直接用 wx.request，无需 SDK 文件）
const util = require('./util')

// ─── 云端数据访问层（懒加载）────────────────────
let _dbCheckinRecords = null

function _getDbCheckinRecords() {
  if (!_dbCheckinRecords) _dbCheckinRecords = require('./db/checkinRecords')
  return _dbCheckinRecords
}

/**
 * 判断当前是否已登录（云端模式）
 * @returns {boolean}
 */
function _isCloudMode() {
  return util.isCloudMode()
}

const QQMAP_KEY = 'SWGBZ-7P2CB-LK2UO-JZYYV-6BZYQ-KEBUG'

/**
 * 逆地理编码：坐标 → 景点名 + 详细地址
 * 腾讯地图 WebService API v1
 *
 * 筛选策略：
 * 1. 初筛：从 POI 列表中按类别/距离筛选候选
 * 2. 进一步筛：用 reject_patterns 过滤无意义名称
 * 3. 兜底策略：使用 formatted_addresses.recommend 或地址文本
 */
function reverseGeocode(latitude, longitude) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      data: {
        location: latitude + ',' + longitude,
        key: QQMAP_KEY,
        get_poi: 1,
        poi_options: 'address_format=short;radius=3000;policy=5;orderby=_distance',
        added_fields: 'is_aoi'
      },
      header: {
        'Referer': 'https://meitour.app'   // 腾讯地图 WebService API 要求
      },
      success: (res) => {
        console.log('[checkinUtil] 逆地理响应 statusCode:', res.statusCode)
        if (res.statusCode === 200) {
          const data = res.data
          if (data.status === 0) {
            const result = data.result || {}
            const pois = result.pois || []
            console.log('pois-5', pois)

            // ── 多级筛选 ──

            // 【第一级】初筛：按类别偏好排序，提取候选列表
            // 社交签到场景(policy=4)已按热度+距离排序，这里只做分类加权
            const categoryPriority = [
              /美食|小吃|餐厅|火锅|烧烤|快餐|面馆|粥店|甜品|咖啡|茶饮|酒吧|酒楼/,
              /街|巷|城|广场|市场|农庄|农贸市场|步行街|美食街|夜市/,
              /景区|公园|博物馆|美术馆|寺庙|教堂|景点|名胜|河/,
              /商场|购物中心|百货|超市|mall/i,
              /酒店|宾馆|民宿|公寓/
            ]
            const sortedPOIs = [...pois].sort((a, b) => {
              let scoreA = 0, scoreB = 0
              const catA = (a.category || '').toLowerCase()
              const catB = (b.category || '').toLowerCase()
              categoryPriority.forEach((pattern, idx) => {
                if (pattern.test(catA)) scoreA += (categoryPriority.length - idx)
                if (pattern.test(catB)) scoreB += (categoryPriority.length - idx)
              })
              return scoreB - scoreA
            })

            // 【第二级】进一步筛：reject_patterns 过滤无意义名称
            // 只丢弃真正没辨识度的地址片段，保留大楼/商场等有意义的地标名
            const rejectPatterns = [
              /路\d+号/,           // xx路xx号
              /弄\d+号/,           // 弄堂号
              /街道/,
              /小区/, /村\d+号/, /号楼/, /单元/,
              /公司/, /有限公司/, /办事处/,
              /加油站/, /停车场/,
              /厕所/, /卫生间/
            ]
            const isRejectName = (name) => {
              if (!name) return true
              const n = name.trim()
              if (n.length < 2) return true
              return rejectPatterns.some(p => p.test(n))
            }

            const candidatePOIs = sortedPOIs.filter(p => !isRejectName(p.title || p.name))

            // 从候选 POI 中取最优名称
            let spotName = ''
            if (candidatePOIs.length > 0) {
              spotName = candidatePOIs[0].title || candidatePOIs[0].name
            }

            // 【第三级兜底】用腾讯推荐精地址
            if (!spotName || isRejectName(spotName)) {
              spotName = ''
              if (result.formatted_addresses) {
                const rec = result.formatted_addresses.recommend
                if (rec && !isRejectName(rec)) spotName = rec
              }
            }

            const city = result.ad_info ? result.ad_info.city : extractCity(result.address || '')

            console.log('[checkinUtil] 解析结果 - spotName:', spotName, '| address:', result.address, ' | candidatePOIs:', candidatePOIs)

            resolve({
              spotName: spotName,
              address: result.address || '',
              district: result.ad_info ? result.ad_info.district : '',
              city: city,
              addressComponent: result.address_component ? {
                province: result.address_component.province || '',
                city: result.address_component.city || '',
                district: result.address_component.district || '',
                street: result.address_component.street || '',
                street_number: result.address_component.street_number || ''
              } : null,
              candidates: candidatePOIs.map(p => ({
                name: p.title || p.name,
                address: p.address || ''
              }))
            })
          } else {
            console.error('[checkinUtil] 逆地理状态码错误:', data.status, data.message)
            reject(new Error('逆地理编码失败: ' + (data.message || '状态码' + data.status)))
          }
        } else {
          reject(new Error('请求失败: ' + res.statusCode))
        }
      },
      fail: (err) => {
        console.error('>>> 逆地理请求失败:', err)
        reject(new Error('网络请求失败，请检查手机网络设置'))
      }
    })
  })
}

/**
 * 提取城市名
 */
function extractCity(address) {
  if (!address) return '广州'
  const match = address.match(/([^省市区县]+?[市])/)
  return match ? match[1] : '广州'
}

/**
 * 获取打卡采集列表
 */
function getCheckins() {
  // 先做一次历史数据清理，把以前误写进采集里的足迹迁出去。
  util.migrateLegacyFootprintsFromCheckins()
  return wx.getStorageSync('checkin_records') || []
}

/**
 * 保存打卡采集
 */
function saveCheckin(data) {
  const checkins = getCheckins()
  const matchedPlace = util.findKnownPlace({
    name: data.spotName,
    address: data.address,
    type: data.type
  }, data.type)
  const checkin = {
    id: 'CK' + Date.now().toString(36).toUpperCase(),
    type: data.type || 'food',       // 'food' 美食 | 'spot' 景点
    photoPath: data.photoPath,
    cloudFileID: data.cloudFileID || '',    // 云端 fileID，用于跨设备降级
    spotName: data.spotName || '',
    address: data.address || '',
    latitude: data.latitude,
    longitude: data.longitude,
    description: data.description || generateDescription(data.spotName, data.address, data.type),
    // 允许确认页把用户编辑后的记录时间一起保存。
    date: data.date || new Date().toISOString(),
    customRecordTimeLabel: data.customRecordTimeLabel || '',
    city: extractCity(data.address),
    // 如果这条采集能匹配到系统里的真实地点，就顺手记下它的 id，
    // 后面"足迹 / 已去过 / 详情跳转"都能更稳定地复用。
    relatedPlaceId: matchedPlace ? String(matchedPlace.id) : ''
  }
  checkins.unshift(checkin)
  wx.setStorageSync('checkin_records', checkins)
  util.syncLegacyCheckedInFromRecords()
  return checkin
}

/**
 * 更新打卡采集
 */
function updateCheckin(id, patchData) {
  const checkins = getCheckins()
  const nextCheckins = checkins.map(item => {
    if (String(item.id) !== String(id)) return item

    return {
      ...item,
      ...patchData,
      id: item.id
    }
  })
  wx.setStorageSync('checkin_records', nextCheckins)
  util.syncLegacyCheckedInFromRecords()
  return nextCheckins.find(item => String(item.id) === String(id)) || null
}

/**
 * 删除打卡采集
 */
function deleteCheckin(id) {
  const checkins = getCheckins()
  const filtered = checkins.filter(c => c.id !== id)
  wx.setStorageSync('checkin_records', filtered)
  util.syncLegacyCheckedInFromRecords()
  return filtered
}

/**
 * 获取用户打卡统计
 */
function getCheckinStats() {
  const checkins = getCheckins()
  const cities = new Set()
  const places = new Set()
  let spotCount = 0
  let foodCount = 0
  checkins.forEach(c => {
    if (c.city) cities.add(c.city)
    if (c.spotName) places.add(c.spotName)
    if (c.type === 'spot') spotCount++
    if (c.type === 'food') foodCount++
  })
  return {
    totalCount: checkins.length,
    cityCount: cities.size,
    visitedCount: places.size,
    spotCount,
    foodCount
  }
}

/**
 * 生成AI描述（本地兜底版本，诗意风格）
 * @param {string} locationName - 地点名称
 * @param {string} address - 详细地址
 */
function generateDescription(locationName, address) {
  const hour = new Date().getHours()
  const name = locationName || '某处'
  
  const templates = [
    `${hour < 12 ? '清晨的光影' : hour < 18 ? '午后的斜阳' : '暮色渐起'}落在${name}，城市的喧哗在这里忽然安静下来。`,
    `${name}有一种让人慢下来的力量，像一帧被按下暂停键的画面。`,
    `${hour < 12 ? '早晨' : hour < 18 ? '下午' : '入夜'}走进${name}，发现了这座城市另一面的故事。`,
    `${hour < 12 ? '清晨路过' : hour < 14 ? '午间探访' : hour < 18 ? '午后闲逛' : '傍晚觅食'}${name}，香气从路口就能捕捉到。`,
    `${name}的出品有惊喜，汤头清澈、鲜味却浓，胃里落定，心里也暖了起来。`,
    `${hour < 12 ? '早餐' : hour < 14 ? '午餐' : hour < 18 ? '下午茶' : '晚餐'}时光，${name}的一口，是认真生活的证据。`
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}

/**
 * 格式化日期为邮票样式
 */
function formatStampDate(isoString) {
  const d = new Date(isoString)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return mm + '/' + dd + '/' + yyyy
}

// ============================================================
// 云端异步版（已登录走云端，未登录走本地）
// ============================================================

/**
 * 获取打卡记录列表（纯本地）
 * @returns {Array}
 */
function getCheckinsAsync() {
  return getCheckins()
}

/**
 * 保存打卡记录（本地优先 + 后台同步）
 * @param {Object} data - 打卡数据
 * @returns {Object} 保存后的记录
 */
function saveCheckinAsync(data) {
  // 1. 立即写本地（零等待）
  const record = saveCheckin(data)

  // 2. 后台推云端（fire-and-forget）
  if (_isCloudMode() && record) {
    _getDbCheckinRecords().add(data).then(res => {
      if (res.success && res.data) {
        // 用云端 _id 更新本地记录
        updateCheckin(record.id, { _id: res.data })
      }
    }).catch(err => {
      console.warn('[checkinUtil] 云端保存失败，数据已在本地:', err)
    })
  }

  return record
}

/**
 * 更新打卡记录（本地优先 + 后台同步）
 * @param {string} id  - 记录 id
 * @param {Object} patchData - 要更新的字段
 * @returns {Object|null}
 */
function updateCheckinAsync(id, patchData) {
  // 1. 立即更新本地
  const result = updateCheckin(id, patchData)

  // 2. 后台推云端
  if (_isCloudMode()) {
    _getDbCheckinRecords().update(id, patchData).catch(err => {
      console.warn('[checkinUtil] 云端更新失败，数据已在本地:', err)
    })
  }

  return result
}

/**
 * 删除打卡记录（本地优先 + 后台同步）
 * @param {string} id - 记录 id
 * @returns {Array} 删除后的列表
 */
function deleteCheckinAsync(id) {
  // 1. 立即删除本地
  const filtered = deleteCheckin(id)

  // 2. 后台推云端
  if (_isCloudMode()) {
    _getDbCheckinRecords().remove(id).catch(err => {
      console.warn('[checkinUtil] 云端删除失败，本地已删除:', err)
    })
  }

  return filtered
}

/**
 * 获取打卡统计（纯本地）
 * @returns {Object}
 */
function getCheckinStatsAsync() {
  return getCheckinStats()
}

// ─── 导出 ─────────────────────────────────────

module.exports = {
  getCheckins,
  saveCheckin,
  updateCheckin,
  deleteCheckin,
  getCheckinStats,
  reverseGeocode,
  generateDescription,
  formatStampDate,
  // 云端异步版
  getCheckinsAsync,
  saveCheckinAsync,
  updateCheckinAsync,
  deleteCheckinAsync,
  getCheckinStatsAsync,
}
