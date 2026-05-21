const util = require('./util')

// 导入路线时，如果文本里有“没有收录”的地点，
// 这里给它生成一组临时坐标，保证后面的路线页还能正常规划。
function buildSyntheticImportLatLng(basePoint, index) {
  const seed = index + 1
  return {
    lat: Number((basePoint.lat + seed * 0.0023).toFixed(6)),
    lng: Number((basePoint.lng + seed * 0.0021).toFixed(6))
  }
}

// 根据地点数量给一个默认天数，避免导入后还要先手动补天数。
function buildImportedDayCount(placeCount) {
  const count = Math.max(1, parseInt(placeCount, 10) || 1)
  if (count <= 4) return 1
  if (count <= 8) return 2
  if (count <= 12) return 3
  return Math.min(Math.ceil(count / 4), 7)
}

// 把未收录地点转换成项目本地可识别的“临时美食地点”。
// 这样即使系统里没有这家店，也能先把路线跑通。
// TODO: 用AI搜索图片
function buildImportedFoodItems(items = []) {
  const basePoint = getApp().globalData.location || getApp().globalData.centerLocation || { lat: 22.5431, lng: 114.0579 }
  const timestamp = Date.now()
  return (items || []).map((item, index) => {
    const synthetic = buildSyntheticImportLatLng(basePoint, index)
    return {
      id: `imported-route-${timestamp}-${index}`,
      name: item.name || `导入地点${index + 1}`,
      emoji: '🍜',
      rating: 0,
      price: 0,
      category: '其他',
      tags: ['导入路线'],
      address: item.address || '',
      lat: synthetic.lat,
      lng: synthetic.lng,
      hours: item.hours || '',
      dishes: Array.isArray(item.dishes) ? item.dishes : [],
      image: '/images/app-logo.jpg',
      logo: '/images/app-logo.jpg',
      isUserAdded: true,
      importSource: 'route-text'
    }
  })
}

// 把新导入的临时地点合并进 userAddedShops：
// 同名同地址的旧记录直接复用，避免越导越多重复项。
function mergeImportedFoodItems(importedItems = []) {
  const existingItems = util.loadData('userAddedShops', []) || []
  const resultItems = []
  const nextUserAddedShops = existingItems.slice()

  importedItems.forEach(importedItem => {
    const duplicated = nextUserAddedShops.find(item => {
      const sameName = String(item.name || '').trim() === String(importedItem.name || '').trim()
      const sameAddress = String(item.address || '').trim() === String(importedItem.address || '').trim()
      return sameName && sameAddress
    })

    if (duplicated) {
      resultItems.push(duplicated)
      return
    }

    nextUserAddedShops.push(importedItem)
    resultItems.push(importedItem)
  })

  util.saveData('userAddedShops', nextUserAddedShops)
  return resultItems
}

// 解析攻略文本：
// 1. 先找系统已收录地点
// 2. 再把未收录地点补成本地临时地点
// 3. 最后返回可直接带去路线页的 id 列表
function parseRouteTextToIds(text = '') {
  const content = String(text || '').trim()
  if (!content) {
    return {
      routeIds: [],
      dayCount: 1,
      foundItems: [],
      importedItems: [],
      totalCount: 0,
      onlyLink: false
    }
  }

  const onlyLink = /^https?:\/\/\S+$/i.test(content)
  if (onlyLink) {
    return {
      routeIds: [],
      dayCount: 1,
      foundItems: [],
      importedItems: [],
      totalCount: 0,
      onlyLink: true
    }
  }

  const parsedResult = util.parseBlockBasedGuide(content)
  const foundItems = parsedResult.foundShops || []
  const rawImportedItems = buildImportedFoodItems(parsedResult.notFoundShops || [])
  const importedItems = mergeImportedFoodItems(rawImportedItems)
  const routeItems = foundItems.concat(importedItems)

  return {
    routeIds: routeItems.map(item => item.id),
    dayCount: buildImportedDayCount(routeItems.length),
    foundItems,
    importedItems,
    totalCount: routeItems.length,
    onlyLink: false
  }
}

// 判断输入是不是“只有一个链接”。
function isPureLinkText(text = '') {
  return /^https?:\/\/\S+$/i.test(String(text || '').trim())
}

// 前端统一解析导入内容：
// 1. 普通正文直接返回
// 2. 纯链接则调用云函数先提取正文
async function resolveRouteImportText(inputText = '') {
  const content = String(inputText || '').trim()
  if (!content) {
    return {
      success: false,
      text: '',
      sourceType: 'empty',
      message: '请先粘贴内容'
    }
  }

  if (!isPureLinkText(content)) {
    return {
      success: true,
      text: content,
      sourceType: 'text'
    }
  }

  if (!wx.cloud || !wx.cloud.callFunction) {
    return {
      success: false,
      text: '',
      sourceType: 'link',
      message: '当前环境不支持链接解析'
    }
  }

  try {
    const response = await wx.cloud.callFunction({
      name: 'extractRouteFromLink',
      data: {
        url: content
      }
    })
    const result = response && response.result ? response.result : {}
    if (!result.success || !result.text) {
      return {
        success: false,
        text: '',
        sourceType: 'link',
        message: result.message || '链接正文提取失败'
      }
    }
    return {
      success: true,
      text: result.text,
      sourceType: result.sourceType || 'link'
    }
  } catch (error) {
    return {
      success: false,
      text: '',
      sourceType: 'link',
      message: '链接解析失败，请稍后重试'
    }
  }
}

module.exports = {
  buildImportedDayCount,
  parseRouteTextToIds,
  isPureLinkText,
  resolveRouteImportText
}
