# 来源与许可声明 / Attribution & License

## 本项目许可

本项目采用 **GNU Affero General Public License v3.0（AGPL-3.0）**，全文见 [LICENSE](LICENSE)。

选择 AGPL-3.0 的原因是：本项目在设计与实现上参考了下面这个同样以 AGPL-3.0 发布的开源项目。

> 如果你修改本项目并通过网络向用户提供服务，AGPL 的网络源码条款同样适用：
> 你需要向使用者提供修改后的完整源码。

---

## 参考来源

### Tidal_Echo —— 设计语言「PEARL TIDE · 珍珠潮汐」

- 仓库：https://github.com/anhe2021212-spec/Tidal_Echo
- 作者：anhe2021212-spec
- 许可：AGPL-3.0
- 本项目参考的内容：
  - **配色体系**：PEARL TIDE（珍珠潮汐，浅色）与 Harbor（港湾，深色）两套色板的取值与用法
  - **字体方案**：拉丁文用 Cormorant Garamond 衬线体，中文用宋体/明朝体系
  - **排版手法**：以 `clamp()` 做流式缩放而非媒体查询、衬线正文、字距微调、
    毛玻璃卡片（`backdrop-filter`）、边缘渐隐
  - **信息密度与间距节奏**

本项目是在自己的 React + TypeScript 代码库上**按上述设计规范重新实现**的界面，
并非直接复制其源码；但既然参考了它的设计体系，本项目同样以 AGPL-3.0 发布。

### 字体

- **Cormorant Garamond**（`src/assets/fonts/CormorantGaramond-var.woff2`）
  - 作者：Christian Thalmann / Catharsis Fonts
  - 许可：SIL Open Font License 1.1（可自由嵌入与再分发）
  - 来源：Google Fonts

### 背景图

`src/assets/backgrounds/*.webp` 由使用者提供的本地壁纸库裁切压缩而来。
这些素材**不在**上述开源许可范围内，商用或再分发前请自行确认原图授权。
生成脚本见 `tools/build-backgrounds.py`。

### 其他参考

- [taste-skill](https://github.com/Leonxlnx/taste-skill)（MIT）—— 界面审计与设计旋钮的方法论
- [transitions.dev](https://github.com/Jakubantalik/transitions.dev) —— 过渡动效的手法（共享缓动、关闭快于打开、blur 景深）
- [cute-chat-stickers](https://github.com/Anko3o/cute-chat-stickers) —— 气泡表情回应的交互思路
