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
    const productType = text(event.productType, 50)
    const rollNumber = text(event.rollNumber, 50)
    const constructionStore = text(event.constructionStore, 50)
    const constructionPriceFen = Number(event.constructionPriceFen || 0)
    const installPosition = Array.isArray(event.installPosition) ? [...new Set(event.installPosition.filter(item => POSITIONS.includes(item)))].slice(0, 10) : []
    const warrantyMonths = Number(event.warrantyMonths || 0)
    const mileageKm = Number(event.mileageKm || 0)
    const serviceDate = String(event.serviceDate || "")
    if (!userId || !vehicleId || !images.length) return { code: 400, message: "请选择车辆并至少上传一张服务照片" }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || !CATEGORIES.includes(filmCategory) || !installPosition.length) return { code: 400, message: "请完善服务日期、贴膜类别和施工位置" }
    if (!constructionStore || !productType || !text(event.filmBrand, 50) || !text(event.filmModel, 50) || !rollNumber) return { code: 400, message: "请完善施工门店、产品类型、品牌、型号和卷膜编号" }
    if (!Number.isSafeInteger(constructionPriceFen) || constructionPriceFen < 0 || constructionPriceFen > 100000000 || !Number.isSafeInteger(warrantyMonths) || warrantyMonths < 0 || warrantyMonths > 240 || !Number.isSafeInteger(mileageKm) || mileageKm < 0 || mileageKm > 10000000) return { code: 400, message: "施工价格、质保年限或里程不正确" }
    const [memberResult, vehicleResult] = await Promise.all([
      db.collection("users").doc(userId).get().catch(() => ({ data: null })),
      db.collection("vehicles").doc(vehicleId).get().catch(() => ({ data: null }))
    ])
    const vehicle = vehicleResult.data
    const member = memberResult.data
    if (!member || member.status !== 1) return { code: 404, message: "会员不存在或已禁用" }
    if (!vehicle || vehicle.userId !== userId || vehicle.status !== 1) return { code: 400, message: "车辆不存在、已停用或不属于该会员" }
    const vehicleSnapshot = { id: vehicle._id, plateNumber: vehicle.plateNumber, brand: vehicle.brand || "", model: vehicle.model || "", color: vehicle.color || "", vin: vehicle.vin || "" }
    const memberSnapshot = { name: member.name || "会员", mobile: member.mobile || "" }
    const result = await db.collection("film_records").add({ data: { userId, vehicleId, memberSnapshot, vehicleSnapshot, constructionStore, constructionPriceFen, serviceDate, filmCategory, productType, filmBrand: text(event.filmBrand, 50), filmSeries: text(event.filmSeries, 50), filmModel: text(event.filmModel, 50), rollNumber, installPosition, warrantyMonths, mileageKm, images, remark, schemaVersion: 3, status: 1, staffId: staff._id, staffName: staff.name, createTime: db.serverDate() } })
    return { code: 0, data: { id: result._id } }
  } catch (error) {
    return resultFromError(error)
  }
}
