const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async event => {
  try {
    await requireStaff(db, event.token, ["admin"])
    const title = String(event.title || "").trim().slice(0, 100), image = String(event.image || "").trim(), sort = Number(event.sort == null ? 0 : event.sort), status = Number(event.status == null ? 1 : event.status)
    if (!title || (image && !image.startsWith("cloud://")) || !Number.isSafeInteger(sort) || ![0, 1].includes(status)) return { code: 400, message: "公告参数不正确" }
    const result = await db.collection("notices").add({ data: { title, image, sort, status, version: 1, createTime: db.serverDate(), updateTime: db.serverDate() } })
    return { code: 0, data: { id: result._id, title, image, sort, status, version: 1 } }
  } catch (error) { return resultFromError(error) }
}
