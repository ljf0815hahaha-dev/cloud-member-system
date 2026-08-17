const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const isCloudFile = value => typeof value === "string" && value.startsWith("cloud://")
const imageList = value => Array.isArray(value) && value.length <= 9 && value.every(isCloudFile)
const asText = (value, max = 100) => String(value || "").trim().slice(0, max)

async function getOrder(orderId) {
  return (await db.collection("work_orders").doc(orderId).get().catch(() => ({ data: null }))).data
}

function canOperate(staff, order) {
  return staff.role === "admin" || order.createdStaffId === staff._id || order.assignedStaffId === staff._id
}

exports.main = async event => {
  try {
    const staff = await requireStaff(db, event.token)
    const action = String(event.action || "")

    if (action === "staffOptions") {
      const result = await db.collection("staff").where({ status: 1 }).get()
      return { code: 0, data: result.data.filter(item => ["staff", "admin"].includes(item.role)).map(item => ({ id: item._id, name: item.name, role: item.role })) }
    }

    if (action === "list") {
      const userId = asText(event.userId, 64)
      if (!userId) return { code: 400, message: "缺少会员信息" }
      const result = await db.collection("work_orders").where({ userId }).limit(100).get()
      const orders = result.data.sort((a, b) => new Date(b.createTime || 0).getTime() - new Date(a.createTime || 0).getTime())
      return { code: 0, data: orders.map(({ _id, ...item }) => ({ id: _id, ...item })) }
    }

    if (action === "create") {
      const userId = asText(event.userId, 64), vehicleId = asText(event.vehicleId, 64), serviceName = asText(event.serviceName, 50)
      const expectedDeliveryAt = asText(event.expectedDeliveryAt, 32), assignedStaffId = asText(event.assignedStaffId, 64)
      const beforeImages = event.beforeImages || [], remark = asText(event.remark, 300)
      if (!userId || !vehicleId || !serviceName || !expectedDeliveryAt || !assignedStaffId || !imageList(beforeImages) || !beforeImages.length) return { code: 400, message: "请填写服务、施工人员、预计交车时间并上传施工前照片" }
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(expectedDeliveryAt)) return { code: 400, message: "预计交车时间格式不正确" }
      const [memberResult, vehicleResult, assignedResult] = await Promise.all([
        db.collection("users").doc(userId).get().catch(() => ({ data: null })),
        db.collection("vehicles").doc(vehicleId).get().catch(() => ({ data: null })),
        db.collection("staff").doc(assignedStaffId).get().catch(() => ({ data: null }))
      ])
      const member = memberResult.data, vehicle = vehicleResult.data, assigned = assignedResult.data
      if (!member || member.status !== 1 || !vehicle || vehicle.status !== 1 || vehicle.userId !== userId || !assigned || assigned.status !== 1) return { code: 400, message: "会员、车辆或施工人员信息无效" }
      if (staff.role !== "admin" && assignedStaffId !== staff._id) return { code: 403, message: "店员只能创建分配给自己的工单" }
      const result = await db.collection("work_orders").add({ data: {
        userId, memberName: member.name || "会员", memberMobile: member.mobile || "", vehicleId,
        vehicleSnapshot: { plateNumber: vehicle.plateNumber || "", brand: vehicle.brand || "", model: vehicle.model || "", color: vehicle.color || "" },
        serviceName, expectedDeliveryAt, assignedStaffId, assignedStaffName: assigned.name || "施工人员", beforeImages, afterImages: [], remark,
        status: "pending", createdStaffId: staff._id, createdStaffName: staff.name || "", createTime: db.serverDate(), updateTime: db.serverDate()
      } })
      return { code: 0, data: { id: result._id } }
    }

    const orderId = asText(event.orderId, 64), order = await getOrder(orderId)
    if (!order) return { code: 404, message: "工单不存在" }
    if (!canOperate(staff, order)) return { code: 403, message: "无权操作该工单" }

    if (action === "start") {
      if (order.status !== "pending") return { code: 400, message: "当前工单不能开始施工" }
      await db.collection("work_orders").doc(orderId).update({ data: { status: "inProgress", startedAt: db.serverDate(), updateTime: db.serverDate() } })
      return { code: 0, data: true }
    }

    if (action === "complete") {
      const afterImages = event.afterImages || []
      if (!imageList(afterImages) || !afterImages.length) return { code: 400, message: "请上传施工后照片后再提交完工" }
      if (!['pending', 'inProgress'].includes(order.status)) return { code: 400, message: "当前工单不能提交完工" }
      await db.collection("work_orders").doc(orderId).update({ data: { status: "completed", afterImages, completedAt: db.serverDate(), completedStaffId: staff._id, completedStaffName: staff.name || "", updateTime: db.serverDate() } })
      return { code: 0, data: true }
    }

    if (action === "sign") {
      const signerName = asText(event.signerName, 40)
      if (!signerName) return { code: 400, message: "请填写顾客签收姓名" }
      if (order.status !== "completed" || order.signedAt) return { code: 400, message: "当前工单不能重复签收" }
      await db.collection("work_orders").doc(orderId).update({ data: { signerName, signedAt: db.serverDate(), signedStaffId: staff._id, signedStaffName: staff.name || "", updateTime: db.serverDate() } })
      return { code: 0, data: true }
    }

    return { code: 400, message: "不支持的工单操作" }
  } catch (error) {
    return resultFromError(error)
  }
}
