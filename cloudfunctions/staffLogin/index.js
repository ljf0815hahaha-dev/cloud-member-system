const cloud = require("wx-server-sdk")
const crypto = require("crypto")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false
  const parts = stored.split(":")
  if (parts.length !== 2 || !parts[0] || !/^[0-9a-fA-F]{128}$/.test(parts[1])) return false
  try {
    const expected = Buffer.from(parts[1], "hex")
    const actual = crypto.scryptSync(password, parts[0], 64)
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  } catch (error) {
    return false
  }
}

exports.main = async event => {
  const account = String(event.account || "").trim()
  const password = String(event.password || "")
  if (!account || !password) return { code: 400, message: "请输入账号和密码" }
  try {
    const result = await db.collection("staff").where({ account, status: 1 }).limit(1).get()
    if (!result.data.length || !verifyPassword(password, result.data[0].passwordHash)) return { code: 401, message: "账号或密码错误" }
    const staff = result.data[0]
    if (!["staff", "admin"].includes(staff.role)) return { code: 401, message: "店员账号不可用" }
    const token = crypto.randomBytes(32).toString("hex")
    const tokenVersion = staff.tokenVersion == null ? 1 : Number(staff.tokenVersion)
    const expireAt = new Date(Date.now() + 2 * 60 * 60 * 1000)
    await db.collection("staff_sessions").doc(token).set({ data: { staffId: staff._id, role: staff.role, tokenVersion, expireAt, createTime: db.serverDate() } })
    return { code: 0, data: { token, account: staff.account, name: staff.name, role: staff.role, tokenVersion, expireAt: expireAt.toISOString() } }
  } catch (error) {
    console.error("staff login failed", error)
    return { code: 500, message: "登录服务暂时不可用" }
  }
}
