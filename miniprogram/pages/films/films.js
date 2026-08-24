const { call } = require("../../utils/cloud")

const categoryNames = { window: "玻璃膜", ppf: "漆面保护膜", colorChange: "改色膜", other: "其他" }
const positionNames = { frontWindshield: "前挡", rearWindshield: "后挡", leftFront: "左前窗", rightFront: "右前窗", leftRear: "左后窗", rightRear: "右后窗", sunroof: "天窗", fullBody: "全车", partialBody: "局部车身", other: "其他" }
const money = value => `¥${(Number(value || 0) / 100).toFixed(2)}`
const warranty = value => {
  const months = Number(value || 0)
  if (!months) return "未填写"
  return months % 12 === 0 ? `${months / 12} 年` : `${months} 个月`
}

Page({
  data: { records: [] },
  async onShow() {
    try {
      const records = await call("getFilms", { limit: 30 })
      this.setData({ records: records.map(item => ({
        ...item,
        timeText: item.serviceDate || new Date(item.createTime).toLocaleDateString(),
        vehicleText: item.vehicleSnapshot ? `${item.vehicleSnapshot.plateNumber} ${item.vehicleSnapshot.brand || ""} ${item.vehicleSnapshot.model || ""}` : "未关联车辆（旧记录）",
        memberName: item.memberSnapshot && item.memberSnapshot.name || "会员",
        memberMobile: item.memberSnapshot && item.memberSnapshot.mobile || "未填写",
        storeText: item.constructionStore || "EP车房·改色·车衣·精洗",
        productText: [item.productType || categoryNames[item.filmCategory], item.filmBrand, item.filmSeries].filter(Boolean).join(" · ") || "未填写产品信息（旧记录）",
        modelText: item.filmModel || "未填写",
        rollNumberText: item.rollNumber || "未填写",
        priceText: money(item.constructionPriceFen),
        isCertificate: Number(item.schemaVersion || 1) >= 3,
        positionText: (item.installPosition || []).map(value => positionNames[value] || value).join("、") || "未填写",
        warrantyText: warranty(item.warrantyMonths)
      })) })
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" })
    }
  },
  preview(event) {
    wx.previewImage({ current: event.currentTarget.dataset.current, urls: event.currentTarget.dataset.images })
  }
})
