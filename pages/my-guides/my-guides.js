// 觅食图 - 我的攻略页面
const util = require('../../utils/util')
const shopData = require('../../utils/shopData')
const spotData = require('../../utils/spotData')

Page({
  data: {
    // 攻略列表
    myGuides: [],
    guideCount: 0,

    // 导航栏
    statusBarHeight: 44
  },

  onLoad() {
    this.initNavigationBar()
    this.loadMyGuides()
  },

  onShow() {
    this.loadMyGuides()
  },

  // 初始化导航栏
  initNavigationBar() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 44
    })
  },

  // 加载我的攻略
  loadMyGuides() {
    const guides = util.loadData('myGuides', [])
    
    // 处理每个攻略，生成封面图和元数据
    guides.forEach(g => {
      // 格式化日期
      g.dateStr = new Date(g.date).toLocaleDateString('zh-CN')
      
      // 尝试获取封面图：从攻略内容中的第一个店铺/景点获取图片
      if (!g.coverImage && g.content && g.content.length > 0) {
        const firstItem = g.content[0]
        const allShops = [...(shopData.shops || []), ...(shopData.foods || [])]
        const allSpots = spotData.spotData || []
        
        // 在店铺中查找
        const shop = allShops.find(s => String(s.id) === String(firstItem.id))
        if (shop) {
          g.coverImage = shop.logo || shop.image || shop.thumb
        } else {
          // 在景点中查找
          const spot = allSpots.find(s => String(s.id) === String(firstItem.id))
          if (spot) {
            g.coverImage = spot.image || spot.logo || spot.thumb
          }
        }
        
        // 如果都没有，使用默认封面
        if (!g.coverImage) {
          g.coverImage = '/images/app-logo.jpg'
        }
      }
      
      // 计算店铺数量
      g.shopCount = g.content ? g.content.length : 0
    })
    
    this.setData({
      myGuides: guides,
      guideCount: guides.length
    })
  },

  // 加载攻略到地图
  onLoadGuide(e) {
    const guide = e.currentTarget.dataset.guide
    if (!guide || !guide.content) {
      wx.showToast({ title: '攻略内容不存在', icon: 'none' })
      return
    }

    // 跳转到探索页，传递攻略内容
    wx.switchTab({
      url: '/pages/index/index',
      success: () => {
        const pages = getCurrentPages()
        const currentPage = pages[pages.length - 1]
        if (currentPage && currentPage.loadGuideFromContent) {
          currentPage.loadGuideFromContent(guide.content)
        }
        wx.showToast({ title: '已加载攻略', icon: 'success' })
      }
    })
  },

  // 管理攻略
  onManageGuides() {
    if (this.data.myGuides.length === 0) {
      wx.showToast({ title: '还没有攻略', icon: 'none' })
      return
    }

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

  // 删除单条攻略
  onDeleteGuide(e) {
    e.stopPropagation()
    const guideId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条攻略吗？',
      success: (res) => {
        if (res.confirm) {
          let guides = util.loadData('myGuides', [])
          guides = guides.filter(g => g.id !== guideId)
          util.saveData('myGuides', guides)
          this.loadMyGuides()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  // 图片加载失败
  onImageError(e) {
    const index = e.currentTarget.dataset.index
    const key = `myGuides[${index}].coverImage`
    this.setData({ [key]: '/images/app-logo.jpg' })
  }
})
