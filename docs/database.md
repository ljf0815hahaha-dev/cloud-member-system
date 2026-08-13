# CloudBase Database Design

All monetary values use integer fen. Do not store or calculate balances with floating point values.

## Collections

### users

```json
{
  "_id": "auto",
  "openid": "wechat-openid",
  "mobile": "13800138000",
  "name": "车友8000",
  "balance": 0,
  "status": 1,
  "createTime": "serverDate",
  "updateTime": "serverDate"
}
```

Indexes:

- `openid`: unique
- `mobile`: unique, sparse if phone authorization is completed later

### balance_logs

```json
{
  "_id": "auto",
  "userId": "users._id",
  "type": "recharge | settlement | reversal",
  "amount": 50000,
  "beforeBalance": 30000,
  "afterBalance": 80000,
  "totalAmount": 0,
  "balancePaid": 0,
  "offlinePaid": 0,
  "payMethod": "wechat | alipay | cash | none",
  "offlinePayMethod": "wechat | alipay | cash | none",
  "consumeItemId": "consume_items._id",
  "consumeItem": "汽车贴膜（名称快照）",
  "remark": "",
  "staffId": "staff._id",
  "staffName": "",
  "status": 1,
  "sourceLogId": "被冲正的 balance_logs._id，仅 reversal",
  "sourceType": "recharge | settlement，仅 reversal",
  "balanceDelta": 0,
  "revokeReason": "作废原因",
  "revokedByStaffId": "staff._id",
  "revokedByStaffName": "",
  "offlineRefundRequired": false,
  "createTime": "serverDate"
}
```

Indexes:

- `{ userId: 1, createTime: -1 }`
- `{ staffId: 1, createTime: -1 }`

### operation_requests

```json
{
  "_id": "sha256(staffId:operation:requestId)",
  "staffId": "staff._id",
  "operation": "recharge | settlement",
  "requestId": "16-80位请求标识",
  "payloadHash": "sha256",
  "result": { "logId": "balance_logs._id" },
  "createTime": "serverDate"
}
```

文档 ID 唯一保证同一员工、操作和 `requestId` 只落库一次。

### vehicles

```json
{
  "_id": "auto",
  "userId": "users._id",
  "plateNumber": "粤B12345",
  "plateKey": "粤B12345",
  "brand": "特斯拉",
  "model": "Model Y",
  "color": "白色",
  "vin": "",
  "isDefault": true,
  "status": 1,
  "version": 1,
  "createTime": "serverDate",
  "updateTime": "serverDate",
  "createStaffId": "staff._id",
  "createStaffName": "",
  "updateStaffId": "staff._id",
  "updateStaffName": ""
}
```

Indexes: `{ userId: 1, plateKey: 1 }` unique、`{ userId: 1, isDefault: -1, updateTime: -1 }`。

### film_records

```json
{
  "_id": "auto",
  "userId": "users._id",
  "vehicleId": "vehicles._id",
  "vehicleSnapshot": { "id": "vehicles._id", "plateNumber": "粤B12345", "brand": "特斯拉", "model": "Model Y", "color": "白色", "vin": "" },
  "serviceDate": "2026-08-14",
  "filmCategory": "window | ppf | colorChange | other",
  "filmBrand": "品牌",
  "filmSeries": "系列",
  "filmModel": "型号",
  "installPosition": ["frontWindshield"],
  "warrantyMonths": 60,
  "mileageKm": 12000,
  "images": ["cloud://..."],
  "remark": "前挡玻璃膜",
  "schemaVersion": 2,
  "status": 1,
  "staffId": "staff._id",
  "staffName": "",
  "createTime": "serverDate"
}
```

旧记录可没有结构化字段，读取时按 `schemaVersion: 1` 兼容。Index: `{ userId: 1, createTime: -1 }`。

### notices

```json
{
  "_id": "auto",
  "title": "夏季贴膜优惠",
  "image": "cloud://...",
  "sort": 10,
  "status": 1,
  "version": 1,
  "createTime": "serverDate",
  "updateTime": "serverDate"
}
```

Index: `{ status: 1, sort: 1 }`

### staff

```json
{
  "_id": "auto",
  "account": "manager",
  "passwordHash": "scrypt hash",
  "name": "店长",
  "role": "admin | staff",
  "status": 1,
  "tokenVersion": 1,
  "createTime": "serverDate",
  "updateTime": "serverDate"
}
```

Index: `account` unique.

### staff_sessions

```json
{
  "_id": "random opaque session token",
  "staffId": "staff._id",
  "role": "admin | staff",
  "tokenVersion": 1,
  "expireAt": "date",
  "createTime": "serverDate"
}
```

Index: `expireAt` with TTL expiry; `staffId` normal index.

### consume_items

```json
{
  "_id": "auto",
  "name": "汽车贴膜",
  "sort": 10,
  "status": 1,
  "version": 1,
  "createTime": "serverDate",
  "updateTime": "serverDate"
}
```

Seed values: 汽车贴膜、玻璃膜、车衣、洗车、精洗、汽车美容、其他。

## Access rules

Do not grant direct client write permission to balance, logs, staff, or film record collections. Customer and staff writes must go through cloud functions. Cloud functions must validate identity and authorization on every request.
