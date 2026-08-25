## 0.41 PATCH：WARDROBE TIMELINE & BODY PART CONTINUITY LOCK

### 多服装时间线与局部身体连续性锁

【补丁目的】

修复 AI 真人短剧中以下严重穿帮：

1. 角色拥有多套服装，但第一集错误穿上后期身份服。  
   例：女主后期才揭露顶尖医生身份，但 E01 就穿医生白大褂。
2. 剧情需要隐藏身份，但服装提前暴露身份。  
   例：隐藏千金身份时，第一集却穿高定礼服 / 名牌套装。
3. 角色当前处境与服装不符。  
   例：被婆家羞辱的养女，却穿得像医院主任 / 集团继承人。
4. 全身服装资产与局部镜头不一致。  
   例：婚纱是无袖，但第一人称手部镜头出现长袖。
5. 手部、肩膀、背影、腿部特写没有继承当前服装结构。
6. SHOT UNIT 只引用角色 @base，但没有引用正确服装全身图，导致模型随机套衣服。

从本补丁生效起，角色身份资产、服装资产、剧情阶段、镜头局部身体，必须全部由 `WARDROBE REGISTRY` 统一控制。

### 一、核心原则

角色不是只有一张固定衣服。

一个角色可以有多套服装，但每套服装必须绑定：

- 剧情阶段
- 身份显露程度
- 出场集数范围
- 场景使用条件
- 是否允许提前出现
- 是否属于身份剧透服
- 是否允许用于手部 / 肩膀 / 背影 / 第一人称视角
- 是否已有全身服装资产图

禁止模型自由决定角色穿什么。

禁止用后期服装资产污染前期剧情。

禁止一个角色只用“医生 / 总裁 / 新娘 / 千金”这种最终身份标签来生成所有镜头。

### 二、WARDROBE REGISTRY 服装资产总表

每个主要角色 / 重要角色必须建立 `WARDROBE REGISTRY`。

格式：

```text
WARDROBE REGISTRY

CHAR_xxx:
- character_name:
- identity_secret_level:
  public_identity:
  hidden_identity:
  revealed_identity:
  identity_reveal_episode:
- default_costume_policy:
  before_reveal:
  during_reveal:
  after_reveal:
- costume_assets:

  COSTUME_xxx_01:
  - costume_name:
  - costume_stage:
  - costume_function:
  - episode_allowed_range:
  - scene_allowed_context:
  - identity_visibility:
  - spoiler_risk:
  - reveal_permission:
  - full_body_asset_ref:
  - base_character_ref:
  - silhouette:
  - sleeve_structure:
  - shoulder_structure:
  - neckline:
  - arm_visibility:
  - hand_visibility:
  - lower_body_structure:
  - footwear:
  - jewelry_accessories:
  - fabric_type:
  - color_palette:
  - dirt_damage_state:
  - social_status_signal:
  - must_not_appear_before:
  - must_not_be_used_for:
  - first_person_body_rules:
  - partial_body_rules:
  - continuity_notes:
```

### 三、服装阶段定义

每套服装必须属于以下阶段之一：

```text
costume_stage:
- STAGE_0_PRE_STORY_MEMORY
- STAGE_1_DISGUISED / LOW_STATUS / HUMILIATED
- STAGE_2_PRESSURE / CONFLICT
- STAGE_3_REVEAL_PREPARATION
- STAGE_4_IDENTITY_REVEAL
- STAGE_5_POWER_AFTER_REVEAL
- STAGE_6_SPECIAL_EVENT
- STAGE_7_DAMAGE / BLOOD / TEAR / RAIN / DIRT
```

规则：

- E01 默认只能使用 `STAGE_1` 或当前剧情明确成立的 `STAGE_2`。
- 后期身份服必须标注为 `STAGE_4` 或 `STAGE_5`。
- 医生服、警服、军装、法官袍、婚纱、礼服、集团高管套装等强身份服，必须单独登记。
- 如果身份未揭露，强身份服不得提前出现在任何镜头、回忆以外也不得出现。
- 如果使用回忆镜头，必须标注 `memory / flashback / dream / imagined future`，不得污染当前现实时间线。

### 四、身份剧透服禁止提前出现

以下服装类型默认属于高剧透风险：

```text
HIGH SPOILER COSTUME TYPES:
- doctor coat / surgical scrubs / medical uniform
- police uniform
- military uniform
- judge robe / lawyer courtroom robe
- wedding dress
- luxury evening gown
- CEO suit with luxury status symbols
- royal / noble costume
- sect leader robe / immortal robe
- battle armor
- school uniform if hidden age / hidden school identity matters
- prisoner uniform
- funeral mourning outfit
```

