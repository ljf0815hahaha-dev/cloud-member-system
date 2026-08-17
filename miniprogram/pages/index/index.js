const { call, formatFen } = require("../../utils/cloud")

Page({
  data: { notices: [], loading: true, isLoggedIn: false, balanceText: "¥0.00", memberName: "会员", devMode: true },
  onLoad() { this.setData({ devMode: getApp().globalData.devMode }) },
  onShow() {
    this.load()
  },
  async load() {
    this.setData({ loading: true })
    try {
      const notices = await call("getNotices")
      this.setData({ notices })
      const member = await call("memberData")
      this.setData({
        isLoggedIn: true,
        balanceText: formatFen(member.balance),
        memberName: member.name || "会员"
      })
    } catch (error) {
      this.setData({ isLoggedIn: false })
    } finally {
      this.setData({ loading: false })
    }
  },
  goLogin() { wx.navigateTo({ url: "/pages/login/login" }) },
  goBooking() { wx.navigateTo({ url: "/pages/booking/booking" }) },
  logout() {
    const app = getApp()
    if (app.globalData.devMode) require("../../utils/mock").logout()
    this.setData({ isLoggedIn: false, balanceText: "¥0.00", memberName: "会员" })
    wx.showToast({ title: app.globalData.devMode ? "已退出演示登录" : "已隐藏会员信息" })
  },
  goLogs() { wx.navigateTo({ url: "/pages/logs/logs" }) },
  goFilms() { wx.navigateTo({ url: "/pages/films/films" }) },
  goVehicles() { wx.navigateTo({ url: "/pages/vehicles/vehicles" }) },
  callStore(event) {
    wx.makePhoneCall({ phoneNumber: event.currentTarget.dataset.phone })
  },
  copyAddress() {
    wx.setClipboardData({
      data: "南京市鼓楼区挹江门街道洪庙一巷8号红五月硅巷5栋102",
      success: () => wx.showToast({ title: "地址已复制", icon: "success" })
    })
  }
})
