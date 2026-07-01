const app = getApp()
const { normalizeTripDurationText } = require('../../../../utils/trip-duration')
const { backfillStoredGuides } = require('../../../../utils/guide-backfill')
const { DEFAULT_COVER_POOL } = require('../../config/cover-pool')

// 根据攻略已有文案，尽量推断出城市名称。
function inferGuideCity(guide = {}) {
  const sourceText = [
    guide.city,
    guide.districtName,
    guide.title,
    guide.desc
  ].join(' ')

  if (/香港/.test(sourceText)) return '香港特别行政区'
  if (/上海/.test(sourceText)) return '上海市'
  if (/北京/.test(sourceText)) return '北京市'
  if (/广州/.test(sourceText)) return '广州市'
  if (/杭州/.test(sourceText)) return '杭州市'
  if (/台北/.test(sourceText)) return '台北市'
  if (/澳门/.test(sourceText)) return '澳门特别行政区'
  if (/成都/.test(sourceText)) return '成都市'
  if (/厦门/.test(sourceText)) return '厦门市'
  if (/南京/.test(sourceText)) return '南京市'
  if (/苏州/.test(sourceText)) return '苏州市'
  if (/福州/.test(sourceText)) return '福州市'
  if (/台州/.test(sourceText)) return '台州市'
  if (/台南/.test(sourceText)) return '台南市'
  if (/台中/.test(sourceText)) return '台中市'
  if (/高雄/.test(sourceText)) return '高雄市'
  if (/温州/.test(sourceText)) return '温州市'
  if (/泉州/.test(sourceText)) return '泉州市'
  if (/扬州/.test(sourceText)) return '扬州市'
  if (/常州/.test(sourceText)) return '常州市'
  if (/新北/.test(sourceText)) return '新北市'
  if (/新竹县/.test(sourceText)) return '新竹县'
  if (/新竹/.test(sourceText)) return '新竹市'
  if (/宁德/.test(sourceText)) return '宁德市'
  if (/惠州/.test(sourceText)) return '惠州市'
  return '深圳市'
}

// 统计某篇攻略被保存成路线的次数。
function getSavedGuideCount(guideId) {
  const savedRoutes = wx.getStorageSync('savedRoutes') || []
  return savedRoutes.filter(item => String(item.guideId || item.id) === String(guideId)).length
}

// 给区县攻略卡片补齐展示字段。
function decorateGuideCards(guides = []) {
  return guides.map(item => ({
    ...item,
    cityText: item.cityText || inferGuideCity(item),
    authorAvatar: item.authorAvatar || item.coverImage,
    useRouteCount: (item.baseUseCount || 0) + getSavedGuideCount(item.id),
    duration: normalizeTripDurationText(item.duration, Math.max((item.daySections || []).length, 1))
  }))
}

// 尝试把城市文案映射到区县 id，方便把已发布攻略归到某个区页里。
function mapCityToDistrict(cityText = '') {
  const source = String(cityText || '')
  if (/南山/.test(source)) return 'nanshan'
  if (/福田/.test(source)) return 'futian'
  if (/罗湖/.test(source)) return 'luohu'
  if (/宝安/.test(source)) return 'baoan'
  if (/龙岗/.test(source)) return 'longgang'
  if (/龙华/.test(source)) return 'longhua'
  if (/盐田/.test(source)) return 'yantian'
  if (/大鹏/.test(source)) return 'dapeng'
  return ''
}

// 读取用户已发布攻略，并补成区县攻略列表可直接使用的结构。
function getPublishedGuides(cardColors = []) {
  const guides = wx.getStorageSync('myGuides') || []
  const { guides: fixedGuides, changed } = backfillStoredGuides(guides)
  if (changed) {
    wx.setStorageSync('myGuides', fixedGuides)
  }
  return fixedGuides.map((item, index) => ({
    ...item,
    district: item.district || mapCityToDistrict(item.city || item.cityText),
    districtName: item.districtName || '',
    category: item.category || 'all',
    cardColor: item.cardColor || cardColors[index % cardColors.length] || '#F7F7F7',
    cityText: item.cityText || inferGuideCity(item),
    baseUseCount: item.baseUseCount || 0,
    duration: normalizeTripDurationText(item.duration, Math.max((item.daySections || []).length, 1)),
    shopCount: item.shopCount || ((item.content || []).length || 0)
  }))
}

