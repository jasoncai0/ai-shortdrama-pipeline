## 0.5 PATCH：ENVIRONMENT LIGHT INTEGRATION & MATERIAL REALISM LOCK

### 环境光融合与真实材质质感锁

【补丁目的】

修复以下问题：

1. 人物、物体、服装像被抠图贴进场景。
2. 角色脸部、衣服、道具没有反映场景环境光。
3. 皮肤、布料、金属、玻璃、纸张、皮革等材质缺少真实受光差异。
4. 道具和人物没有接触阴影，空间关系不真实。
5. 世界视觉设定板、角色资产、地点资产、关键帧之间光色不统一。
6. AI 视频生成时出现“人物清楚但环境不融合”的廉价感。

从本补丁生效起，所有 CHARACTER / LOCATION / PROP / COSTUME / SHOT KEYFRAME / I2V prompt 都必须显式继承并执行环境光融合规则。

### 一、核心原则

AI 真人质感短剧不是把清晰人物放到背景上。

所有人物、服装、道具都必须像真实存在于同一个场景光线中。

必须体现：

- 环境光颜色
- 主光方向
- 反射光
- 边缘光
- 接触阴影
- 皮肤自然反光
- 衣料受光纹理
- 金属 / 玻璃 / 皮革 / 纸张材质高光
- 道具与手部 / 桌面 / 空间的真实接触关系

禁止：

- 人物像抠图贴上去
- 脸部棚拍光与环境光不一致
- 衣服没有环境色反射
- 道具没有接触阴影
- 金属没有高光
- 玻璃没有反射
- 皮革没有细微纹理
- 纸张像平面贴图
- 物体悬浮
- 背景真实但人物塑料感
- 过度磨皮
- 美颜滤镜感
- 广告棚拍感覆盖剧情环境光

### 二、WORLD_VISUAL_BIBLE 光照模块强化

WORLD_VISUAL_BIBLE 中的 LightingSystem 必须明确：

1. 主光方向
2. 环境光颜色
3. 阴影硬度
4. 反射光来源
5. 边缘光 / 轮廓光规则
6. 夜景 / 室内 / 雨天 / 豪宅 / 医院 / 办公室等场景的光色差异
7. 人物皮肤在该世界中的真实受光方式
8. 服装材质在该世界中的反光方式
9. 道具材质在该世界中的高光方式

LightingSystem 输出不得只写“cinematic lighting”。

必须写成可执行字段：

```text
LightingSystem:
- KeyLightDirection:
- AmbientLightColor:
- ShadowQuality:
- RimLightRule:
- BounceLightSource:
- SkinLightResponse:
- FabricLightResponse:
- MetalGlassReflection:
- ContactShadowRule:
```

### 三、CHARACTER @base 环境光规则

CHARACTER @base 仍然必须是白底 / 浅灰底全身基准图。

但必须保持真实人物材质：

- natural skin texture
- subtle skin pores
- realistic skin specular highlights
- realistic hair shine
- fabric weave visible
- shoes and accessories with material detail
- no plastic skin
- no beauty filter
- no wax figure look

@base 不需要强场景环境光，因为它是身份真相源。  
但它必须提供可被后续 keyframe 继承的真实皮肤、头发、服装、材质基础。

@base prompt 必须加入：

```text
realistic skin response to soft studio light, natural fabric texture, subtle hair highlights, realistic material detail, no plastic skin, no beauty filter, no waxy face
```

### 四、LOCATION / PROP / COSTUME 环境光继承

LOCATION 资产必须明确场景光照：

```text
Location Lighting:
- time of day:
- main light source:
- ambient color:
- shadow direction:
- reflective surfaces:
- practical lights:
```

PROP 资产必须明确材质受光：

```text
Prop Material Response:
- material:
- reflectivity:
- edge highlight:
- contact shadow:
- fingerprints / scratches / wear:
- interaction with hand or surface:
```

COSTUME 资产必须明确服装材质受光：

```text
Costume Material Response:
- fabric type:
- texture visibility:
- highlight behavior:
- wrinkle behavior:
- color shift under ambient light:
- how it reflects the world’s lighting system:
```

禁止生成孤立的电商图感道具 / 服装。  
所有 PROP / COSTUME 必须适合进入具体剧情场景并继承 WORLD_VISUAL_BIBLE 光色系统。

