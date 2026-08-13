const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  if (!event.phoneCode) return { code: 400, message: "缺少手机号授权信息" }

  try {
    const phoneResult = await cloud.openapi.phonenumber.getPhoneNumber({ code: event.phoneCode })
    const mobile = phoneResult.phoneInfo.purePhoneNumber
    const byOpenid = await db.collection("users").where({ openid: OPENID }).limit(1).get()
    const now = db.serverDate()

    if (byOpenid.data.length) {
      const member = byOpenid.data[0]
      if (member.mobile !== mobile) await db.collection("users").doc(member._id).update({ data: { mobile, updateTime: now } })
      return { code: 0, data: { userId: member._id, mobile } }
    }

    const byMobile = await db.collection("users").where({ mobile }).limit(1).get()
    if (byMobile.data.length) {
      const member = byMobile.data[0]
      if (member.openid && member.openid !== OPENID) return { code: 409, message: "该手机号已绑定其他微信账号，请联系门店处理" }
      await db.collection("users").doc(member._id).update({ data: { openid: OPENID, updateTime: now } })
      return { code: 0, data: { userId: member._id, mobile } }
    }

    const result = await db.collection("users").add({
      data: { openid: OPENID, mobile, name: `车友${mobile.slice(-4)}`, balance: 0, status: 1, createTime: now, updateTime: now }
    })
    return { code: 0, data: { userId: result._id, mobile } }
  } catch (error) {
    console.error("member login failed", error)
    return { code: 500, message: "手机号授权失败，请稍后重试" }
  }
}
