// 觅食图 - 攻略页
const app = getApp()

Page({
  data: {
    // 导航栏高度
    menuTop: 44,
    menuHeight: 32,
    menuRightInset: 24,
    contentTop: 108,

    // 区域
    districts: [
      { name: '南山区', id: 'nanshan' },
      { name: '福田区', id: 'futian' },
      { name: '龙岗区', id: 'longgang' },
      { name: '盐田区', id: 'yantian' },
      { name: '大鹏新区', id: 'dapeng' },
      { name: '罗湖区', id: 'luohu' },
      { name: '宝安区', id: 'baoan' },
      { name: '龙华区', id: 'longhua' }
    ],

    // 分类
    categories: [
      { name: '全部', id: 'all' },
      { name: '推荐', id: 'recommend' }
    ],
    currentCategory: '全部',

    // 精选攻略
    featuredGuides: [],

    // 攻略列表
    allGuides: [],
    currentGuides: []
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
  },

  loadGuides() {
    const coverImages = [
      '/images/covers/01.jpeg',
      '/images/covers/02.jpeg',
      '/images/covers/03.jpeg',
      '/images/covers/04.jpeg',
      '/images/covers/05.jpeg',
      '/images/covers/06.jpeg',
      '/images/covers/07.jpeg',
      '/images/covers/08.jpeg'
    ]

    const cardColors = [
      '#F2EEEB', // 米白色
      '#E8F4E8', // 浅绿色
      '#FDF2E8', // 浅橙色
      '#E8F0F4', // 浅蓝色
      '#F4E8F0', // 浅粉色
      '#F0F4E8', // 浅黄绿色
      '#E8ECF4', // 浅紫蓝色
      '#F4F0E8'  // 浅棕色
    ]

    const featuredGuides = [
      {
        id: 1,
        name: '蛇口的海与月',
        title: '深圳蛇口必吃地道老店推荐',
        coverImage: coverImages[0],
        author: '@小胖又饿了',
        duration: '2天',
        shopCount: 14,
        likes: 4222
      },
      {
        id: 2,
        name: '春日踏青',
        title: '深圳春日赏花攻略',
        coverImage: coverImages[1],
        author: '@旅行博主',
        duration: '1天',
        shopCount: 8,
        likes: 2841
      },
      {
        id: 3,
        name: '周末寻味',
        title: '深圳本地人常去的美食街',
        coverImage: coverImages[2],
        author: '@美食达人',
        duration: '1天',
        shopCount: 12,
        likes: 3567
      },
      {
        id: 4,
        name: '文艺慢生活',
        title: '蛇口值得打卡的咖啡馆',
        coverImage: coverImages[3],
        author: '@文艺青年',
        duration: '半天',
        shopCount: 6,
        likes: 2156
      },
      {
        id: 5,
        name: '海滨漫步',
        title: '深圳最值得去的海边景点',
        coverImage: coverImages[4],
        author: '@旅行家',
        duration: '1天',
        shopCount: 5,
        likes: 1987
      }
    ]

    const allGuides = [
      {
        id: 6,
        district: 'nanshan',
        category: 'recommend',
        title: '舌尖上的长安：3天吃遍西安老味道',
        desc: '西安美食小吃：腊味酥饼糕点各种地道小吃：双皮奶、鱼皮、煲仔饭等等，有些热门...',
        coverImage: coverImages[5],
        cardColor: cardColors[0],
        author: '@打工人',
        duration: '3天',
        shopCount: 14,
        likes: 4232
      },
      {
        id: 7,
        district: 'futian',
        category: 'recommend',
        title: '深圳南山老字号餐厅攻略',
        desc: '14年+老店真的好吃，嘉华小吃、好好味面馆、翠湖广东乡下菜等10家南山老字号',
        coverImage: coverImages[6],
        cardColor: cardColors[1],
        author: '@大湾区探店王',
        duration: '1天',
        shopCount: 10,
        likes: 3891
      },
      {
        id: 8,
        district: 'luohu',
        category: 'all',
        title: '深圳隐藏的文艺角落',
        desc: '远离喧嚣，发现深圳那些不为人知的文艺小店和咖啡馆',
        coverImage: coverImages[7],
        cardColor: cardColors[2],
        author: '@文艺青年',
        duration: '1天',
        shopCount: 6,
        likes: 1567
      },
      {
        id: 9,
        district: 'yantian',
        category: 'recommend',
        title: '福田CBD商务宴请餐厅指南',
        desc: '福田会展中心周边高端餐厅推荐，适合商务宴请和朋友聚会',
        coverImage: coverImages[0],
        cardColor: cardColors[3],
        author: '@商务美食家',
        duration: '1天',
        shopCount: 8,
        likes: 2103
      },
      {
        id: 10,
        district: 'longgang',
        category: 'all',
        title: '东门町美食攻略',
        desc: '东门步行街美食全攻略，20家必吃小吃等你来打卡',
        coverImage: coverImages[1],
        cardColor: cardColors[4],
        author: '@东门通',
        duration: '半天',
        shopCount: 20,
        likes: 5678
      },
      {
        id: 11,
        district: 'dapeng',
        category: 'all',
        title: '盐田海滨栈道徒步',
        desc: '最美海岸线徒步路线，山海相连的绝美风景',
        coverImage: coverImages[2],
        cardColor: cardColors[5],
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
    const districtName = e.currentTarget.dataset.name
    wx.navigateTo({
      url: `/pages/discover/discover?district=${district}&name=${encodeURIComponent(districtName)}`
    })
  },

  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category
    const categoryName = e.currentTarget.dataset.name
    this.setData({ currentCategory: categoryName })

    if (categoryName === '全部') {
      this.setData({ currentGuides: this.data.allGuides })
    } else {
      const filtered = this.data.allGuides.filter(g => g.category === 'recommend')
      this.setData({ currentGuides: filtered })
    }
  },

  onGuideTap(e) {
    const guide = e.currentTarget.dataset.guide
    wx.navigateTo({
      url: `/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}`
    })
  }
})