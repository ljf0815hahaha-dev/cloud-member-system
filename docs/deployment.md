# CloudBase 正式部署准备指南

> 本文是人工部署与核对指南，不是一键部署脚本。当前仓库仍使用占位 `envId` 且 `devMode: true`，在认证通过并取得真实 CloudBase 环境 ID 前不得声称已完成真实部署。

## 1. 部署范围

- 微信小程序：`miniprogram/`
- 店员/店长 H5：`staff-h5/`，部署到同一 CloudBase 环境的静态网站托管
- 云函数根目录：`cloudfunctions/`
- 小程序 AppID：`wxfd38d9b1de5af197`
- 环境 ID：`YOUR_CLOUDBASE_ENV_ID`（待认证通过后填写真实值）

部署清单见 `docs/deployment-manifest.json`；真机验收见 `docs/test-checklist.md`。

## 2. 当前全部云函数

以下 23 个目录需要作为独立云函数部署；`cloudfunctions/common/` 只是共享源码参考目录，不单独部署。

| 云函数 | 用途 | 主要权限 |
|---|---|---|
| `memberLogin` | 顾客手机号授权登录、创建或绑定会员 | 微信 `OPENID` |
| `memberData` | 获取当前顾客会员资料与余额 | 顾客 |
| `getNotices` | 获取启用公告 | 顾客公开读 |
| `getLogs` | 获取当前顾客有效余额流水 | 顾客 |
| `getFilms` | 获取当前顾客贴膜档案 | 顾客 |
| `memberVehicles` | 获取当前顾客车辆档案 | 顾客 |
| `staffLogin` | 员工账号密码登录并创建会话 | 未登录入口 |
| `sessionValidate` | 校验员工会话、状态、角色和 `tokenVersion` | 店员/店长 |
| `staffSearch` | 按手机号查询会员、流水和车辆 | 店员/店长 |
| `getConsumeItems` | 获取启用消费项目 | 店员/店长 |
| `staffRecharge` | 事务化充值、幂等请求落库 | 店员/店长 |
| `staffSettle` | 事务化混合消费结算、幂等请求落库 | 店员/店长 |
| `staffListVehicles` | 查询会员车辆 | 店员/店长 |
| `staffSaveVehicle` | 新增、编辑、停用和切换默认车辆 | 店员/店长 |
| `staffAddFilm` | 新增结构化贴膜档案 | 店员/店长 |
| `adminData` | 店长首页统计、员工、项目、公告和流水 | 店长 |
| `adminAddStaff` | 新增员工 | 店长 |
| `adminUpdateStaff` | 修改员工状态、角色或密码并使旧会话失效 | 店长 |
| `adminAddItem` | 新增消费项目 | 店长 |
| `adminUpdateItem` | 编辑、排序或停用消费项目 | 店长 |
| `adminAddNotice` | 新增有图或无图公告 | 店长 |
| `adminUpdateNotice` | 编辑、排序或停用公告 | 店长 |
| `adminRevoke` | 作废充值/消费流水并事务化冲正余额 | 店长 |

每个可部署目录必须包含 `index.js`、`package.json`；清单中标记为会话鉴权的函数还必须包含同目录 `auth.js`，合称云函数“三件套”。`scripts/preflight.js` 会按 `docs/deployment-manifest.json` 只读核对这些文件。部署时上传完整函数目录及已安装依赖。

## 3. 数据库集合与索引

先创建以下 9 个集合。字段示例与兼容说明见 `docs/database.md`。

### `users`

- 唯一索引：`openid`。
- 唯一索引：`mobile`；若平台支持且手机号可能后补，配置 sparse/稀疏策略。

### `balance_logs`

- 复合索引：`{ userId: 1, createTime: -1 }`。
- 复合索引：`{ staffId: 1, createTime: -1 }`。
- 建议补充管理端最近流水查询索引：`{ createTime: -1 }`。

### `operation_requests`

- 文档 `_id` 已由 `sha256(staffId:operation:requestId)` 唯一确定，无需另建唯一索引。
- 可选运维索引：`{ createTime: -1 }`，用于归档与审计；生产中不得在幂等重试窗口内清理记录。

### `vehicles`

