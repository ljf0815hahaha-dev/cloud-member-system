const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const result = await db.collection("users").where({ openid: OPENID, status: 1 }).limit(1).get()
  if (!result.data.length) return { code: 401, message: "请先完成手机号登录" }
  const member = result.data[0]
  return { code: 0, data: { id: member._id, name: member.name, mobile: member.mobile, balance: member.balance } }
}
