/**
 * routeDataUtil.test.js — 回归测试路线数据纯函数工具集
 *
 * 本次改动：把 my-route.js 顶部的纯函数抽出到 routeDataUtil.js（删除死代码，
 * 移除 4 个 behavior 文件）。这些函数负责路线的展示字段、地点匹配、跨天拖拽等
 * 核心逻辑，发版前需确保逻辑未在抽取过程中改变。
 */

// 提前 mock placesData，routeDataUtil 内部依赖其 getAllPlaces
jest.mock('../../utils/placesData', () => ({
  getAllPlaces: jest.fn(),
  getFoods: jest.fn(() => []),
  getSpots: jest.fn(() => []),
}))

const {
  MAX_DELETE_OFFSET,
  buildCurrentLocationDisplayName,
  buildSyntheticLatLng,
  inferTag,
  findMatchedPlace,
  decorateRoutePlaceItem,
  removeEmptyDaysOnSave,
  buildDaySectionsFromLegacy,
  buildPlacePickerData,
  buildAddedPlace,
  buildMapPickedPlace,
  moveItemAcrossDays,
} = require('../../subpackages/route/utils/routeDataUtil')
const placesData = require('../../utils/placesData')

const mockStorage = global.__mockStorage

beforeEach(() => {
  mockStorage.__resetStorage()
  jest.clearAllMocks()
})

// ─── 常量 ───────────────────────────────────────

describe('常量', () => {
  test('MAX_DELETE_OFFSET 恒为 -84（左滑删除打开距离）', () => {
    expect(MAX_DELETE_OFFSET).toBe(-84)
  })
})

// ─── buildCurrentLocationDisplayName ────────────

describe('buildCurrentLocationDisplayName', () => {
  test('有地址时拼成“当前所在位置（地址）”', () => {
    expect(buildCurrentLocationDisplayName('深圳市南山区蛇口')).toBe('当前所在位置（深圳市南山区蛇口）')
  })
  test('无地址时只显示“当前所在位置”', () => {
    expect(buildCurrentLocationDisplayName()).toBe('当前所在位置')
    expect(buildCurrentLocationDisplayName('   ')).toBe('当前所在位置')
  })
})

// ─── buildSyntheticLatLng ───────────────────────

describe('buildSyntheticLatLng', () => {
  test('按天索引与条目索引生成偏移坐标，保证不重叠', () => {
    const city = { lat: 22.5, lng: 113.9 }
    const a = buildSyntheticLatLng(city, 0, 0)
    const b = buildSyntheticLatLng(city, 0, 1)
    const c = buildSyntheticLatLng(city, 1, 0)
    expect(a.lat).not.toBe(b.lat)
    expect(a.lat).not.toBe(c.lat)
    expect(b.lng).toBeGreaterThan(a.lng) // 同一城市内横向偏移
  })
})

// ─── inferTag ──────────────────────────────────

describe('inferTag 名称猜标签', () => {
  test('博物馆/美术馆 → 文化展馆', () => {
    expect(inferTag('市博物馆')).toBe('文化展馆')
    expect(inferTag('当代美术馆')).toBe('文化展馆')
  })
  test('剧场/音乐会 → 演出', () => {
    expect(inferTag('大剧场')).toBe('演出')
    expect(inferTag('音乐会')).toBe('演出')
  })
  test('商场/步行街 → 购物', () => {
    expect(inferTag('中心城购物中心')).toBe('购物')
    expect(inferTag('步行街')).toBe('购物')
  })
  test('店铺/餐厅/咖啡等 → 美食', () => {
    expect(inferTag('老字号面馆')).toBe('美食')
    expect(inferTag('咖啡厅')).toBe('美食')
  })
  test('其他 → 景点', () => {
    expect(inferTag('深圳湾')).toBe('景点')
    expect(inferTag('')).toBe('景点')
  })
})

// ─── findMatchedPlace ──────────────────────────