- 唯一复合索引：`{ userId: 1, plateKey: 1 }`。
- 复合索引：`{ userId: 1, isDefault: -1, updateTime: -1 }`。

### `film_records`

- 复合索引：`{ userId: 1, createTime: -1 }`。

### `notices`

- 复合索引：`{ status: 1, sort: 1 }`。
- 管理端按排序读取全部公告，如控制台提示缺索引，再按实际查询补 `{ sort: 1 }`。

### `staff`

- 唯一索引：`account`。
- 建议索引：`{ createTime: -1 }`。

### `staff_sessions`

- TTL 索引：`expireAt`，按平台支持方式开启到期清理。
- 普通索引：`staffId`。

### `consume_items`

- 建议唯一索引：`name`，与函数内重复校验形成双重保护。
- 复合索引：`{ status: 1, sort: 1 }`。
- 管理端按排序读取全部项目，如控制台提示缺索引，再按实际查询补 `{ sort: 1 }`。

## 4. 数据库与存储权限原则

1. 小程序和 H5 客户端不直接写数据库；余额、流水、车辆、贴膜、员工、会话、项目和公告的写入全部经过云函数。
2. `users.balance`、`balance_logs`、`operation_requests`、`staff`、`staff_sessions` 必须拒绝客户端直接读写；仅授权云函数服务端访问。
3. `vehicles`、`film_records`、`consume_items`、`notices` 也优先关闭客户端直写。当前代码均通过云函数读取或写入，不需要开放数据库客户端权限。
4. 顾客数据必须以云函数上下文中的 `OPENID` 定位，不接受客户端传入 `openid` 作为身份依据。
5. 员工函数必须校验会话到期时间、员工 `status`、角色以及 `tokenVersion`；店长函数只允许 `admin`。
6. 云存储中公告图和贴膜照片允许客户端展示，但上传由已认证 H5 流程发起；生产规则应限制写入主体、文件类型和大小，禁止匿名覆盖或删除任意路径。
7. 建议路径按用途与业务对象隔离，例如 `notices/`、`films/<userId>/`；不要在公开 URL 或文件名中放手机号、密码、会话 token 等敏感信息。
8. 生产权限应遵循“默认拒绝、按需开放”；上线前用未登录顾客、已登录顾客、店员和店长四类身份分别验证越权访问被拒绝。

## 5. 初始数据

### 5.1 首个店长

不要保存明文密码。认证通过后，在本地使用 Node.js 生成 scrypt 哈希：

```js
const crypto = require("crypto")
const password = "replace-with-a-strong-password"
const salt = crypto.randomBytes(16).toString("hex")
const hash = crypto.scryptSync(password, salt, 64).toString("hex")
console.log(`${salt}:${hash}`)
```

通过 CloudBase 控制台写入首个 `staff` 文档：

```json
{
  "account": "manager",
  "passwordHash": "salt:hash",
  "name": "店长",
  "role": "admin",
  "status": 1,
  "tokenVersion": 1,
  "createTime": "serverDate",
  "updateTime": "serverDate"
}
```

必须立即用真实强密码替代示例值；本地演示账号不得复制到生产数据库。

### 5.2 消费项目

建议初始化启用状态项目：汽车贴膜、玻璃膜、车衣、洗车、精洗、汽车美容、其他。每条包含 `name`、递增 `sort`、`status: 1`、`version: 1` 和服务端时间。

### 5.3 其他集合

- `users` 可由首次手机号授权自动创建，无需预置虚假会员。
- `notices` 可先保持为空；上线前至少验证一条无图公告和一条有图公告。
- `balance_logs`、`operation_requests`、`vehicles`、`film_records`、`staff_sessions` 不应伪造生产初始数据。

## 6. SDK 版本策略

- 以各云函数现有 `package.json` 为依赖声明来源；部署准备阶段不猜测、不新增、不升级或降级依赖版本。
- 部署前人工安装并核对各函数已声明的依赖，保留现有版本约束；如需调整版本，应另行依据官方兼容性文档评审，不纳入本次准备工作。
- 当前 H5 SDK 加载方式也只做人工门禁记录，不由 `preflight` 修改或推断版本。正式部署前应确认其明确可用且与当前全局变量 `cloudbase` 用法兼容。

## 7. 环境切换

当前本地演示配置是预期状态：