规则：

如果该服装会提前暴露角色隐藏身份、职业、阶层、婚姻状态、权力地位，则必须设置：

```text
spoiler_risk: high
reveal_permission: only_after_episode_x
must_not_appear_before: E{编号}
```

禁止：

- 女主 E01 被当成普通养女羞辱，却穿医生白大褂。
- 隐藏千金 E01 穿高定礼服。
- 隐藏战神 E01 穿军装。
- 伪装穷人 E01 戴全套奢侈珠宝。
- 未到婚礼剧情时提前穿婚纱。
- 未进医院场景却穿手术服。

### 五、COSTUME ASSET 生成规则

凡是角色存在多套关键服装，必须生成独立 `COSTUME FULL BODY ASSET`。

不能只在文字里写“她换了一套衣服”。

每套关键服装必须有一张完整全身服装资产图：

```text
COSTUME FULL BODY ASSET

Asset ID:
Character:
Costume ID:
Costume Stage:
Episode Allowed Range:
Identity Visibility:
Full Body Prompt EN:
- full-body front view
- same character identity inherited from CHAR_xxx@base
- complete outfit visible from head to toe
- accurate sleeve structure
- accurate shoulder structure
- accurate neckline
- accurate arm visibility
- accurate footwear
- no background distraction
- no text
- no labels
- photorealistic AI character consistency reference
Negative Prompt:
- wrong sleeves
- extra sleeves
- random jacket
- wrong neckline
- hidden arms if sleeveless outfit
- identity-spoiler costume before allowed episode
```

规则：

- `CHARACTER @base` 锁脸、身材、基础身份。
- `COSTUME FULL BODY ASSET` 锁当前阶段服装。
- `SHOT KEYFRAME / I2V` 必须同时引用：
  - `CHAR_xxx@base`
  - `COSTUME_xxx_full_body`
  - `SCENE CONTINUITY LEDGER`

禁止只引用角色 @base 而不引用服装资产。

### 六、EPISODE COSTUME PLAN 单集服装计划

每一集进入分镜前，必须先输出 `EPISODE COSTUME PLAN`。

格式：

```text
EPISODE COSTUME PLAN

Episode ID:
Episode Time Range:
Identity Reveal Status:
Current Reality Timeline:

CHAR_xxx:
- current_public_identity:
- hidden_identity_status:
- allowed_costume_ids:
- forbidden_costume_ids:
- selected_default_costume_id:
- scene_costume_map:
  SCENE_01:
  - costume_id:
  - reason:
  - continuity_scope:
  - allowed_partial_body:
  - forbidden_partial_body:
  SCENE_02:
  - costume_id:
  - reason:
  - continuity_scope:
  - allowed_partial_body:
  - forbidden_partial_body:
```

规则：

- 每一集必须明确“本集角色能穿什么，不能穿什么”。
- 如果角色身份未揭露，后期身份服必须进入 `forbidden_costume_ids`。
- 如果一集内换装，必须写出可见因果：
  - 回家换衣
  - 医院值班
  - 婚礼入场
  - 雨中狼狈
  - 被泼酒
  - 公开亮身份
- 不允许无因果换装。
- 不允许因为后面剧情身份强，就提前调用后期服装。

### 七、SCENE CONTINUITY LEDGER 服装字段升级

原有：

```text
CHAR_xxx:
- Costume:
```

升级为：

```text
CHAR_xxx:
- Costume ID:
- Costume Full Body Asset Ref:
- Costume Stage:
- Costume Legality:
- Episode Allowed Range:
- Identity Reveal Status:
- Sleeve Structure:
- Shoulder Structure:
- Neckline:
- Arm Visibility:
- Hand / Wrist Visibility:
- Jewelry / Accessories:
- Footwear:
- Damage / Dirt / Tear State:
- Partial Body Continuity:
- Must Not Change:
```

其中：

```text
Costume Legality:
- legal_current_timeline
- illegal_future_identity_spoiler
- illegal_wrong_scene_context
- illegal_unregistered_costume
```

规则：

如果 `Costume Legality` 不是 `legal_current_timeline`，不得进入 SHOT UNIT。

### 八、SHOT UNIT 服装引用字段升级

每个 `SHOT UNIT` 必须新增：

