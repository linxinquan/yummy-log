// 觅食图 - 小程序入口
// 版本：V1.1.0（2026-05-22）
// 更新：本地缓存 + 两阶段加载，首屏秒开

const placesData = require('./utils/placesData')

// 子包共用工具（主包显式引用，确保打包进主包 common/vendor chunk）
require('./utils/routeHelper')
require('./utils/map-preview')
require('./utils/mapRouteFetcher')
require('./utils/map-config')

App({
  // 当前版本号（每次发版递增，大版本变更时强制清除缓存）
  currentVersion: '2.0.0',

  globalData: {
    userInfo: null,
    location: null,
    locationReady: false,          // 定位是否已就绪
    locationCallbacks: [],           // 等待定位的回调队列
    centerLocation: {
      lat: 22.5322,
      lng: 113.9558
    },
    // 地图 Key
    qqMapKey: 'SWGBZ-7P2CB-LK2UO-JZYYV-6BZYQ-KEBUG',
    // 百度地图 Key（用于全景图）
    baiduMapKey: 'KuGlOjdoC0kmGUbU1Tw2OQyK6LKQ6gGa',
    // 用户行政区划信息
    districtInfo: {
      city: '广州',      // 城市（不带"市"后缀）
      district: '天河区'   // 区
    },
    // 用户详细位置描述
    locationDesc: '',  // 如 "南山街道" 或 "海上世界附近"
  },

  onLaunch() {
    // 版本记录（用于后续可能的增量迁移，不再强制清除缓存）
    const lastVersion = wx.getStorageSync('app_version');
    if (lastVersion !== this.currentVersion) {
      wx.setStorageSync('app_version', this.currentVersion);
      console.log('[App] 版本已更新：' + (lastVersion || '无') + ' → ' + this.currentVersion);
    }
    
    // ── CloudBase 初始化 ──────────────
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-9grc0ja0405b042a',
        traceUser: true
      })
      console.log('[CloudBase] 初始化完成')
      
      // 实时加载云端数据（后台异步，不阻塞启动）
      placesData.init().catch(err => {
        console.warn('[App] placesData 初始化失败', err)
      })
    }
    // ──────────────────────────────────

    // 启动时获取用户位置
    this.getUserLocation()
  },

  // 小程序切入后台时备份数据到云端
  onHide() {
    const util = require('./utils/util')
    if (util.isCloudMode()) {
      const syncManager = require('./utils/db/syncManager')
      syncManager.pushAll()
    }
  },

  // 强制刷新所有数据（下拉刷新时调用）
  async refreshAllData() {
    try {
      wx.showLoading({ title: '刷新数据中...' })
      await placesData.init(true)
      wx.hideLoading()
    } catch (e) {
      console.error('[App] 数据刷新失败:', e)
      wx.hideLoading()
      wx.showToast({ title: '刷新失败，请重试', icon: 'none' })
      throw e
    }
  },

  // 获取用户位置（返回 Promise）
  getUserLocation() {
    return new Promise((resolve) => {
      // 如果已经有位置信息，直接返回缓存
      if (this.globalData.location && this.globalData.locationReady) {
        console.log('✅ 使用缓存位置', this.globalData.location)
        resolve(this.globalData.location)
        return
      }

      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: (res) => {
          const loc = {
            lat: res.latitude,
            lng: res.longitude,
            accuracy: res.accuracy
          }
          this.globalData.location = loc
          this.globalData.locationReady = true
          console.log('✅ 定位成功', loc)
          // 逆地址解析获取行政区划
          this.reverseGeocode(loc.lat, loc.lng)
          // 通知所有等待回调
          this.globalData.locationCallbacks.forEach(cb => cb(loc))
          this.globalData.locationCallbacks = []
          resolve(loc)
        },
        fail: (err) => {
          console.log('❌ 获取位置失败，使用蛇口中心坐标', err)
          const defaultLoc = this.globalData.centerLocation
          this.globalData.location = defaultLoc
          this.globalData.locationReady = true
          // 使用默认的行政区划
          this.reverseGeocode(defaultLoc.lat, defaultLoc.lng)
          this.globalData.locationCallbacks.forEach(cb => cb(defaultLoc))
          this.globalData.locationCallbacks = []
          resolve(defaultLoc)
        }
      })
    })
  },

  // 逆地址解析：经纬度 → 行政区划 + 详细位置
  reverseGeocode(lat, lng) {
    const key = this.globalData.qqMapKey
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${key}&get_poi=0`
    
    wx.request({
      url: url,
      success: (res) => {
        if (res.data && res.data.status === 0 && res.data.result) {
          const addr = res.data.result.address_component
          const cityRaw = addr.city || '深圳市'
          // 去掉「市/自治州/盟」等后缀，与 districtMap key 保持一致
          const city = cityRaw.replace(/市$|自治州$|盟$/, '')
          const district = addr.district || '南山区'
          const street = addr.street || ''  // 街道
          const street_number = addr.street_number || ''  // 门牌号
          
          // 生成详细位置描述
          let locationDesc = ''
          if (street) {
            // 优先使用街道名
            locationDesc = street.replace(district, '').trim() || district
            if (!locationDesc) locationDesc = district
          } else {
            locationDesc = district
          }
          
          this.globalData.districtInfo = {
            city: city,
            district: district
          }
          this.globalData.locationDesc = locationDesc
          console.log('📍 位置描述:', locationDesc, city, district)
          
          // 通知所有等待区划信息的回调
          if (this.globalData.districtCallbacks) {
            this.globalData.districtCallbacks.forEach(cb => cb(this.globalData.districtInfo, locationDesc))
            this.globalData.districtCallbacks = []
          }
        }
      },
      fail: (err) => {
        console.log('❌ 逆地址解析失败，使用默认区划', err)
        // 使用默认区划
        this.globalData.districtInfo = {
          city: '深圳市',
          district: '南山区'
        }
        this.globalData.locationDesc = '南山区'
      }
    })
  },

  // 等待定位就绪后执行（供各页面调用）
  whenLocationReady(callback) {
    if (this.globalData.locationReady && this.globalData.location) {
      callback(this.globalData.location)
    } else {
      this.globalData.locationCallbacks.push(callback)
    }
  },

  // 等待区划信息就绪后执行
  whenDistrictReady(callback) {
    if (this.globalData.districtInfo && this.globalData.districtInfo.district) {
      callback(this.globalData.districtInfo)
    } else {
      if (!this.globalData.districtCallbacks) {
        this.globalData.districtCallbacks = []
      }
      this.globalData.districtCallbacks.push(callback)
    }
  }
})
