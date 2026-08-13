const cloud = require("wx-server-sdk")
const crypto = require("crypto")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ALLOWED_METHODS = ["wechat", "alipay", "cash", "none"]
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{16,80}$/
const hash = value => crypto.createHash("sha256").update(value).digest("hex")
const businessError = (message, code = 400) => { const error = new Error(message); error.businessCode = code; return error }

exports.main = async event => {
  try {
    const staff = await requireStaff(db, event.token)
    const requestId = String(event.requestId || "")
    const userId = String(event.userId || "")
    const totalAmount = Number(event.totalAmount)
    const consumeItemId = String(event.consumeItemId || "").trim()
    const legacyConsumeItem = String(event.consumeItem || "").trim().slice(0, 50)
    const remark = String(event.remark || "").trim().slice(0, 100)
    const offlinePayMethod = String(event.offlinePayMethod || "none")
    if (!REQUEST_ID_PATTERN.test(requestId)) return { code: 400, message: "requestId 须为16-80位字母、数字或 ._:-" }
    if (!userId || !Number.isSafeInteger(totalAmount) || totalAmount <= 0 || (!consumeItemId && !legacyConsumeItem)) return { code: 400, message: "请填写正确的消费金额和项目" }
    if (!ALLOWED_METHODS.includes(offlinePayMethod)) return { code: 400, message: "线下支付方式不正确" }

    const operationId = hash(`${staff._id}:settlement:${requestId}`)
    const payloadHash = hash(JSON.stringify({ userId, totalAmount, consumeItemId, legacyConsumeItem, offlinePayMethod, remark }))
    const outcome = await db.runTransaction(async transaction => {
      const operation = (await transaction.collection("operation_requests").doc(operationId).get().catch(() => ({ data: null }))).data
      if (operation) {
        if (operation.payloadHash !== payloadHash) throw businessError("同一 requestId 的请求参数不一致", 409)
        return { ...operation.result, requestId, replayed: true }
      }
      let item
      if (consumeItemId) item = (await transaction.collection("consume_items").doc(consumeItemId).get().catch(() => ({ data: null }))).data
      else item = (await transaction.collection("consume_items").where({ name: legacyConsumeItem, status: 1 }).limit(1).get()).data[0]
      if (!item || item.status !== 1) throw businessError("消费项目不存在或已停用")
      const member = (await transaction.collection("users").doc(userId).get()).data
      if (!member || member.status !== 1) throw businessError("会员不存在或已禁用", 404)
      const beforeBalance = Number(member.balance || 0)
      const balancePaid = Math.min(beforeBalance, totalAmount)
      const offlinePaid = totalAmount - balancePaid
      if (offlinePaid > 0 && offlinePayMethod === "none") throw businessError("余额不足，请选择线下补付方式")
      if (offlinePaid === 0 && offlinePayMethod !== "none") throw businessError("余额足够时无需填写线下支付方式")
      const afterBalance = beforeBalance - balancePaid
      await transaction.collection("users").doc(userId).update({ data: { balance: afterBalance, updateTime: db.serverDate() } })
      const log = await transaction.collection("balance_logs").add({
        data: { userId, type: "settlement", amount: totalAmount, beforeBalance, afterBalance, totalAmount, balancePaid, offlinePaid, payMethod: "none", offlinePayMethod, consumeItemId: item._id, consumeItem: item.name, remark, requestId, staffId: staff._id, staffName: staff.name, status: 1, createTime: db.serverDate() }
      })
      const result = { logId: log._id, beforeBalance, afterBalance, balancePaid, offlinePaid }
      await transaction.collection("operation_requests").doc(operationId).set({ data: { staffId: staff._id, operation: "settlement", requestId, payloadHash, result, createTime: db.serverDate() } })
      return { ...result, requestId, replayed: false }
    })
    return { code: 0, data: outcome }
  } catch (error) {
    if (error.businessCode) return { code: error.businessCode, message: error.message }
    return resultFromError(error)
  }
}
