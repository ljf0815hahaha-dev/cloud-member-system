const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async event => {
  try {
    const staff = await requireStaff(db, event.token, ["admin"])
    const logId = String(event.logId || "").trim(), revokeReason = String(event.revokeReason || "").trim().slice(0, 200)
    if (!logId) return { code: 400, message: "请选择要作废的流水" }
    const outcome = await db.runTransaction(async transaction => {
      const source = (await transaction.collection("balance_logs").doc(logId).get()).data
      if (!source) throw new Error("流水不存在")
      if (source.type === "reversal") throw new Error("冲正流水不能作废")
      if (source.status !== 1) throw new Error("流水已作废，不能重复处理")
      if (!["recharge", "settlement"].includes(source.type)) throw new Error("该流水不支持作废")
      const member = (await transaction.collection("users").doc(source.userId).get()).data
      if (!member || member.status !== 1) throw new Error("会员不存在或已禁用")
      const beforeBalance = Number(member.balance || 0)
      const balanceDelta = source.type === "recharge" ? -Number(source.amount || 0) : Number(source.balancePaid || 0)
      if (beforeBalance + balanceDelta < 0) throw new Error("会员余额不足，不能作废该充值流水")
      const afterBalance = beforeBalance + balanceDelta
      const offlineRefundRequired = source.type === "settlement" && Number(source.offlinePaid || 0) > 0
      await transaction.collection("users").doc(source.userId).update({ data: { balance: afterBalance, updateTime: db.serverDate() } })
      await transaction.collection("balance_logs").doc(logId).update({ data: { status: 0, revokeTime: db.serverDate(), revokedByStaffId: staff._id, revokedByStaffName: staff.name, revokeReason } })
      const reversal = await transaction.collection("balance_logs").add({ data: { userId: source.userId, type: "reversal", amount: Math.abs(balanceDelta), beforeBalance, afterBalance, totalAmount: 0, balancePaid: 0, offlinePaid: 0, payMethod: "none", offlinePayMethod: "none", consumeItemId: source.consumeItemId || "", consumeItem: source.consumeItem || "", remark: revokeReason, sourceLogId: logId, sourceType: source.type, balanceDelta, revokeReason, revokedByStaffId: staff._id, revokedByStaffName: staff.name, offlineRefundRequired, staffId: staff._id, staffName: staff.name, status: 1, createTime: db.serverDate() } })
      return { id: reversal._id, sourceLogId: logId, beforeBalance, afterBalance, balanceDelta, offlineRefundRequired, message: offlineRefundRequired ? "余额已冲正，线下款需人工处理" : "余额已冲正" }
    })
    return { code: 0, data: outcome }
  } catch (error) {
    if (["流水不存在", "冲正流水不能作废", "流水已作废，不能重复处理", "该流水不支持作废", "会员不存在或已禁用", "会员余额不足，不能作废该充值流水"].includes(error.message)) return { code: 400, message: error.message }
    return resultFromError(error)
  }
}
