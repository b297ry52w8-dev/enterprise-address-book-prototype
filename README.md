# 企业门户个人事务与通讯录原型

直接打开 `index.html` 进入统一原型入口，可选择 PC 端或移动端。建议通过本地静态服务器访问，以确保浏览器剪贴板能力完整可用。

移动端访问链路为：`mobile-portal.html` 工作台 → 底部“应用中心” → “通讯录”应用入口 → `address-book-mobile.html` 通讯录详情。移动页面适配 375px、390px、430px 手机宽度，并复用 PC 页面的 `ContactApi` 人员与组织数据。

## 文件结构

- `index.html`：PC 端与移动端统一原型入口，仅包含两个跳转按钮
- `address-book-pc.html`：企业门户顶部入口、个人事务抽屉、PC 通讯录页面、导出确认弹窗
- `mobile-portal.html`：移动工作台与应用中心，提供通讯录应用入口
- `css/styles.css`：蓝白企业后台视觉与各交互状态
- `js/app.js`：组织树、组合查询、分页、手机号复制、权限控制、模拟接口与 xlsx 导出
- `address-book-mobile.html`：独立移动端通讯录入口
- `css/address-book-mobile.css`：移动端专用布局、字母索引与底部抽屉样式
- `js/address-book-mobile.js`：移动端搜索、组织筛选、A-Z 分组、快速定位与拨号交互
- `css/prototype-entry.css`：统一入口页样式
- `css/mobile-portal.css`：移动工作台、应用中心与底部导航样式
- `js/mobile-portal.js`：移动端工作台/应用中心切换与占位提示
- `assets/images/address-book-app-icon.png`：通讯录 3D 应用图标
- `design/`：已确认的入口页、移动端访问链路与应用图标高保真设计稿

## 真实接口对接

页面通过 `window.ContactApi` 暴露以下适配方法：

- `getOrganizationTree()`
- `queryContacts({ orgId, includeChildren, name, positionId, positionKeyword, pageNo, pageSize })`
- `getPositionDictionary(keyword)`
- `exportContacts(filters)`

替换 `js/app.js` 中 `ContactApi` 的模拟实现即可接入后端。联系人字段遵循：`id`、`name`、`orgId`、`orgPath`、`positionName`、`mobile`、`accountCreatedAt`。

导出按钮由 `contact:export` 权限点控制。真实项目可在脚本加载前注入：

```html
<script>window.USER_PERMISSIONS = ["contact:export"];</script>
```

邮箱、待办、待阅入口优先调用现有项目注入的 `window.PORTAL_NAVIGATE(route)`；静态演示环境仅显示跳转提示。
