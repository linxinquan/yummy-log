// utils/checkinUtil.js - 打卡采集数据层
// 腾讯地图逆地理接口（直接用 wx.request，无需 SDK 文件）

const QQMAP_KEY = 'SWGBZ-7P2CB-LK2UO-JZYYV-6BZYQ-KEBUG'

/**
 * 逆地理编码：坐标 → 景点名 + 详细地址
 * 腾讯地图 WebService API v1
 */
function reverseGeocode(latitude, longitude) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      data: {
        location: latitude + ',' + longitude,
        key: QQMAP_KEY,
        get_poi: 1,
        poi_options: 'policy=2;radius=1000'
      },
      header: {
        'Referer': 'https://meitour.app'   // 腾讯地图 WebService API 要求
      },
      success: (res) => {
        console.log('[checkinUtil] 逆地理响应 statusCode:', res.statusCode, 'data:', JSON.stringify(res.data).substring(0, 500))
        if (res.statusCode === 200) {
          const data = res.data
          if (data.status === 0) {
            const result = data.result || {}
            const pois = result.pois || []

            // 取景点名优先级：
            // 1. pois[0].name（最近的POI名称）
            // 2. formatted_addresses.recommend（腾讯推荐地址）
            // 3. formatted_addresses.rough（粗略地址）
            // 4. address_component.pois[0].name
            let spotName = ''
            if (pois.length > 0 && pois[0].name) {
              spotName = pois[0].name
            } else if (result.formatted_addresses && result.formatted_addresses.recommend) {
              spotName = result.formatted_addresses.recommend
            } else if (result.formatted_addresses && result.formatted_addresses.rough) {
              spotName = result.formatted_addresses.rough
            } else if (
              result.address_component &&
              result.address_component.pois &&
              result.address_component.pois[0] &&
              result.address_component.pois[0].name
            ) {
              spotName = result.address_component.pois[0].name
            }

            const city = result.ad_info ? result.ad_info.city : extractCity(result.address || '')

            console.log('>>> 解析结果 - 景点名:', spotName, '地址:', result.address)

            resolve({
              spotName: spotName,
              address: result.address || '',
              district: result.ad_info ? result.ad_info.district : '',
              city: city
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
        // 网络错误或域名白名单问题
        reject(new Error('网络请求失败，请检查手机网络设置'))
      }
    })
  })
}

/**
 * 提取城市名
 */
function extractCity(address) {
  if (!address) return '深圳'
  const match = address.match(/([^省市区县]+?[市])/)
  return match ? match[1] : '深圳'
}

/**
 * 获取打卡采集列表
 */
function getCheckins() {
  return wx.getStorageSync('userCheckins') || []
}

/**
 * 保存打卡采集
 */
function saveCheckin(data) {
  const checkins = getCheckins()
  const checkin = {
    id: 'CK' + Date.now().toString(36).toUpperCase(),
    type: data.type || 'food',       // 'food' 美食 | 'spot' 景点
    photoPath: data.photoPath,
    spotName: data.spotName || '',
    address: data.address || '',
    latitude: data.latitude,
    longitude: data.longitude,
    description: data.description || generateDescription(data.spotName, data.address, data.type),
    date: new Date().toISOString(),
    city: extractCity(data.address)
  }
  checkins.unshift(checkin)
  wx.setStorageSync('userCheckins', checkins)
  return checkin
}

/**
 * 删除打卡采集
 */
function deleteCheckin(id) {
  const checkins = getCheckins()
  const filtered = checkins.filter(c => c.id !== id)
  wx.setStorageSync('userCheckins', filtered)
  return filtered
}

/**
 * 获取用户打卡统计
 */
function getCheckinStats() {
  const checkins = getCheckins()
  const cities = new Set()
  let spotCount = 0
  let foodCount = 0
  checkins.forEach(c => {
    if (c.city) cities.add(c.city)
    if (c.type === 'spot') spotCount++
    if (c.type === 'food') foodCount++
  })
  return {
    totalCount: checkins.length,
    cityCount: cities.size,
    spotCount,
    foodCount
  }
}

/**
 * 生成AI描述（本地模板版本，区分美食/景点）
 * @param {string} locationName - 地点名称
 * @param {string} address - 详细地址
 * @param {string} type - 'food' | 'spot'
 */
function generateDescription(locationName, address, type) {
  const time = new Date()
  const hour = time.getHours()
  const city = extractCity(address)

  if (type === 'spot') {
    // 景点打卡描述
    const spotGreetings = {
      morning: ['清晨的第一缕阳光照在', '早起打卡'],
      noon: ['午间漫游到', '正午时分的'],
      afternoon: ['午后来到', '下午漫步'],
      evening: ['傍晚时分抵达', '夕阳下的'],
      night: ['夜幕降临，华灯初上', '夜晚打卡']
    }
    let period
    if (hour < 9) period = 'morning'
    else if (hour < 14) period = 'noon'
    else if (hour < 18) period = 'afternoon'
    else if (hour < 22) period = 'evening'
    else period = 'night'
    const templates = spotGreetings[period]
    const template = templates[Math.floor(Math.random() * templates.length)]
    return template + (locationName || city + '某景点')
  } else {
    // 美食打卡描述
    const foodGreetings = {
      morning: ['清晨的阳光洒在', '早餐时间打卡', '清晨探访'],
      noon: ['午间来到了', '午餐时间打卡', '中午探访'],
      afternoon: ['下午茶时光在', '午后探访'],
      evening: ['傍晚来到了', '晚餐打卡'],
      night: ['夜宵时间，探访', '夜晚打卡']
    }
    let period
    if (hour < 9) period = 'morning'
    else if (hour < 14) period = 'noon'
    else if (hour < 18) period = 'afternoon'
    else if (hour < 22) period = 'evening'
    else period = 'night'
    const templates = foodGreetings[period]
    const template = templates[Math.floor(Math.random() * templates.length)]
    return template + (locationName || city + '某地')
  }
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

module.exports = {
  getCheckins,
  saveCheckin,
  deleteCheckin,
  getCheckinStats,
  reverseGeocode,
  generateDescription,
  formatStampDate
}
