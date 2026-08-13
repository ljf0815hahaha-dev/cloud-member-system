const { call, formatFen } = require("../../utils/cloud")

function formatLog(log) {
  const recharge = log.type === "recharge"
  const positive = recharge || (log.type === "reversal" && Number(log.balanceDelta) > 0)
  return { ...log, typeText: recharge ? "充值" : log.type === "settlement" ? "消费" : "冲正", amountText: `${positive ? "+" : "-"}${formatFen(log.amount)}`, afterBalanceText: formatFen(log.afterBalance), balancePaidText: formatFen(log.balancePaid), offlinePaidText: formatFen(log.offlinePaid), timeText: new Date(log.createTime).toLocaleString(), methodText: ({ wechat: "微信", alipay: "支付宝", cash: "现金", none: "无" })[log.payMethod || log.offlinePayMethod] || "" }
}

Page({
  data: { allLogs: [], logs: [], activeFilter: "all", rechargeTotal: "¥0.00", settlementTotal: "¥0.00" },
  async onShow() {
    try {
      const allLogs = (await call("getLogs", { limit: 50 })).map(formatLog)
      const recharge = allLogs.filter(item => item.type === "recharge").reduce((sum, item) => sum + item.amount, 0)
      const settlement = allLogs.filter(item => item.type === "settlement").reduce((sum, item) => sum + item.amount, 0)
      this.setData({ allLogs, logs: allLogs, rechargeTotal: formatFen(recharge), settlementTotal: formatFen(settlement) })
    } catch (error) { wx.showToast({ title: error.message, icon: "none" }) }
  },
  filter(event) {
    const activeFilter = event.currentTarget.dataset.type
    this.setData({ activeFilter, logs: activeFilter === "all" ? this.data.allLogs : this.data.allLogs.filter(item => item.type === activeFilter) })
  }
})