describe('findMatchedPlace 匹配系统地点', () => {
  beforeEach(() => {
    placesData.getAllPlaces.mockReturnValue([
      { id: 'p1', name: '蛇口老街面馆', type: 'food' },
      { id: 'p2', name: '海上世界', type: 'spot' },
      { id: 'p3', name: '美术馆（南山区）', type: 'spot' },
    ])
  })

  test('精确匹配返回对应地点', () => {
    const hit = findMatchedPlace('海上世界')
    expect(hit && hit.id).toBe('p2')
  })

  test('名称包含/被包含时模糊匹配', () => {
    const hit = findMatchedPlace('蛇口老街面馆 老字号') // 去掉空格/符号后仍命中
    // normalizeName 去空格后为 "蛇口老街面馆老字号"，与 "蛇口老街面馆" 互相包含
    expect(hit).toBeTruthy()
  })

  test('无匹配返回 null', () => {
    expect(findMatchedPlace('完全不存在的店XYZ')).toBeNull()
  })

  test('空名称返回 null', () => {
    expect(findMatchedPlace('')).toBeNull()
    expect(findMatchedPlace(null)).toBeNull()
  })
})

// ─── decorateRoutePlaceItem ────────────────────

describe('decorateRoutePlaceItem 补齐展示字段', () => {
  test('补齐 displayCategory / tags / 交通文案', () => {
    const item = {
      id: 'x1',
      name: '测试店',
      type: 'food',
      travelMeta: { mode: 'walk', distance: 500 },
    }
    const result = decorateRoutePlaceItem(item)
    expect(result.displayCategory).toBe('美食')
    expect(Array.isArray(result.tags)).toBe(true)
    expect(result.travelDistanceText).toBe('500米')
    expect(result.travelSummaryText).toContain('·')
  })

  test('空对象也能安全处理', () => {
    const result = decorateRoutePlaceItem({})
    expect(result.displayCategory).toBeDefined()
    expect(result.travelModeLabel).toBeDefined()
  })
})

// ─── removeEmptyDaysOnSave ─────────────────────

describe('removeEmptyDaysOnSave', () => {
  test('过滤空的待计划天，保留有内容的天', () => {
    const input = [
      { id: 'd1', items: [{ id: 'a' }] },
      { id: '__pending__', items: [] },
      { id: 'd2', items: [{ id: 'b' }] },
    ]
    const result = removeEmptyDaysOnSave(input)
    expect(result.length).toBe(2)
    expect(result.some(d => d.id === '__pending__')).toBe(false)
  })

  test('全为空时保底返回第一条（避免保存空路线）', () => {
    const input = [{ id: '__pending__', items: [] }]
    const result = removeEmptyDaysOnSave(input)
    expect(result.length).toBe(1)
  })

  test('空数组返回空数组', () => {
    expect(removeEmptyDaysOnSave([])).toEqual([])
    expect(removeEmptyDaysOnSave(null)).toEqual([])
  })
})

// ─── buildDaySectionsFromLegacy ────────────────

describe('buildDaySectionsFromLegacy', () => {
  test('有 daySections 时返回', () => {
    const sections = [{ id: 'd1', items: [] }]
    expect(buildDaySectionsFromLegacy({ daySections: sections })).toBe(sections)
  })
  test('无 daySections 返回空数组', () => {
    expect(buildDaySectionsFromLegacy({})).toEqual([])
    expect(buildDaySectionsFromLegacy(null)).toEqual([])
  })
})

// ─── buildPlacePickerData ──────────────────────

