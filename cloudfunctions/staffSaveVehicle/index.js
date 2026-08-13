const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const PLATE_PATTERN = /^[\u4e00-\u9fa5A-Z0-9]{5,10}$/
const text = (value, length) => String(value || "").trim().slice(0, length)
const businessError = (message, code = 400) => { const error = new Error(message); error.businessCode = code; return error }

exports.main = async event => {
  try {
    const staff = await requireStaff(db, event.token)
    const vehicleId = String(event.vehicleId || "")
    const userId = String(event.userId || "")
    const plateNumber = String(event.plateNumber || "").replace(/\s/g, "").toUpperCase()
    const status = event.status == null ? 1 : Number(event.status)
    const isDefault = status === 1 && Boolean(event.isDefault)
    const version = Number(event.version || 0)
    if (!userId || !PLATE_PATTERN.test(plateNumber)) return { code: 400, message: "车牌须为5-10个中文、大写字母或数字" }
    if (![0, 1].includes(status)) return { code: 400, message: "车辆状态不正确" }
    const outcome = await db.runTransaction(async transaction => {
      const member = (await transaction.collection("users").doc(userId).get().catch(() => ({ data: null }))).data
      if (!member || member.status !== 1) throw businessError("会员不存在或已禁用", 404)
      const duplicate = (await transaction.collection("vehicles").where({ userId, plateKey: plateNumber }).limit(2).get()).data.find(item => item._id !== vehicleId)
      if (duplicate) throw businessError("该会员已存在相同车牌", 409)
      let current = null
      if (vehicleId) {
        current = (await transaction.collection("vehicles").doc(vehicleId).get().catch(() => ({ data: null }))).data
        if (!current || current.userId !== userId) throw businessError("车辆不存在", 404)
        if (version !== Number(current.version || 1)) throw businessError("车辆资料已更新，请刷新后重试", 409)
      }
      const activeVehicles = (await transaction.collection("vehicles").where({ userId, status: 1 }).limit(50).get()).data
      const shouldDefault = isDefault || (Boolean(current && current.isDefault) && status === 1) || (!current && status === 1 && !activeVehicles.length)
      if (shouldDefault) {
        const defaults = (await transaction.collection("vehicles").where({ userId, isDefault: true }).limit(50).get()).data
        for (const item of defaults) if (item._id !== vehicleId) await transaction.collection("vehicles").doc(item._id).update({ data: { isDefault: false, version: Number(item.version || 1) + 1, updateTime: db.serverDate(), updateStaffId: staff._id, updateStaffName: staff.name } })
      }
      const fields = { userId, plateNumber, plateKey: plateNumber, brand: text(event.brand, 30), model: text(event.model, 30), color: text(event.color, 20), vin: text(event.vin, 40).toUpperCase(), isDefault: shouldDefault, status, updateTime: db.serverDate(), updateStaffId: staff._id, updateStaffName: staff.name }
      let id = vehicleId
      if (current) {
        fields.version = Number(current.version || 1) + 1
        await transaction.collection("vehicles").doc(vehicleId).update({ data: fields })
      } else {
        fields.version = 1
        fields.createTime = db.serverDate()
        fields.createStaffId = staff._id
        fields.createStaffName = staff.name
        const added = await transaction.collection("vehicles").add({ data: fields })
        id = added._id
      }
      if (status === 0 && current && current.isDefault) {
        const replacement = (await transaction.collection("vehicles").where({ userId, status: 1 }).limit(50).get()).data.find(item => item._id !== vehicleId)
        if (replacement) await transaction.collection("vehicles").doc(replacement._id).update({ data: { isDefault: true, version: Number(replacement.version || 1) + 1, updateTime: db.serverDate(), updateStaffId: staff._id, updateStaffName: staff.name } })
      }
      return { id, version: current ? Number(current.version || 1) + 1 : 1 }
    })
    return { code: 0, data: outcome }
  } catch (error) {
    if (error.businessCode) return { code: error.businessCode, message: error.message }
    return resultFromError(error)
  }
}
