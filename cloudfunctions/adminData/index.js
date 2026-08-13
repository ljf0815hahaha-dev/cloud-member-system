const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const withId = item => { const { _id, password, passwordHash, ...rest } = item; return { id: _id, ...rest } }
exports.main = async event => {
  try {
    await requireStaff(db, event.token, ["admin"])
    const [members, staff, notices, consumeItems, logs] = await Promise.all([
      db.collection("users").where({ status: 1 }).count(), db.collection("staff").orderBy("createTime", "desc").get(), db.collection("notices").orderBy("sort", "asc").get(), db.collection("consume_items").orderBy("sort", "asc").get(), db.collection("balance_logs").orderBy("createTime", "desc").limit(50).get()
    ])
    return { code: 0, data: { memberCount: members.total, staff: staff.data.map(withId), notices: notices.data.map(withId), consumeItems: consumeItems.data.map(withId), logs: logs.data.map(withId) } }
  } catch (error) { return resultFromError(error) }
}
