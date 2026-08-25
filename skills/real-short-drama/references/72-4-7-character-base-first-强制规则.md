## 4.7 CHARACTER BASE FIRST 强制规则

角色生产必须遵循 BASE FIRST 原则。

每个角色、每个重要成长阶段，必须先生成一张独立的 `CHAR_xxx@base_stage`。

`CHAR_xxx@base_stage` 必须满足：

- 默认 16:9 横版或 4:3 横版白底三视图图像
- 一张图内包含同一角色正面 / 侧面 / 背面三个完整全身视图
- 白底或浅灰底
- 三视图必须同一张脸、同一骨相、同一年龄感、同一身材比例
- 三视图必须同一套当前剧情合法基础服装
- 中性站姿
- 双手自然下垂或轻微自然姿态
- 无文字
- 无标签
- 无边框信息栏
- 无局部细节拼贴
- 无表情宫格
- 无角色卡信息栏
- 无色板
- 无标尺
- 无分栏
- 无剧情背景
- 三个视图服装从头到脚完整可见
- 鞋子可见
- 脸部清晰
- 发型明确
- 身材比例稳定
- 年龄准确
- 适合后续 img2img / I2V / 关键帧生成

`CHAR_xxx@base` 是角色生产真相源。  
`CHAR_xxx@sheet` 是派生展示资产。

禁止：

- 禁止跳过 @base 直接生成 @sheet。
- 禁止跳过 @base 直接生成角色卡。
- 禁止把带文字、信息栏、局部细节、表情宫格的角色设定表当成 @base。
- 禁止把整张 @sheet 喂给 I2V。
- 禁止用带文字、边框、标尺、色板、分栏的角色卡替代 @base。
- 禁止用 WORLD_VISUAL_BIBLE 里的主角预览图替代 @base。
- 禁止从 WORLD_VISUAL_BIBLE 裁一格人物图当 @base。
- 禁止使用带复杂背景的角色图作为 @base。
- 禁止用单张正面全身图替代三视图 @base。

执行顺序必须为：

1. 生成 `CHAR_xxx@base_stage` 白底三视图全身基准图。
2. 进入 THREE-VIEW BASE LOCK GATE / BASE CONFIRMATION GATE。
3. 停在 BASE CONFIRMATION GATE，要求用户审阅 @base；只有 `User Confirmed Image = yes` / `user_confirmed=yes` 后，才允许进入 @sheet。
4. 对主角 / 重要角色，在 @base 已确认后生成 `CHAR_xxx@sheet`。
5. 通过 SHEET LOCK GATE 后，`CharacterAssetCompletion = base_and_sheet_complete`。
6. 后续 SHOT / KEYFRAME / I2V 只允许引用：
   - `CHAR_xxx@base_stage`
   - 或由该 @base 生成并批准的单张关键帧
   - 若需要 sheet 辅助，只能裁取无文字单一人物图块作为 SECONDARY_AUXILIARY_REFERENCE，且必须同时附带 @base。

不允许引用整张 @sheet。

THREE-VIEW BASE LOCK GATE 检查项：

- 是否一张图内包含正面 / 侧面 / 背面三个完整全身视图
- 三视图脸是否稳定、清晰、可复用
- 三视图年龄是否一致且准确
- 三视图身材比例是否稳定
- 三视图发型是否明确且一致
- 三视图服装是否完整可见且一致
- 鞋子是否可见
- 是否无文字、无标签、无边框信息栏
- 是否无局部细节拼贴、无色板、无标尺
- 是否适合抠图、img2img、I2V、关键帧生成
- 是否继承 WORLD_VISUAL_BIBLE 的 CharacterEvolutionDirection / ColorSystem / MaterialLanguage
- 是否符合角色当前成长阶段
- 是否可作为后续所有人物镜头的身份真相源

如果 THREE-VIEW BASE LOCK GATE 不通过，必须重做 `CHAR_xxx@base_stage`，不得进入 @sheet 或视频生产。

### BASE 不是角色阶段终点，但 BASE 必须先确认

`CHAR_xxx@base_stage` 只是角色资产包的第一张图，不是主角 / 重要角色的最终交付。

当角色被判定为主角 / 重要角色时，系统必须先生成 @base，然后停在 BASE CONFIRMATION GATE 调用 `AskUser` 等待用户确认。只有用户明确确认该 @base / `user_confirmed=yes` 后，才允许生成该角色的 `CHAR_xxx@sheet`。

严格状态机解释：

```text
CHARACTER ASSET PACKAGE 是一个复合阶段。
@base generation / BASE CONFIRMATION / @sheet generation / SHEET CONFIRMATION 是该复合阶段的内部子阶段。
“阶段完成后停住”只作用于 CHARACTER ASSET PACKAGE 完成后。
BASE CONFIRMATION GATE 必须停住等用户确认；确认通过后，Next Allowed Substage 固定为 CHARACTER @sheet。
```

禁止在只生成 @base 后把角色资产包标记为完成。  
禁止把 @base 当成完整角色设计交付。  
禁止在 @base 未确认时生成 @sheet。  
禁止用户确认 @base 后跳过 @sheet 直接进入 LOCATION / PROP / COSTUME / 分镜。  
禁止把 THREE-VIEW BASE LOCK GATE 当成角色资产包最终闸门。
