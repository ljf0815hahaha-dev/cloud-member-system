const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const allowedServices = ["wash", "detail", "film", "coating", "other"]

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  const user = (await db.collection("users").where({ openid: OPENID, status: 1 }).limit(1).get()).data[0]
  if (!user) return { code: 401, message: "请先完成手机号登录" }
  const serviceType = String(event.serviceType || "").trim()
  const appointmentDate = String(event.appointmentDate || "").trim()
  const timeSlot = String(event.timeSlot || "").trim()
  const remark = String(event.remark || "").trim().slice(0, 200)
  if (!allowedServices.includes(serviceType)) return { code: 400, message: "请选择服务项目" }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !/^\d{2}:\d{2}$/.test(timeSlot)) return { code: 400, message: "请选择预约日期和时间" }
  const vehicleId = String(event.vehicleId || "").trim()
  let vehicleSnapshot = null
  if (vehicleId) {
    const vehicle = (await db.collection("vehicles").doc(vehicleId).get().catch(() => ({ data: null }))).data
    if (!vehicle || vehicle.userId !== user._id || vehicle.status !== 1) return { code: 400, message: "所选车辆不可用" }
    vehicleSnapshot = { id: vehicle._id, plateNumber: vehicle.plateNumber, brand: vehicle.brand || "", model: vehicle.model || "" }
  }
  const result = await db.collection("appointments").add({ data: { userId: user._id, memberName: user.name || "会员", mobile: user.mobile || "", vehicleId, vehicleSnapshot, serviceType, appointmentDate, timeSlot, remark, status: "pending", createTime: db.serverDate(), updateTime: db.serverDate() } })
  return { code: 0, data: { id: result._id, status: "pending" } }
}
