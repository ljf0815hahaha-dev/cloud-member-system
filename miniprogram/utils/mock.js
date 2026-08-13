const STORAGE_KEY = "cloud_member_mock_data"
const SESSION_KEY = "cloud_member_mock_session"
const SESSION_TTL = 2 * 60 * 60 * 1000

function seed() {
  return {
    member: { id: "mock-member-1", mobile: "13800138000", name: "演示车友8000", balance: 68000 },
    notices: [{ _id: "notice-1", title: "门店活动", image: "/images/mock-banner.svg", sort: 1, status: 1 }],
    logs: [
      { _id: "log-1", type: "recharge", amount: 100000, beforeBalance: 0, afterBalance: 100000, remark: "到店充值", status: 1, createTime: "2026-08-10T10:00:00+08:00" },
      { _id: "log-2", type: "settlement", amount: 32000, beforeBalance: 100000, afterBalance: 68000, balancePaid: 32000, offlinePaid: 0, consumeItem: "汽车贴膜", remark: "前挡玻璃膜", status: 1, createTime: "2026-08-12T14:30:00+08:00" }
    ],
    vehicles: [{ _id: "vehicle-1", userId: "mock-member-1", plateNumber: "粤B12345", plateKey: "粤B12345", brand: "特斯拉", model: "Model Y", color: "白色", vin: "", isDefault: true, status: 1, version: 1 }],
    films: [{ _id: "film-1", userId: "mock-member-1", vehicleId: "vehicle-1", vehicleSnapshot: { id: "vehicle-1", plateNumber: "粤B12345", brand: "特斯拉", model: "Model Y", color: "白色", vin: "" }, serviceDate: "2026-08-12", filmCategory: "window", filmBrand: "演示品牌", filmSeries: "畅享系列", filmModel: "前挡膜", installPosition: ["frontWindshield"], warrantyMonths: 60, mileageKm: 12000, images: ["/images/mock-film.svg"], remark: "前挡玻璃膜 · 演示服务记录", schemaVersion: 2, status: 1, createTime: "2026-08-12T14:45:00+08:00" }]
  }
}

function read() {
  let data = wx.getStorageSync(STORAGE_KEY)
  if (!data) { data = seed(); wx.setStorageSync(STORAGE_KEY, data) }
  return data
}

function save(data) { wx.setStorageSync(STORAGE_KEY, data); return data }
function createSession(memberId) { wx.setStorageSync(SESSION_KEY, { memberId, expireAt: Date.now() + SESSION_TTL }) }
function getSession() {
  const session = wx.getStorageSync(SESSION_KEY)
  if (!session || !session.memberId || Number(session.expireAt) <= Date.now()) { wx.removeStorageSync(SESSION_KEY); return null }
  return session
}
function logout() { wx.removeStorageSync(SESSION_KEY) }

function call(name) {
  const data = read()
  if (name === "getNotices") return Promise.resolve(data.notices)
  if (name === "memberLogin") { createSession(data.member.id); return Promise.resolve({ userId: data.member.id, mobile: data.member.mobile, expireAt: Date.now() + SESSION_TTL }) }
  if (name === "memberLogout") { logout(); return Promise.resolve(true) }
  const session = getSession()
  if (!session || session.memberId !== data.member.id) return Promise.reject(new Error("请先完成手机号登录"))
  if (name === "memberData") return Promise.resolve(data.member)
  if (name === "getLogs") return Promise.resolve(data.logs.filter(item => item.status === 1))
  if (name === "getFilms") return Promise.resolve(data.films.map(item => ({ schemaVersion: 1, status: 1, vehicleSnapshot: null, serviceDate: "", filmCategory: "", filmBrand: "", filmSeries: "", filmModel: "", installPosition: [], warrantyMonths: 0, mileageKm: 0, ...item })))
  if (name === "memberVehicles") return Promise.resolve((data.vehicles || []).filter(item => item.status === 1).sort((a, b) => Number(b.isDefault) - Number(a.isDefault)))
  return Promise.reject(new Error(`本地模式暂不支持服务：${name}`))
}

module.exports = { call, logout, getSession }