```text
Wardrobe Continuity:
- Character:
- Costume ID:
- Costume Full Body Asset Ref:
- Costume Stage:
- Episode Costume Plan Ref:
- Scene Continuity Ledger Ref:
- Current Identity Reveal Status:
- Is Costume Legal In This Episode: yes / no
- Is Costume Legal In This Scene: yes / no
- Spoiler Risk:
- Sleeve Structure:
- Shoulder Structure:
- Neckline:
- Arm Visibility:
- Wrist Visibility:
- Partial Body Allowed:
- Partial Body Forbidden:
- First Person Body Logic:
- Must Match Full Body Costume Asset: yes
```

规则：

- 如果 `Is Costume Legal In This Episode = no`，该 SHOT UNIT 必须重写。
- 如果 `Is Costume Legal In This Scene = no`，该 SHOT UNIT 必须重写。
- 如果没有 `Costume Full Body Asset Ref`，不得进入 keyframe / I2V。
- 如果当前镜头含手、肩、背、腿、脚，必须引用服装局部结构字段。

### 九、局部身体连续性规则

凡是出现以下镜头，必须检查当前服装结构：

```text
PARTIAL BODY SHOTS:
- first person POV
- hand insert
- wrist close-up
- shoulder close-up
- back view
- side profile
- over-the-shoulder
- waist shot
- walking legs shot
- foot / shoe close-up
- mirror reflection
- phone-holding shot
- prop handover shot
```

必须继承：

```text
Partial Body Continuity:
- sleeve_structure
- wrist_visibility
- arm_visibility
- shoulder_structure
- neckline
- jewelry_accessories
- hand_prop_state
- fabric_color
- fabric_texture
```

禁止：

- 无袖婚纱生成长袖手臂。
- 短袖 T 恤生成西装袖口。
- 穿礼服时手腕出现白大褂袖口。
- 穿医生服时手部特写变成裸肩礼服。
- 穿长袖外套时肩部特写突然露肩。
- 穿高领衣服时近景出现低胸领口。
- 穿运动鞋的角色脚部特写变成高跟鞋。
- 角色没戴戒指，手部特写突然出现戒指。
- 角色戴婚戒，手部特写突然消失。

### 十、无袖 / 短袖 / 长袖强制逻辑

服装必须明确 `sleeve_structure`：

```text
sleeve_structure:
- sleeveless
- strapless
- spaghetti_strap
- short_sleeve
- half_sleeve
- long_sleeve
- suit_jacket_sleeve
- coat_sleeve
- medical_coat_sleeve
- rolled_up_sleeve
- torn_sleeve
```

对应生成规则：

#### sleeveless / strapless / spaghetti_strap

必须写入：

```text
bare arms visible, no sleeves, no fabric covering upper arms, no cuffs, no jacket sleeves, shoulder and arm skin visible according to the costume design
```

负向必须写入：

```text
no sleeves, no long sleeves, no jacket sleeve, no shirt cuff, no medical coat sleeve, no fabric on forearms unless explicitly stated, no random sleeve
```

#### long_sleeve / suit_jacket_sleeve / medical_coat_sleeve

必须写入：

```text
sleeves visible and consistent with the full body costume, correct cuffs, fabric continues from shoulder to wrist
```

负向必须写入：

```text
no bare shoulders, no sleeveless arms, no random exposed upper arm, no wrong neckline
```

### 十一、第一人称 POV 身体逻辑锁

凡是第一人称视角，必须新增：

```text
First Person Body Logic:
- POV Belongs To:
- Visible Body Part:
- Costume ID:
- Sleeve Structure:
- Wrist / Hand Visibility:
- Jewelry / Accessories:
- Prop Held:
- Must Match Full Body Costume Asset:
- Forbidden Body Elements:
```

规则：

- 第一人称镜头必须说明 POV 属于哪个角色。
- 可见手臂必须继承该角色当前服装。
- 如果角色当前穿无袖婚纱，第一人称手臂不能出现袖子。
- 如果角色当前穿医生服，第一人称手臂必须有医生服袖口或内搭袖口。
- 如果 POV 不是主角，必须标注 `POV Belongs To`，防止模型套错主角衣服。
- 第一人称镜头不得自动生成未登记的衣袖、首饰、手表、戒指。

### 十二、身份揭露服装门禁

在进入每集分镜前，必须检查：

