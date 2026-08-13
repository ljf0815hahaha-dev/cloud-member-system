const { call } = require("../../utils/cloud")

Page({
  data: { vehicles: [] },
  async onShow() {
    try {
      const vehicles = await call("memberVehicles")
      this.setData({ vehicles })
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" })
    }
  }
})
