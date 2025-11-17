# 构建配置说明

本项目支持在构建时将 Twitch Client ID 和 Client Secret 内置到应用中，这样最终用户就不需要手动配置这些信息。

## 功能特性

- 在构建时读取 `.secret` 文件并将凭据内置到应用中
- 用户无需手动填写 Client ID 和 Client Secret
- 仍然保留手动配置的选项（用户配置会覆盖内置配置）
- `.secret` 文件不会被提交到版本控制

## 使用方法

### 1. 创建 .secret 文件

复制示例文件并填入您的真实凭据：

```bash
cp .secret.example .secret
```

编辑 `.secret` 文件，填入您从 [Twitch Developer Console](https://dev.twitch.tv/console/apps) 获取的凭据：

```
TWITCH_CLIENT_ID=your_actual_client_id
TWITCH_CLIENT_SECRET=your_actual_client_secret
```

### 2. 构建应用

运行构建命令，prebuild 脚本会自动读取 `.secret` 文件：

```bash
# 构建 Windows 和 macOS 版本
npm run build

# 仅构建 Windows 版本
npm run build:win

# 仅构建 macOS 版本
npm run build:mac
```

### 3. 构建过程

构建时会发生以下操作：

1. `prebuild` 脚本读取 `.secret` 文件
2. 验证 Client ID 和 Secret 是否存在且非占位符
3. 生成 `config/builtin.js` 文件，包含内置的凭据
4. electron-builder 将应用打包，包含内置配置

### 4. 用户体验

当最终用户使用构建后的应用时：

- 应用会自动加载内置的 Client ID 和 Secret
- 用户只需要完成 OAuth 授权流程
- 用户仍然可以在设置中手动覆盖这些值

## 工作原理

### 文件说明

- `.secret.example` - 模板文件，展示需要配置的内容
- `.secret` - 实际的凭据文件（不会被提交到 Git）
- `scripts/prebuild.js` - 构建前脚本，读取 `.secret` 并生成配置
- `config/builtin.js` - 自动生成的内置配置文件

### 配置优先级

应用按以下优先级加载配置：

1. 内置配置（从 `.secret` 构建）作为基础
2. 用户的 `.env` 文件配置会覆盖内置配置
3. 空值不会覆盖已有的配置

### 安全注意事项

- ✅ `.secret` 文件已添加到 `.gitignore`，不会被提交
- ✅ 构建后的 `config/builtin.js` 会被包含在应用中
- ⚠️ 请妥善保管您的 `.secret` 文件
- ⚠️ 不要将包含凭据的 `config/builtin.js` 提交到公开仓库

## 无 .secret 文件构建

如果不存在 `.secret` 文件，构建仍会成功，但会：

- 显示警告信息
- 生成空的内置配置
- 用户需要手动配置 Client ID 和 Secret

## 故障排查

### 构建失败：找不到凭据

```
Error: .secret file must contain TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET
```

**解决方法**：检查 `.secret` 文件是否包含两个必需的字段。

### 构建失败：占位符值

```
Warning: .secret file contains placeholder values.
Please update .secret with your actual credentials.
```

**解决方法**：将 `your_client_id_here` 和 `your_client_secret_here` 替换为真实的凭据。

### 应用启动但仍要求输入凭据

**可能原因**：
1. 构建时没有 `.secret` 文件
2. `.secret` 文件内容不正确
3. `config/builtin.js` 未被正确打包

**解决方法**：
1. 确认 `.secret` 文件存在且内容正确
2. 重新运行 `npm run prebuild` 检查输出
3. 检查 `config/builtin.js` 文件内容
4. 重新构建应用

## 示例工作流程

```bash
# 1. 设置凭据
cp .secret.example .secret
# 编辑 .secret 填入真实凭据

# 2. 测试 prebuild 脚本
npm run prebuild

# 3. 检查生成的配置
cat config/builtin.js

# 4. 构建应用
npm run build:win  # 或 build:mac

# 5. 测试构建后的应用
# 检查 dist/ 目录中的应用
```

## 开发模式

在开发模式下（`npm run gui:dev`），应用仍然使用 `.env` 文件进行配置，不会使用内置配置。这允许开发者测试不同的凭据而无需重新构建。
