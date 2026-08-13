function unauthorized(message = "请先完成手机号登录") { const error = new Error(message); error.code = "UNAUTHORIZED"; return error }
module.exports = { unauthorized }
