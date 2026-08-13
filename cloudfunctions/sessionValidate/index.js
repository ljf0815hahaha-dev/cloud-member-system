const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async event => {
  try { const staff = await requireStaff(db, event.token); return { code: 0, data: { id: staff._id, account: staff.account, name: staff.name, role: staff.role } } }
  catch (error) { return resultFromError(error) }
}
