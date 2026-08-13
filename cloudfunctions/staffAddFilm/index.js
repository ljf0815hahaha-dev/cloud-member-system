const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CATEGORIES = ["window", "ppf", "colorChange", "other"]
const POSITIONS = ["frontWindshield", "rearWindshield", "leftFront", "rightFront", "leftRear", "rightRear", "sunroof", "fullBody", "partialBody", "other"]
const text = (value, length) => String(value || "").trim().slice(0, length)

exports.main = async event => {
  try {
    const staff = await requireStaff(db, event.token)
    const userId = String(event.userId || "")
    const vehicleId = String(event.vehicleId || "")
    const images = Array.isArray(event.images) ? event.images.filter(item => typeof item === "string" && (item.startsWith("cloud://") || item.startsWith("data:image/"))).slice(0, 9) : []
    const remark = text(event.remark, 200)
    const filmCategory = String(event.filmCategory || "")
    const installPosition = Array.isArray(event.installPosition) ? [...new Set(event.installPosition.filter(item => POSITIONS.includes(item)))].slice(0, 10) : []
    const warrantyMonths = Number(event.warrantyMonths || 0)
    const mileageKm = Number(event.mileageKm || 0)
    const serviceDate = String(event.serviceDate || "")
    if (!userId || !vehicleId || !images.length) return { code: 400, message: "请选择车辆并至少上传一张服务照片" }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || !CATEGORIES.includes(filmCategory) || !installPosition.length) return { code: 400, message: "请完善服务日期、贴膜类别和施工位置" }
    if (!Number.isSafeInteger(warrantyMonths) || warrantyMonths < 0 || warrantyMonths > 240 || !Number.isSafeInteger(mileageKm) || mileageKm < 0 || mileageKm > 10000000) return { code: 400, message: "质保月数或里程不正确" }
    const [memberResult, vehicleResult] = await Promise.all([
      db.collection("users").doc(userId).get().catch(() => ({ data: null })),
      db.collection("vehicles").doc(vehicleId).get().catch(() => ({ data: null }))
    ])
    const vehicle = vehicleResult.data
    if (!memberResult.data || memberResult.data.status !== 1) return { code: 404, message: "会员不存在或已禁用" }
    if (!vehicle || vehicle.userId !== userId || vehicle.status !== 1) return { code: 400, message: "车辆不存在、已停用或不属于该会员" }
    const vehicleSnapshot = { id: vehicle._id, plateNumber: vehicle.plateNumber, brand: vehicle.brand || "", model: vehicle.model || "", color: vehicle.color || "", vin: vehicle.vin || "" }
    const result = await db.collection("film_records").add({ data: { userId, vehicleId, vehicleSnapshot, serviceDate, filmCategory, filmBrand: text(event.filmBrand, 50), filmSeries: text(event.filmSeries, 50), filmModel: text(event.filmModel, 50), installPosition, warrantyMonths, mileageKm, images, remark, schemaVersion: 2, status: 1, staffId: staff._id, staffName: staff.name, createTime: db.serverDate() } })
    return { code: 0, data: { id: result._id } }
  } catch (error) {
    return resultFromError(error)
  }
}
