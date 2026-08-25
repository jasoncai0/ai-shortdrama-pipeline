## 4.8 CHARACTER @base 角色基准图

### 定义

`CHAR_001@base` 是默认 16:9 或 4:3 横版、白底 / 浅灰底、同一角色三视图全身基准图；一张图内必须包含正面 / 侧面 / 背面三个完整全身视图，并保持同一张脸、同一骨相、同一年龄感、同一身材比例、同一基础服装。

它是：

- 角色身份真相源
- 脸部一致性真相源
- 身材比例真相源
- 服装比例真相源
- 逐镜关键帧与 I2V 的人物参考源

它不是：

- 角色卡
- 多视图表
- 表情表
- 海报
- 剧照
- 分镜图
- 世界设定板中的人物缩略图

### 多阶段角色

多阶段角色每个成长阶段都必须单独生成 @base：

- `CHAR_001@base_poverty`
- `CHAR_001@base_awakened`
- `CHAR_001@base_power`
- `CHAR_001@base_final`

阶段之间可以变化：

- 服装
- 姿态气质
- 发型细节
- 妆容精致度
- 权力感

但必须保持：

- 同一张脸
- 同一基础骨相
- 同一身份连续性
- 可被观众识别为同一个人

### CHARACTER @base Prompt 模板

```text
Create a photorealistic full-body character base reference for a live-action-looking AI-generated photorealistic human vertical micro-drama.

Aspect ratio: vertical 4:5 or 3:4.

This character inherits WORLD_VISUAL_BIBLE_001 modules: CharacterEvolutionDirection, ColorSystem, LightingSystem, MaterialLanguage, and WorldRulesVisual.

Character: [insert role]
Stage: [poverty / suppressed / awakened / powerful / final control]
Identity: [insert identity]
Emotional baseline: [insert emotion]
Power status: [low / rising / dominant]
Costume function: [insert what the costume says about class, identity, and story stage]

CRITICAL BASE REFERENCE FORMAT:
single person only, white or light gray studio background, full-body identity base with consistent face and body across the required base identity views, neutral standing pose, face clearly visible, full outfit visible from head to toe, shoes visible, natural human proportions, stable facial identity, natural skin texture, realistic fabric texture, no dramatic camera angle, no cinematic background, no props unless essential to identity, no text, no labels, no grid, no collage, no border, no frame, no color palette, no character sheet layout, no expression sheet, no poster, no anime, no cartoon, no illustration, no 3D render.

Purpose:
AI character consistency reference, image-to-video ready, synthetic human identity source, not actor casting, not costume fitting, not real photography test.
This image will be used as the video-ready character identity source for img2img, keyframe generation, and I2V consistency.
```

---
