/**
 * 地图配置常量
 * 从 pages/route/route.js 提取的硬编码变量
 */

module.exports = {
  // 默认地图中心（珠海）
  DEFAULT_CENTER: { lat: 22.4846, lng: 113.9046 },

  // 默认起点/终点坐标（珠海）
  DEFAULT_START: { lat: 22.4798, lng: 113.9125 },

  // 主题颜色
  THEME_COLORS: {
    primary: '#00D9C0',      // 主色调（青绿色）
    start: '#4CAF50',        // 起点绿色
    end: '#FF5722',          // 终点红色
    drive: '#4A90D9',       // 驾车蓝色
    transit: '#9B59B6',     // 地铁紫色
    walk: '#27AE60'          // 步行绿色
  },

  // 路线配置
  ROUTE_CONFIG: {
    MAX_DP_SHOPS: 15,        // DP算法最大店铺数
    SIMULATION_STEPS: 20,    // 模拟路线插值点数
    API_DELAY: 1100,         // API限流延迟(ms)
    LOADING_RESET_DELAY: 100, // 加载状态重置延迟(ms)
    OPTIMIZE_DELAY: 400,     // 优化算法延迟(ms)
    DP_CALC_DELAY: 100      // DP计算延迟(ms)
  },

  // 模拟路线弯曲因子
  BEND_FACTOR: {
    drive: 0.0003,    // 驾车弯曲度小
    transit: 0.0005,  // 地铁弯曲度中等
    walk: 0.0002      // 步行弯曲度最小
  },

  // 地图缩放级别阈值（根据经纬度跨度）
  MAP_SCALE_THRESHOLDS: [
    { threshold: 0.1, scale: 11 },
    { threshold: 0.05, scale: 12 },
    { threshold: 0.02, scale: 13 },
    { threshold: 0.01, scale: 14 }
  ],
  DEFAULT_MAP_SCALE: 15,

  // 出行方式映射（腾讯地图API）
  TRAVEL_MODE_MAP: {
    drive: 'driving',
    transit: 'transit',
    walk: 'walking'
  },

  // 腾讯地图路径规划API端点
  QQ_MAP_API_BASE: 'https://apis.map.qq.com/ws/direction/v1'
}
