const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  const userResult = await db.collection("users").where({ openid: OPENID, status: 1 }).limit(1).get()
  if (!userResult.data.length) return { code: 401, message: "请先完成手机号登录" }
  const limit = Math.min(Math.max(Number(event.limit) || 30, 1), 50)
  const logs = await db.collection("balance_logs").where({ userId: userResult.data[0]._id, status: 1 }).orderBy("createTime", "desc").limit(limit).get()
  return { code: 0, data: logs.data }
}
