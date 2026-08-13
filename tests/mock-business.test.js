const assert = require("assert")
const fs = require("fs")
const vm = require("vm")

const store = new Map()
const localStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key)
}
const window = {}
vm.runInNewContext(fs.readFileSync(require.resolve("../staff-h5/mock-service.js"), "utf8"), { window, localStorage, FileReader: class {}, console, Date, Math, JSON, Promise, Array, Number, String, Error, Set })

async function main() {
  const service = window.MockStaffService
  const login = await service.call("staffLogin", { account: "staff", password: "123456" })
  localStorage.setItem("staff_session", JSON.stringify({ token: login.token, expireAt: login.expireAt }))
  localStorage.setItem("staff_profile", JSON.stringify({ account: login.account, name: login.name, role: login.role }))

  const requestId = "recharge-test-0001"
  const first = await service.call("staffRecharge", { token: login.token, requestId, userId: "mock-member-1", amount: 1000, payMethod: "cash", remark: "断言" })
  const replay = await service.call("staffRecharge", { token: login.token, requestId, userId: "mock-member-1", amount: 1000, payMethod: "cash", remark: "断言" })
  assert.strictEqual(first.replayed, false)
  assert.strictEqual(replay.replayed, true)
  assert.strictEqual(replay.logId, first.logId)
  assert.strictEqual(replay.afterBalance, first.afterBalance)
  const searched = await service.call("staffSearch", { token: login.token, mobile: "13800138000" })
  assert.strictEqual(searched.member.balance, 69000, "重放不得重复增加余额")

  let conflict = null
  try {
    await service.call("staffRecharge", { token: login.token, requestId, userId: "mock-member-1", amount: 2000, payMethod: "cash", remark: "断言" })
  } catch (error) {
    conflict = error
  }
  assert(conflict, "不同 payload 必须冲突")
  assert.strictEqual(conflict.code, 409)

  const vehicle = await service.call("staffSaveVehicle", { token: login.token, userId: "mock-member-1", plateNumber: "粤 B88888", brand: "宝马", model: "i3", color: "蓝色", vin: "vin001", isDefault: false, status: 1 })
  const vehicles = await service.call("staffListVehicles", { token: login.token, userId: "mock-member-1" })
  const savedVehicle = vehicles.find(item => item.id === vehicle.id)
  assert(savedVehicle, "车辆新增后应可查询")
  assert.strictEqual(savedVehicle.plateNumber, "粤B88888")
  assert.strictEqual(savedVehicle.vin, "VIN001")

  const film = await service.call("staffAddFilm", { token: login.token, userId: "mock-member-1", vehicleId: vehicle.id, serviceDate: "2026-08-14", filmCategory: "ppf", filmBrand: "XPEL", filmSeries: "ULTIMATE", filmModel: "PLUS", installPosition: ["fullBody"], warrantyMonths: 120, mileageKm: 12345, images: ["data:image/png;base64,AA"], remark: "结构化断言" })
  const raw = JSON.parse(localStorage.getItem("cloud_member_staff_mock_v1"))
  const savedFilm = raw.films.find(item => item.id === film.id)
  assert(savedFilm, "贴膜档案应保存")
  assert.strictEqual(savedFilm.schemaVersion, 2)
  assert.strictEqual(savedFilm.vehicleSnapshot.plateNumber, "粤B88888")
  assert.strictEqual(savedFilm.filmCategory, "ppf")
  assert.deepStrictEqual(savedFilm.installPosition, ["fullBody"])
  assert.strictEqual(savedFilm.warrantyMonths, 120)
  assert.strictEqual(savedFilm.mileageKm, 12345)

  localStorage.setItem("staff_session", JSON.stringify({ token: login.token, expireAt: login.expireAt, tokenVersion: login.tokenVersion }))
  const adminLogin = await service.call("staffLogin", { account: "manager", password: "123456" })
  localStorage.setItem("staff_session", JSON.stringify({ token: adminLogin.token, expireAt: adminLogin.expireAt, tokenVersion: adminLogin.tokenVersion }))
  localStorage.setItem("staff_profile", JSON.stringify({ account: adminLogin.account, name: adminLogin.name, role: adminLogin.role }))
  const adminData = await service.call("adminData", { token: adminLogin.token })
  const staffTarget = adminData.staff.find(item => item.account === "staff")
  await service.call("adminUpdateStaff", { token: adminLogin.token, staffId: staffTarget.id, action: "setStatus", status: 0 })
  localStorage.setItem("staff_session", JSON.stringify({ token: login.token, expireAt: login.expireAt, tokenVersion: login.tokenVersion }))
  localStorage.setItem("staff_profile", JSON.stringify({ account: login.account, name: login.name, role: login.role }))
  await assert.rejects(() => service.call("sessionValidate", { token: login.token }), /登录已过期/)

  const adminRelogin = await service.call("staffLogin", { account: "manager", password: "123456" })
  localStorage.setItem("staff_session", JSON.stringify({ token: adminRelogin.token, expireAt: adminRelogin.expireAt, tokenVersion: adminRelogin.tokenVersion }))
  localStorage.setItem("staff_profile", JSON.stringify({ account: adminRelogin.account, name: adminRelogin.name, role: adminRelogin.role }))
  const refreshed = await service.call("adminData", { token: adminRelogin.token })
  const notice = refreshed.notices[0]
  const changedNotice = await service.call("adminUpdateNotice", { token: adminRelogin.token, noticeId: notice.id, version: notice.version, title: "更新后的公告", status: 0 })
  assert.strictEqual(changedNotice.title, "更新后的公告")
  assert.strictEqual(changedNotice.status, 0)
  const item = refreshed.consumeItems[0]
  const renamedItem = await service.call("adminUpdateItem", { token: adminRelogin.token, itemId: item.id, version: item.version, name: "升级贴膜", status: 0 })
  assert.strictEqual(renamedItem.name, "升级贴膜")
  assert.strictEqual(renamedItem.status, 0)
  const historical = JSON.parse(localStorage.getItem("cloud_member_staff_mock_v1")).logs.find(entry => entry.id === "log-2")
  assert.strictEqual(historical.consumeItem, "汽车贴膜", "历史流水项目名称快照不得改变")

  console.log("Mock 业务断言通过：幂等、车辆、贴膜、员工会话失效、公告上下架、项目改名停用")
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
