// 觅食图 - 我的页面 v5.1 觅食迹版
const app = getApp()
const placesData = require('../../utils/placesData')
const util = require('../../utils/util')
const { DEFAULT_COVER_POOL } = require('../../config/cover-pool')
const { getCheckinStats, getCheckins } = require('../../utils/checkinUtil')


// 登录用户没有上传头像时，随机从美食 / 景点封面里挑一张，避免回退到项目 Logo。
function getRandomProfileImage() {
  const imagePool = DEFAULT_COVER_POOL

  if (!imagePool.length) {
    return '/images/app-logo.jpg'
  }
  const randomIndex = Math.floor(Math.random() * imagePool.length)
  
  return imagePool[randomIndex]
}

Page({
  data: {
    // 登录状态
    isLoggedIn: false,
    nickName: '',
    avatarUrl: '', // 登录后没有自定义头像时，使用随机美食 / 景点图
    hasNickname: false, // 是否有昵称
    hasAvatar: false,   // 是否选择了头像

    // 用户信息
    userInfo: {
      nickName: '',
      avatarUrl: '',
      uid: '',
      level: '',
      isVip: false,
      visits: 0
    },

    // 统计数据
    stats: {
      likedCount: 0,
      visitedCount: 0,
      userAddedCount: 0
    },

    // 列表数据
    currentTab: 'liked',
    likedShops: [],
    visitedList: [],
    userAddedShops: [],

    // 当前行政区划
    currentDistrict: '南山区',  // 默认值，等待定位更新
    currentCity: '深圳市',

    // 天气信息
    weatherIcon: '☀️',
    weatherTemp: '25°C',

    // 打卡采集统计
    checkinStats: { totalCount: 0, cityCount: 0 },

    // 采集展示
    latestStamp: null,
    recentStamps: [],

    // 深圳地图打卡点
    mapCenter: { latitude: 22.543099, longitude: 114.057868 },
    mapMarkers: []
  },

  // 页面初始化：加载用户信息、统计数据、行政区和天气。
  onLoad() {
    this.loadUserInfo()
    this.loadData()
    // 首屏就刷新采集统计，避免第一次进入数字为空
    this.loadCheckinStats()
    // 获取行政区划信息
    this.loadDistrictInfo()
    // 获取天气
    this.loadWeather()
  },

  // 回到页面时重新刷新用户和打卡数据。
  onShow() {
    this.loadUserInfo()
    this.loadData()
    this.loadCheckinStats()
  },

  // 读取打卡统计、最近邮票、地图点位这些"足迹"相关数据。
  loadCheckinStats() {
    try {
      const stats = getCheckinStats()
      const allCheckins = getCheckins()
      // 最新邮票（第一条）
      let latestStamp = null
      if (allCheckins.length > 0) {
        const first = allCheckins[0]
        const d = new Date(first.date)
        latestStamp = {
          ...first,
          dateStr: `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
        }
      }

      // 近期邮票（最多6条）
      const recentStamps = allCheckins.slice(0, 6).map(c => {
        const d = new Date(c.date)
        return {
          ...c,
          shortDate: `${d.getMonth()+1}/${d.getDate()}`,
          dateStr: `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
        }
      })

      // 地图打卡点：只用有坐标的采集记录
      const mapMarkers = []
      allCheckins.forEach((c) => {
        if (c.latitude && c.longitude) {
          const marker = {
            id: c.id,
            latitude: c.latitude,
            longitude: c.longitude,
            width: 36,
            height: 36,
            callout: {
              content: c.spotName || '采集点',
              color: '#ffffff',
              fontSize: 11,
              borderRadius: 6,
              padding: 4,
              display: 'BYCLICK',
              bgColor: '#FF8B7E',
              textAlign: 'center'
            }
          }
          mapMarkers.push(marker)
        }
      })

      // 地图中心：取所有打卡点的边界中心，无数据时默认深圳
      let mapCenter = { latitude: 22.543099, longitude: 114.057868 }
      if (mapMarkers.length > 0) {
        const lats = mapMarkers.map(m => m.latitude)
        const lngs = mapMarkers.map(m => m.longitude)
        mapCenter = {
          latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
          longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2
        }
      }

      this.setData({
        checkinStats: {
          totalCount: stats.totalCount || 0,
          cityCount: stats.cityCount || 0
        },
        latestStamp,
        recentStamps,
        mapMarkers,
        mapCenter
      })
    } catch (e) {
      console.warn('getCheckinStats 失败:', e)
    }
  },

  // 读取定位后的城市和区信息
  loadDistrictInfo() {
    app.whenDistrictReady((info) => {
      this.setData({
        currentDistrict: info.district,
        currentCity: info.city
      })
      // 区划更新后重新获取天气
      this.loadWeather()
    })
  },

  // 读取当前定位对应的天气信息。
  loadWeather() {
    const location = app.globalData.location
    if (!location) return
    
    // 使用和风天气API（免费版）
    wx.request({
      url: 'https://devapi.qweather.com/v7/weather/now',
      data: {
        location: `${Math.round(location.lng * 100) / 100},${Math.round(location.lat * 100) / 100}`,
        key: '6e62e8e03d5e4e7ebc4e95e9e7e0a5e5'  // 和风天气API Key
      },
      success: (res) => {
        if (res.data && res.data.code === '200') {
          const now = res.data.now
          const iconMap = {
            '100': '☀️', '101': '☁️', '102': '⛅', '103': '🌤️',
            '104': '☁️', '200': '🌬️', '201': '🌬️', '202': '🌬️',
            '300': '🌦️', '301': '🌧️', '302': '⛈️', '303': '🌨️',
            '304': '❄️', '305': '🌧️', '306': '🌧️', '307': '🌨️',
            '308': '🌨️', '309': '🌧️', '310': '🌧️', '311': '🌧️',
            '312': '⛈️', '313': '⛈️', '314': '🌧️', '315': '🌧️',
            '316': '🌨️', '317': '🌨️', '318': '🌨️', '400': '🌙',
            '401': '☁️', '402': '🌨️', '403': '❄️', '404': '❄️',
            '405': '🌨️', '406': '🌨️', '407': '❄️', '408': '❄️',
            '409': '🌨️', '410': '❄️', '456': '🌧️', '457': '🌨️'
          }
          this.setData({
            weatherIcon: iconMap[now.icon] || '🌡️',
            weatherTemp: now.temp + '°C'
          })
        }
      },
      fail: () => {
        // 静默失败，保持默认天气
      }
    })
  },

  // 从本地缓存读取登录用户信息。
  loadUserInfo() {
    const userInfo = util.loadData('userInfo', null)
    if (userInfo) {
      // 兼容历史账号：如果之前没有头像，就补一张随机封面并写回缓存。
      const fallbackAvatar = userInfo.avatarUrl || getRandomProfileImage()
      const nextUserInfo = userInfo.avatarUrl
        ? userInfo
        : Object.assign({}, userInfo, { avatarUrl: fallbackAvatar })

      if (!userInfo.avatarUrl) {
        util.saveData('userInfo', nextUserInfo)
      }

      this.setData({
        isLoggedIn: true,
        userInfo: nextUserInfo,
        nickName: nextUserInfo.nickName,
        avatarUrl: fallbackAvatar
      })
    } else {
      this.setData({
        isLoggedIn: false,
        userInfo: {},
        nickName: '',
        avatarUrl: ''
      })
    }
  },

  // 快速登录：当前项目里先用一份默认账号，方便体验流程。
  onQuickLogin() {
    const defaultAvatar = this.data.avatarUrl || getRandomProfileImage()
    const userInfo = {
      uid: 'MS' + Date.now().toString(36).toUpperCase(),
      nickName: this.data.nickName || '觅食者',
      avatarUrl: defaultAvatar,
      phone: '',
      level: 'Lv.1 入门吃货',
      isVip: false,
      visits: this.data.stats.visitedCount || 0,
      days: 1,
      createdAt: new Date().toISOString()
    }

    util.saveData('userInfo', userInfo)
    
    this.setData({
      isLoggedIn: true,
      userInfo: userInfo,
      avatarUrl: defaultAvatar
    })

    wx.showToast({ 
      title: '登录成功', 
      icon: 'success',
      duration: 2000
    })
  },

  // 未登录时点击顶部头像区域，直接触发快速登录。
  onShowLogin() {
    if (this.data.isLoggedIn) {
      return
    }
    const defaultAvatar = getRandomProfileImage()
    // 点击登录，直接调用快速登录（为了方便测试体验，目前直接生成默认账号）
    this.setData({
      nickName: '觅食者',
      avatarUrl: defaultAvatar,
      hasNickname: true,
      hasAvatar: true
    })
    this.onQuickLogin()
  },

  // 点击顶部资料区：未登录走登录，已登录走资料编辑。
  onTapUserProfile() {
    if (!this.data.isLoggedIn) {
      this.onShowLogin()
      return
    }
    this.onEditProfile()
  },

  // 已登录后点击资料区：可改昵称或退出登录。
  onEditProfile() {
    wx.showActionSheet({
      itemList: ['修改昵称', '退出登录'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0: // 修改昵称
            this.showEditNickname()
            break
          case 1: // 退出登录
            this.onLogout()
            break
        }
      }
    })
  },

  // 弹出昵称编辑框，并把结果写回缓存。
  showEditNickname() {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      success: (res) => {
        if (res.confirm && res.content) {
          const userInfo = this.data.userInfo
          userInfo.nickName = res.content.trim()
          util.saveData('userInfo', userInfo)
          this.setData({ 
            nickName: userInfo.nickName,
            userInfo: userInfo
          })
          wx.showToast({ title: '修改成功', icon: 'success' })
        }
      }
    })
  },

  // 退出登录，但不清掉历史打卡等业务数据。
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态（保留觅食记录数据）
          util.saveData('userInfo', null)
          this.setData({
            isLoggedIn: false,
            nickName: '',
            avatarUrl: '',
            hasNickname: false,
            hasAvatar: false,
            userInfo: {},
            showUserMenu: false
          })
          wx.showToast({ title: '已退出登录', icon: 'none' })
        }
      }
    })
  },

  // 我的页快捷入口：收藏、我的发布、设置、分享等。
  onMenuTap(e) {
    const type = e.currentTarget.dataset.type
    
    if (type === 'favorites') {
      // 跳转到我的收藏页面
      wx.navigateTo({ url: '/subpackages/extra/pages/my-favorites/my-favorites' })
      return
    }
    
    if (type === 'guides') {
      // 跳转到我的攻略页面
      wx.navigateTo({ url: '/subpackages/guide/pages/my-guides/my-guides' })
      return
    }
    
    if (type === 'settings') {
      wx.showToast({ title: '设置', icon: 'none' })
      return
    }
    
    if (type === 'share') {
      wx.showToast({ title: '分享我们', icon: 'none' })
      return
    }
  },

  // 读取"想去 / 到访 / 自己添加的地点"等统计数据。
  loadData() {
    const userAddedShops = util.loadData('userAddedShops', [])
    const allItems = [...placesData.getAllPlaces(), ...userAddedShops]
    const itemMap = {}
    allItems.forEach(item => {
      itemMap[String(item.id)] = item
    })

    // 新格式：userWantList 存储所有想去的 ID（美食+景点）
    const wantIds = util.getWantList()
    const likedShops = wantIds
      .map(id => {
        // 先查 placesData（美食+景点）
        let place = placesData.getPlaceById(id)
        // 如果找不到，再查用户自己添加的店铺
        if (!place) {
          place = userAddedShops.find(s => String(s.id) === String(id))
        }
        return place
      })
      .filter(Boolean)  // 过滤掉找不到的数据（防护数据不一致）
      .map(item => ({
        ...item,
        // 确保有 type 字段（美食或景点）
        type: item.type || (item.category === '景点' || item.category === '公园' ? 'spot' : 'food')
      }))

    const footprintItems = util.getFootprintItems()
    const visitedList = footprintItems.map(item => ({
      shopId: item.id,
      shop: itemMap[String(item.id)] || item,
      data: {
        dateStr: item.checkedInAt
          ? new Date(item.checkedInAt).toLocaleDateString('zh-CN')
          : '已标记到访'
      }
    }))
    
    this.setData({
      likedShops,
      visitedList,
      userAddedShops,
      stats: {
        likedCount: likedShops.length,
        visitedCount: visitedList.length,
        userAddedCount: userAddedShops.length
      }
    })

    // 更新用户觅食次数
    if (this.data.isLoggedIn) {
      const userInfo = this.data.userInfo
      userInfo.visits = visitedList.length
      util.saveData('userInfo', userInfo)
      this.setData({ userInfo })
    }
  },

  // 跳到采集本页面。
  onGoCollection() {
    wx.navigateTo({ url: '/subpackages/extra/pages/collection/collection' })
  }

})
