const cloud = require("wx-server-sdk")
const { requireStaff, resultFromError } = require("./auth")

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async event => {
  try {
    await requireStaff(db, event.token, ["admin"])
    const offset = Math.max(0, Number.parseInt(event.offset, 10) || 0)
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(event.pageSize, 10) || 20))
    const [countResult, memberResult] = await Promise.all([
      db.collection("users").where({ status: 1 }).count(),
      db.collection("users").where({ status: 1 }).orderBy("createTime", "desc").skip(offset).limit(pageSize).get()
    ])
    const members = memberResult.data.map(member => ({
      id: member._id,
      name: member.name || "会员",
      mobile: member.mobile || "",
      balance: Number(member.balance || 0),
      createTime: member.createTime
    }))
    return { code: 0, data: { members, total: countResult.total, nextOffset: offset + members.length, hasMore: offset + members.length < countResult.total } }
  } catch (error) {
    return resultFromError(error)
  }
}
