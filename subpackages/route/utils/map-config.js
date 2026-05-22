/**
 * 地图配置
 * 用于路线规划页面的地图显示和路线规划
 */

// 默认中心坐标（深圳市）
const DEFAULT_CENTER = { lat: 22.5431, lng: 114.0579 }

// 默认起点坐标（深圳市）
const DEFAULT_START = { lat: 22.5431, lng: 114.0579 }

// 主题颜色
const THEME_COLORS = {
  primary: '#00D9C0', // 主色调（青色）
  start: '#4CAF50',    // 起点（绿色）
  end: '#F44336',      // 终点（红色）
  drive: '#2196F3',    // 驾车（蓝色）
  transit: '#FF9800',  // 公交（橙色）
  walk: '#4CAF50',     // 步行（绿色）
  ride: '#9C27B0'      // 骑行（紫色）
}

// 出行方式映射到腾讯地图API的模式
const TRAVEL_MODE_MAP = {
  drive: 'driving',
  transit: 'transit',
  walk: 'walking',
  ride: 'bicycling'
}

// 路线配置
const ROUTE_CONFIG = {
  LOADING_RESET_DELAY: 500,  // 加载重置延迟（毫秒）
  API_DELAY: 200,            // API请求延迟（毫秒），避免限流
  OPTIMIZE_DELAY: 300,       // 优化延迟（毫秒）
  DP_CALC_DELAY: 100,       // DP计算延迟（毫秒）
  MAX_DP_SHOPS: 10,         // DP算法最大店铺数
  SIMULATION_STEPS: 20       // 模拟路线插值点数
}

// 弯曲因子（用于模拟路线）
const BEND_FACTOR = {
  drive: 0.0003,   // 驾车弯曲程度
  transit: 0.0002,  // 公交弯曲程度
  walk: 0.0005,     // 步行弯曲程度
  ride: 0.0004      // 骑行弯曲程度
}

// 腾讯地图API基础URL
const QQ_MAP_API_BASE = 'https://apis.map.qq.com/ws/direction/v1'

// 默认地图缩放级别
const DEFAULT_MAP_SCALE = 14

// 地图缩放级别阈值（根据路线跨度确定缩放级别）
const MAP_SCALE_THRESHOLDS = [
  { threshold: 0.02, scale: 15 },   // 很小范围
  { threshold: 0.05, scale: 14 },   // 小范围
  { threshold: 0.1, scale: 13 },    // 中等范围
  { threshold: 0.2, scale: 12 },    // 大范围
  { threshold: 0.5, scale: 11 },    // 很大范围
  { threshold: 1.0, scale: 10 },    // 超大范围
  { threshold: Infinity, scale: 9 }  // 极大范围
]

module.exports = {
  DEFAULT_CENTER,
  DEFAULT_START,
  THEME_COLORS,
  TRAVEL_MODE_MAP,
  ROUTE_CONFIG,
  BEND_FACTOR,
  QQ_MAP_API_BASE,
  DEFAULT_MAP_SCALE,
  MAP_SCALE_THRESHOLDS
}