```text
IDENTITY REVEAL COSTUME GATE

CHAR_xxx:
- Hidden Identity:
- Reveal Episode:
- Current Episode:
- Current Reveal Status:
- Costume Requested:
- Costume Spoiler Risk:
- Is Costume Allowed Now:
- If Not Allowed, Replace With:
```

规则：

如果 `Current Episode < Reveal Episode` 且服装 `spoiler_risk = high`：

```text
Is Costume Allowed Now: no
```

必须替换为当前阶段服装。

示例：

```text
CHAR_001 女主
Hidden Identity: 顶尖外科医生
Reveal Episode: E03
Current Episode: E01
Costume Requested: COSTUME_DOCTOR_COAT
Costume Spoiler Risk: high
Is Costume Allowed Now: no
If Not Allowed, Replace With: COSTUME_LOW_STATUS_PLAIN_DRESS_E01
```

### 十三、Prompt 编译规则

所有 keyframe / I2V prompt 必须写入：

```text
costume identity must follow the referenced costume full body asset exactly, correct episode-stage wardrobe, no future identity-spoiler outfit, no unregistered outfit, no random costume change, sleeve structure must match the costume asset, partial body shots must inherit the same sleeve, neckline, shoulder and wrist design, no wrong sleeves, no random cuffs, no mismatched arms
```

如果是无袖服装，必须追加：

```text
the character is wearing a sleeveless outfit, bare arms visible, no sleeves, no cuffs, no jacket sleeves, no shirt sleeves, no fabric covering the forearms unless explicitly described
```

如果是长袖服装，必须追加：

```text
the character is wearing a long-sleeve outfit, sleeves consistently visible from shoulder to wrist, correct cuff shape, no bare shoulders, no sleeveless arms
```

### 十四、服装错误自动降级策略

如果模型容易生成错误局部服装，必须自动降级镜头：

高风险镜头：

```text
- first person POV hand close-up
- bare arm + prop interaction
- sleeve-dependent wedding dress shot
- hand insert with jewelry
- close-up of shoulder / neckline
- mirror reflection showing partial body
```

降级方式：

```text
Downgrade Strategy:
- 改成中近景，显示完整上半身，减少模型乱补袖子。
- 用正面半身继承 full body costume，而不是极近手臂特写。
- 手部只露出手掌和道具，不露出袖口边界。
- 使用道具插入镜替代完整手臂运动。
- 先生成正确 keyframe，再 I2V，不直接让视频模型想象服装局部。
```

### 十五、输出前服装自检

每次输出 `EPISODE SCRIPT / SCENE BREAKDOWN / SHOT UNIT / KEYFRAME / I2V` 前必须检查：

【剧情合法性】

- 当前服装是否属于本集允许阶段？
- 是否提前暴露隐藏身份？
- 是否使用了后期身份服？
- 是否有明确换装因果？
- 是否与角色当前社会处境一致？

【资产引用】

- 是否引用了 `CHAR_xxx@base`？
- 是否引用了正确 `COSTUME_xxx_full_body_asset`？
- 是否引用了 `EPISODE COSTUME PLAN`？
- 是否引用了 `SCENE CONTINUITY LEDGER`？
- 是否没有使用未登记服装？

【局部身体】

- 手部 / 肩部 / 背影 / 第一人称是否继承当前服装？
- 袖子结构是否正确？
- 无袖服装是否没有生成袖子？
- 长袖服装是否没有突然裸肩？
- 鞋、首饰、戒指、手表是否连续？
- POV 镜头是否明确属于哪个角色？

【Prompt】

- 是否写明 no future identity-spoiler outfit？
- 是否写明 sleeve structure must match？
- 是否写明 no wrong sleeves / no random cuffs？
- 是否根据 sleeveless / long_sleeve 写入对应正向和负向词？

如果任一项不通过，必须回到 `WARDROBE REGISTRY / EPISODE COSTUME PLAN / SHOT UNIT` 修正，不得进入视频生成。

### 十六、补丁口诀

角色可以多套衣服，但每套衣服必须有剧情时间线。  
@base 锁人，COSTUME 锁衣服，SHOT UNIT 必须同时引用。  
隐藏身份没揭露，身份服不能提前穿。  
医生服、婚纱、军装、礼服，都是高剧透服。  
第一集穿什么，由当前处境决定，不由最终身份决定。  
无袖就是无袖，手臂不能长袖。  
长袖就是长袖，肩膀不能裸。  
第一人称也要继承服装，不准模型乱补袖子。  
每个局部身体镜头，都必须回到全身服装资产。  
衣服不合法，镜头不能生成。

---
