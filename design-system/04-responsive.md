# Responsive & Multi-Device Rules 
 
 ## 断点定义 
 | 断点 | 范围          | 典型设备                  | 
 |------|---------------|------------------------| 
 | xs   | 0 – 374px     | 小屏手机(iPhone SE)      | 
 | sm   | 375 – 767px   | 标准手机                 | 
 | md   | 768 – 1023px  | 平板竖屏                 | 
 | lg   | 1024 – 1279px | 平板横屏 / 小笔记本       | 
 | xl   | 1280px+       | 桌面端                  | 
 
 ## 页面边距 
 - xs / sm：左右各 16px 
 - md：左右各 24px 
 - lg / xl：左右各 32px，内容区最大宽度 1200px，居中 
 
 ## 字号响应规则 
 - display：sm=28px，md=32px，lg=40px 
 - heading-1：sm=20px，md=24px，lg=28px 
 - body：所有断点固定 16px，不随屏幕缩放 
 
 ## 栅格系统 
 - 手机：4 列，gutters 16px 
 - 平板：8 列，gutters 24px 
 - 桌面：12 列，gutters 24px 
 
 ## 触控与鼠标行为差异 
 - 移动端：所有可点击元素最小触控区域 44×44px 
 - 移动端：❌ 禁止 hover 态作为唯一信息展示方式 
 - 桌面端：可以使用 hover 展示操作项 
 
 ## 图片响应式规则 
 - 所有图片使用相对单位（100% 宽度），❌ 禁止固定像素宽度 
 - Hero Banner：sm=16:9，lg=21:9 
 - 缩略图网格：sm=2列，md=3列，lg=4列 
 
 ## iOS 安全区适配 
 - 底部需要 safeAreaInsets.bottom 留白 
 - 顶部状态栏区域不允许覆盖内容 
 - 横屏模式：左右各加 safe area padding 
 
 ## 深色模式 
 - 所有 Token 必须同时定义 light / dark 两套值 
 - ❌ 禁止在深色模式下直接取反色（机械反转） 
 - surface 色在深色模式下：#1C1C1E（iOS 规范）