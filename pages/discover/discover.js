// 觅食迹 - 发现页
const app = getApp()
const shopData = require('../../utils/shopData')
const util = require('../../utils/util')

Page({
  data: {
    // 攻略推荐轮播
    guideRecommendations: [],
    // 深圳各区
    districts: [
      { name: '南山区' },
      { name: '福田区' },
      { name: '罗湖区' },
      { name: '宝安区' },
      { name: '龙岗区' },
      { name: '龙华区' },
      { name: '盐田区' },
      { name: '光明区' },
      { name: '坪山区' },
      { name: '大鹏新区' }
    ],
    currentDistrict: '南山区',
    // 各区美食攻略
    districtGuides: {},
    currentGuides: [],
    
    // 我的攻略
    myGuides: [],
    
    // 导入弹窗
    showImportModal: false,
    importTab: 'text',
    importText: '',
    
    // 识别结果
    showResultModal: false,
    foundShops: [],
    notFoundShops: [],

    // 当前行政区划
    currentDistrict: '南山区',  // 默认值，等待定位更新
    currentCity: '深圳市',

    // 天气信息
    weatherIcon: '☀️',
    weatherTemp: '25°C'
  },

  onLoad() {
    this.loadGuideRecommendations()
    this.loadDistrictGuides()
    this.loadMyGuides()
    // 获取行政区划信息
    this.loadDistrictInfo()
    // 获取天气
    this.loadWeather()
  },

  onShow() {
    this.loadMyGuides()
  },

  // 加载行政区划信息
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

  // 加载天气信息
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

  onPullDownRefresh() {
    this.loadRecommend()
    wx.stopPullDownRefresh()
  },

  // 加载攻略推荐（精选探店攻略）
  loadGuideRecommendations() {
    const guides = [
      {
        id: 1,
        title: '深圳南山老字号餐厅❗14年+老店真的好吃',
        author: '@大湾区探店王',
        coverImage: '/images/guides/guide_laozihao.jpg.jpg',
        shopCount: 10,
        tag: '老字号',
        shops: ['嘉华小吃', '好好味面馆', '翠湖广东乡下菜', '老字号德记烧腊', '小煵记', '湛记佬海鲜', '蛇口老街鱼仔档', '海燕餐厅', '华洋酒楼', '新高记湛江鸡饭店']
      },
      {
        id: 2,
        title: '深圳蛇口必吃地道老店推荐❗赶紧收藏❗',
        author: '@小胖又饿了',
        coverImage: '/images/guides/guide_shekou_bibei.jpg',
        shopCount: 8,
        tag: '必吃榜',
        shops: ['同兴旺湛江鸡饭店', '嘉华小吃', '益康堂鱼仔码头', '蛇口老街鱼仔档', '冬阴功泰国菜', '原乡车田情', '鹅最好', '百草堂祖传凉茶铺']
      }
    ]
    this.setData({ guideRecommendations: guides })
  },

  // 点击攻略推荐卡片
  onGuideTap(e) {
    const guide = e.currentTarget.dataset.guide
    wx.navigateTo({
      url: `/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}`
    })
  },

  // 加载各区美食攻略
  loadDistrictGuides() {
    const districtGuides = {
      '南山区': [
        {
          id: 'ns_1',
          title: '深圳南山老字号餐厅❗14年+老店',
          author: '@大湾区探店王',
          coverImage: '/images/guides/guide_laozihao.jpg.jpg',
          shopCount: 10,
          tags: ['老字号', '粤菜'],
          desc: '嘉华小吃、好好味面馆、翠湖广东乡下菜等10家南山老字号'
        },
        {
          id: 'ns_2',
          title: '深圳蛇口必吃地道老店推荐',
          author: '@小胖又饿了',
          coverImage: '/images/guides/guide_shekou_bibei.jpg',
          shopCount: 8,
          tags: ['必吃榜', '蛇口'],
          desc: '同兴旺湛江鸡、嘉华小吃、益康堂鱼仔码头等蛇口老店'
        },
        {
          id: 'ns_3',
          title: '南山科技园打工人美食地图',
          author: '@深圳吃货',
          coverImage: '/images/app-logo.jpg',
          shopCount: 12,
          tags: ['科技园', '工作餐'],
          desc: '科技园周边高性价比美食推荐'
        },
        {
          id: 'ns_4',
          title: '南山海上世界美食攻略',
          author: '@探店达人',
          coverImage: '/images/app-logo.jpg',
          shopCount: 6,
          tags: ['海上世界', '西餐'],
          desc: '海上世界周边精品餐厅推荐'
        }
      ],
      '福田区': [
        {
          id: 'ft_1',
          title: '福田CBD商务宴请餐厅指南',
          author: '@商务美食家',
          coverImage: '/images/app-logo.jpg',
          shopCount: 8,
          tags: ['CBD', '商务'],
          desc: '福田会展中心周边高端餐厅'
        },
        {
          id: 'ft_2',
          title: '华强北地道小吃一条街',
          author: '@街头美食',
          coverImage: '/images/app-logo.jpg',
          shopCount: 15,
          tags: ['华强北', '小吃'],
          desc: '华强北隐藏美食小店大搜罗'
        },
        {
          id: 'ft_3',
          title: '福田皇庭广场美食攻略',
          author: '@ mall美食',
          coverImage: '/images/app-logo.jpg',
          shopCount: 10,
          tags: ['皇庭广场', '商场'],
          desc: '皇庭广场必吃餐厅推荐'
        },
        {
          id: 'ft_4',
          title: '福田梅林美食地图',
          author: '@梅林吃货',
          coverImage: '/images/app-logo.jpg',
          shopCount: 9,
          tags: ['梅林', '本地'],
          desc: '梅林片区老字号美食推荐'
        }
      ],
      '罗湖区': [
        {
          id: 'lh_1',
          title: '罗湖黄贝岭老字号美食',
          author: '@老街坊',
          coverImage: '/images/app-logo.jpg',
          shopCount: 7,
          tags: ['黄贝岭', '老字号'],
          desc: '龟老吉凉粉、新发烧腊等25年老字号'
        },
        {
          id: 'lh_2',
          title: '罗湖东门町美食攻略',
          author: '@东门通',
          coverImage: '/images/app-logo.jpg',
          shopCount: 20,
          tags: ['东门', '小吃街'],
          desc: '东门步行街美食全攻略'
        },
        {
          id: 'lh_3',
          title: '罗湖万象城高端美食',
          author: '@品质生活',
          coverImage: '/images/app-logo.jpg',
          shopCount: 6,
          tags: ['万象城', '高端'],
          desc: '万象城精品餐厅推荐'
        },
        {
          id: 'lh_4',
          title: '罗湖潮汕美食聚集地',
          author: '@潮汕人',
          coverImage: '/images/app-logo.jpg',
          shopCount: 11,
          tags: ['潮汕', '牛肉火锅'],
          desc: '罗湖正宗潮汕牛肉火锅推荐'
        }
      ],
      '宝安区': [
        {
          id: 'ba_1',
          title: '宝安壹方城美食全攻略',
          author: '@宝安吃货',
          coverImage: '/images/app-logo.jpg',
          shopCount: 14,
          tags: ['壹方城', '商场'],
          desc: '壹方城必吃餐厅一网打尽'
        },
        {
          id: 'ba_2',
          title: '宝安盐田夜市美食地图',
          author: '@夜市达人',
          coverImage: '/images/app-logo.jpg',
          shopCount: 25,
          tags: ['夜市', '小吃'],
          desc: '宝安盐田夜市各地小吃推荐'
        },
        {
          id: 'ba_3',
          title: '宝安欢乐港湾美食指南',
          author: '@湾区美食',
          coverImage: '/images/app-logo.jpg',
          shopCount: 8,
          tags: ['欢乐港湾', '海景'],
          desc: '欢乐港湾海景餐厅推荐'
        }
      ],
      '龙岗区': [
        {
          id: 'lg_1',
          title: '龙岗中心城美食攻略',
          author: '@龙岗通',
          coverImage: '/images/app-logo.jpg',
          shopCount: 10,
          tags: ['中心城', '本地'],
          desc: '龙岗中心城人气餐厅推荐'
        },
        {
          id: 'lg_2',
          title: '龙岗坂田美食地图',
          author: '@坂田吃货',
          coverImage: '/images/app-logo.jpg',
          shopCount: 12,
          tags: ['坂田', '华为'],
          desc: '坂田华为周边美食推荐'
        },
        {
          id: 'lg_3',
          title: '龙岗罗瑞合美食街',
          author: '@美食街探店',
          coverImage: '/images/app-logo.jpg',
          shopCount: 18,
          tags: ['美食街', '客家'],
          desc: '罗瑞合客家美食一条街'
        }
      ],
      '龙华区': [
        {
          id: 'lh_1',
          title: '龙华壹方天地美食攻略',
          author: '@龙华吃货',
          coverImage: '/images/app-logo.jpg',
          shopCount: 9,
          tags: ['壹方天地', '商场'],
          desc: '龙华壹方天地美食推荐'
        },
        {
          id: 'lh_2',
          title: '龙华民治夜市美食',
          author: '@夜市猎人',
          coverImage: '/images/app-logo.jpg',
          shopCount: 16,
          tags: ['民治', '夜市'],
          desc: '民治大道夜市烟火气美食'
        }
      ],
      '盐田区': [
        {
          id: 'yt_1',
          title: '盐田海鲜街美食攻略',
          author: '@海鲜控',
          coverImage: '/images/app-logo.jpg',
          shopCount: 8,
          tags: ['海鲜', '海边'],
          desc: '盐田海鲜街新鲜海鲜推荐'
        },
        {
          id: 'yt_2',
          title: '大梅沙海滨美食指南',
          author: '@海边美食',
          coverImage: '/images/app-logo.jpg',
          shopCount: 6,
          tags: ['大梅沙', '度假'],
          desc: '大梅沙海滨度假区餐厅推荐'
        }
      ],
      '光明区': [
        {
          id: 'gm_1',
          title: '光明三宝美食之旅',
          author: '@光明通',
          coverImage: '/images/app-logo.jpg',
          shopCount: 5,
          tags: ['光明三宝', '乳鸽'],
          desc: '光明乳鸽、甜玉米、牛初乳'
        },
        {
          id: 'gm_2',
          title: '光明农场美食攻略',
          author: '@农场美食',
          coverImage: '/images/app-logo.jpg',
          shopCount: 7,
          tags: ['农场', '有机'],
          desc: '光明农场周边农家菜推荐'
        }
      ],
      '坪山区': [
        {
          id: 'ps_1',
          title: '坪山牛肉一条街',
          author: '@牛肉控',
          coverImage: '/images/app-logo.jpg',
          shopCount: 6,
          tags: ['牛肉火锅', '现宰'],
          desc: '坪山潮汕现宰牛肉火锅'
        }
      ],
      '大鹏新区': [
        {
          id: 'dp_1',
          title: '大鹏所城美食攻略',
          author: '@古城美食',
          coverImage: '/images/app-logo.jpg',
          shopCount: 8,
          tags: ['大鹏所城', '海鲜'],
          desc: '大鹏所城特色餐厅推荐'
        },
        {
          id: 'dp_2',
          title: '较场尾海边美食',
          author: '@海边吃货',
          coverImage: '/images/app-logo.jpg',
          shopCount: 5,
          tags: ['较场尾', '民宿'],
          desc: '较场尾海边民宿美食'
        }
      ]
    }
    
    this.setData({ 
      districtGuides: districtGuides,
      currentGuides: districtGuides['南山区'] || []
    })
  },

  // 切换区
  onDistrictChange(e) {
    const district = e.currentTarget.dataset.district
    const guides = this.data.districtGuides[district] || []
    this.setData({ 
      currentDistrict: district,
      currentGuides: guides
    })
  },

  // 点击区攻略卡片
  onDistrictGuideTap(e) {
    const guide = e.currentTarget.dataset.guide
    wx.navigateTo({
      url: `/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}`
    })
  },

  // 刷新当前区攻略
  onRefreshGuides() {
    // 随机打乱当前区攻略顺序
    const guides = [...this.data.currentGuides]
    for (let i = guides.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[guides[i], guides[j]] = [guides[j], guides[i]]
    }
    this.setData({ currentGuides: guides })
  },

  // 加载推荐网格（按人气/打卡数排序，取6家）
  loadRecommend() {
    const shops = shopData.shops
    const sorted = [...shops].sort((a, b) => (b.checkInCount || 0) - (a.checkInCount || 0))
    const recommend = sorted.slice(0, 6)
    this.setData({ recommendShops: recommend })
  },

  // 加载我的攻略
  loadMyGuides() {
    const guides = util.loadData('myGuides', [])
    guides.forEach(g => {
      g.dateStr = new Date(g.date).toLocaleDateString('zh-CN')
    })
    this.setData({ myGuides: guides })
  },

  // 打开导入弹窗
  onOpenImport() {
    this.setData({ showImportModal: true, importTab: 'text', importText: '' })
    
    // 自动读取剪贴板
    wx.getClipboardData({
      success: (res) => {
        const clipboardText = res.data || ''
        if (clipboardText) {
          // 检测是否是链接
          const isLink = /xhs\.cn|xhslink\.com|xiaohongshu\.com|redbook|大众点评|dianping/.test(clipboardText)
          // 检测是否像攻略文本
          const looksLikeGuide = clipboardText.includes('✅') || clipboardText.includes('店名') || clipboardText.includes('推荐')
          
          if (isLink || looksLikeGuide || clipboardText.length > 20) {
            this.setData({ importText: clipboardText })
            // 自动提示用户
            wx.showToast({
              title: isLink ? '检测到链接，可直接解析' : '已粘贴剪贴板内容',
              icon: 'none',
              duration: 2000
            })
          }
        }
      }
    })
  },

  // 关闭导入弹窗
  onCloseImport() {
    this.setData({ showImportModal: false })
  },

  // 切换 Tab
  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ importTab: tab })
  },

  // 文本输入
  onTextInput(e) {
    this.setData({ importText: e.detail.value })
  },

  // 解析攻略
  onParseGuide() {
    const text = this.data.importText.trim()
    if (!text) {
      wx.showToast({ title: '请先输入攻略内容', icon: 'none' })
      return
    }
    
    util.showLoading('智能识别中...')
    
    // 延迟模拟解析
    setTimeout(() => {
      const result = util.parseBlockBasedGuide(text)
      
      this.setData({
        showImportModal: false,
        showResultModal: true,
        foundShops: result.foundShops,
        notFoundShops: result.notFoundShops
      })
      
      util.hideLoading()
      
      // 显示识别结果提示
      const total = result.foundShops.length + result.notFoundShops.length
      if (total === 0) {
        wx.showToast({ 
          title: '未识别到店铺，请检查格式', 
          icon: 'none',
          duration: 2500 
        })
      } else {
        wx.showToast({ 
          title: `识别到 ${total} 家店铺`, 
          icon: 'success' 
        })
      }
      
      // 保存攻略
      if (total > 0) {
        this.saveGuide(text, result)
      }
    }, 800)
  },

  // 保存攻略
  saveGuide(text, result) {
    const guides = util.loadData('myGuides', [])
    const newGuide = {
      id: Date.now(),
      title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
      content: text,
      shopCount: result.foundShops.length + result.notFoundShops.length,
      date: new Date().toISOString()
    }
    guides.unshift(newGuide)
    // 只保留最近10篇
    if (guides.length > 10) guides.pop()
    util.saveData('myGuides', guides)
    this.loadMyGuides()
  },

  // 关闭结果弹窗
  onCloseResult() {
    this.setData({ showResultModal: false })
  },

  // 加载攻略
  onLoadGuide(e) {
    const guide = e.currentTarget.dataset.guide
    this.setData({ 
      importText: guide.content,
      importTab: 'text'
    })
    this.onParseGuide()
  },

  // 选择攻略
  onSelectGuide(e) {
    const guide = e.currentTarget.dataset.guide
    this.onLoadGuide({ currentTarget: { dataset: { guide } } })
    this.onCloseImport()
  },

  // 添加新店
  onAddNewShop(e) {
    const shop = e.currentTarget.dataset.shop
    wx.navigateTo({
      url: `/pages/sub/add-shop/add-shop?shop=${encodeURIComponent(JSON.stringify(shop))}`
    })
  },

  // 批量添加
  onBatchAdd() {
    wx.navigateTo({
      url: `/pages/sub/add-shop/add-shop?batch=${encodeURIComponent(JSON.stringify(this.data.notFoundShops))}`
    })
  },

  // 添加店铺
  onAddShop() {
    wx.navigateTo({
      url: '/pages/add-shop/add-shop'
    })
  },

  // 店铺点击
  onShopTap(e) {
    const shop = e.currentTarget.dataset.shop
    wx.navigateTo({
      url: `/pages/sub/shop-detail/shop-detail?shop=${encodeURIComponent(JSON.stringify(shop))}`
    })
  },

  // 换一批推荐
  onRefreshRecommend() {
    this.loadRecommend()
    wx.showToast({ title: '已换一批', icon: 'none' })
  },

  // 图片加载失败
  onImageError(e) {
    const index = e.currentTarget.dataset.index
    if (index !== undefined) {
      const shops = this.data.recommendShops
      shops[index].imgError = true
      this.setData({ recommendShops: shops })
    }
  },

  // 管理攻略
  onManageGuides() {
    wx.showActionSheet({
      itemList: ['清空所有攻略'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showModal({
            title: '确认清空',
            content: '确定要清空所有攻略吗？',
            success: (m) => {
              if (m.confirm) {
                util.saveData('myGuides', [])
                this.loadMyGuides()
                wx.showToast({ title: '已清空', icon: 'success' })
              }
            }
          })
        }
      }
    })
  },

  // 阻止冒泡
  stopPropagation() {}
})
