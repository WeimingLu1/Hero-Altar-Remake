# 参考资料

本目录存放网页重制版开发时使用的上游参考资料，不属于 Web 应用运行时。

## `rpgmaker/`

原始 RPG Maker XP / RGSS 工程，保留地图、数据库、Ruby 脚本、音频、图像和原版可执行文件，供规则核对与数据重新提取使用。

`rpgmaker/SOURCE_COMMIT` 记录本次参考快照对应的上游提交。

Web 应用需要的结构化运行时数据已经提取到仓库根目录的 `game-data/`。修改移植逻辑时应优先修改 `app/game-core/`；只有重新生成原始数据时才直接读取本目录。

常用提取脚本：

```bash
ruby scripts/extract_rxdata.rb
ruby scripts/extract_gmud_data.rb
```

迁移期间生成的旧仓库历史备份和本地冲突文件由根目录 `.gitignore` 排除，不属于项目交付内容。
