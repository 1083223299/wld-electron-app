# Mac 打包 / 代码签名配置说明

> 配套文件：`package.json` 中 `build` 配置。
> JSON 格式不支持注释，所以所有说明集中写在这里。

---

## 一、当前 `package.json` 里的配置

```json
"mac": {
  "target": ["dmg", "zip"],
  "icon": "build/icon.icns",
  "category": "public.app-category.business",
  "hardenedRuntime": true,
  "notarize": false
}
```

### 字段说明

| 字段 | 作用 | 说明 |
|---|---|---|
| `mac.target` | Mac 打包产物：`dmg`（给用户安装）+ `zip`（给 electron-updater 自动更新用） | 保持默认即可 |
| `mac.icon` | Mac 应用图标 | 已配置为 `build/icon.png`——electron-builder **打包时自动把它转成 icns**，无需手动准备 icns 文件；建议图片分辨率 ≥512x512（最好 1024x1024，Retina 屏更清晰） |
| `mac.category` | 应用分类标识，`business` = 商务类 | 保持默认 |
| `mac.hardenedRuntime` | 开启硬运行时（macOS 签名/公证的强制要求） | 保持 `true` |
| `mac.notarize` | Apple 公证开关（**现在的 macOS 强制要求**，不做公证的包在别的 Mac 上打不开） | 当前 `false` = 暂不公证；正式发布前改 `true` 并配环境变量（见下） |

---

## 二、证书配置方式（重要：不要写空字符串占位）

**electron-builder 的证书字段不能填空字符串**——`cscLink` 空值会被当成文件路径去解析，直接导致打包报错（已实测验证）。所以证书一律用**环境变量**配置，package.json 里不出现证书字段：

### Windows 签名（可选，但正式发布强烈建议）

```powershell
set CSC_LINK=D:\cert\你的证书.pfx
set CSC_KEY_PASSWORD=证书密码
npm run dist:prod
```

### Mac 签名 + 公证

1. 在 Apple Developer 后台申请 **Developer ID Application** 证书并导入 Mac 钥匙串
2. electron-builder 会自动查找钥匙串中的 Developer ID 证书；如需指定证书名，用环境变量：

```powershell
set CSC_NAME=Developer ID Application: 公司名 (TEAMID)
```

3. 公证需要 Apple 环境变量（三选一）：
   - 方式一（推荐）：`APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`
   - 方式二：`APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD`（App 专用密码在 appleid.apple.com 生成）
   - 方式三：`APPLE_KEYCHAIN` + `APPLE_KEYCHAIN_PROFILE`

---

## 三、Mac 打包的硬性前提

**macOS 安装包必须在 macOS 电脑上构建**，Windows 上无法交叉编译（dmg 需要 Mac 的 hdiutil，签名需要 Xcode 工具链）。

没有 Mac 的替代方案：
- **GitHub Actions**：用 `macos-latest` runner 自动构建（推荐，免费额度内）
- 借一台 Mac / 云 Mac（MacStadium、AWS EC2 Mac）

Mac 上打包命令：

```bash
# 开发调试（只出 .app，不签名）
npx electron-builder --mac --dir

# 正式打包（签名 + dmg/zip）
npm run build:prod && npx electron-builder --mac
```

产物：`未来电竞管理系统-1.0.0.dmg`、`未来电竞管理系统-1.0.0-mac.zip`、`latest-mac.yml`，全部上传到 OSS `esports-updata/` 目录（electron-updater 在 Mac 上读 `latest-mac.yml`）。

---

## 四、常见问题

- **Mac 包打开提示"无法打开，因为 Apple 无法检查其是否包含恶意软件"** → 没做公证（`notarize` 还是 `false`，或 Apple 环境变量没配）
- **Mac 包提示"已损坏，无法打开"** → 签名问题，检查钥匙串证书与 `CSC_NAME`
- **Windows 打包后 SmartScreen 警告"未知发布者"** → 没签名，配 `CSC_LINK` 后重新打包
- **不要往 package.json 里写 `cscLink: ""` / `cscKeyPassword: ""` 这类空字符串** → 会报 "cannot resolve ... not a file"，一律用环境变量
