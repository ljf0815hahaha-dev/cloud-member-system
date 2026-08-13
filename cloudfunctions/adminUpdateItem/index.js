const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const businessError = (message, code = 400) => { const error = new Error(message); error.businessCode = code; return error }
const clean = item => { const { _id, ...rest } = item; return { id: _id, ...rest } }

exports.main = async event => {
  try {
    await requireStaff(db, event.token, ["admin"])
    const itemId = String(event.itemId || "").trim(), version = Number(event.version)
    if (!itemId || !Number.isSafeInteger(version) || version < 1) return { code: 400, message: "消费项目版本参数不正确" }
    const patch = {}
    if (Object.prototype.hasOwnProperty.call(event, "name")) { patch.name = String(event.name || "").trim().slice(0, 50); if (!patch.name) return { code: 400, message: "消费项目名称不能为空" } }
    if (Object.prototype.hasOwnProperty.call(event, "sort")) { patch.sort = Number(event.sort); if (!Number.isSafeInteger(patch.sort)) return { code: 400, message: "消费项目排序必须为整数" } }
    if (Object.prototype.hasOwnProperty.call(event, "status")) { patch.status = Number(event.status); if (![0, 1].includes(patch.status)) return { code: 400, message: "消费项目状态不合法" } }
    if (!Object.keys(patch).length) return { code: 400, message: "没有可更新的消费项目字段" }
    const updated = await db.runTransaction(async transaction => {
      const current = (await transaction.collection("consume_items").doc(itemId).get().catch(() => ({ data: null }))).data
      if (!current) throw businessError("消费项目不存在", 404)
      if (Number(current.version || 1) !== version) throw businessError("消费项目已被修改，请刷新后重试", 409)
      if (patch.name) {
        const duplicate = (await transaction.collection("consume_items").where({ name: patch.name }).limit(2).get()).data.find(item => item._id !== itemId)
        if (duplicate) throw businessError("消费项目已存在", 409)
      }
      await transaction.collection("consume_items").doc(itemId).update({ data: { ...patch, version: version + 1, updateTime: db.serverDate() } })
      return { ...current, ...patch, version: version + 1 }
    })
    return { code: 0, data: clean(updated) }
  } catch (error) { if (error.businessCode) return { code: error.businessCode, message: error.message }; return resultFromError(error) }
}
