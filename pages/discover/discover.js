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
      { name: '福田区', id: 'futian' },
      { name: '南山区', id: 'nanshan' },
      { name: '罗湖区', id: 'luohu' },
      { name: '宝安区', id: 'baoan' },
      { name: '龙岗区', id: 'longgang' },
      { name: '龙华区', id: 'longhua' },
      { name: '光明区', id: 'guangming' },
      { name: '坪山区', id: 'pingshan' },
      { name: '盐田区', id: 'yantian' },
      { name: '大鹏新区', id: 'dapeng' }
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
      '#F7F7F7',
      '#F5F6F8',
      '#F6F7F6',
      '#F5F5F6',
      '#F6F5F5',
      '#F4F5F4'
    ]

    const featuredGuides = [
      {
        id: 1,
        name: '蛇口的海与月',
        title: '深圳蛇口必吃地道老店推荐',
        coverImage: coverImages[0],
        author: '小胖又饿了',
        duration: '2天',
        shopCount: 14,
        likes: 4222
      },
      {
        id: 2,
        name: '春日踏青',
        title: '深圳春日赏花攻略',
        coverImage: coverImages[1],
        author: '旅行博主',
        duration: '1天',
        shopCount: 8,
        likes: 2841
      },
      {
        id: 3,
        name: '周末寻味',
        title: '深圳本地人常去的美食街',
        coverImage: coverImages[2],
        author: '美食达人',
        duration: '1天',
        shopCount: 12,
        likes: 3567
      },
      {
        id: 4,
        name: '文艺慢生活',
        title: '蛇口值得打卡的咖啡馆',
        coverImage: coverImages[3],
        author: '文艺青年',
        duration: '半天',
        shopCount: 6,
        likes: 2156
      },
      {
        id: 5,
        name: '海滨漫步',
        title: '深圳最值得去的海边景点',
        coverImage: coverImages[4],
        author: '旅行家',
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
        desc: '西安美食小吃全攻略！腊味酥饼糕点、双皮奶、鱼皮、煲仔饭，带你尝遍地道陕西风味。从回民街到永兴坊，从洒金桥到小寨，跟着这份攻略吃遍西安城！',
        coverImage: coverImages[5],
        cardColor: cardColors[0],
        author: '打工人',
        duration: '3天',
        shopCount: 14,
        likes: 4232,
        tags: ['西安', '美食', '小吃'],
        shops: ['老孙家羊肉泡馍', '贾三灌汤包', '马洪小炒泡馍', '甑糕', '肉丸胡辣汤', '柿子糊塌']
      },
      {
        id: 7,
        district: 'futian',
        category: 'recommend',
        title: '深圳南山老字号餐厅攻略',
        desc: '14年+老店真的好吃！嘉华小吃、好好味面馆、翠湖广东乡下菜等10家南山老字号，带你体验深圳本地人的美食记忆。这些店承载了一代人的味蕾回忆，值得打卡！',
        coverImage: coverImages[6],
        cardColor: cardColors[1],
        author: '大湾区探店王',
        duration: '1天',
        shopCount: 10,
        likes: 3891,
        tags: ['南山', '老字号', '本地美食'],
        shops: ['嘉华小吃', '好好味面馆', '翠湖广东乡下菜', '潮香四海', '湛江鸡饭店', '桂园酒楼']
      },
      {
        id: 8,
        district: 'luohu',
        category: 'recommend',
        title: '深圳必打卡网红餐厅合集',
        desc: '深圳最火的网红餐厅推荐！打卡拍照两不误，从高空景观餐厅到ins风咖啡馆，从创意料理到特色甜品，这份攻略带你刷爆朋友圈！',
        coverImage: coverImages[7],
        cardColor: cardColors[2],
        author: '美食博主',
        duration: '2天',
        shopCount: 12,
        likes: 6789,
        tags: ['网红', '打卡', '拍照'],
        shops: ['网红咖啡店', '高空餐厅', '创意料理', '甜品店', '露台酒吧', '花园餐厅']
      },
      {
        id: 9,
        district: 'yantian',
        category: 'recommend',
        title: '福田CBD商务宴请餐厅指南',
        desc: '福田会展中心周边高端餐厅推荐，适合商务宴请和朋友聚会。从粤菜到日料，从海鲜到牛排，这里有最适合商务场合的用餐选择。',
        coverImage: coverImages[0],
        cardColor: cardColors[3],
        author: '商务美食家',
        duration: '1天',
        shopCount: 8,
        likes: 2103,
        tags: ['商务', '高端', '宴请'],
        shops: ['粤菜餐厅', '日料放题', '海鲜酒楼', '牛排馆', '私房菜', '茶馆']
      },
      {
        id: 10,
        district: 'longgang',
        category: 'recommend',
        title: '深圳夜市攻略',
        desc: '深圳各大夜市美食全攻略，从沙井到东门一网打尽！烧烤、小吃、甜品、饮品应有尽有，体验深圳夜生活的烟火气。',
        coverImage: coverImages[1],
        cardColor: cardColors[4],
        author: '夜市达人',
        duration: '1天',
        shopCount: 25,
        likes: 8901,
        tags: ['夜市', '小吃', '宵夜'],
        shops: ['沙井生蚝', '东门小吃街', '福田夜市', '南山烧烤', '龙华大排档', '宝安糖水铺']
      },
      {
        id: 11,
        district: 'dapeng',
        category: 'recommend',
        title: '大鹏半岛海鲜之旅',
        desc: '大鹏所城、南澳渔港，最新鲜的海鲜等你来尝！从捕捞到餐桌，体验真正的海鲜盛宴。还有美丽的海滩和古村落等着你！',
        coverImage: coverImages[2],
        cardColor: cardColors[5],
        author: '海鲜控',
        duration: '1天',
        shopCount: 10,
        likes: 3456
      },
      {
        id: 12,
        district: 'baoan',
        category: 'all',
        title: '深圳隐藏的文艺角落',
        desc: '远离喧嚣，发现深圳那些不为人知的文艺小店和咖啡馆。老厂房改造的艺术区、独立书店、小众画廊，带你感受深圳的文艺气息。',
        coverImage: coverImages[3],
        cardColor: cardColors[0],
        author: '文艺青年',
        duration: '1天',
        shopCount: 6,
        likes: 1567,
        tags: ['文艺', '小众', '咖啡馆'],
        shops: ['旧天堂书店', '华侨城创意园', '海上世界艺术中心', '深业上城', 'OCT-LOFT', '南头古城']
      },
      {
        id: 13,
        district: 'longhua',
        category: 'all',
        title: '东门町美食攻略',
        desc: '东门步行街美食全攻略，20家必吃小吃等你来打卡！从传统小吃到网红美食，从老字号到新潮流，这里应有尽有。',
        coverImage: coverImages[4],
        cardColor: cardColors[1],
        author: '东门通',
        duration: '半天',
        shopCount: 20,
        likes: 5678,
        tags: ['东门', '小吃', '步行街'],
        shops: ['东门町美食城', '酸辣粉', '章鱼小丸子', '牛杂', '冰淇淋', '奶茶店']
      },
      {
        id: 14,
        district: 'nanshan',
        category: 'all',
        title: '盐田海滨栈道徒步',
        desc: '最美海岸线徒步路线，山海相连的绝美风景！从盐田海鲜街到大梅沙，一路海景相伴，适合周末徒步和拍照打卡。',
        coverImage: coverImages[5],
        cardColor: cardColors[2],
        author: '户外达人',
        duration: '1天',
        shopCount: 4,
        likes: 1892,
        tags: ['徒步', '海景', '户外'],
        shops: ['盐田海鲜街', '大梅沙', '小梅沙', '东部华侨城']
      },
      {
        id: 15,
        district: 'futian',
        category: 'all',
        title: '深圳公园打卡指南',
        desc: '深圳各大公园游玩攻略，周末亲子游好去处！莲花山、深圳湾公园、中心公园，每个公园都有独特的风景和玩法。',
        coverImage: coverImages[6],
        cardColor: cardColors[3],
        author: '亲子达人',
        duration: '2天',
        shopCount: 8,
        likes: 2345,
        tags: ['公园', '亲子', '游玩'],
        shops: ['莲花山公园', '深圳湾公园', '中心公园', '笔架山公园', '塘朗山', '梅林水库']
      },
      {
        id: 16,
        district: 'luohu',
        category: 'all',
        title: '深圳书店地图',
        desc: '深圳特色书店推荐，阅读爱好者的天堂！从大型书城到独立书店，从24小时书店到文艺咖啡馆，总有一款适合你。',
        coverImage: coverImages[7],
        cardColor: cardColors[4],
        author: '书虫',
        duration: '1天',
        shopCount: 10,
        likes: 1234,
        tags: ['书店', '阅读', '文艺'],
        shops: ['深圳书城', '西西弗书店', '覔书店', '旧天堂书店', '24小时书店', '方所']
      },
      {
        id: 17,
        district: 'yantian',
        category: 'all',
        title: '深圳咖啡馆合集',
        desc: '精选深圳特色咖啡馆，适合办公和约会！从精品咖啡到创意特调，从工业风到ins风，总有一家能打动你。',
        coverImage: coverImages[0],
        cardColor: cardColors[5],
        author: '咖啡控',
        duration: '1天',
        shopCount: 15,
        likes: 2890,
        tags: ['咖啡', '办公', '约会'],
        shops: ['% Arabica', 'Blue Bottle', 'Seesaw', 'Manner', '星巴克臻选', 'Peet\'s']
      }
    ]

    this.setData({
      featuredGuides,
      allGuides,
      currentGuides: [...allGuides]
    })
  },

  onDistrictChange(e) {
    const district = e.currentTarget.dataset.district
    const districtName = e.currentTarget.dataset.name
    wx.navigateTo({
      url: `/pages/district-guide/district-guide?district=${district}&name=${encodeURIComponent(districtName)}`
    })
  },

  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category
    const categoryName = e.currentTarget.dataset.name
    
    if (categoryName === '全部') {
      this.setData({ 
        currentCategory: categoryName,
        currentGuides: [...this.data.allGuides]
      })
    } else {
      const filtered = this.data.allGuides.filter(g => g.category === 'recommend')
      this.setData({ 
        currentCategory: categoryName,
        currentGuides: [...filtered]
      })
    }
  },

  onGuideTap(e) {
    const guide = e.currentTarget.dataset.guide
    wx.navigateTo({
      url: `/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}`
    })
  }
})