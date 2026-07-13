const util = require('../../../utils/util')
const { buildPreviewRouteData, flattenDaySections } = require('../../../utils/routeHelper')
const { buildPreviewStateFromRoute } = require('./routeHelper')


module.exports = Behavior({
  data: {
    // ★ 选择模式：all=最优路径, custom=自定义
    selectMode: 'all',

    // ★ 所有想去店铺候选池
    allLikedShops: [],

    // 编辑模式
    reorderSheetVisible: false,
    routeShopsBackup: [],
    routeDaySectionsBackup: []
  },

  methods: {
      // 重新做一次智能排序优化。
      onOptimizeRoute() {
        wx.showLoading({ title: '优化中...' })
        setTimeout(() => {
          const shops = this.data.selectMode === 'all'
            ? this.data.allLikedShops
            : this.data.allLikedShops.filter(s => s.selected)
          const daySections = this._planRouteByDays(shops)
          const routeShops = flattenDaySections(daySections)
          this.setData({ daySections, routeShops, isEditing: false, reorderSheetVisible: false })
          this.refreshPreviewRoute(routeShops, { markDirty: true })
          this.updateMap()
          wx.hideLoading()
          wx.showToast({ title: '路线已优化', icon: 'success' })
        }, 400)
      },
    
      // 进入或退出当前页内的简易编辑模式。
      onToggleEdit() {
        const isEditing = !this.data.isEditing
        this.setData({ isEditing })
        if (!isEditing) {
          wx.showToast({ title: '顺序已保存', icon: 'success' })
        }
      },
    
      // 打开"编辑路线规划"弹窗
      onOpenReorderSheet() {
        this.setData({
          reorderSheetVisible: true,
        })
      },
    
      // 去基础信息页
      onEditBasicInfo() {
        const previewRoute = buildPreviewRouteData(this.data, { isDraft: true })
        if (!previewRoute) return
        this.setData({ previewRouteId: previewRoute.id, hasUnsavedPreview: true })
        wx.navigateTo({
          url: `/subpackages/route/pages/route-basic-edit/route-basic-edit?route=${encodeURIComponent(JSON.stringify(previewRoute))}&temp=1`,
          success: (res) => {
            res.eventChannel.on('routeBasicSaved', (updatedRoute) => {
              if (!updatedRoute) return
              this.setData(buildPreviewStateFromRoute(updatedRoute, this.data.currentStart), () => {
                if (typeof this.ensureAutoSavedPreviewRoute === 'function') {
                  this.ensureAutoSavedPreviewRoute()
                }
              })
              this.updateMap()
              if (updatedRoute.daySections && updatedRoute.daySections.length) {
                this.focusPreviewByIndex(0, -1)
              }
            })
          }
        })
      },
    
      // 关闭"编辑路线规划"弹窗
      onCloseReorderSheet() {
        this.setData({
          reorderSheetVisible: false,
        })
      },
        
      // 取消页内顺序编辑，恢复备份数据。
      onCancelEdit() {
        const routeShops = JSON.parse(JSON.stringify(this.data.routeShopsBackup || []))
        this.setData({
          isEditing: false,
          routeShops,
          routeShopsBackup: [],
          currentTab: 0,
          sheetScrollTarget: ''
        })
        this.refreshPreviewRoute(routeShops)
        this.updateMap()
      },
    
      // 确认页内顺序编辑。
      onConfirmEdit() {
        this.setData({
          isEditing: false,
          routeShopsBackup: [],
          currentTab: 0,
          sheetScrollTarget: ''
        })
        this.refreshPreviewRoute(this.data.routeShops)
        this.updateMap()
        wx.showToast({ title: '顺序已保存', icon: 'success' })
      },
    
      // 某个地点上移一位
      onMoveUp(e) {
        const index = e.currentTarget.dataset.index
        if (index <= 0) return
        const shops = [...this.data.routeShops]
        ;[shops[index], shops[index - 1]] = [shops[index - 1], shops[index]]
        this.setData({ routeShops: shops })
        this.refreshPreviewRoute(shops)
        this.updateMap()
      },
    
      // 某个地点下移一位
      onMoveDown(e) {
        const index = e.currentTarget.dataset.index
        if (index >= this.data.routeShops.length - 1) return
        const shops = [...this.data.routeShops]
        ;[shops[index], shops[index + 1]] = [shops[index + 1], shops[index]]
        this.setData({ routeShops: shops })
        this.refreshPreviewRoute(shops)
        this.updateMap()
      },
    
      // 从当前路线里移除某个地点，同时取消它的"想去"状态。
      onRemoveShop(e) {
        const shopId = e.currentTarget.dataset.shopid
        util.toggleWant(shopId)
        this.loadRoute()
        wx.showToast({ title: '已从路线移除', icon: 'none' })
      },
},
})
