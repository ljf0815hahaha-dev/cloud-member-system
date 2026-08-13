const cloud = require("wx-server-sdk")
const crypto = require("crypto")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async event => {
  try {
    await requireStaff(db, event.token, ["admin"])
    const account = String(event.account || "").trim(), password = String(event.password || ""), name = String(event.name || "").trim().slice(0, 30), role = String(event.role || "staff")
    if (!/^[A-Za-z0-9_]{3,32}$/.test(account)) return { code: 400, message: "账号须为3-32位字母、数字或下划线" }
    if (password.length < 6) return { code: 400, message: "密码至少6位" }
    if (!name) return { code: 400, message: "请输入店员姓名" }
    if (!["staff", "admin"].includes(role)) return { code: 400, message: "角色不合法" }
    if ((await db.collection("staff").where({ account }).limit(1).get()).data.length) return { code: 409, message: "账号已存在" }
    const salt = crypto.randomBytes(16).toString("hex"), passwordHash = `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`
    const result = await db.collection("staff").add({ data: { account, passwordHash, name, role, status: 1, tokenVersion: 1, createTime: db.serverDate(), updateTime: db.serverDate() } })
    return { code: 0, data: { id: result._id, account, name, role, status: 1, tokenVersion: 1 } }
  } catch (error) { return resultFromError(error) }
}
