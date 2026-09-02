# 登录界面源码说明

本目录只包含 Electron 本地认证界面。产品名称和 Logo 路径不要在 HTML 中硬编码，统一修改上一级目录的 `desktop.config.json`。

登录窗口有效尺寸固定为 `420 x 620`，禁止缩放、最大化和全屏；注册页激活时标题栏也不可拖动。

- `login.html`：页面结构和输入字段
- `login.css`：颜色、间距和固定窗口布局
- `login.js`：页面切换、表单校验和受限认证调用
- `assets/`：SVG 或 PNG 品牌资源

注册页只提交用户名、密码和申请理由；确认密码仅在页面内比较，不发送到服务器。找回密码不使用邮箱：第一阶段只提交用户名和申请理由，管理员批准后第二阶段显示“重置密码”和“再次确认重置密码”。第二次密码仅在页面内比较，不发送到服务器。页面通过 `preload.js` 暴露的固定方法调用主进程，不拥有文件系统、Shell 或任意网络访问能力。

修改后执行：

```powershell
npm run check
npm test
npm run visual:check
```

Logo 的 Markdown 预览见 [assets/品牌预览.md](./assets/品牌预览.md)。
