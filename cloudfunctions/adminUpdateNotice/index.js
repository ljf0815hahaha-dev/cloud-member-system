const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const businessError = (message, code = 400) => { const error = new Error(message); error.businessCode = code; return error }
const clean = item => { const { _id, ...rest } = item; return { id: _id, ...rest } }

exports.main = async event => {
  try {
    await requireStaff(db, event.token, ["admin"])
    const noticeId = String(event.noticeId || "").trim(), version = Number(event.version)
    if (!noticeId || !Number.isSafeInteger(version) || version < 1) return { code: 400, message: "公告版本参数不正确" }
    const patch = {}
    if (Object.prototype.hasOwnProperty.call(event, "title")) { patch.title = String(event.title || "").trim().slice(0, 100); if (!patch.title) return { code: 400, message: "公告标题不能为空" } }
    if (Object.prototype.hasOwnProperty.call(event, "image")) { patch.image = String(event.image || "").trim(); if (patch.image && !patch.image.startsWith("cloud://")) return { code: 400, message: "公告图片地址不合法" } }
    if (Object.prototype.hasOwnProperty.call(event, "sort")) { patch.sort = Number(event.sort); if (!Number.isSafeInteger(patch.sort)) return { code: 400, message: "公告排序必须为整数" } }
    if (Object.prototype.hasOwnProperty.call(event, "status")) { patch.status = Number(event.status); if (![0, 1].includes(patch.status)) return { code: 400, message: "公告状态不合法" } }
    if (!Object.keys(patch).length) return { code: 400, message: "没有可更新的公告字段" }
    const updated = await db.runTransaction(async transaction => {
      const current = (await transaction.collection("notices").doc(noticeId).get().catch(() => ({ data: null }))).data
      if (!current) throw businessError("公告不存在", 404)
      if (Number(current.version || 1) !== version) throw businessError("公告已被修改，请刷新后重试", 409)
      await transaction.collection("notices").doc(noticeId).update({ data: { ...patch, version: version + 1, updateTime: db.serverDate() } })
      return { ...current, ...patch, version: version + 1 }
    })
    return { code: 0, data: clean(updated) }
  } catch (error) { if (error.businessCode) return { code: error.businessCode, message: error.message }; return resultFromError(error) }
}
