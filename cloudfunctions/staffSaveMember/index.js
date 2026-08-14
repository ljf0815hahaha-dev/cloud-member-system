const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const text = (value, length) => String(value || "").trim().slice(0, length)

exports.main = async event => {
  try {
    await requireStaff(db, event.token)
    const memberId = text(event.memberId, 64), mobile = text(event.mobile, 11), name = text(event.name, 40)
    if (!/^1\d{10}$/.test(mobile)) return { code: 400, message: "请输入正确的11位手机号" }
    if (!name) return { code: 400, message: "请填写会员姓名或称呼" }
    const duplicate = await db.collection("users").where({ mobile }).limit(1).get()
    if (duplicate.data.length && duplicate.data[0]._id !== memberId) return { code: 409, message: "该手机号已存在会员" }
    if (memberId) {
      const current = (await db.collection("users").doc(memberId).get().catch(() => ({ data: null }))).data
      if (!current) return { code: 404, message: "会员不存在" }
      await db.collection("users").doc(memberId).update({ data: { mobile, name, updateTime: db.serverDate() } })
      return { code: 0, data: { id: memberId, mobile, name, created: false } }
    }
    const result = await db.collection("users").add({ data: { mobile, name, balance: 0, status: 1, createTime: db.serverDate(), updateTime: db.serverDate() } })
    return { code: 0, data: { id: result._id, mobile, name, created: true } }
  } catch (error) { return resultFromError(error) }
}
