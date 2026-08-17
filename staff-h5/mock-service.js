(() => {
  const KEY = "cloud_member_staff_mock_v1"
  const seed = () => ({
    staff: [{ id: "staff-admin", account: "manager", password: "123456", name: "演示店长", role: "admin", status: 1, tokenVersion: 1 }, { id: "staff-001", account: "staff", password: "123456", name: "演示店员", role: "staff", status: 1, tokenVersion: 1 }],
    members: [{ id: "mock-member-1", mobile: "13800138000", name: "演示车友8000", balance: 68000, status: 1 }],
    logs: [{ id: "log-1", userId: "mock-member-1", type: "recharge", amount: 100000, beforeBalance: 0, afterBalance: 100000, remark: "到店充值", status: 1, createTime: "2026-08-10T10:00:00+08:00" }, { id: "log-2", userId: "mock-member-1", type: "settlement", amount: 32000, beforeBalance: 100000, afterBalance: 68000, balancePaid: 32000, offlinePaid: 0, consumeItemId: "item-1", consumeItem: "汽车贴膜", remark: "前挡玻璃膜", status: 1, createTime: "2026-08-12T14:30:00+08:00" }],
    films: [], workOrders: [], vehicles: [{ id: "vehicle-1", userId: "mock-member-1", plateNumber: "粤B12345", plateKey: "粤B12345", brand: "特斯拉", model: "Model Y", color: "白色", vin: "", isDefault: true, status: 1, version: 1, createTime: new Date().toISOString(), updateTime: new Date().toISOString() }], operationRequests: {}, notices: [{ id: "notice-1", title: "夏季贴膜会员活动", image: "", sort: 10, status: 1, version: 1, createTime: new Date().toISOString(), updateTime: new Date().toISOString() }],
    consumeItems: [{ id: "item-1", name: "汽车贴膜", sort: 10, status: 1 }, { id: "item-2", name: "玻璃膜", sort: 20, status: 1 }, { id: "item-3", name: "车衣", sort: 30, status: 1 }, { id: "item-4", name: "洗车", sort: 40, status: 1 }, { id: "item-5", name: "精洗", sort: 50, status: 1 }, { id: "item-6", name: "汽车美容", sort: 60, status: 1 }, { id: "item-7", name: "其他", sort: 70, status: 1 }].map(item => ({ ...item, version: 1, createTime: new Date().toISOString(), updateTime: new Date().toISOString() }))
  })
  function migrate(data) {
    if (!Array.isArray(data.consumeItems)) data.consumeItems = []
    data.consumeItems = data.consumeItems.map((item, index) => typeof item === "string" ? { id: `item-migrated-${index + 1}`, name: item, sort: (index + 1) * 10, status: 1, version: 1 } : { ...item, id: item.id || item._id || `item-migrated-${index + 1}`, sort: Number(item.sort || (index + 1) * 10), status: item.status == null ? 1 : item.status, version: Number(item.version || 1) })
    data.notices = (data.notices || []).map(item => ({ ...item, version: Number(item.version || 1) }))
    data.staff.forEach(item => { if (item.tokenVersion == null) item.tokenVersion = 1 })
    if (!Array.isArray(data.vehicles)) data.vehicles = []
    if (!Array.isArray(data.workOrders)) data.workOrders = []
    if (!data.operationRequests) data.operationRequests = {}
    data.films = (data.films || []).map(item => ({ schemaVersion: 1, status: 1, vehicleSnapshot: null, serviceDate: "", filmCategory: "", filmBrand: "", filmSeries: "", filmModel: "", installPosition: [], warrantyMonths: 0, mileageKm: 0, ...item }))
    return data
  }
  function read() { const raw = localStorage.getItem(KEY); const data = migrate(raw ? JSON.parse(raw) : seed()); write(data); return data }
  function write(data) { localStorage.setItem(KEY, JSON.stringify(data)) }
  function tokenStaff(data, token) {
    const profile = JSON.parse(localStorage.getItem("staff_profile") || "null"), session = JSON.parse(localStorage.getItem("staff_session") || "null")
    if (!profile || !session || !token || token !== session.token || Number(session.expireAt) <= Date.now()) return null
    return data.staff.find(item => item.account === profile.account && item.status === 1 && item.role === profile.role && Number(item.tokenVersion || 1) === Number(session.tokenVersion || 1))
  }
  function ensureStaff(data, token, roles = ["staff", "admin"]) { const staff = tokenStaff(data, token); if (!staff || !roles.includes(staff.role)) throw new Error(staff ? "仅店长可操作" : "店员登录已过期，请重新登录"); return staff }
  function recentLogs(data, userId) { return data.logs.filter(item => item.userId === userId && item.status === 1).sort((a, b) => new Date(b.createTime) - new Date(a.createTime)).slice(0, 5) }
  function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}` }

  async function call(name, input = {}) {
    const data = read()
    if (name === "staffLogin") {
      const staff = data.staff.find(item => item.account === input.account && item.password === input.password && item.status === 1)
      if (!staff) throw new Error("账号或密码错误")
      return { token: `mock-${staff.id}-${Date.now()}`, name: staff.name, role: staff.role, account: staff.account, tokenVersion: Number(staff.tokenVersion || 1), expireAt: Date.now() + 2 * 60 * 60 * 1000 }
    }
    const staff = ensureStaff(data, input.token)
    if (name === "sessionValidate") return { id: staff.id, name: staff.name, role: staff.role, account: staff.account }
    if (name === "getConsumeItems") return data.consumeItems.filter(item => item.status === 1).sort((a, b) => a.sort - b.sort).map(({ id, name, sort }) => ({ id, name, sort }))
    if (name === "staffSearch") { const member = data.members.find(item => item.mobile === input.mobile && item.status === 1); if (!member) throw new Error("该手机号尚未注册会员"); return { member: { ...member }, recentLogs: recentLogs(data, member.id), vehicles: data.vehicles.filter(item => item.userId === member.id).sort((a, b) => Number(b.isDefault) - Number(a.isDefault)) } }
    if (name === "staffWorkOrders") { if (input.action === "staffOptions") return data.staff.filter(item => item.status === 1).map(item => ({ id: item.id, name: item.name, role: item.role })); if (input.action === "list") return data.workOrders.filter(item => item.userId === input.userId).slice().sort((a, b) => String(b.createTime).localeCompare(String(a.createTime))); if (input.action === "create") { const member = data.members.find(item => item.id === input.userId), vehicle = data.vehicles.find(item => item.id === input.vehicleId && item.userId === input.userId), assigned = data.staff.find(item => item.id === input.assignedStaffId && item.status === 1); if (!member || !vehicle || !assigned || !input.serviceName || !input.expectedDeliveryAt || !Array.isArray(input.beforeImages) || !input.beforeImages.length) throw new Error("请完善施工工单信息与施工前照片"); const order = { id: id("work"), userId: member.id, memberName: member.name, memberMobile: member.mobile, vehicleId: vehicle.id, vehicleSnapshot: { plateNumber: vehicle.plateNumber, brand: vehicle.brand, model: vehicle.model, color: vehicle.color }, serviceName: input.serviceName, expectedDeliveryAt: input.expectedDeliveryAt, assignedStaffId: assigned.id, assignedStaffName: assigned.name, beforeImages: input.beforeImages, afterImages: [], remark: input.remark || "", status: "pending", createdStaffId: staff.id, createdStaffName: staff.name, createTime: new Date().toISOString() }; data.workOrders.push(order); write(data); return { id: order.id } } const order = data.workOrders.find(item => item.id === input.orderId); if (!order) throw new Error("工单不存在"); if (input.action === "start") { order.status = "inProgress"; order.startedAt = new Date().toISOString() } else if (input.action === "complete") { if (!Array.isArray(input.afterImages) || !input.afterImages.length) throw new Error("请上传施工后照片"); order.status = "completed"; order.afterImages = input.afterImages; order.completedAt = new Date().toISOString() } else if (input.action === "sign") { if (!input.signerName || order.status !== "completed" || order.signedAt) throw new Error("请填写顾客签收姓名"); order.signerName = input.signerName; order.signedAt = new Date().toISOString(); order.signedStaffName = staff.name } else throw new Error("不支持的工单操作"); write(data); return true }
    if (name === "staffMembers") { ensureStaff(data, input.token, ["admin"]); const offset = Math.max(0, Number(input.offset) || 0), pageSize = Math.min(50, Math.max(1, Number(input.pageSize) || 20)), members = data.members.filter(item => item.status === 1).slice().sort((a, b) => String(b.createTime || "").localeCompare(String(a.createTime || ""))); const page = members.slice(offset, offset + pageSize).map(({ id, name, mobile, balance, createTime }) => ({ id, name, mobile, balance, createTime })); return { members: page, total: members.length, nextOffset: offset + page.length, hasMore: offset + page.length < members.length } }
    if (name === "staffListVehicles") return data.vehicles.filter(item => item.userId === input.userId)
    const idempotent = (operation, payload) => { if (!/^[A-Za-z0-9._:-]{16,80}$/.test(input.requestId || "")) throw new Error("requestId 须为16-80位字母、数字或 ._:-"); const key = `${staff.id}:${operation}:${input.requestId}`, hash = JSON.stringify(payload), previous = data.operationRequests[key]; if (previous && previous.hash !== hash) { const error = new Error("同一 requestId 的请求参数不一致"); error.code = 409; throw error } return { key, hash, previous } }
    if (name === "staffRecharge") {
      const member = data.members.find(item => item.id === input.userId), amount = Number(input.amount), payload = { userId: input.userId, amount, payMethod: input.payMethod, remark: input.remark || "" }
      if (!member || !Number.isSafeInteger(amount) || amount <= 0) throw new Error("充值金额不合法")
      const operation = idempotent("recharge", payload); if (operation.previous) return { ...operation.previous.result, requestId: input.requestId, replayed: true }
      const beforeBalance = member.balance; member.balance += amount
      const logId = id("log"); data.logs.push({ id: logId, userId: member.id, type: "recharge", amount, beforeBalance, afterBalance: member.balance, totalAmount: 0, balancePaid: 0, offlinePaid: 0, payMethod: input.payMethod, offlinePayMethod: "none", consumeItemId: "", consumeItem: "", remark: input.remark || "", requestId: input.requestId, staffId: staff.id, staffName: staff.name, status: 1, createTime: new Date().toISOString() }); const result = { logId, beforeBalance, afterBalance: member.balance }; data.operationRequests[operation.key] = { hash: operation.hash, result }; write(data)
      return { ...result, requestId: input.requestId, replayed: false }
    }
    if (name === "staffSettle") {
      const member = data.members.find(item => item.id === input.userId), totalAmount = Number(input.totalAmount)
      const item = input.consumeItemId ? data.consumeItems.find(entry => entry.id === input.consumeItemId && entry.status === 1) : data.consumeItems.find(entry => entry.name === input.consumeItem && entry.status === 1)
      if (!member || !Number.isSafeInteger(totalAmount) || totalAmount <= 0) throw new Error("消费金额不合法")
      if (!item) throw new Error("消费项目不存在或已停用")
      const payload = { userId: input.userId, totalAmount, consumeItemId: input.consumeItemId || "", consumeItem: input.consumeItem || "", offlinePayMethod: input.offlinePayMethod, remark: input.remark || "" }, operation = idempotent("settlement", payload)
      if (operation.previous) return { ...operation.previous.result, requestId: input.requestId, replayed: true }
      const beforeBalance = member.balance, balancePaid = Math.min(beforeBalance, totalAmount), offlinePaid = totalAmount - balancePaid
      if (offlinePaid > 0 && input.offlinePayMethod === "none") throw new Error("余额不足，请选择线下补付方式")
      member.balance -= balancePaid
      const logId = id("log"); data.logs.push({ id: logId, userId: member.id, type: "settlement", amount: totalAmount, beforeBalance, afterBalance: member.balance, totalAmount, balancePaid, offlinePaid, consumeItemId: item.id, consumeItem: item.name, payMethod: "none", offlinePayMethod: input.offlinePayMethod, remark: input.remark || "", requestId: input.requestId, staffId: staff.id, staffName: staff.name, status: 1, createTime: new Date().toISOString() }); const result = { logId, beforeBalance, afterBalance: member.balance, balancePaid, offlinePaid }; data.operationRequests[operation.key] = { hash: operation.hash, result }; write(data)
      return { ...result, requestId: input.requestId, replayed: false }
    }
    if (name === "staffSaveVehicle") {
      const plateNumber = String(input.plateNumber || "").replace(/\s/g, "").toUpperCase(), current = data.vehicles.find(item => item.id === input.vehicleId)
      if (!/^[\u4e00-\u9fa5A-Z0-9]{5,10}$/.test(plateNumber)) throw new Error("车牌须为5-10个中文、大写字母或数字")
      if (data.vehicles.some(item => item.userId === input.userId && item.plateKey === plateNumber && item.id !== input.vehicleId)) throw new Error("该会员已存在相同车牌")
      if (current && Number(input.version) !== Number(current.version)) throw new Error("车辆资料已更新，请刷新后重试")
      if (input.isDefault) data.vehicles.filter(item => item.userId === input.userId).forEach(item => { item.isDefault = false })
      const status = input.status == null ? 1 : Number(input.status), keepDefault = Boolean(current && current.isDefault && status === 1)
      const fields = { userId: input.userId, plateNumber, plateKey: plateNumber, brand: input.brand || "", model: input.model || "", color: input.color || "", vin: String(input.vin || "").toUpperCase(), isDefault: Boolean(input.isDefault) || keepDefault, status, updateTime: new Date().toISOString(), updateStaffId: staff.id, updateStaffName: staff.name }
      const wasDefault = Boolean(current && current.isDefault)
      if (current) Object.assign(current, fields, { version: current.version + 1 })
      else data.vehicles.push({ id: id("vehicle"), ...fields, isDefault: fields.isDefault || !data.vehicles.some(item => item.userId === input.userId && item.status === 1), version: 1, createTime: new Date().toISOString(), createStaffId: staff.id, createStaffName: staff.name })
      if (current && current.status === 0 && wasDefault) { current.isDefault = false; const replacement = data.vehicles.find(item => item.userId === input.userId && item.status === 1); if (replacement) replacement.isDefault = true }
      write(data); const saved = current || data.vehicles.at(-1); return { id: saved.id, version: saved.version }
    }
    if (name === "staffAddFilm") {
      const vehicle = data.vehicles.find(item => item.id === input.vehicleId && item.userId === input.userId && item.status === 1), categories = ["window", "ppf", "colorChange", "other"], positions = ["frontWindshield", "rearWindshield", "leftFront", "rightFront", "leftRear", "rightRear", "sunroof", "fullBody", "partialBody", "other"], warrantyMonths = Number(input.warrantyMonths || 0), mileageKm = Number(input.mileageKm || 0)
      if (!vehicle) throw new Error("车辆不存在、已停用或不属于该会员")
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.serviceDate || "") || !categories.includes(input.filmCategory) || !Array.isArray(input.installPosition) || !input.installPosition.length || input.installPosition.some(item => !positions.includes(item))) throw new Error("请完善服务日期、贴膜类别和施工位置")
      if (!Array.isArray(input.images) || !input.images.length || !Number.isSafeInteger(warrantyMonths) || warrantyMonths < 0 || warrantyMonths > 240 || !Number.isSafeInteger(mileageKm) || mileageKm < 0 || mileageKm > 10000000) throw new Error("贴膜档案参数不正确")
      data.films.push({ id: id("film"), userId: input.userId, vehicleId: vehicle.id, vehicleSnapshot: { id: vehicle.id, plateNumber: vehicle.plateNumber, brand: vehicle.brand, model: vehicle.model, color: vehicle.color, vin: vehicle.vin }, serviceDate: input.serviceDate, filmCategory: input.filmCategory, filmBrand: input.filmBrand || "", filmSeries: input.filmSeries || "", filmModel: input.filmModel || "", installPosition: [...new Set(input.installPosition)], warrantyMonths, mileageKm, images: input.images, remark: input.remark || "", schemaVersion: 2, status: 1, staffId: staff.id, staffName: staff.name, createTime: new Date().toISOString() }); write(data); return { id: data.films.at(-1).id }
    }
    if (name === "adminData") { ensureStaff(data, input.token, ["admin"]); return { memberCount: data.members.filter(item => item.status === 1).length, staff: data.staff.map(({ password, ...item }) => item), notices: data.notices.slice().sort((a, b) => a.sort - b.sort), consumeItems: data.consumeItems.slice().sort((a, b) => a.sort - b.sort), logs: data.logs.slice().sort((a, b) => new Date(b.createTime) - new Date(a.createTime)).slice(0, 50) } }
    if (name === "adminAddStaff") {
      ensureStaff(data, input.token, ["admin"])
      if (!/^[A-Za-z0-9_]{3,32}$/.test(input.account || "")) throw new Error("账号须为3-32位字母、数字或下划线")
      if (String(input.password || "").length < 6 || !["staff", "admin"].includes(input.role)) throw new Error("店员参数不正确")
      if (data.staff.some(item => item.account === input.account)) throw new Error("账号已存在")
      const added = { id: id("staff"), account: input.account, password: input.password, name: input.name, role: input.role, status: 1, tokenVersion: 1, createTime: new Date().toISOString(), updateTime: new Date().toISOString() }; data.staff.push(added); write(data); return { ...added, password: undefined }
    }
    if (name === "adminUpdateStaff") {
      const admin = ensureStaff(data, input.token, ["admin"]), target = data.staff.find(item => item.id === input.staffId)
      if (!target) throw new Error("员工不存在")
      if (input.action === "setStatus") { const status = Number(input.status); if (![0, 1].includes(status)) throw new Error("员工状态不合法"); if (target.id === admin.id && status === 0) throw new Error("当前店长不能停用自己"); target.status = status }
      else if (input.action === "setRole") { if (!["staff", "admin"].includes(input.role)) throw new Error("员工角色不合法"); if (target.id === admin.id && input.role !== "admin") throw new Error("当前店长不能将自己降级"); target.role = input.role }
      else if (input.action === "resetPassword") { if (String(input.password || "").length < 6) throw new Error("密码至少6位"); target.password = input.password }
      else throw new Error("员工操作参数不正确")
      target.tokenVersion = Number(target.tokenVersion || 1) + 1; target.updateTime = new Date().toISOString(); write(data); const { password, ...result } = target; return result
    }
    if (name === "adminAddItem") { ensureStaff(data, input.token, ["admin"]); if (!input.name) throw new Error("消费项目参数不正确"); if (data.consumeItems.some(item => item.name === input.name)) throw new Error("消费项目已存在"); const now = new Date().toISOString(), item = { id: id("item"), name: input.name, sort: Number(input.sort || 0), status: input.status == null ? 1 : Number(input.status), version: 1, createTime: now, updateTime: now }; data.consumeItems.push(item); write(data); return item }
    if (name === "adminUpdateItem") { ensureStaff(data, input.token, ["admin"]); const item = data.consumeItems.find(entry => entry.id === input.itemId); if (!item) throw new Error("消费项目不存在"); if (Number(item.version || 1) !== Number(input.version)) { const error = new Error("消费项目已被修改，请刷新后重试"); error.code = 409; throw error } if (Object.prototype.hasOwnProperty.call(input, "name")) { const value = String(input.name || "").trim(); if (!value) throw new Error("消费项目名称不能为空"); if (data.consumeItems.some(entry => entry.id !== item.id && entry.name === value)) throw new Error("消费项目已存在"); item.name = value } if (Object.prototype.hasOwnProperty.call(input, "sort")) { const value = Number(input.sort); if (!Number.isSafeInteger(value)) throw new Error("消费项目排序必须为整数"); item.sort = value } if (Object.prototype.hasOwnProperty.call(input, "status")) { const value = Number(input.status); if (![0, 1].includes(value)) throw new Error("消费项目状态不合法"); item.status = value } item.version = Number(item.version || 1) + 1; item.updateTime = new Date().toISOString(); write(data); return { ...item } }
    if (name === "adminAddNotice") { ensureStaff(data, input.token, ["admin"]); if (!input.title || (input.image && !input.image.startsWith("cloud://") && !String(input.image).startsWith("data:image/"))) throw new Error("公告参数不正确"); const now = new Date().toISOString(), notice = { id: id("notice"), title: input.title, image: input.image || "", sort: Number(input.sort || 0), status: input.status == null ? 1 : Number(input.status), version: 1, createTime: now, updateTime: now }; data.notices.push(notice); write(data); return notice }
    if (name === "adminUpdateNotice") { ensureStaff(data, input.token, ["admin"]); const notice = data.notices.find(entry => entry.id === input.noticeId); if (!notice) throw new Error("公告不存在"); if (Number(notice.version || 1) !== Number(input.version)) { const error = new Error("公告已被修改，请刷新后重试"); error.code = 409; throw error } if (Object.prototype.hasOwnProperty.call(input, "title")) { const value = String(input.title || "").trim(); if (!value) throw new Error("公告标题不能为空"); notice.title = value } if (Object.prototype.hasOwnProperty.call(input, "image")) { const value = String(input.image || ""); if (value && !value.startsWith("data:image/") && !value.startsWith("cloud://")) throw new Error("公告图片地址不合法"); notice.image = value } if (Object.prototype.hasOwnProperty.call(input, "sort")) { const value = Number(input.sort); if (!Number.isSafeInteger(value)) throw new Error("公告排序必须为整数"); notice.sort = value } if (Object.prototype.hasOwnProperty.call(input, "status")) { const value = Number(input.status); if (![0, 1].includes(value)) throw new Error("公告状态不合法"); notice.status = value } notice.version = Number(notice.version || 1) + 1; notice.updateTime = new Date().toISOString(); write(data); return { ...notice } }
    if (name === "adminRevoke") {
      ensureStaff(data, input.token, ["admin"])
      const log = data.logs.find(item => item.id === input.logId)
      if (!log) throw new Error("流水不存在"); if (log.type === "reversal") throw new Error("冲正流水不能作废"); if (log.status !== 1) throw new Error("流水已作废，不能重复处理")
      const member = data.members.find(item => item.id === log.userId), balanceDelta = log.type === "recharge" ? -Number(log.amount || 0) : Number(log.balancePaid || 0)
      if (member.balance + balanceDelta < 0) throw new Error("会员余额不足，不能作废该充值流水")
      const beforeBalance = member.balance, offlineRefundRequired = log.type === "settlement" && Number(log.offlinePaid || 0) > 0; member.balance += balanceDelta; log.status = 0
      log.revokeReason = input.revokeReason || ""; log.revokedByStaffId = staff.id; log.revokedByStaffName = staff.name
      const reversal = { id: id("log"), userId: member.id, type: "reversal", amount: Math.abs(balanceDelta), beforeBalance, afterBalance: member.balance, sourceLogId: log.id, sourceType: log.type, balanceDelta, revokeReason: input.revokeReason || "", revokedByStaffId: staff.id, revokedByStaffName: staff.name, offlineRefundRequired, staffId: staff.id, staffName: staff.name, status: 1, createTime: new Date().toISOString() }
      data.logs.push(reversal); write(data); return { id: reversal.id, sourceLogId: log.id, beforeBalance, afterBalance: member.balance, balanceDelta, offlineRefundRequired, message: offlineRefundRequired ? "余额已冲正，线下款需人工处理" : "余额已冲正" }
    }
    throw new Error(`本地模式暂不支持服务：${name}`)
  }
  async function upload(files) { return Promise.all(Array.from(files).map(file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) }))) }
  window.MockStaffService = { call, upload, reset: () => { localStorage.removeItem(KEY); localStorage.removeItem("staff_token"); localStorage.removeItem("staff_profile"); localStorage.removeItem("staff_session") } }
})()
