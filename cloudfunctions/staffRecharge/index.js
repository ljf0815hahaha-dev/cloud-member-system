const cloud = require("wx-server-sdk")
const crypto = require("crypto")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ALLOWED_METHODS = ["wechat", "alipay", "cash"]
const MAX_RECHARGE_FEN = 1000000
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{16,80}$/
const hash = value => crypto.createHash("sha256").update(value).digest("hex")
const businessError = (message, code) => { const error = new Error(message); error.businessCode = code; return error }

exports.main = async event => {
  try {
    const staff = await requireStaff(db, event.token)
    const requestId = String(event.requestId || "")
    const userId = String(event.userId || "")
    const amount = Number(event.amount)
    const payMethod = String(event.payMethod || "")
    const remark = String(event.remark || "").trim().slice(0, 100)
    if (!REQUEST_ID_PATTERN.test(requestId)) return { code: 400, message: "requestId 须为16-80位字母、数字或 ._:-" }
    if (!userId || !Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_RECHARGE_FEN) return { code: 400, message: "充值金额不合法" }
    if (!ALLOWED_METHODS.includes(payMethod)) return { code: 400, message: "请选择正确的收款方式" }

    const operationId = hash(`${staff._id}:recharge:${requestId}`)
    const payloadHash = hash(JSON.stringify({ userId, amount, payMethod, remark }))
    const outcome = await db.runTransaction(async transaction => {
      const operation = (await transaction.collection("operation_requests").doc(operationId).get().catch(() => ({ data: null }))).data
      if (operation) {
        if (operation.payloadHash !== payloadHash) throw businessError("同一 requestId 的请求参数不一致", 409)
        return { ...operation.result, requestId, replayed: true }
      }
      const member = (await transaction.collection("users").doc(userId).get()).data
      if (!member || member.status !== 1) throw businessError("会员不存在或已禁用", 404)
      const beforeBalance = Number(member.balance || 0)
      const afterBalance = beforeBalance + amount
      await transaction.collection("users").doc(userId).update({ data: { balance: afterBalance, updateTime: db.serverDate() } })
      const log = await transaction.collection("balance_logs").add({
        data: { userId, type: "recharge", amount, beforeBalance, afterBalance, totalAmount: 0, balancePaid: 0, offlinePaid: 0, payMethod, offlinePayMethod: "none", consumeItem: "", remark, requestId, staffId: staff._id, staffName: staff.name, status: 1, createTime: db.serverDate() }
      })
      const result = { logId: log._id, beforeBalance, afterBalance }
      await transaction.collection("operation_requests").doc(operationId).set({ data: { staffId: staff._id, operation: "recharge", requestId, payloadHash, result, createTime: db.serverDate() } })
      return { ...result, requestId, replayed: false }
    })
    return { code: 0, data: outcome }
  } catch (error) {
    if (error.businessCode) return { code: error.businessCode, message: error.message }
    return resultFromError(error)
  }
}
