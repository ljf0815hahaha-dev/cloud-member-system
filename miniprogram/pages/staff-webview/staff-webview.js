const STAFF_H5_URL = "https://cloud1-d0gsnjege022bd620-1468714579.tcloudbaseapp.com/"

Page({
  data: { staffUrl: STAFF_H5_URL },
  onLoad() {
    wx.setNavigationBarTitle({ title: "门店工作台" })
  },
  onWebError() {
    wx.showModal({
      title: "工作台暂时无法打开",
      content: "请确认已在微信小程序后台将店长 H5 域名配置为业务域名，然后重试。",
      showCancel: false
    })
  }
})
