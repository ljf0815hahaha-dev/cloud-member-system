const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const result = await db.collection("notices").where({ status: 1 }).orderBy("sort", "asc").limit(10).get()
  return { code: 0, data: result.data }
}
