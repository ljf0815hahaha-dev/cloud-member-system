const { call } = require("../../utils/cloud")

const categoryNames = { window: "玻璃膜", ppf: "漆面保护膜", colorChange: "改色膜", other: "其他" }
const positionNames = { frontWindshield: "前挡", rearWindshield: "后挡", leftFront: "左前窗", rightFront: "右前窗", leftRear: "左后窗", rightRear: "右后窗", sunroof: "天窗", fullBody: "全车", partialBody: "局部车身", other: "其他" }

Page({
  data: { records: [] },
  async onShow() {
    try {
      const records = await call("getFilms", { limit: 30 })
      this.setData({ records: records.map(item => ({
        ...item,
        timeText: item.serviceDate || new Date(item.createTime).toLocaleDateString(),
        vehicleText: item.vehicleSnapshot ? `${item.vehicleSnapshot.plateNumber} ${item.vehicleSnapshot.brand || ""} ${item.vehicleSnapshot.model || ""}` : "未关联车辆（旧记录）",
        filmText: [categoryNames[item.filmCategory], item.filmBrand, item.filmSeries, item.filmModel].filter(Boolean).join(" · ") || "未填写膜信息（旧记录）",
        positionText: (item.installPosition || []).map(value => positionNames[value] || value).join("、") || "未填写",
        warrantyText: Number(item.warrantyMonths) > 0 ? `${item.warrantyMonths} 个月` : "未填写"
      })) })
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" })
    }
  },
  preview(event) {
    wx.previewImage({ current: event.currentTarget.dataset.current, urls: event.currentTarget.dataset.images })
  }
})
