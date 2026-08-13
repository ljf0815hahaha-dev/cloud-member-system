const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async event => {
  try {
    await requireStaff(db, event.token)
    const result = await db.collection("consume_items").where({ status: 1 }).orderBy("sort", "asc").get()
    return { code: 0, data: result.data.map(item => ({ id: item._id, name: item.name, sort: Number(item.sort || 0) })) }
  } catch (error) { return resultFromError(error) }
}
