const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const user = (await db.collection("users").where({ openid: OPENID, status: 1 }).limit(1).get()).data[0]
  if (!user) return { code: 401, message: "请先完成手机号登录" }
  const result = await db.collection("appointments").where({ userId: user._id }).orderBy("createTime", "desc").limit(30).get()
  return { code: 0, data: result.data }
}
