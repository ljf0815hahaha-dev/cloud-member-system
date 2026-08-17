(() => {
  const config = window.STAFF_APP_CONFIG || {}
  const cachedSession = JSON.parse(localStorage.getItem("staff_session") || "null")
  const cachedProfile = JSON.parse(localStorage.getItem("staff_profile") || "null")
  const validCachedSession = cachedSession && cachedProfile && Number(cachedSession.expireAt) > Date.now()
  const state = { app: null, token: validCachedSession ? cachedSession.token : "", staff: validCachedSession ? cachedProfile : null, member: null, consumeItems: [], vehicles: [], members: [], memberOffset: 0, memberTotal: 0, memberHasMore: false }
  const $ = id => document.getElementById(id)
  const fen = value => { const text = String(value).trim(); return /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text) ? Math.round(Number(text) * 100) : NaN }
  const yuan = value => `¥${(Number(value || 0) / 100).toFixed(2)}`
  const idOf = item => item && (item.id || item._id)
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node }
  const requestId = () => `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(4)).join("-")}`
  const pendingKey = operation => `staff_pending_${operation}`
  const getRequestId = operation => { let value = sessionStorage.getItem(pendingKey(operation)); if (!value) { value = requestId(); sessionStorage.setItem(pendingKey(operation), value) } return value }
  const clearRequestId = operation => sessionStorage.removeItem(pendingKey(operation))
  async function submitting(button, action) { if (button.disabled) return; button.disabled = true; try { return await action() } finally { button.disabled = false } }

  function message(text, type = "success") { const target = $("action-message"); target.textContent = text; target.className = `message ${type}` }
  function setLoginError(text = "") { $("login-error").textContent = text }
  function setSearchError(text = "") { $("search-error").textContent = text }
  function clearSession() {
    localStorage.removeItem("staff_session"); localStorage.removeItem("staff_token"); localStorage.removeItem("staff_profile")
    state.token = ""; state.staff = null; state.member = null; state.consumeItems = []
    $("member-card").classList.add("hidden"); $("actions").classList.add("hidden")
  }
  function showApp() {
    const active = Boolean(state.token && state.staff)
    $("login-view").classList.toggle("hidden", active); $("workbench").classList.toggle("hidden", !active); $("logout").classList.toggle("hidden", !active)
    $("admin-tab").classList.toggle("hidden", !(active && state.staff.role === "admin"))
    $("staff-name").replaceChildren()
    if (active) {
      $("staff-name").append(document.createTextNode(`${state.staff.name} · ${state.staff.role === "admin" ? "店长" : "店员"}`))
      if (config.devMode) $("staff-name").append(el("span", "本地演示", "dev-badge"))
    }
  }
  async function call(name, data = {}) {
    if (config.devMode) return window.MockStaffService.call(name, data)
    const result = await state.app.callFunction({ name, data })
    const body = result.result
    if (!body || body.code !== 0) throw new Error((body && body.message) || "服务调用失败")
    return body.data
  }
  function renderLogs(target, logs) {
    target.replaceChildren()
    if (!logs.length) { target.append(el("div", "暂无近期流水", "log")); return }
    logs.forEach(log => target.append(el("div", `${log.type === "recharge" ? "充值" : log.type === "settlement" ? "消费" : "冲正"} ${yuan(log.amount)} · ${new Date(log.createTime).toLocaleString()}`, "log")))
  }
  function renderMember(data) {
    state.member = { ...data.member, id: idOf(data.member) }
    state.vehicles = (data.vehicles || []).map(item => ({ ...item, id: idOf(item) }))
    const main = el("div", null, "member-main"), info = el("div"), name = el("div", state.member.name || "会员", "member-name"), mobile = el("div", state.member.mobile, "member-mobile")
    info.append(name, mobile); main.append(info, el("div", yuan(state.member.balance), "member-balance"))
    const logs = el("div"); renderLogs(logs, data.recentLogs || [])
    $("member-card").replaceChildren(main, logs); $("member-card").classList.remove("hidden"); $("actions").classList.remove("hidden"); renderVehicles(); updateSettlementPreview()
  }
  function clearVehicleForm() { $("vehicle-id").value = ""; $("vehicle-version").value = "0"; $("vehicle-plate").value = ""; $("vehicle-brand").value = ""; $("vehicle-model").value = ""; $("vehicle-color").value = ""; $("vehicle-vin").value = ""; $("vehicle-default").checked = false }
  function renderVehicles() {
    const rows = state.vehicles.map(vehicle => {
      const row = el("div", null, "vehicle-row"), info = el("div", `${vehicle.plateNumber}${vehicle.isDefault ? " · 默认" : ""}\n${[vehicle.brand, vehicle.model, vehicle.color].filter(Boolean).join(" ") || "未填写车型"}`), actions = el("div", null, "inline")
      const edit = el("button", "编辑", "ghost"), disable = el("button", vehicle.status === 1 ? "停用" : "已停用", "ghost")
      edit.addEventListener("click", () => { $("vehicle-id").value = vehicle.id; $("vehicle-version").value = vehicle.version || 1; $("vehicle-plate").value = vehicle.plateNumber; $("vehicle-brand").value = vehicle.brand || ""; $("vehicle-model").value = vehicle.model || ""; $("vehicle-color").value = vehicle.color || ""; $("vehicle-vin").value = vehicle.vin || ""; $("vehicle-default").checked = Boolean(vehicle.isDefault) })
      disable.disabled = vehicle.status !== 1; disable.addEventListener("click", async () => { try { await call("staffSaveVehicle", { token: state.token, userId: state.member.id, vehicleId: vehicle.id, version: vehicle.version || 1, plateNumber: vehicle.plateNumber, brand: vehicle.brand, model: vehicle.model, color: vehicle.color, vin: vehicle.vin, isDefault: false, status: 0 }); await searchCurrentMember(); message("车辆已停用") } catch (error) { message(error.message, "error") } })
      actions.append(edit, disable); row.append(info, actions); return row
    })
    $("vehicle-list").replaceChildren(...(rows.length ? rows : [el("div", "暂无车辆档案", "log")]))
    $("film-vehicle").replaceChildren(...state.vehicles.filter(item => item.status === 1).map(vehicle => { const option = el("option", `${vehicle.plateNumber} ${vehicle.brand || ""} ${vehicle.model || ""}`); option.value = vehicle.id; option.selected = Boolean(vehicle.isDefault); return option }))
  }
  async function searchCurrentMember() {
    if (!state.member) return
    renderMember(await call("staffSearch", { token: state.token, mobile: state.member.mobile }))
  }
  function renderConsumeItems(items) {
    state.consumeItems = items.map(item => typeof item === "string" ? { id: item, name: item, sort: 0 } : { ...item, id: idOf(item) })
    $("consume-item").replaceChildren(...state.consumeItems.map(item => { const option = el("option", item.priceFen ? `${item.name} · ${yuan(item.priceFen)}` : item.name); option.value = item.id; option.dataset.priceFen = String(item.priceFen || 0); return option }))
  }
  async function loadConsumeItems() { renderConsumeItems(await call("getConsumeItems", { token: state.token })) }
  async function loadAppointments() {
    if (!state.staff) return
    const target = $("appointment-list")
    try {
      const appointments = await call("staffAppointments", { token: state.token, action: "list", status: $("appointment-status").value })
      target.replaceChildren()
      if (!appointments.length) { target.append(el("div", "暂无待确认预约", "log")); return }
      appointments.forEach(item => {
        const row = el("div", null, "admin-row"), vehicle = item.vehicleSnapshot && item.vehicleSnapshot.plateNumber ? ` · ${item.vehicleSnapshot.plateNumber}` : "", info = el("span", `${item.appointmentDate} ${item.timeSlot} · ${item.memberName || "会员"}\n${({ wash: "洗车", detail: "精洗美容", film: "贴膜服务", coating: "镀晶/车衣", other: "其他服务" })[item.serviceType] || item.serviceType}${vehicle}`), actions = el("div", null, "inline")
        const transitions = item.status === "pending" ? [["确认", "confirmed"], ["取消", "cancelled"]] : item.status === "confirmed" ? [["完成", "completed"], ["取消", "cancelled"]] : []
        transitions.forEach(([label, status]) => { const button = el("button", label, "ghost"); button.addEventListener("click", () => submitting(button, async () => { if (status === "cancelled" && !confirm("确认取消该预约？")) return; await call("staffAppointments", { token: state.token, action: "update", appointmentId: idOf(item), status }); message(`预约已${label}`); await loadAppointments() })); actions.append(button) })
        row.append(info, actions); target.append(row)
      })
    } catch (error) { target.replaceChildren(el("div", error.message, "error")) }
  }
  async function refreshOverview() {
    if (!state.staff) return
    $("today-label").textContent = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" })
    if (state.staff.role !== "admin") return
    try {
      const data = await call("adminData", { token: state.token }), today = new Date().toDateString()
      const todays = data.logs.filter(log => new Date(log.createTime).toDateString() === today && log.status === 1)
      $("stat-members").textContent = String(data.memberCount || 0)
      $("stat-recharge").textContent = yuan(todays.filter(log => log.type === "recharge").reduce((sum, log) => sum + log.amount, 0))
      $("stat-settlement").textContent = yuan(todays.filter(log => log.type === "settlement").reduce((sum, log) => sum + log.amount, 0))
    } catch (error) { console.warn("overview unavailable", error) }
  }
  function renderAdminRows(target, rows, emptyText) { target.replaceChildren(...(rows.length ? rows : [el("div", emptyText)])) }
  function renderMemberOverview() {
    const target = $("member-overview-list")
    target.replaceChildren(...(state.members.length ? state.members.map(member => {
      const row = el("div", null, "member-overview-row"), info = el("div"), name = el("strong", member.name || "会员"), detail = el("span", `${member.mobile} · 余额 ${yuan(member.balance)}`), button = el("button", "查看", "ghost")
      button.addEventListener("click", async () => { $("mobile").value = member.mobile; try { renderMember(await call("staffSearch", { token: state.token, mobile: member.mobile })); $("actions").scrollIntoView({ behavior: "smooth", block: "start" }) } catch (error) { message(error.message, "error") } })
      info.append(name, detail); row.append(info, button); return row
    }) : [el("div", "暂无会员", "log")]))
    $("member-overview-summary").textContent = `已展示 ${state.members.length} / ${state.memberTotal} 位会员`
    $("load-more-members").classList.toggle("hidden", !state.memberHasMore)
  }
  async function loadMembers(reset = false) {
    if (!state.staff || state.staff.role !== "admin") return
    if (reset) { state.members = []; state.memberOffset = 0; state.memberTotal = 0; state.memberHasMore = false }
    const data = await call("staffMembers", { token: state.token, offset: state.memberOffset, pageSize: 20 })
    state.members.push(...data.members); state.memberOffset = data.nextOffset; state.memberTotal = data.total; state.memberHasMore = data.hasMore
    renderMemberOverview()
  }
  function field(value, type = "text") { const input = document.createElement("input"); input.type = type; input.value = value == null ? "" : String(value); return input }
  function actionButton(text, handler) { const button = el("button", text, "ghost"); button.addEventListener("click", () => submitting(button, handler)); return button }
  function renderStaffAdmin(items) {
    renderAdminRows($("staff-list"), items.map(item => {
      const row = el("div", null, "admin-edit-row"), info = el("div", `${item.name} · ${item.account}\n${item.role === "admin" ? "店长" : "店员"} · ${item.status === 1 ? "启用" : "停用"}`), controls = el("div", null, "admin-controls")
      const role = document.createElement("select"); [["staff", "店员"], ["admin", "店长"]].forEach(([value, text]) => { const option = el("option", text); option.value = value; option.selected = item.role === value; role.append(option) })
      controls.append(role, actionButton("保存角色", async () => { await call("adminUpdateStaff", { token: state.token, staffId: idOf(item), action: "setRole", role: role.value }); message("员工角色已更新，旧会话已失效"); await loadAdmin() }), actionButton(item.status === 1 ? "停用" : "启用", async () => { await call("adminUpdateStaff", { token: state.token, staffId: idOf(item), action: "setStatus", status: item.status === 1 ? 0 : 1 }); message("员工状态已更新，旧会话已失效"); await loadAdmin() }), actionButton("重置密码", async () => { const password = prompt("请输入至少6位的新密码"); if (password == null) return; await call("adminUpdateStaff", { token: state.token, staffId: idOf(item), action: "resetPassword", password }); message("密码已重置，旧会话已失效"); await loadAdmin() }))
      row.append(info, controls); return row
    }), "暂无员工")
  }
  function renderItemAdmin(items) {
    renderAdminRows($("consume-items-list"), items.map(item => {
      const row = el("div", null, "admin-edit-row"), controls = el("div", null, "admin-controls"), name = field(item.name), price = field(((Number(item.priceFen) || 0) / 100).toFixed(2), "number"), sort = field(item.sort, "number")
      price.min = "0"; price.step = "0.01"; price.title = "参考价（元）"
      controls.append(name, price, sort, actionButton("保存", async () => { await call("adminUpdateItem", { token: state.token, itemId: idOf(item), version: item.version || 1, name: name.value, priceFen: fen(price.value), sort: Number(sort.value) }); message("消费项目已更新"); await loadAdmin() }), actionButton(item.status === 1 ? "停用" : "启用", async () => { await call("adminUpdateItem", { token: state.token, itemId: idOf(item), version: item.version || 1, status: item.status === 1 ? 0 : 1 }); message("消费项目状态已更新"); await loadAdmin() }))
      row.append(el("div", item.status === 1 ? "启用" : "停用"), controls); return row
    }), "暂无消费项目")
  }
  function renderNoticeAdmin(items) {
    renderAdminRows($("notice-list"), items.map(item => {
      const row = el("div", null, "admin-edit-row"), controls = el("div", null, "admin-controls"), title = field(item.title), sort = field(item.sort, "number"), file = document.createElement("input"), preview = el("div", null, "image-preview")
      file.type = "file"; file.accept = "image/jpeg,image/png,image/webp"
      if (item.image) { const image = document.createElement("img"); image.src = item.image; image.alt = item.title; preview.append(image) }
      file.addEventListener("change", () => { try { const selected = validateNoticeImage(file.files); const image = document.createElement("img"); image.src = URL.createObjectURL(selected); image.alt = "待替换公告图片"; preview.replaceChildren(image) } catch (error) { file.value = ""; preview.replaceChildren(); message(error.message, "error") } })
      controls.append(title, sort, file, preview, actionButton("保存", async () => { const patch = { token: state.token, noticeId: idOf(item), version: item.version || 1, title: title.value, sort: Number(sort.value) }; if (file.files.length) patch.image = await uploadNoticeImage(file.files); await call("adminUpdateNotice", patch); message("公告已更新"); await loadAdmin() }), actionButton(item.status === 1 ? "下架" : "上架", async () => { await call("adminUpdateNotice", { token: state.token, noticeId: idOf(item), version: item.version || 1, status: item.status === 1 ? 0 : 1 }); message("公告状态已更新"); await loadAdmin() }))
      row.append(el("div", item.status === 1 ? "展示中" : "已下架"), controls); return row
    }), "暂无公告")
  }
  async function loadAdmin() {
    if (!state.staff || state.staff.role !== "admin") return
    const data = await call("adminData", { token: state.token })
    $("stat-members").textContent = String(data.memberCount || 0)
    renderConsumeItems(data.consumeItems.filter(item => item.status === 1))
    renderStaffAdmin(data.staff); renderItemAdmin(data.consumeItems); renderNoticeAdmin(data.notices); await loadMembers(true)
    renderAdminRows($("admin-log-list"), data.logs.map(log => {
      const row = el("div", null, "admin-row")
      row.append(el("span", `${log.type === "recharge" ? "充值" : log.type === "settlement" ? "消费" : "冲正"} ${yuan(log.amount)} · ${new Date(log.createTime).toLocaleString()}`))
      if (log.status === 1 && log.type !== "reversal") {
        const button = el("button", "作废"); button.dataset.revoke = idOf(log)
        button.addEventListener("click", async () => {
          if (!confirm("确认作废该流水？系统只自动冲正余额，线下款需人工处理。")) return
          try { const result = await call("adminRevoke", { token: state.token, logId: button.dataset.revoke, revokeReason: "店长在工作台作废" }); message(result.offlineRefundRequired ? "余额已冲正，线下款需人工处理" : "流水已作废并完成余额冲正"); await Promise.all([loadAdmin(), refreshOverview(), searchCurrentMember()]) } catch (error) { message(error.message, "error") }
        }); row.append(button)
      } else row.append(el("span", "已处理"))
      return row
    }), "暂无流水")
  }
  function updateSettlementPreview() {
    if (!state.member) return
    const total = fen($("settle-amount").value)
    if (!Number.isSafeInteger(total) || total <= 0) { $("settlement-preview").textContent = "输入消费金额后显示结算拆分"; $("offline-method-wrap").classList.add("hidden"); return }
    const balancePaid = Math.min(state.member.balance, total), offlinePaid = total - balancePaid
    $("settlement-preview").textContent = `本次消费 ${yuan(total)}：会员余额支付 ${yuan(balancePaid)}，线下补付 ${yuan(offlinePaid)}。`
    $("offline-method-wrap").classList.toggle("hidden", offlinePaid === 0)
  }
  function validateImages(files) {
    const valid = Array.from(files).slice(0, 9), types = ["image/jpeg", "image/png", "image/webp"]
    if (!valid.length) throw new Error("请至少选择一张照片")
    if (valid.some(file => !types.includes(file.type))) throw new Error("照片仅支持 JPEG、PNG 或 WebP")
    if (valid.some(file => file.size > 10 * 1024 * 1024)) throw new Error("单张照片不能超过10MB")
    return valid
  }
  async function uploadImages(files) {
    const valid = validateImages(files)
    if (config.devMode) return window.MockStaffService.upload(valid, state.member.id)
    return Promise.all(valid.map((file, index) => state.app.uploadFile({ cloudPath: `film-records/${state.member.id}/${Date.now()}-${index}-${file.name}`, filePath: file }).then(res => res.fileID)))
  }
  function validateNoticeImage(files) {
    const file = files && files[0], types = ["image/jpeg", "image/png", "image/webp"]
    if (!file) throw new Error("请选择公告图片")
    if (!types.includes(file.type)) throw new Error("公告图片仅支持 JPEG、PNG 或 WebP")
    if (file.size > 10 * 1024 * 1024) throw new Error("公告图片不能超过10MB")
    return file
  }
  async function uploadNoticeImage(files) {
    const file = validateNoticeImage(files)
    if (config.devMode) return (await window.MockStaffService.upload([file]))[0]
    const suffix = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type]
    const random = crypto.getRandomValues(new Uint32Array(4)).join("-")
    return state.app.uploadFile({ cloudPath: `notices/${Date.now()}-${random}.${suffix}`, filePath: file }).then(res => res.fileID)
  }
  async function activateSession(profile) {
    state.staff = profile; showApp(); await Promise.all([loadConsumeItems(), refreshOverview(), loadAppointments()])
  }
  async function boot() {
    $("mode-value").textContent = config.devMode ? "本地演示" : "云端正式"
    $("mode-detail").textContent = config.devMode ? "使用浏览器本地模拟数据" : "已连接 CloudBase 云环境"
    $("login-hint").classList.toggle("hidden", !config.devMode); $("search-hint").classList.toggle("hidden", !config.devMode)
    if (!validCachedSession) clearSession()
    if (!config.devMode) {
      if (!config.envId || config.envId === "YOUR_CLOUDBASE_ENV_ID") { setLoginError("请先在 config.js 配置 CloudBase 环境 ID"); showApp(); return }
      if (typeof cloudbase === "undefined" || typeof cloudbase.init !== "function") { setLoginError("CloudBase SDK 加载失败，请刷新页面后重试"); showApp(); return }
      state.app = cloudbase.init({ env: config.envId, region: "ap-shanghai" })
      try { await state.app.auth().signInAnonymously() } catch (error) { console.warn("anonymous auth unavailable", error) }
    }
    showApp()
    $("film-service-date").value = new Date().toISOString().slice(0, 10)
    if (state.staff) {
      try { const profile = await call("sessionValidate", { token: state.token }); await activateSession(profile) }
      catch (error) { clearSession(); showApp(); setLoginError("登录状态已过期，请重新登录") }
    }
  }

  $("login").addEventListener("click", async () => {
    setLoginError(); const account = $("account").value.trim(), password = $("password").value
    try { const data = await call("staffLogin", { account, password }); state.token = data.token; const profile = { name: data.name, role: data.role, account: data.account }; localStorage.setItem("staff_session", JSON.stringify({ token: data.token, expireAt: new Date(data.expireAt).getTime() || Number(data.expireAt), tokenVersion: data.tokenVersion })); localStorage.setItem("staff_profile", JSON.stringify(profile)); const validatedProfile = await call("sessionValidate", { token: data.token }); localStorage.setItem("staff_profile", JSON.stringify(validatedProfile)); await activateSession(validatedProfile) } catch (error) { clearSession(); showApp(); setLoginError(error.message) }
  })
  $("logout").addEventListener("click", () => { clearSession(); showApp() })
  $("refresh-appointments").addEventListener("click", loadAppointments)
  $("appointment-status").addEventListener("change", loadAppointments)
  $("load-more-members").addEventListener("click", () => submitting($("load-more-members"), () => loadMembers()))
  $("new-member").addEventListener("click", () => { $("member-create").classList.remove("hidden"); $("member-name").focus() })
  $("cancel-member").addEventListener("click", () => { $("member-create").classList.add("hidden"); $("member-name").value = ""; $("member-mobile").value = "" })
  $("save-member").addEventListener("click", () => submitting($("save-member"), async () => { try { const data = await call("staffSaveMember", { token: state.token, name: $("member-name").value.trim(), mobile: $("member-mobile").value.trim() }); $("member-create").classList.add("hidden"); $("member-name").value = ""; $("member-mobile").value = ""; $("mobile").value = data.mobile; renderMember(await call("staffSearch", { token: state.token, mobile: data.mobile })); message("会员已建档，可继续充值、结算与新增服务记录") } catch (error) { message(error.message, "error") } }))
  $("search").addEventListener("click", async () => { setSearchError(); try { renderMember(await call("staffSearch", { token: state.token, mobile: $("mobile").value.trim() })) } catch (error) { setSearchError(error.message); if (error.message.includes("过期") || error.message.includes("不可用")) $("logout").click() } })
  document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", async () => { document.querySelectorAll(".tab").forEach(item => item.classList.toggle("active", item === tab)); document.querySelectorAll(".action-panel").forEach(panel => panel.classList.toggle("hidden", panel.dataset.panel !== tab.dataset.tab)); message(""); if (tab.dataset.tab === "admin") try { await loadAdmin() } catch (error) { message(error.message, "error") } }))
  $("film-images").addEventListener("change", event => { try { const files = validateImages(event.target.files); $("image-preview").replaceChildren(...files.map(file => { const image = document.createElement("img"); image.src = URL.createObjectURL(file); image.alt = "待上传照片"; return image })) } catch (error) { event.target.value = ""; $("image-preview").replaceChildren(); message(error.message, "error") } })
  $("settle-amount").addEventListener("input", updateSettlementPreview)
  $("consume-item").addEventListener("change", () => { const option = $("consume-item").selectedOptions[0], priceFen = Number(option && option.dataset.priceFen); if (Number.isSafeInteger(priceFen) && priceFen > 0 && !$("settle-amount").value) { $("settle-amount").value = (priceFen / 100).toFixed(2); updateSettlementPreview() } })
  $("recharge").addEventListener("click", () => submitting($("recharge"), async () => { try { if (!state.member) throw new Error("请先查询会员"); const data = await call("staffRecharge", { token: state.token, requestId: getRequestId("recharge"), userId: state.member.id, amount: fen($("recharge-amount").value), payMethod: $("recharge-method").value, remark: $("recharge-remark").value }); clearRequestId("recharge"); $("recharge-amount").value = ""; await Promise.all([searchCurrentMember(), refreshOverview()]); message(`${data.replayed ? "充值请求已确认" : "充值成功"}，结余 ${yuan(data.afterBalance)}`) } catch (error) { message(error.message, "error") } }))
  $("settle").addEventListener("click", () => submitting($("settle"), async () => { try { if (!state.member) throw new Error("请先查询会员"); const total = fen($("settle-amount").value), offline = Math.max(0, total - state.member.balance); const data = await call("staffSettle", { token: state.token, requestId: getRequestId("settlement"), userId: state.member.id, totalAmount: total, consumeItemId: $("consume-item").value, offlinePayMethod: offline ? $("offline-method").value : "none", remark: $("settle-remark").value }); clearRequestId("settlement"); $("settle-amount").value = ""; await Promise.all([searchCurrentMember(), refreshOverview()]); updateSettlementPreview(); message(`${data.replayed ? "结算请求已确认" : "结算完成"}：余额支付 ${yuan(data.balancePaid)}，线下补付 ${yuan(data.offlinePaid)}，结余 ${yuan(data.afterBalance)}`) } catch (error) { message(error.message, "error") } }))
  $("save-vehicle").addEventListener("click", () => submitting($("save-vehicle"), async () => { try { if (!state.member) throw new Error("请先查询会员"); await call("staffSaveVehicle", { token: state.token, userId: state.member.id, vehicleId: $("vehicle-id").value, version: Number($("vehicle-version").value), plateNumber: $("vehicle-plate").value, brand: $("vehicle-brand").value, model: $("vehicle-model").value, color: $("vehicle-color").value, vin: $("vehicle-vin").value, isDefault: $("vehicle-default").checked, status: 1 }); clearVehicleForm(); await searchCurrentMember(); message("车辆档案已保存") } catch (error) { message(error.message, "error") } }))
  $("cancel-vehicle").addEventListener("click", clearVehicleForm)
  $("add-film").addEventListener("click", () => submitting($("add-film"), async () => { try { if (!state.member) throw new Error("请先查询会员"); if (!$("film-vehicle").value) throw new Error("请先新增并选择车辆"); message("照片上传中..."); const images = await uploadImages($("film-images").files); await call("staffAddFilm", { token: state.token, userId: state.member.id, vehicleId: $("film-vehicle").value, serviceDate: $("film-service-date").value, filmCategory: $("film-category").value, filmBrand: $("film-brand").value, filmSeries: $("film-series").value, filmModel: $("film-model").value, installPosition: Array.from(document.querySelectorAll("#film-positions input:checked")).map(item => item.value), warrantyMonths: Number($("film-warranty").value), mileageKm: Number($("film-mileage").value), images, remark: $("film-remark").value }); message("贴膜记录已保存，顾客端可立即查看"); $("film-images").value = ""; $("film-remark").value = ""; $("image-preview").replaceChildren() } catch (error) { message(error.message, "error") } }))
  $("add-staff").addEventListener("click", async () => { try { await call("adminAddStaff", { token: state.token, account: $("new-staff-account").value.trim(), name: $("new-staff-name").value.trim(), password: $("new-staff-password").value, role: $("new-staff-role").value }); message("员工账号已创建"); $("new-staff-account").value = $("new-staff-name").value = $("new-staff-password").value = ""; await loadAdmin() } catch (error) { message(error.message, "error") } })
  $("add-consume-item").addEventListener("click", async () => { try { const price = $("new-consume-price").value; await call("adminAddItem", { token: state.token, name: $("new-consume-item").value.trim(), priceFen: price ? fen(price) : 0, sort: state.consumeItems.length * 10 + 10, status: 1 }); $("new-consume-item").value = ""; $("new-consume-price").value = ""; message("消费项目已添加"); await loadAdmin() } catch (error) { message(error.message, "error") } })
  $("new-notice-image").addEventListener("change", event => { try { const file = validateNoticeImage(event.target.files), image = document.createElement("img"); image.src = URL.createObjectURL(file); image.alt = "待上传公告图片"; $("new-notice-preview").replaceChildren(image) } catch (error) { event.target.value = ""; $("new-notice-preview").replaceChildren(); message(error.message, "error") } })
  $("add-notice").addEventListener("click", async () => { try { const files = $("new-notice-image").files, image = files.length ? await uploadNoticeImage(files) : ""; await call("adminAddNotice", { token: state.token, title: $("new-notice-title").value.trim(), image, sort: 0, status: 1 }); $("new-notice-title").value = ""; $("new-notice-image").value = ""; $("new-notice-preview").replaceChildren(); message("公告已添加"); await loadAdmin() } catch (error) { message(error.message, "error") } })
  boot()
})()
