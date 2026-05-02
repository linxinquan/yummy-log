// 觅食图 - 攻略页
const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    // 导航栏高度
    menuTop: 44,
    menuHeight: 32,
    menuRightInset: 24,
    contentTop: 108,

    // 区域
    districts: [
      { name: '南山区' },
      { name: '福田区' },
      { name: '罗湖区' },
      { name: '盐田区' },
      { name: '大鹏新区' }
    ],
    currentDistrict: '南山区',

    // 分类
    categories: [
      { name: '全部' },
      { name: '推荐' }
    ],
    currentCategory: '全部',

    // 精选攻略
    featuredGuides: [],

    // 攻略列表
    allGuides: [],
    currentGuides: [],

    // 搜索
    showSearchModal: false,
    searchText: '',
    searchHistory: [],
    hotSearches: ['深圳美食', '网红打卡', '周末出游', '小众景点']
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuRightInset = menuButtonInfo
      ? Math.max(sysInfo.windowWidth - menuButtonInfo.left + 8, 24)
      : 103

    const contentTop = menuTop + menuHeight + 12

    this.setData({
      menuTop,
      menuHeight,
      menuRightInset,
      contentTop
    })

    this.loadGuides()
    this.loadSearchHistory()
  },

  loadGuides() {
    const featuredGuides = [
      {
        id: 1,
        name: '蛇口的海与月',
        title: '深圳蛇口必吃地道老店推荐',
        coverImage: 'https://images.unsplash.com/photo-1529543544277-750e0c097d84?w=300&h=200&fit=crop',
        author: '@小胖又饿了',
        duration: '2天',
        shopCount: 14,
        likes: 4222
      },
      {
        id: 2,
        name: '春日踏青',
        title: '深圳春日赏花攻略',
        coverImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop',
        author: '@旅行博主',
        duration: '1天',
        shopCount: 8,
        likes: 2841
      }
    ]

    const allGuides = [
      {
        id: 3,
        category: '美食',
        title: '舌尖上的长安：3天吃遍西安老味道',
        desc: '西安美食小吃：腊味酥饼糕点各种地道小吃：双皮奶、鱼皮、煲仔饭等等，有些热门...',
        coverImage: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=160&h=120&fit=crop',
        author: '@打工人',
        duration: '3天',
        shopCount: 14,
        likes: 4232
      },
      {
        id: 4,
        category: '热门',
        title: '深圳南山老字号餐厅攻略',
        desc: '14年+老店真的好吃，嘉华小吃、好好味面馆、翠湖广东乡下菜等10家南山老字号',
        coverImage: 'https://images.unsplash.com/photo-1529543544277-750e0c097d84?w=160&h=120&fit=crop',
        author: '@大湾区探店王',
        duration: '1天',
        shopCount: 10,
        likes: 3891
      },
      {
        id: 5,
        category: '小众',
        title: '深圳隐藏的文艺角落',
        desc: '远离喧嚣，发现深圳那些不为人知的文艺小店和咖啡馆',
        coverImage: 'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=160&h=120&fit=crop',
        author: '@文艺青年',
        duration: '1天',
        shopCount: 6,
        likes: 1567
      },
      {
        id: 6,
        category: '美食',
        title: '福田CBD商务宴请餐厅指南',
        desc: '福田会展中心周边高端餐厅推荐，适合商务宴请和朋友聚会',
        coverImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=160&h=120&fit=crop',
        author: '@商务美食家',
        duration: '1天',
        shopCount: 8,
        likes: 2103
      },
      {
        id: 7,
        category: '热门',
        title: '东门町美食攻略',
        desc: '东门步行街美食全攻略，20家必吃小吃等你来打卡',
        coverImage: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=160&h=120&fit=crop',
        author: '@东门通',
        duration: '半天',
        shopCount: 20,
        likes: 5678
      },
      {
        id: 8,
        category: '小众',
        title: '盐田海滨栈道徒步',
        desc: '最美海岸线徒步路线，山海相连的绝美风景',
        coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=160&h=120&fit=crop',
        author: '@户外达人',
        duration: '1天',
        shopCount: 4,
        likes: 1892
      }
    ]

    this.setData({
      featuredGuides,
      allGuides,
      currentGuides: allGuides
    })
  },

  onDistrictChange(e) {
    const district = e.currentTarget.dataset.district
    this.setData({ currentDistrict: district })
  },

  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ currentCategory: category })

    if (category === '全部') {
      this.setData({ currentGuides: this.data.allGuides })
    } else {
      const filtered = this.data.allGuides.filter(g => g.category === category)
      this.setData({ currentGuides: filtered })
    }
  },

  onGuideTap(e) {
    const guide = e.currentTarget.dataset.guide
    wx.navigateTo({
      url: `/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}`
    })
  },

  onOpenSearch() {
    this.setData({ showSearchModal: true })
  },

  onCloseSearch() {
    this.setData({ showSearchModal: false, searchText: '' })
  },

  onSearchInput(e) {
    this.setData({ searchText: e.detail.value })
  },

  onSearch() {
    const text = this.data.searchText.trim()
    if (!text) return

    this.saveSearchHistory(text)
    this.setData({ showSearchModal: false })

    const filtered = this.data.allGuides.filter(g => 
      g.title.includes(text) || g.desc.includes(text)
    )
    this.setData({ currentGuides: filtered, currentCategory: '全部' })
  },

  onClearSearch() {
    this.setData({ searchText: '' })
  },

  loadSearchHistory() {
    const history = util.loadData('searchHistory', [])
    this.setData({ searchHistory: history.slice(0, 10) })
  },

  saveSearchHistory(text) {
    let history = util.loadData('searchHistory', [])
    history = history.filter(h => h !== text)
    history.unshift(text)
    if (history.length > 10) history.pop()
    util.saveData('searchHistory', history)
    this.setData({ searchHistory: history })
  },

  onHistoryTap(e) {
    const text = e.currentTarget.dataset.text
    this.setData({ searchText: text })
    this.onSearch()
  },

  onHotTap(e) {
    const text = e.currentTarget.dataset.text
    this.setData({ searchText: text })
    this.onSearch()
  },

  stopPropagation() {}
})