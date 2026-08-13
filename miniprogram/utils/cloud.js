const mock = require("./mock")

function call(name, data = {}) {
  const app = getApp()
  if (app.globalData.devMode) return mock.call(name, data)
  return wx.cloud.callFunction({ name, data }).then(({ result }) => {
    if (!result || result.code !== 0) {
      throw new Error((result && result.message) || "服务暂时不可用")
    }
    return result.data
  })
}

function formatFen(fen) {
  return `¥${(Number(fen || 0) / 100).toFixed(2)}`
}

module.exports = { call, formatFen }
