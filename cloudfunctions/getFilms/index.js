const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  const user = (await db.collection("users").where({ openid: OPENID, status: 1 }).limit(1).get()).data[0]
  if (!user) return { code: 401, message: "请先完成手机号登录" }
  const limit = Math.min(Math.max(Number(event.limit) || 30, 1), 50)
  const records = await db.collection("film_records").where({ userId: user._id }).orderBy("createTime", "desc").limit(limit).get()
  return { code: 0, data: records.data.filter(item => item.status == null || item.status === 1).map(item => ({ schemaVersion: 1, status: 1, vehicleSnapshot: null, serviceDate: "", filmCategory: "", filmBrand: "", filmSeries: "", filmModel: "", installPosition: [], warrantyMonths: 0, mileageKm: 0, ...item })) }
}
