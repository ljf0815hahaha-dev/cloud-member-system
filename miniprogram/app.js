App({
  globalData: {
    envId: "YOUR_CLOUDBASE_ENV_ID",
    devMode: true
  },
  onLaunch() {
    if (this.globalData.devMode) return
    if (!wx.cloud) {
      wx.showModal({ title: "运行环境错误", content: "请使用支持云开发的微信客户端。", showCancel: false })
      return
    }
    wx.cloud.init({ env: this.globalData.envId, traceUser: true })
  }
})
