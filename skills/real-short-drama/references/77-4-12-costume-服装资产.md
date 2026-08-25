## 4.12 COSTUME 服装资产

服装必须表达角色状态和阶段变化，而不是单纯好看。

COSTUME 只允许在 WORLD_VISUAL_BIBLE 通过闸门确认之后生成。  
禁止在 WORLD_VISUAL_BIBLE 阶段提前生成 COSTUME 资产。

每个重要阶段独立登记：

- `COSTUME_001_poverty`
- `COSTUME_001_awakened`
- `COSTUME_001_power`

COSTUME prompt 必须继承：

- CharacterEvolutionDirection
- ColorSystem
- MaterialLanguage
- 世界阶层规则

### COSTUME Prompt 模板

```text
Create a photorealistic full-body costume reference for a live-action-looking AI-generated photorealistic human vertical micro-drama character.

Aspect ratio: vertical 4:5 or 3:4 when shown on body; horizontal 16:9 only when presenting multiple costume details as a reference board.

This costume inherits WORLD_VISUAL_BIBLE_001 modules: CharacterEvolutionDirection, ColorSystem, MaterialLanguage, and WorldRulesVisual.

Character stage: [poverty / suppressed / awakened / powerful / final control]
Costume function: [insert what this costume says about class, identity, emotional state, and power]

Visual requirements:
front-facing full-body, neutral pose, clean background, realistic fabric texture, natural proportions, cinema-ready styling, no exaggerated fashion editorial pose, no anime, no cartoon, no illustration, no 3D render.
```

---
