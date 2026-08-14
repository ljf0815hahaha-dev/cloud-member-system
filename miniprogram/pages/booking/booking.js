const { call } = require("../../utils/cloud")

const serviceNames = { wash: "洗车", detail: "精洗美容", film: "贴膜服务", coating: "镀晶/车衣", other: "其他服务" }
const localDate = value => { const offset = value.getTimezoneOffset() * 60000; return new Date(value - offset).toISOString().slice(0, 10) }

Page({
  data: { minDate: localDate(new Date()), date: localDate(new Date()), timeSlots: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"], timeIndex: 0, serviceTypes: Object.keys(serviceNames), serviceNames, serviceIndex: 0, vehicles: [], vehicleIndex: 0, remark: "", submitting: false, appointments: [] },
  async onShow() {
    try {
      const [vehicles, appointments] = await Promise.all([call("memberVehicles"), call("getAppointments")])
      this.setData({ vehicles, appointments: appointments.map(item => ({ ...item, serviceText: serviceNames[item.serviceType] || item.serviceType, statusText: ({ pending: "待门店确认", confirmed: "已确认", completed: "已完成", cancelled: "已取消" })[item.status] || item.status })) })
    } catch (error) { wx.showToast({ title: error.message, icon: "none" }) }
  },
  onDate(event) { this.setData({ date: event.detail.value }) },
  onTime(event) { this.setData({ timeIndex: Number(event.detail.value) }) },
  onService(event) { this.setData({ serviceIndex: Number(event.detail.value) }) },
  onVehicle(event) { this.setData({ vehicleIndex: Number(event.detail.value) }) },
  onRemark(event) { this.setData({ remark: event.detail.value }) },
  async submit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    try {
      const vehicle = this.data.vehicles[this.data.vehicleIndex]
      await call("createAppointment", { appointmentDate: this.data.date, timeSlot: this.data.timeSlots[this.data.timeIndex], serviceType: this.data.serviceTypes[this.data.serviceIndex], vehicleId: vehicle ? vehicle._id : "", remark: this.data.remark })
      wx.showToast({ title: "预约已提交" }); this.setData({ remark: "" }); await this.onShow()
    } catch (error) { wx.showToast({ title: error.message, icon: "none" }) } finally { this.setData({ submitting: false }) }
  }
})
