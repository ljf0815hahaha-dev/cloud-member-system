"use strict"

const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "..")
const args = new Set(process.argv.slice(2))
const allowedArgs = new Set(["--allow-placeholder"])
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg))
const allowPlaceholder = args.has("--allow-placeholder")
const errors = []
const warnings = []
const passes = []

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/")
}

function pass(message) {
  passes.push(message)
}

function fail(message) {
  errors.push(message)
}

function warn(message) {
  warnings.push(message)
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8")
  } catch (error) {
    fail(`${relative(filePath)} 无法读取：${error.message}`)
    return null
  }
}

function readJson(filePath) {
  const source = readText(filePath)
  if (source === null) return null
  try {
    return JSON.parse(source.replace(/^\uFEFF/, ""))
  } catch (error) {
    fail(`${relative(filePath)} 不是有效 JSON：${error.message}`)
    return null
  }
}

function extractConfig(source, filePath) {
  if (source === null) return null
  const envMatch = source.match(/\benvId\s*:\s*(["'])(.*?)\1/)
  const devModeMatch = source.match(/\bdevMode\s*:\s*(true|false)\b/)

  if (!envMatch) fail(`${relative(filePath)} 缺少字符串 envId 配置`)
  if (!devModeMatch) fail(`${relative(filePath)} 缺少布尔值 devMode 配置`)
  if (!envMatch || !devModeMatch) return null

  return {
    envId: envMatch[2].trim(),
    devMode: devModeMatch[1] === "true"
  }
}

function checkConfiguration(manifest) {
  const placeholder = manifest.configuration.placeholder
  const targets = [
    ["小程序", manifest.configuration.miniprogram.file],
    ["H5", manifest.configuration.h5.file]
  ]
  const configs = []

  for (const [label, configuredPath] of targets) {
    const filePath = path.join(root, configuredPath)
    const config = extractConfig(readText(filePath), filePath)
    if (!config) continue
    configs.push([label, config])

    if (!config.envId) {
      fail(`${label} envId 为空`)
    } else if (config.envId === placeholder) {
      if (allowPlaceholder) warn(`${label} envId 仍为占位符（已由 --allow-placeholder 放宽）`)
      else fail(`${label} envId 仍为占位符 ${placeholder}`)
    } else {
      pass(`${label} envId 已填写`)
    }

    if (config.devMode && allowPlaceholder) warn(`${label} devMode 当前为 true；正式部署前必须改为 false`)
    else if (config.devMode) fail(`${label} devMode 必须为 false`)
    else pass(`${label} devMode 为 false`)
  }

  if (configs.length === targets.length) {
    const realEnvIds = configs.map(([, config]) => config.envId).filter((envId) => envId && envId !== placeholder)
    if (realEnvIds.length === targets.length && new Set(realEnvIds).size !== 1) {
      fail("小程序与 H5 envId 不一致")
    } else if (realEnvIds.length === targets.length) {
      pass("小程序与 H5 使用同一 envId")
    }
  }
}

function checkCloudFunctions(manifest) {
  const functionsRoot = path.join(root, "cloudfunctions")
  const requiredForAll = manifest.cloudFunctionFiles.requiredForAll
  const authRequired = new Set(manifest.cloudFunctionFiles.authRequired)
  const authFile = manifest.cloudFunctionFiles.authFile

  for (const name of manifest.cloudFunctions) {
    const functionDir = path.join(functionsRoot, name)
    if (!fs.existsSync(functionDir) || !fs.statSync(functionDir).isDirectory()) {
      fail(`cloudfunctions/${name}/ 目录缺失`)
      continue
    }

    const requiredFiles = authRequired.has(name) ? [...requiredForAll, authFile] : requiredForAll
    const missing = requiredFiles.filter((fileName) => !fs.existsSync(path.join(functionDir, fileName)))
    if (missing.length) fail(`cloudfunctions/${name}/ 缺少：${missing.join(", ")}`)
    else pass(`cloudfunctions/${name}/ 必需文件完整`)
  }
}

function checkH5Charset(manifest) {
  const entryPath = path.join(root, manifest.h5.entry)
  const html = readText(entryPath)
  if (html === null) return

  const hasCharset = /<meta\s+[^>]*charset\s*=\s*["']?utf-8["']?[^>]*>/i.test(html)
  if (hasCharset) pass(`${manifest.h5.entry} 声明 UTF-8 charset`)
  else fail(`${manifest.h5.entry} 缺少 UTF-8 meta charset`)
}

function checkSitemap(manifest) {
  const appConfigPath = path.join(root, manifest.miniprogram.appConfig)
  const appConfig = readJson(appConfigPath)
  if (!appConfig) return

  const expectedName = path.basename(manifest.miniprogram.sitemap)
  if (appConfig.sitemapLocation !== expectedName) {
    fail(`${manifest.miniprogram.appConfig} 的 sitemapLocation 应为 ${expectedName}`)
    return
  }

  const sitemapPath = path.join(root, manifest.miniprogram.sitemap)
  const sitemap = readJson(sitemapPath)
  if (!sitemap) return
  if (!Array.isArray(sitemap.rules) || sitemap.rules.length === 0) {
    fail(`${manifest.miniprogram.sitemap} 必须包含非空 rules 数组`)
    return
  }

  const invalidRule = sitemap.rules.find((rule) => {
    return !rule || !["allow", "disallow"].includes(rule.action) || typeof rule.page !== "string" || !rule.page
  })
  if (invalidRule) fail(`${manifest.miniprogram.sitemap} 包含无效规则`)
  else pass(`${manifest.miniprogram.sitemap} 存在且配置有效`)
}

function printResults() {
  for (const message of passes) console.log(`[PASS] ${message}`)
  for (const message of warnings) console.warn(`[WARN] ${message}`)
  for (const message of errors) console.error(`[FAIL] ${message}`)
  console.log(`\n结果：${passes.length} 通过，${warnings.length} 警告，${errors.length} 失败`)
}

if (unknownArgs.length) {
  fail(`未知参数：${unknownArgs.join(", ")}`)
} else {
  const manifestPath = path.join(root, "docs", "deployment-manifest.json")
  const manifest = readJson(manifestPath)
  if (manifest) {
    checkConfiguration(manifest)
    checkCloudFunctions(manifest)
    checkH5Charset(manifest)
    checkSitemap(manifest)
  }
}

printResults()
process.exitCode = errors.length ? 1 : 0