- `miniprogram/app.js`：`envId: "YOUR_CLOUDBASE_ENV_ID"`、`devMode: true`。
- `staff-h5/config.js`：`envId: "YOUR_CLOUDBASE_ENV_ID"`、`devMode: true`。

认证通过并创建环境后，人工执行：

1. 将两个文件的 `envId` 都替换为同一个真实环境 ID。
2. 将两个文件的 `devMode` 都改为 `false`。
3. 运行 `node scripts/preflight.js`；此时不使用 `--allow-placeholder`。
4. 确认小程序开发者工具选择的云环境与代码中的 `envId` 一致。
5. 确认 H5 静态托管、云函数、数据库、云存储都属于该环境。

开发环境与生产环境应使用不同 `envId`、独立集合和存储空间。切换环境只改配置，不复制真实会员、密码、会话或流水到开发环境。

## 8. 推荐部署顺序

1. 认证通过后创建 CloudBase 正式环境，记录真实 `envId`。
2. 创建 9 个集合与索引，设置数据库和存储权限。
3. 按各函数现有 `package.json` 声明安装并核对依赖，执行全量 `node --check` 与预检。
4. 部署基础顾客函数：`memberLogin`、`memberData`、`getNotices`、`getLogs`、`getFilms`、`memberVehicles`。
5. 部署员工认证与读取函数：`staffLogin`、`sessionValidate`、`staffSearch`、`getConsumeItems`、`staffListVehicles`。
6. 部署员工写函数：`staffRecharge`、`staffSettle`、`staffSaveVehicle`、`staffAddFilm`。
7. 部署店长函数：`adminData`、`adminAddStaff`、`adminUpdateStaff`、`adminAddItem`、`adminUpdateItem`、`adminAddNotice`、`adminUpdateNotice`、`adminRevoke`。
8. 创建首个店长和消费项目初始数据。
9. 在 H5 中填真实 `envId`、关闭 `devMode`，确认固定的 H5 SDK 加载方式后上传 `staff-h5/` 全部内容。
10. 在小程序中填真实 `envId`、关闭 `devMode`，真机测试后再上传体验版/提交审核。
11. 按 `docs/test-checklist.md` 完成全矩阵验收并保存测试记录。

部署云函数时不要只上传 `index.js`；带 `auth.js` 的函数必须一起上传。不要把 `cloudfunctions/common/` 当作独立函数。

## 9. 回滚提示

1. 发布前导出数据库备份，并记录当前云函数版本、H5 静态文件版本和小程序体验版/线上版本。
2. 优先采用向后兼容的数据结构变更；本次新增 `vehicles`、`operation_requests` 不要求删除旧集合或旧字段。
3. 云函数回滚时保持集合和索引，先回滚代码，确认无新请求写入后再评估数据修复；不要直接删除幂等记录。
4. H5 回滚应恢复整套静态文件，至少包括 `index.html`、`config.js`、`app.js`、`styles.css`，避免缓存导致新旧文件混用。
5. 小程序回滚按微信平台已有版本机制处理；回滚前确认旧版本是否能读取 `schemaVersion: 2` 的贴膜记录和车辆关联字段。
6. 充值、消费和冲正涉及资金：发现异常先暂停相关员工账号或入口，保留 `balance_logs` 与 `operation_requests` 审计记录，不得通过删除流水“修复”。
7. 混合支付消费冲正只恢复系统余额；`offlineRefundRequired: true` 时必须人工完成微信、支付宝或现金退款并留存线下凭证。
8. 回滚后重新运行会话、权限、幂等和余额一致性测试。

## 10. 部署前命令

认证前只做代码完整性检查：

```bash
node scripts/preflight.js --allow-placeholder
```

取得真实 `envId`、关闭 `devMode` 并完成 H5 SDK 固定后，正式发布前运行：

```bash
node scripts/preflight.js
```

`--allow-placeholder` 只允许配置中暂时保留 `YOUR_CLOUDBASE_ENV_ID`，用于认证前的仓库完整性检查；它不会放宽 `devMode: true`。任一端 `devMode` 为 `true`、必需云函数文件缺失、H5 缺少 UTF-8 charset、或 sitemap 配置无效时仍返回退出码 1。脚本全程只读，不安装依赖、不修改配置、不部署。