Page({
  data: {
    districtName: '',
    districtId: '',
    guideSource: [],
    guides: []
  },

  // 页面初始化：接收区县参数，然后加载该区的攻略列表。
  onLoad(options) {
    const districtId = options.district || ''
    const districtName = options.name ? decodeURIComponent(options.name) : '攻略'

    this.setData({
      districtId,
      districtName
    })

    this.loadDistrictGuides()
  },

  // 回到页面时，重新把卡片做一遍展示字段补齐。
  onShow() {
    if (this.data.guideSource.length) {
      this.setData({
        guides: decorateGuideCards(this.data.guideSource)
      })
    }
  },

  // 读取当前区县下的攻略数据，并合并用户已发布攻略。
  loadDistrictGuides() {
    const coverImages = DEFAULT_COVER_POOL

    const cardColors = [
      '#F7F7F7',
      '#F5F6F8',
      '#F6F7F6',
      '#F5F5F6',
      '#F6F5F5',
      '#F4F5F4'
    ]

    const allGuides = [
      {
        id: 1,
        district: 'nanshan',
        districtName: '南山区',
        category: 'recommend',
        title: '南山老字号餐厅攻略',
        desc: '14年+老店真的好吃，嘉华小吃、好好味面馆、翠湖广东乡下菜等10家南山老字号',
        coverImage: coverImages[0],
        cardColor: cardColors[0],
        author: '大湾区探店王',
        duration: '1天',
        shopCount: 10,
        likes: 3891
      },
      {
        id: 2,
        district: 'nanshan',
        districtName: '南山区',
        category: 'all',
        title: '深圳湾公园徒步指南',
        desc: '深圳湾公园最美徒步路线，从红树林到欢乐海岸，一路海景相伴',
        coverImage: coverImages[1],
        cardColor: cardColors[1],
        author: '户外达人',
        duration: '半天',
        shopCount: 4,
        likes: 2345
      },
      {
        id: 3,
        district: 'nanshan',
        districtName: '南山区',
        category: 'recommend',
        title: '蛇口海上世界美食街',
        desc: '海上世界广场周边餐厅推荐，海鲜、西餐、特色小吃应有尽有',
        coverImage: coverImages[2],
        cardColor: cardColors[2],
        author: '美食探店',
        duration: '1天',
        shopCount: 15,
        likes: 4521
      },
      {
        id: 4,
        district: 'nanshan',
        districtName: '南山区',
        category: 'all',
        title: '南山书城周边咖啡馆',
        desc: '南山文化中心区精选咖啡馆，适合阅读和办公的好去处',
        coverImage: coverImages[3],
        cardColor: cardColors[3],
        author: '咖啡控',
        duration: '半天',
        shopCount: 8,
        likes: 1876
      },
      {
        id: 5,
        district: 'nanshan',
        districtName: '南山区',
        category: 'recommend',
        title: '科技园午餐攻略',
        desc: '科技园周边性价比高的午餐选择，上班族的美食福音',
        coverImage: coverImages[4],
        cardColor: cardColors[4],
        author: '打工人',
        duration: '半天',
        shopCount: 12,
        likes: 2890
      },
      {
        id: 6,
        district: 'futian',
        districtName: '福田区',
        category: 'recommend',
        title: '福田CBD商务宴请餐厅指南',
        desc: '福田会展中心周边高端餐厅推荐，适合商务宴请和朋友聚会',
        coverImage: coverImages[2],
        cardColor: cardColors[2],
        author: '商务美食家',
        duration: '1天',
        shopCount: 8,
        likes: 2103
      },
      {
        id: 7,
        district: 'futian',
        districtName: '福田区',
        category: 'all',
        title: '市民中心周边下午茶',
        desc: '福田中心区精选咖啡馆和甜品店，周末休闲好去处',
        coverImage: coverImages[3],
        cardColor: cardColors[3],
        author: '咖啡爱好者',
        duration: '半天',
        shopCount: 6,
        likes: 1876
      },
      {
        id: 8,
        district: 'futian',
        districtName: '福田区',
        category: 'recommend',
        title: '皇岗村美食街',
        desc: '皇岗村内隐藏的潮汕美食聚集地，正宗潮汕牛肉丸、肠粉推荐',
        coverImage: coverImages[5],
        cardColor: cardColors[5],
        author: '潮汕吃货',
        duration: '1天',
        shopCount: 18,
        likes: 5234
      },
      {
        id: 9,
        district: 'futian',
        districtName: '福田区',
        category: 'all',
        title: '莲花山公园游玩攻略',
        desc: '莲花山公园散步、野餐、放风筝，周末亲子游好去处',
        coverImage: coverImages[6],
        cardColor: cardColors[0],
        author: '亲子达人',
        duration: '1天',
        shopCount: 5,
        likes: 3456
      },
      {
        id: 10,
        district: 'futian',
        districtName: '福田区',
        category: 'recommend',
        title: '华强北小吃街',
        desc: '华强北电子市场周边小吃，各种地道美食等你来发现',
        coverImage: coverImages[7],
        cardColor: cardColors[1],
        author: '逛吃达人',
        duration: '半天',
        shopCount: 20,
        likes: 4876
      },
      {
        id: 11,
        district: 'luohu',
        districtName: '罗湖区',
        category: 'all',
        title: '东门町美食攻略',
        desc: '东门步行街美食全攻略，20家必吃小吃等你来打卡',
        coverImage: coverImages[4],
        cardColor: cardColors[4],
        author: '东门通',
        duration: '半天',
        shopCount: 20,
        likes: 5678
      },
      {
        id: 12,
        district: 'luohu',
        districtName: '罗湖区',
        category: 'recommend',
        title: '罗湖隐藏的文艺角落',
        desc: '远离喧嚣，发现深圳那些不为人知的文艺小店和咖啡馆',
        coverImage: coverImages[5],
        cardColor: cardColors[5],
        author: '文艺青年',
        duration: '1天',
        shopCount: 6,
        likes: 1567
      },
      {
        id: 13,
        district: 'luohu',
        districtName: '罗湖区',
        category: 'all',
        title: '国贸商圈美食指南',
        desc: '国贸大厦周边餐厅推荐，从早茶到宵夜一站式体验',
        coverImage: coverImages[0],
        cardColor: cardColors[0],
        author: '美食地图',
        duration: '1天',
        shopCount: 14,
        likes: 3210
      },
      {
        id: 14,
        district: 'luohu',
        districtName: '罗湖区',
        category: 'recommend',
        title: '梧桐山徒步攻略',
        desc: '梧桐山主峰登山路线推荐，深圳最高山峰等你来征服',
        coverImage: coverImages[1],
        cardColor: cardColors[1],
        author: '登山爱好者',
        duration: '1天',
        shopCount: 3,
        likes: 2890
      },
      {
        id: 15,
        district: 'luohu',
        districtName: '罗湖区',
        category: 'all',
        title: '湖贝旧村美食探索',
        desc: '湖贝旧村内的传统美食，感受深圳老城区的味道',
        coverImage: coverImages[2],
        cardColor: cardColors[2],
        author: '老街坊',
        duration: '半天',
        shopCount: 10,
        likes: 1987
      },
      {
        id: 16,
        district: 'yantian',
        districtName: '盐田区',
        category: 'all',
        title: '盐田海滨栈道徒步',
        desc: '最美海岸线徒步路线，山海相连的绝美风景',
        coverImage: coverImages[6],
        cardColor: cardColors[0],
        author: '户外达人',
        duration: '1天',
        shopCount: 4,
        likes: 1892
      },
      {
        id: 17,
        district: 'yantian',
        districtName: '盐田区',
        category: 'recommend',
        title: '小梅沙度假村游玩',
        desc: '小梅沙海滩游玩攻略，游泳、烧烤、住宿全指南',
        coverImage: coverImages[7],
        cardColor: cardColors[1],
        author: '旅行博主',
        duration: '1天',
        shopCount: 5,
        likes: 2345
      },
      {
        id: 18,
        district: 'yantian',
        districtName: '盐田区',
        category: 'all',
        title: '盐田海鲜街',
        desc: '盐田海鲜市场周边餐厅，新鲜海鲜现买现加工',
        coverImage: coverImages[0],
        cardColor: cardColors[2],
        author: '海鲜控',
        duration: '1天',
        shopCount: 12,
        likes: 3567
      },
      {
        id: 19,
        district: 'yantian',
        districtName: '盐田区',
        category: 'recommend',
        title: '东部华侨城攻略',
        desc: '东部华侨城游玩全指南，大峡谷、茶溪谷一日游',
        coverImage: coverImages[1],
        cardColor: cardColors[3],
        author: '景区达人',
        duration: '1天',
        shopCount: 8,
        likes: 4123
      },
      {
        id: 20,
        district: 'longgang',
        districtName: '龙岗区',
        category: 'recommend',
        title: '龙岗美食探索之旅',
        desc: '龙岗中心城和坂田片区特色美食，地道客家菜推荐',
        coverImage: coverImages[7],
        cardColor: cardColors[1],
        author: '美食猎人',
        duration: '1天',
        shopCount: 12,
        likes: 2456
      },
      {
        id: 21,
        district: 'longgang',
        districtName: '龙岗区',
        category: 'all',
        title: '大运中心周边',
        desc: '大运中心体育馆周边美食和休闲场所推荐',
        coverImage: coverImages[2],
        cardColor: cardColors[2],
        author: '运动达人',
        duration: '半天',
        shopCount: 8,
        likes: 1789
      },
      {
        id: 22,
        district: 'longgang',
        districtName: '龙岗区',
        category: 'recommend',
        title: '甘坑客家小镇',
        desc: '体验客家文化，逛古村落，品尝客家美食',
        coverImage: coverImages[3],
        cardColor: cardColors[3],
        author: '文化探索者',
        duration: '1天',
        shopCount: 6,
        likes: 3210
      },
      {
        id: 23,
        district: 'longgang',
        districtName: '龙岗区',
        category: 'all',
        title: '坂田商业中心',
        desc: '坂田万科城、华为基地周边美食和购物指南',
        coverImage: coverImages[4],
        cardColor: cardColors[4],
        author: '坂田通',
        duration: '1天',
        shopCount: 15,
        likes: 2678
      },
      {
        id: 24,
        district: 'dapeng',
        districtName: '大鹏新区',
        category: 'all',
        title: '大鹏半岛海滩攻略',
        desc: '东西涌、较场尾、杨梅坑，大鹏最美海滩游玩指南',
        coverImage: coverImages[0],
        cardColor: cardColors[2],
        author: '旅行博主',
        duration: '2天',
        shopCount: 8,
        likes: 3210
      },
      {
        id: 25,
        district: 'dapeng',
        districtName: '大鹏新区',
        category: 'recommend',
        title: '大鹏所城探秘',
        desc: '深圳保存最完整的明清古城，感受历史韵味',
        coverImage: coverImages[5],
        cardColor: cardColors[5],
        author: '历史爱好者',
        duration: '1天',
        shopCount: 4,
        likes: 1892
      },
      {
        id: 26,
        district: 'dapeng',
        districtName: '大鹏新区',
        category: 'all',
        title: '七娘山登山攻略',
        desc: '深圳第二高峰七娘山徒步路线，俯瞰大鹏湾美景',
        coverImage: coverImages[6],
        cardColor: cardColors[0],
        author: '登山达人',
        duration: '1天',
        shopCount: 3,
        likes: 2345
      },
      {
        id: 27,
        district: 'dapeng',
        districtName: '大鹏新区',
        category: 'recommend',
        title: '大鹏海鲜美食',
        desc: '大鹏本地海鲜餐厅推荐，新鲜实惠的渔家风味',
        coverImage: coverImages[7],
        cardColor: cardColors[1],
        author: '海鲜吃货',
        duration: '1天',
        shopCount: 10,
        likes: 3567
      },
      {
        id: 28,
        district: 'baoan',
        districtName: '宝安区',
        category: 'recommend',
        title: '宝安夜市美食地图',
        desc: '沙井生蚝、福永烧腊、西乡小吃，宝安特色美食一网打尽',
        coverImage: coverImages[1],
        cardColor: cardColors[3],
        author: '夜市达人',
        duration: '1天',
        shopCount: 15,
        likes: 2890
      },
      {
        id: 29,
        district: 'baoan',
        districtName: '宝安区',
        category: 'all',
        title: '海上田园游玩',
        desc: '海上田园生态旅游区，感受水乡风情',
        coverImage: coverImages[2],
        cardColor: cardColors[4],
        author: '亲子游达人',
        duration: '1天',
        shopCount: 6,
        likes: 2103
      },
      {
        id: 30,
        district: 'baoan',
        districtName: '宝安区',
        category: 'recommend',
        title: '西乡步行街',
        desc: '西乡老城区商业街，本地特色小吃和传统美食',
        coverImage: coverImages[3],
        cardColor: cardColors[5],
        author: '老街坊',
        duration: '半天',
        shopCount: 12,
        likes: 1876
      },
      {
        id: 31,
        district: 'longhua',
        districtName: '龙华区',
        category: 'all',
        title: '龙华商圈购物指南',
        desc: '龙华天虹、星河COCO City、壹方天地，购物美食一站式体验',
        coverImage: coverImages[2],
        cardColor: cardColors[4],
        author: '购物达人',
        duration: '1天',
        shopCount: 12,
        likes: 1678
      },
      {
        id: 32,
        district: 'longhua',
        districtName: '龙华区',
        category: 'recommend',
        title: '观澜湖高尔夫度假区',
        desc: '观澜湖休闲度假攻略，高尔夫、温泉、购物一应俱全',
        coverImage: coverImages[4],
        cardColor: cardColors[0],
        author: '度假达人',
        duration: '1天',
        shopCount: 5,
        likes: 2890
      },
      {
        id: 33,
        district: 'longhua',
        districtName: '龙华区',
        category: 'all',
        title: '龙华公园周边',
        desc: '龙华公园散步、晨练，周边早茶餐厅推荐',
        coverImage: coverImages[5],
        cardColor: cardColors[1],
        author: '晨练爱好者',
        duration: '半天',
        shopCount: 8,
        likes: 1567
      }
    ]

    const normalizedGuides = allGuides.map(item => ({
      ...item,
      baseUseCount: item.likes || 0,
      cityText: inferGuideCity(item)
    }))

    const publishedGuides = getPublishedGuides(cardColors)
    const mergedGuides = publishedGuides.concat(normalizedGuides)
    const filteredGuides = this.data.districtId
      ? mergedGuides.filter(g => g.district === this.data.districtId)
      : mergedGuides

    this.setData({
      guideSource: filteredGuides,
      guides: decorateGuideCards(filteredGuides)
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 点击攻略卡片，进入攻略详情页。
  onGuideTap(e) {
    const guide = e.currentTarget.dataset.guide
    wx.navigateTo({
      url: `/subpackages/guide/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}`
    })
  }
})
