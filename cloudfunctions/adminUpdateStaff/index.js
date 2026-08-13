const cloud = require("wx-server-sdk")
const crypto = require("crypto")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const command = db.command
const clean = item => { const { _id, password, passwordHash, ...rest } = item; return { id: _id, ...rest } }

exports.main = async event => {
  try {
    const admin = await requireStaff(db, event.token, ["admin"])
    const staffId = String(event.staffId || "").trim()
    const action = String(event.action || "")
    if (!staffId || !["setStatus", "setRole", "resetPassword"].includes(action)) return { code: 400, message: "员工操作参数不正确" }
    const target = (await db.collection("staff").doc(staffId).get().catch(() => ({ data: null }))).data
    if (!target) return { code: 404, message: "员工不存在" }
    const data = { tokenVersion: command.inc(1), updateTime: db.serverDate() }
    if (action === "setStatus") {
      const status = Number(event.status)
      if (![0, 1].includes(status)) return { code: 400, message: "员工状态不合法" }
      if (staffId === admin._id && status === 0) return { code: 400, message: "当前店长不能停用自己" }
      data.status = status
    } else if (action === "setRole") {
      const role = String(event.role || "")
      if (!["staff", "admin"].includes(role)) return { code: 400, message: "员工角色不合法" }
      if (staffId === admin._id && role !== "admin") return { code: 400, message: "当前店长不能将自己降级" }
      data.role = role
    } else {
      const password = String(event.password || "")
      if (password.length < 6) return { code: 400, message: "密码至少6位" }
      const salt = crypto.randomBytes(16).toString("hex")
      data.passwordHash = `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`
    }
    await db.collection("staff").doc(staffId).update({ data })
    const updated = (await db.collection("staff").doc(staffId).get()).data
    return { code: 0, data: clean(updated) }
  } catch (error) { return resultFromError(error) }
}