describe('buildPlacePickerData 添加地点弹窗数据', () => {
  beforeEach(() => {
    placesData.getAllPlaces.mockReturnValue([
      { id: 'p1', name: '蛇口老街面馆', type: 'food', tags: ['粤菜', '老字号'] },
      { id: 'p2', name: '海上世界', type: 'spot' },
    ])
  })

  test('想去 + 收藏 + 全部三类汇总正确', () => {
    wx.setStorageSync('userWantList', ['p1'])
    wx.setStorageSync('userCollectedFoods', ['p1'])
    wx.setStorageSync('userCollectedSpots', ['p2'])
    const data = buildPlacePickerData()
    // 想去列表
    expect(data.want.some(i => i.id === 'p1')).toBe(true)
    // 收藏列表
    expect(data.collect.length).toBe(2)
    // 全部（去重后）
    expect(data.all.length).toBe(2)
    // 同时在想去和收藏的地点在 all 中标注
    const p1 = data.all.find(i => i.id === 'p1')
    expect(p1.sourceText).toBe('已在想去和收藏')
  })

  test('无任何用户数据时返回空列表', () => {
    const data = buildPlacePickerData()
    expect(data.want).toEqual([])
    expect(data.collect).toEqual([])
    expect(data.all).toEqual([])
  })

  test('用户添加店铺也纳入可选来源', () => {
    wx.setStorageSync('userAddedShops', [{ id: 'u1', name: '我的小店', type: 'food' }])
    wx.setStorageSync('userWantList', ['u1'])
    const data = buildPlacePickerData()
    expect(data.want.some(i => i.id === 'u1')).toBe(true)
  })
})

// ─── buildAddedPlace ───────────────────────────

describe('buildAddedPlace', () => {
  test('生成手动添加的地点格式', () => {
    const result = buildAddedPlace({
      id: 'p1', name: '店名', tag: '美食', coverImage: '/img.jpg', type: 'food',
      lat: 22.5, lng: 113.9,
    })
    expect(result.originalId).toBe('p1')
    expect(result.id).toMatch(/^manual-/)
    expect(result.name).toBe('店名')
    expect(result.tag).toBe('美食')
    expect(result.type).toBe('food')
    expect(result.lat).toBe(22.5)
  })
})

// ─── buildMapPickedPlace ───────────────────────

describe('buildMapPickedPlace', () => {
  test('生成地图选点地点格式', () => {
    const result = buildMapPickedPlace({
      latitude: '22.55', longitude: '113.95', name: '地图点', address: '南山区',
    })
    expect(result.id).toMatch(/^map-/)
    expect(result.name).toBe('地图点')
    expect(result.type).toBe('spot')
    expect(result.lat).toBe(22.55)   // Number 转换
    expect(result.lng).toBe(113.95)
  })

  test('无名称时回退地址，再回退“地图选点”', () => {
    const byAddress = buildMapPickedPlace({ latitude: 1, longitude: 2, address: '某地址' })
    expect(byAddress.name).toBe('某地址')
    const fallback = buildMapPickedPlace({ latitude: 1, longitude: 2 })
    expect(fallback.name).toBe('地图选点')
  })
})

// ─── moveItemAcrossDays ────────────────────────

describe('moveItemAcrossDays 跨天拖拽', () => {
  function makeSections() {
    return [
      { id: 'd1', items: [{ id: 'a' }, { id: 'b' }] },
      { id: 'd2', items: [{ id: 'c' }] },
    ]
  }

  test('跨天移动：从 d1 移到 d2', () => {
    const result = moveItemAcrossDays(makeSections(), 0, 1, 1, 0)
    expect(result[0].items.map(i => i.id)).toEqual(['a'])
    expect(result[1].items.map(i => i.id)).toEqual(['b', 'c'])
  })

  test('同天移动：目标索引需修正（移除后前移一位）', () => {
    const sections = makeSections()
    // 从 d1 的 index1 移到 d1 的 index1（实际应落到 index0，因为移除前移）
    const result = moveItemAcrossDays(sections, 0, 1, 0, 1)
    expect(result[0].items.map(i => i.id)).toEqual(['a', 'b'])
  })

  test('不修改原数组（纯函数）', () => {
    const sections = makeSections()
    const before = JSON.stringify(sections)
    moveItemAcrossDays(sections, 0, 0, 1, 0)
    expect(JSON.stringify(sections)).toBe(before)
  })

  test('非法索引返回原结构（安全处理）', () => {
    const sections = makeSections()
    const result = moveItemAcrossDays(sections, 99, 0, 1, 0)
    expect(result[0].items.length).toBe(2)
    expect(result[1].items.length).toBe(1)
  })

  test('空数据安全返回', () => {
    expect(moveItemAcrossDays([], 0, 0, 1, 0)).toEqual([])
    expect(moveItemAcrossDays(null, 0, 0, 1, 0)).toEqual([])
  })
})
