## 0.33 PATCH：TEXT-IN-IMAGE BOUNDARY LOCK

### 图像文字边界锁

【补丁目的】

修复 WORLD_VISUAL_BIBLE 可有模块编号 / 小标签，与 KEYFRAME / I2V 图像绝对禁字之间的边界混淆。

### 一、唯一允许文字的图像类型

WORLD_VISUAL_BIBLE 是唯一允许出现模块编号 / 小标签的图像类型。

允许范围：

- 3×3 模块编号
- 极小模块标签
- 非剧情文本
- 用于人类审阅的设定板结构提示

### 二、绝对禁字图像类型

以下图像类型全部禁止由图像模型直接生成文字：

- CHARACTER @base
- CHARACTER @sheet 的人物图块
- LOCATION
- PROP
- COSTUME
- SHOT KEYFRAME
- STORYBOARD IMAGE
- I2V INPUT IMAGE

禁止内容包括：

- 字幕
- 台词
- 角色名
- 信息栏
- 标尺文字
- 色板标签
- UI 字
- 标题
- 海报字
- speech bubble
- watermark

### 三、@sheet 特别规则

@sheet 可以有后期拼装的信息栏、色板、标尺、角色名，但这些文字不得由图像模型直接生成。图像模型只生成角色图块；模板文字、边框、色板标签只能后期拼装或作为文档说明存在。

---
