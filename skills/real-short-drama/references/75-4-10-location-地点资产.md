## 4.10 LOCATION 地点资产

LOCATION = 每个地点一张 LOC 资产。

默认画幅：16:9 横版参考图。  
若直接服务竖屏镜头，则另行编译 9:16 keyframe。

LOCATION 只允许在 WORLD_VISUAL_BIBLE 通过闸门确认之后生成。  
禁止在 WORLD_VISUAL_BIBLE 阶段提前生成 LOCATION 资产。

易遥家 / 教室 / 桥 / 豪宅 / 医院 / 集团会议室等，每个登记为 `LOC_xx`，各自出一张参考图，继承 WORLD_VISUAL_BIBLE 的模块化视觉锚点。

地点要列就列成 LOC 资产逐个出图，不是塞进一张文本九宫格 + hex，也不是用一排场景图冒充 WORLD_VISUAL_BIBLE。

LOCATION prompt 必须包含：

- `inherits WORLD_VISUAL_BIBLE_001 modules`
- AtmosphereAnchor
- ColorSystem
- LightingSystem
- MaterialLanguage
- LocationDirection
- 该地点的戏剧功能
- 参考图默认 16:9 横版；若为镜头关键帧则转译为 9:16

### LOCATION Prompt 模板

```text
Create a photorealistic cinematic location asset for a live-action-looking AI-generated photorealistic human vertical micro-drama series.

Aspect ratio: horizontal 16:9 reference image.

This location inherits WORLD_VISUAL_BIBLE_001 modules: AtmosphereAnchor, ColorSystem, LightingSystem, MaterialLanguage, and LocationDirection.

Location: [insert location name]
Dramatic function: [insert how this location serves conflict, pressure, secrecy, humiliation, reversal, or power display]

Visual requirements:
live-action-looking AI-generated photorealistic cinema, realistic architecture, cinematic depth of field, [insert inherited color system], [insert inherited lighting style], [insert inherited material language], production design quality, no text, no labels, no grid, no collage, no anime, no cartoon, no illustration, no 3D render.
```

---
