const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async event => {
  try {
    await requireStaff(db, event.token)
    const userId = String(event.userId || "")
    if (!userId) return { code: 400, message: "会员参数不正确" }
    const member = (await db.collection("users").doc(userId).get().catch(() => ({ data: null }))).data
    if (!member || member.status !== 1) return { code: 404, message: "会员不存在或已禁用" }
    const result = await db.collection("vehicles").where({ userId }).orderBy("isDefault", "desc").orderBy("updateTime", "desc").limit(50).get()
    return { code: 0, data: result.data }
  } catch (error) {
    return resultFromError(error)
  }
}
