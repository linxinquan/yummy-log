# Component Constraints 
 
 ## Button 
 - 变体仅限：primary / secondary / ghost / danger 
 - 尺寸仅限：sm（32px高）/ md（40px高）/ lg（48px高） 
 - 圆角：固定 radius-full，不接受方形按钮 
 - 最小宽度：88px；图标按钮除外 
 - ❌ 禁止：outline 变体（用 ghost 替代） 
 - ❌ 禁止：在 primary 按钮上叠加图标（视觉层级混乱） 
 
 ## Button 决策树 
 1. 页面主要操作（唯一）→ primary 
 2. 次要/并列操作 → secondary 
 3. 内容区域内联动作 → ghost 
 4. 删除 / 不可逆操作 → danger 
 5. 图标独立触发 → IconButton（不使用 Button 组件） 
 
 ## Card 
 - 背景：必须为 surface (#FFFFFF) 
 - 阴影：默认 shadow-sm，悬浮态 shadow-xs 
 - 内边距：只能是 16px 或 24px 
 - 圆角：radius-md（12px） 
 - ❌ 禁止：Card 内嵌套 Card 
 - ❌ 禁止：Card 内出现超过 3 层信息层级 
 
 ## Input 
 - 高度固定：40px（md）/ 48px（lg） 
 - 圆角：radius-sm（6px） 
 - 边框颜色：border（默认）/ primary（focus）/ danger（error） 
 - ❌ 禁止：placeholder 字色深于 text-disabled 
 
 ## Modal / 弹窗 
 - 移动端：bottom sheet，圆角 radius-lg 仅上两角 
 - 桌面端：居中弹窗，最大宽度 480px 
 - ❌ 禁止：移动端全屏 Modal（除相机/全屏预览类场景） 
 - ❌ 禁止：超过 2 层 Modal 嵌套