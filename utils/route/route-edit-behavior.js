const util = require('../../utils/util')
const { buildMapPreviewViewData } = require('../../utils/map-preview')
const { getLikeType, getCityInfo, buildDayLabel, buildTabs, buildSummaryText, buildPreviewTitle, buildPreviewRouteData } = require('../routeHelper')


// 把临时路线重新应用回当前预览页：
// 这样从"基础信息"页回来后，不需要先落库也能立刻看到修改结果。
function buildPreviewStateFromRoute(route = {}, currentStart = null) {
  const citySource = route.city || route.cityText || route.title || ''
  const cityInfo = getCityInfo(citySource)
  const routeDaySections = (route.daySections || []).map((day, dayIndex) => ({
    ...day,
    id: day.id || `preview-day-${dayIndex}`,
    title: day.title || buildDayLabel(dayIndex + 1),
    countText: `${(day.items || []).length} 个地点`,
    items: (day.items || []).map((item, itemIndex) => {
      const lat = item.lat || item.latitude
      const lng = item.lng || item.longitude
      const decorated = decorateRouteCardItem({
        ...item,
        coverImage: item.coverImage || getCoverImage(item),
        image: item.image || item.coverImage || getCoverImage(item),
        tagText: item.tagText || getItemTagText(item),
        distanceStr: item.distanceStr || util.formatDistance(item.distanceFromPrev || 0),
        timeStr: item.timeStr || estimateRouteDuration(item.distanceFromPrev || 0, item.travelMode)
      })
      return {
        ...decorated,
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        dayIndex,
        itemIndex
      }
    })
  }))
  const routeShops = routeDaySections.reduce((result, day) => result.concat(day.items || []), [])
  const totalDistanceValue = routeShops.reduce((sum, item) => sum + (item.distanceFromPrev || 0), 0)
  const totalMinutes = routeShops.reduce((sum, item) => {
    const modeKey = (item.travelMeta && item.travelMeta.mode) || item.travelMode
    const modeConfig = MODE_CONFIG[modeKey] || MODE_CONFIG.ride
    return sum + ((Math.max(0, item.distanceFromPrev || 0) / 1000) * modeConfig.minutesPerKm)
  }, 0)
  const previewViewData = routeShops.length
    ? buildMapPreviewViewData(routeDaySections, -1, 0, routeShops[0], routeShops.length)
    : {}

  return {
    routeShops,
    routeDaySections,
    tabs: routeDaySections.length ? buildTabs(routeDaySections.length) : [],
    currentTab: 0,
    currentMapDay: -1,
    sheetScrollTarget: '',
    summaryText: route.subtitle || buildSummaryText(routeDaySections),
    cityText: cityInfo.name,
    routeTitle: route.title || buildPreviewTitle(cityInfo.name, routeDaySections.length, routeDaySections),
    previewRouteId: route.id ? String(route.id) : '',
    hasUnsavedPreview: true,
    preferredDayCount: Math.max(routeDaySections.length || route.dayCount || 1, 1),
    totalDistance: util.formatDistance(totalDistanceValue),
    totalTime: formatDurationShort(totalMinutes),
    mapPreviewShop: routeShops[0] || null,
    mapPreviewIndex: 0,
    mapCenter: routeShops.length
      ? {
          lat: routeShops[0].lat || routeShops[0].latitude,
          lng: routeShops[0].lng || routeShops[0].longitude
        }
      : {
          lat: (currentStart && currentStart.lat) || cityInfo.lat,
          lng: (currentStart && currentStart.lng) || cityInfo.lng
        },
    ...previewViewData
  }
}


module.exports = Behavior({
  data: {
    // ★ 选择模式：all=最优路径, custom=自定义
    selectMode: 'all',

    // ★ 所有想去店铺候选池
    allLikedShops: [],

    // 编辑模式
    reorderSheetVisible: false,
    // 路线规划弹窗默认不选中任何方式，需用户手动选择
    pendingReorderMode: '',
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
          const routeShops = this._planAndAnnotate(shops)
          this.setData({ routeShops, isEditing: false, reorderSheetVisible: false })
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
          // 每次打开都重置为未选择状态
          pendingReorderMode: ''
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
              this.setData(buildPreviewStateFromRoute(updatedRoute, this.data.currentStart))
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
          // 关闭时清空选择，避免下次打开沿用上一次状态
          pendingReorderMode: ''
        })
      },
    
      // 在弹窗里选择"智能重排"还是"手动编辑"
      onSelectReorderMode(e) {
        const { mode } = e.currentTarget.dataset
        if (!mode) return
        this.setData({ pendingReorderMode: mode })
      },
    
      // 确认重排方式：智能重排直接优化，手动编辑跳到我的路线编辑页。
      onConfirmReorderMode() {
        if (!this.data.pendingReorderMode) {
          wx.showToast({ title: '请先选择操作', icon: 'none' })
          return
        }
    
        if (this.data.pendingReorderMode === 'manual') {
          const previewRoute = buildPreviewRouteData(this.data, { isDraft: true })
          if (!previewRoute) return
          this.setData({
            reorderSheetVisible: false,
            previewRouteId: previewRoute.id,
            hasUnsavedPreview: true
          })
          wx.navigateTo({
            url: `/subpackages/route/pages/my-route/my-route?route=${encodeURIComponent(JSON.stringify(previewRoute))}&edit=1&create=1&fromPreview=1`,
            success: (res) => {
              // 手动编辑保存后，把最新路线回传给当前预览页；取消则直接回到这里。
              res.eventChannel.on('previewRouteEdited', (updatedRoute) => {
                if (!updatedRoute) return
                this.setData(buildPreviewStateFromRoute(updatedRoute, this.data.currentStart))
                this.updateMap()
                if (updatedRoute.daySections && updatedRoute.daySections.length) {
                  this.focusPreviewByIndex(0, -1)
                }
              })
            }
          })
          return
        }
    
        this.onOptimizeRoute()
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
        const shop = this.data.allLikedShops.find(item => String(item.id) === String(shopId))
        util.toggleLike(shopId, getLikeType(shop || {}, this.data.routeType))
        this.loadRoute()
        wx.showToast({ title: '已从路线移除', icon: 'none' })
      },
},
})