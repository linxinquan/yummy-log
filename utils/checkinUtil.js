// utils/checkinUtil.js - 打卡采集数据层
// 腾讯地图逆地理接口（直接用 wx.request，无需 SDK 文件）

const QQMAP_KEY = 'SWGBZ-7P2CB-LK2UO-JZYYV-6BZYQ-KEBUG'

/**
 * 逆地理编码：坐标 → 景点名 + 详细地址
 * 腾讯地图 WebService API v1
 * @param {number} latitude - 纬度
 * @param {number} longitude - 经度
 * @param {string} checkinType - 打卡类型：'spot' 景点 | 'food' 美食，默认自动筛选
 */
function reverseGeocode(latitude, longitude, checkinType) {
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
        console.log('[checkinUtil] 逆地理响应 statusCode:', res.statusCode)
        if (res.statusCode === 200) {
          const data = res.data
          if (data.status === 0) {
            const result = data.result || {}
            const pois = result.pois || []

            // ── 智能选 POI：优先有辨识度的名称 ──
            const genericPatterns = [
              /^(深圳市|广州市|东莞市|佛山市|珠海市)/,           // 城市前缀
              /^(大楼|大廈|大厦|广场|商场|购物中心|写字楼|商业中心|科技园|工业园|孵化园)$/,
              /公司$/, /中心$/, /基地$/, /园区$/,
              /路\d+号$/, /街道\d+号$/,
              /_\d+$/, /\d+层$/
            ]
            const isGeneric = (name) => {
              if (!name) return true
              const n = name.trim()
              if (n.length < 3) return true
              return genericPatterns.some(p => p.test(n))
            }

            // ── 按打卡类型定义 POI 优先级 ──
            let spotName = ''

            if (pois.length > 0) {
              // 定义各类型对应的关键词（扩大匹配范围）
              const spotKeywords = [
                '风景名胜', '博物馆', '展览馆', '公园', '景点', '广场', '寺庙', '教堂', 
                '纪念馆', '文物', '古迹', '塔', '阁', '楼', '山', '湖', '海', '沙滩', 
                '度假区', '风景区', '休闲', '广场', '文化', '遗址', '雕塑', '图书馆',
                '科技馆', '海洋馆', '动物园', '植物园', '游乐场', '健身', '跑道', '绿道'
              ]
              const foodKeywords = [
                '美食', '小吃', '餐厅', '咖啡', '茶楼', '农庄', '农家乐', '火锅', 
                '烧烤', '面馆', '粥', '粉', '饭店', '酒楼', '食府', '食街', '市场', 
                '农贸市场', '快餐', '烘焙', '奶茶', '饮品', '水果', '甜品', '卤味',
                '烧烤', '日料', '韩料', '西餐', '酒吧', '清吧', '餐吧'
              ]

              // 根据类型筛选 POI
              let targetKeywords = []
              if (checkinType === 'spot') {
                targetKeywords = spotKeywords
              } else if (checkinType === 'food') {
                targetKeywords = foodKeywords
              } else {
                // 自动模式：优先美食，再景点
                targetKeywords = [...foodKeywords, ...spotKeywords]
              }
              console.log(pois)
              // 遍历关键词找匹配 POI（同时检查category和title）
              for (const keyword of targetKeywords) {
                const matchPOI = pois.find(p => {
                  const cat = p.category || ''
                  const title = p.title || p.name || ''
                  const matched = (cat.includes(keyword) || title.includes(keyword)) && !isGeneric(title)
                  return matched
                })
                if (matchPOI) {
                  spotName = matchPOI.title || matchPOI.name
                  console.log(`[checkinUtil] 类型[${checkinType}] 命中[${keyword}]：`, spotName, '|', matchPOI.category)
                  break
                }
              }

              // 如果没找到匹配，按原有逻辑找非通用名
              if (!spotName) {
                for (const p of pois) {
                  const name = p.title || p.name
                  if (!isGeneric(name)) {
                    spotName = name
                    console.log('[checkinUtil] 类型筛选未命中，使用第一个非通用名：', spotName)
                    break
                  }
                }
              }
            }

            // 备选：formatted_addresses（腾讯推荐精地址，精度高于 rough）
            if (!spotName || isGeneric(spotName)) {
              spotName = ''
              if (result.formatted_addresses) {
                const rec = result.formatted_addresses.recommend
                if (rec && !isGeneric(rec)) spotName = rec
              }
            }

            const city = result.ad_info ? result.ad_info.city : extractCity(result.address || '')

            console.log('[checkinUtil] 解析结果 - spotName:', spotName, '| address:', result.address, '| type:', checkinType)

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
  return wx.getStorageSync('checkin_records') || []
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
  wx.setStorageSync('checkin_records', checkins)
  return checkin
}

/**
 * 删除打卡采集
 */
function deleteCheckin(id) {
  const checkins = getCheckins()
  const filtered = checkins.filter(c => c.id !== id)
  wx.setStorageSync('checkin_records', filtered)
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
 * 生成AI描述（本地兜底版本，诗意风格，区分美食/景点）
 * @param {string} locationName - 地点名称
 * @param {string} address - 详细地址
 * @param {string} type - 'food' | 'spot'
 */
function generateDescription(locationName, address, type) {
  const hour = new Date().getHours()
  const name = locationName || '某处'

  if (type === 'spot') {
    const templates = [
      `${hour < 12 ? '清晨的光影' : hour < 18 ? '午后的斜阳' : '暮色渐起'}落在${name}，城市的喧哗在这里忽然安静下来。`,
      `${name}有一种让人慢下来的力量，像一帧被按下暂停键的画面。`,
      `${hour < 12 ? '早晨' : hour < 18 ? '下午' : '入夜'}走进${name}，发现了这座城市另一面的故事。`
    ]
    return templates[Math.floor(Math.random() * templates.length)]
  } else {
    // 美食：聚焦鲜、香、暖，诗意感
    const templates = [
      `${hour < 12 ? '清晨路过' : hour < 14 ? '午间探访' : hour < 18 ? '午后闲逛' : '傍晚觅食'}${name}，香气从路口就能捕捉到。`,
      `${name}的出品有惊喜，汤头清澈、鲜味却浓，胃里落定，心里也暖了起来。`,
      `${hour < 12 ? '早餐' : hour < 14 ? '午餐' : hour < 18 ? '下午茶' : '晚餐'}时光，${name}的一口，是认真生活的证据。`
    ]
    return templates[Math.floor(Math.random() * templates.length)]
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
