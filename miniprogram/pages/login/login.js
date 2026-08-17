const { call } = require("../../utils/cloud")

Page({
  data: { devMode: true },
  onLoad() { this.setData({ devMode: getApp().globalData.devMode }) },
  goStaffLogin() { wx.navigateTo({ url: "/pages/staff-webview/staff-webview" }) },
  async mockLogin() {
    await call("memberLogin", { phoneCode: "mock" })
    wx.showToast({ title: "演示登录成功" })
    setTimeout(() => wx.navigateBack(), 400)
  },
  async authorizePhone(event) {
    if (!event.detail.code) {
      wx.showToast({ title: "需要授权手机号才能登录", icon: "none" })
      return
    }
    wx.showLoading({ title: "登录中" })
    try {
      await call("memberLogin", { phoneCode: event.detail.code })
      wx.showToast({ title: "登录成功" })
      setTimeout(() => wx.navigateBack(), 400)
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" })
    } finally {
      wx.hideLoading()
    }
  }
})
