const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async event => {
  try {
    await requireStaff(db, event.token, ["admin"])
    const name = String(event.name || "").trim().slice(0, 50), sort = Number(event.sort == null ? 0 : event.sort), status = Number(event.status == null ? 1 : event.status), priceFen = Number(event.priceFen == null ? 0 : event.priceFen)
    if (!name || !Number.isSafeInteger(sort) || ![0, 1].includes(status) || !Number.isSafeInteger(priceFen) || priceFen < 0 || priceFen > 100000000) return { code: 400, message: "消费项目参数不正确" }
    if ((await db.collection("consume_items").where({ name }).limit(1).get()).data.length) return { code: 409, message: "消费项目已存在" }
    const result = await db.collection("consume_items").add({ data: { name, priceFen, sort, status, version: 1, createTime: db.serverDate(), updateTime: db.serverDate() } })
    return { code: 0, data: { id: result._id, name, priceFen, sort, status, version: 1 } }
  } catch (error) { return resultFromError(error) }
}