### 五、SHOT KEYFRAME 环境光融合规则

每个 SHOT KEYFRAME 必须包含 Environment Light Integration 字段：

```text
Environment Light Integration:
- SceneLightSource:
- AmbientColor:
- CharacterLightResponse:
- CostumeLightResponse:
- PropLightResponse:
- ContactShadow:
- Reflection / RimLight:
- MaterialRealismNotes:
```

每个关键帧 prompt 必须包含：

```text
characters, clothing, props, and background all share the same scene lighting;
realistic environmental light spill on skin and fabric;
accurate contact shadows;
subtle rim light matching the location;
realistic material reflections;
no cutout look;
no pasted-on subject;
no inconsistent lighting;
no plastic skin;
no beauty filter
```

### 六、不同材质受光规则

皮肤：

- 保留自然毛孔
- 保留轻微油光 / 皮肤高光
- 避免磨皮塑料感
- 冷光环境中皮肤应有冷色反射
- 暖光环境中皮肤应有暖色边缘光

头发：

- 必须有细微发丝高光
- 黑发不能变成一团死黑
- 逆光时必须出现边缘发光或轮廓分离

布料：

- 西装、衬衫、裙装、大衣必须有真实褶皱
- 不同材质高光不同
- 丝绸 / 皮革 / 羊毛 / 棉麻 / 西装料不能同一种反光

金属：

- 黑卡、钥匙、首饰、钢笔、车钥匙必须有边缘高光
- 反射应符合环境光色
- 不得像纯黑 / 纯灰平面

玻璃 / 手机：

- 手机屏幕、玻璃杯、窗户必须有反射和高光
- 但屏幕禁止出现可读 UI 字，除非剧情明确需要且后期处理

纸张 / 合同：

- 合同、股权书、信件必须有纸张厚度、折痕、接触阴影
- 不依赖 AI 生成可读文字
- 重要文字交给对白、OS / VO、字幕文本字段或角色反应

皮革：

- 包、鞋、座椅、皮带必须有细微纹理和方向性高光
- 不得像塑料

### 七、AI 视频一致性规则

I2V / Seedance prompt 必须继承 keyframe 的光照逻辑。

视频生成时必须避免：

- 人物亮度在片段中无故变化
- 脸部光源方向跳变
- 道具高光漂移
- 服装颜色随帧乱变
- 背景光色与人物光色分离
- 人物像贴在背景上滑动

每个 VIDEO_GENERATION_TASK 的 Batch Prompt EN 必须加入（作用于该 task 内全部碎镜头段落）：

```text
consistent scene lighting throughout all segments, character and props naturally integrated into the environment, matching ambient light on skin and clothing, stable contact shadows, realistic material highlights, no cutout effect, no inconsistent lighting
```

### 八、输出前真实质感自检

每次输出 CHARACTER / LOCATION / PROP / COSTUME / SHOT KEYFRAME / I2V 前必须检查：

【光照一致性】

- 人物是否吃到环境光？
- 服装是否反映场景光色？
- 道具是否有真实高光？
- 皮肤光泽是否自然？
- 背景和人物是否同一光源？
- 是否有接触阴影？
- 是否有合理边缘光？
- 是否避免抠图贴片感？

【材质真实】

- 皮肤是否没有塑料感？
- 头发是否有真实发丝高光？
- 布料是否有纹理和褶皱？
- 金属是否有边缘高光？
- 玻璃 / 手机是否有反射？
- 纸张是否有厚度和阴影？
- 皮革是否有细微纹理？

【AI 视频稳定】

- 光源方向是否能在 4–15s 内保持稳定？
- 角色、服装、道具的受光是否不会随帧乱变？
- 是否没有要求复杂光照突变？
- 是否没有让模型生成无法稳定保持的精确文字或 UI？

不通过则必须回到 prompt / keyframe / asset 阶段重做。

### 九、补丁口诀

人物不是贴上去的。  
衣服要吃光，皮肤要吃光，道具也要吃光。  
同一个场景，同一套光。  
有光就有影，有接触就有接触阴影。  
皮肤别塑料，布料别平，金属别死黑，纸张别像贴图。  
真实质感 = 环境光 + 材质反应 + 接触阴影 + 稳定光源。

---
