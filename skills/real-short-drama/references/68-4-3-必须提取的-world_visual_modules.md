## 4.3 必须提取的 WORLD_VISUAL_MODULES

WORLD_VISUAL_BIBLE 锁定后，必须同步提取以下 WORLD_VISUAL_MODULES，供下游编译：

1. AtmosphereAnchor 氛围锚点
2. WorldRulesVisual 世界规则视觉
3. CharacterEvolutionDirection 角色成长方向
4. ColorSystem 色彩系统
5. LightingSystem 光影系统
6. MaterialLanguage 材质语言
7. LocationDirection 场景方向
8. PropSymbolSystem 道具符号系统
9. ActionLanguage 动作语言
10. EmotionalCurve 情绪曲线

### WORLD_VISUAL_MODULES 固定输出格式

WORLD_VISUAL_BIBLE 生成后，必须同时输出以下结构化字段：

```text
WORLD_VISUAL_MODULES

- AtmosphereAnchor:
- WorldRulesVisual:
- CharacterEvolutionDirection:
- ColorSystem:
- LightingSystem:
  - KeyLightDirection:
  - AmbientLightColor:
  - ShadowQuality:
  - RimLightRule:
  - BounceLightSource:
  - SkinLightResponse:
  - FabricLightResponse:
  - MetalGlassReflection:
  - ContactShadowRule:
- MaterialLanguage:
- LocationDirection:
- PropSymbolSystem:
- ActionLanguage:
- EmotionalCurve:
```

这组字段才是后续 prompt 编译的直接输入。

### 继承方式

所有下游资产必须写明继承：

```text
inherits WORLD_VISUAL_BIBLE_001 modules: AtmosphereAnchor, ColorSystem, LightingSystem, MaterialLanguage, ActionLanguage
```

不得写成：

```text
inherits a single world background image
```

### 防事故规则

可以用 WORLD_VISUAL_BIBLE 做视觉理解和资产编译，但禁止把整张 WORLD_VISUAL_BIBLE 直接喂给视频模型。

原因：整张信息板包含网格、文字、标签、曲线、缩略图，直接喂给视频模型会导致模型复制版式，生成“会动的设定板”而不是剧情镜头。

正确做法：

- 角色生成：读取 CharacterEvolutionDirection + ColorSystem + LightingSystem + MaterialLanguage。
- 地点生成：读取 AtmosphereAnchor + LocationDirection + ColorSystem + LightingSystem + MaterialLanguage。
- 道具生成：读取 PropSymbolSystem + ColorSystem + MaterialLanguage。
- 分镜关键帧：读取 AtmosphereAnchor + LightingSystem + ActionLanguage + 当前场景 / 角色 / 道具资产。
- 视频生成：使用具体关键帧 + 具体角色 @base / 地点 / 道具资产，不使用整张 WORLD_VISUAL_BIBLE。

禁止事项：

- 禁止把 WORLD_VISUAL_BIBLE 当普通背景图。
- 禁止生成一个“纯净世界背景图”替代 WORLD_VISUAL_BIBLE。
- 禁止只输出一张城市夜景就宣称完成世界视觉设定。
- 禁止把整张 WORLD_VISUAL_BIBLE 喂给 I2V。
- 禁止让视频模型复制信息板版式。
- 禁止让角色、地点、道具脱离 WORLD_VISUAL_BIBLE 另起视觉体系。
- 禁止任何下游 image/video prompt 引用整张视觉板图像本身；只能引用被提取出的模块字段。

---
