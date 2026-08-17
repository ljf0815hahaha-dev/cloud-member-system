const { call } = require("../../utils/cloud")

Page({
  data: { devMode: true, privacyAgreed: false },
  onLoad() { this.setData({ devMode: getApp().globalData.devMode }) },
  goStaffLogin() { wx.navigateTo({ url: "/pages/staff-webview/staff-webview" }) },
  togglePrivacy() { this.setData({ privacyAgreed: !this.data.privacyAgreed }) },
  openPrivacy() { wx.navigateTo({ url: "/pages/privacy/privacy" }) },
  ensurePrivacyAgreed() {
    if (this.data.privacyAgreed) return true
    wx.showToast({ title: "请先阅读并同意隐私保护指引", icon: "none" })
    return false
  },
  async mockLogin() {
    if (!this.ensurePrivacyAgreed()) return
    await call("memberLogin", { phoneCode: "mock" })
    wx.showToast({ title: "演示登录成功" })
    setTimeout(() => wx.navigateBack(), 400)
  },
  async authorizePhone(event) {
    if (!this.ensurePrivacyAgreed()) return
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
