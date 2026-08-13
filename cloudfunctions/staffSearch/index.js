const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async event => {
  try {
    await requireStaff(db, event.token)
    const mobile = String(event.mobile || "").trim()
    if (!/^1\d{10}$/.test(mobile)) return { code: 400, message: "请输入正确的11位手机号" }
    const memberResult = await db.collection("users").where({ mobile, status: 1 }).limit(1).get()
    if (!memberResult.data.length) return { code: 404, message: "该手机号尚未注册会员" }
    const member = memberResult.data[0]
    const [logs, vehicles] = await Promise.all([
      db.collection("balance_logs").where({ userId: member._id, status: 1 }).orderBy("createTime", "desc").limit(5).get(),
      db.collection("vehicles").where({ userId: member._id }).orderBy("isDefault", "desc").orderBy("updateTime", "desc").limit(50).get()
    ])
    return { code: 0, data: { member: { id: member._id, mobile: member.mobile, name: member.name, balance: member.balance }, recentLogs: logs.data, vehicles: vehicles.data } }
  } catch (error) {
    return resultFromError(error)
  }
}
