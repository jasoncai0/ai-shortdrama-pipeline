## 0.42 PATCH：CONFIRMED ASSET REGISTRY & CROSS-EPISODE MEMORY LOCK

### 已确认资产库与跨集记忆锁

【补丁目的】

修复以下严重问题：

1. E01 已确认角色图、世界视觉圣经、地点图、道具图、服装图，但 E02 又重新生成资产。
2. 系统反复询问用户“请确认角色资产 ID / 图片 URL / reference ID”。
3. 后续集忘记已确认的角色脸、服装、场景、道具、声音。
4. 第二集关键帧没有继承第一集确认的资产，导致人物不一致、地点不一致、道具不一致。
5. 已确认资产没有成为唯一真相源，导致 AI 自己重新想象角色和世界。
6. 分镜阶段没有强制读取资产库，而是临时编写 prompt。

从本补丁生效起，所有已被用户确认或系统锁定的资产，必须写入 `PROJECT ASSET REGISTRY`，并在后续集自动读取。

### 一、核心原则

已确认资产 = 生产真相源。

任何后续集不得重新发明：

- 世界视觉圣经
- 角色脸
- 角色 @base
- 角色 @sheet
- 角色服装图
- 地点图
- 道具图
- voice_id
- 关键关系设定
- 已确认的视觉 DNA

只要资产已经存在，系统必须默认读取，不得再次询问用户。

除非用户明确说：

- 重新设计
- 替换这个角色
- 换一套服装
- 重做场景
- 这个图不要了
- 用新图覆盖旧图

否则必须沿用已确认资产。

### 二、PROJECT ASSET REGISTRY 项目资产总表

每个项目必须建立唯一 `PROJECT ASSET REGISTRY`。

格式：

```text
PROJECT ASSET REGISTRY

Project ID:
Series Title:
Current Episode:
Last Confirmed Episode:
Registry Version:

WORLD:
- WORLD_VISUAL_BIBLE_ID:
- confirmed_status:
- image_url:
- visual_dna_summary:
- lighting_system:
- color_palette:
- material_rules:
- camera_language:
- forbidden_visual_drift:

CHARACTERS:
CHAR_xxx:
- character_name:
- confirmed_status:
- character_role:
- public_identity:
- hidden_identity:
- identity_reveal_episode:
- base_asset_id:
- base_image_url:
- sheet_asset_id:
- sheet_image_url:
- face_identity_summary:
- body_type_summary:
- hair_makeup_summary:
- default_voice_id:
- wardrobe_registry_ref:
- allowed_costume_ids:
- forbidden_costume_ids_by_episode:
- relationship_memory:
- must_not_change:

WARDROBE:
COSTUME_xxx:
- character_id:
- costume_name:
- costume_stage:
- confirmed_status:
- full_body_asset_id:
- full_body_image_url:
- episode_allowed_range:
- identity_visibility:
- spoiler_risk:
- sleeve_structure:
- shoulder_structure:
- neckline:
- arm_visibility:
- footwear:
- jewelry_accessories:
- must_not_appear_before:
- must_not_change:

LOCATIONS:
LOC_xxx:
- location_name:
- confirmed_status:
- image_url:
- inherited_world_bible:
- lighting_state:
- spatial_layout:
- social_status_signal:
- allowed_episode_range:
- must_not_change:

PROPS:
PROP_xxx:
- prop_name:
- confirmed_status:
- image_url:
- owner_character:
- narrative_function:
- material:
- scale:
- allowed_episode_range:
- continuity_rules:
- must_not_change:

VOICE:
VOICE_xxx:
- character_id:
- confirmed_status:
- voice_id:
- vocal_texture:
- pitch:
- speed:
- emotional_baseline:
- forbidden_voice_traits:
```

### 三、确认状态定义

每个资产必须有 `confirmed_status`：

```text
confirmed_status:
- draft
- generated_pending_user_review
- user_confirmed
- system_locked
- replaced
- deprecated
```

规则：

- `user_confirmed` 和 `system_locked` 的资产，后续必须自动读取。
- `replaced` 和 `deprecated` 的资产不得再用于生成。
- `draft` 不得进入最终 keyframe / I2V。
- 如果用户已经在上一集确认图可用，必须自动升级为 `user_confirmed`。
- 不允许在 E02 重新询问 E01 已确认资产 ID。

### 四、自动读取规则

每次进入新一集，系统必须先执行：

```text
LOAD CONFIRMED ASSETS BEFORE EPISODE GENERATION

Input:
- Project ID
- Current Episode ID

Steps:
1. 读取 PROJECT ASSET REGISTRY。
2. 读取所有 confirmed_status = user_confirmed / system_locked 的资产。
3. 读取 WORLD_VISUAL_BIBLE。
4. 读取 CHARACTERS 中所有已确认角色 @base / @sheet。
5. 读取 WARDROBE 中本集允许使用的 costume full body image_url。
6. 读取 LOCATIONS 中本集会用到的地点 image_url。
7. 读取 PROPS 中本集会用到的道具 image_url。
8. 读取 VOICE REGISTRY。
9. 读取上一集 RUNTIME STATE SNAPSHOT。
10. 只在缺失资产时生成 Missing Asset List。
```

禁止：

- 已确认资产存在时，继续问用户“请提供角色 ID”。
- 已确认图片 URL 存在时，继续问用户“请确认图片链接”。
- 已确认角色存在时，重新做人设。
- 已确认世界图存在时，重新生成视觉圣经。
- 已确认地点存在时，重新生成场景图。
- 已确认道具存在时，重新生成道具图。
- 已确认服装存在时，重新设计服装。

### 五、缺失资产才允许询问

只有以下情况允许询问用户或生成新资产：

```text
MISSING ASSET CONDITIONS:
- PROJECT ASSET REGISTRY 中没有该资产。
- 该资产 confirmed_status 不是 user_confirmed / system_locked。
- 当前剧情需要一个从未出现的新角色。
- 当前剧情需要一个从未出现的新地点。
- 当前剧情需要一个从未出现的新道具。
- 当前剧情发生合法换装，但对应 COSTUME 资产不存在。
- 用户明确要求替换资产。
```

如果不是上述情况，不得询问。

必须输出：

```text
MISSING ASSET LIST

Current Episode:
Required Missing Assets:
1.
- asset_type:
- reason_needed:
- can_continue_without_it: yes / no
- suggested_action:
```

### 六、跨集启动协议

每次用户说：

- 做第二集
- 继续下一集
- 进入 E02
- 基于第一集继续
- 上一集 OK 了

系统必须自动进入：

```text
CROSS-EPISODE STARTUP PROTOCOL

1. Load PROJECT ASSET REGISTRY.
2. Load previous RUNTIME STATE SNAPSHOT.
3. Load confirmed WORLD / CHARACTER / COSTUME / LOCATION / PROP / VOICE assets.
4. Check whether current episode requires new assets.
5. If no missing critical assets, directly continue to EPISODE RELATION MAP / EPISODE SCRIPT DRAFT.
6. Do not ask user to reconfirm existing asset IDs.
7. Do not regenerate confirmed assets.
```

### 七、第二集生成前必须继承上一集状态

每一集结束后必须生成：

```text
RUNTIME STATE SNAPSHOT

Episode ID:
Confirmed Asset Registry Version:
Story State:
- unresolved_conflicts:
- revealed_information:
- hidden_information:
- relationship_changes:
- power_shift:
- cliffhanger:
Character State:
CHAR_xxx:
- current_identity_status:
- current_emotional_state:
- current_power_position:
- current_relationships:
- current_costume_id:
- current_location:
- injuries / dirt / tears / damage:
- known_information:
- unknown_information:
World State:
- current_time:
- current_social_pressure:
- public_reputation:
- faction_status:
Prop State:
PROP_xxx:
- holder:
- location:
- visible / hidden:
- revealed / unrevealed:
Next Episode Entry:
- required_opening_continuity:
- must_follow_from_cliffhanger:
- forbidden_reset:
```

E02 必须从 E01 的 `Next Episode Entry` 继续，不得重启。

### 八、关键帧资产引用强制规则

每个 `SHOT KEYFRAME` 和 `I2V VIDEO` 必须引用：

```text
Asset Refs:
- WORLD_VISUAL_BIBLE:
  - asset_id:
  - image_url:
- CHARACTER:
  - character_id:
  - base_asset_id:
  - base_image_url:
- COSTUME:
  - costume_id:
  - full_body_asset_id:
  - full_body_image_url:
- LOCATION:
  - location_id:
  - image_url:
- PROP:
  - prop_id:
  - image_url:
- VOICE:
  - voice_id:
- RUNTIME_STATE:
  - previous_episode_snapshot_id:
- PROJECT_ASSET_REGISTRY:
  - registry_version:
```

规则：

- 如果 `base_image_url` 缺失，不得进入人物 keyframe。
- 如果 `costume_full_body_image_url` 缺失，不得进入含角色全身 / 半身 / 局部身体镜头。
- 如果 `location_image_url` 缺失，不得进入该地点 keyframe。
- 如果 `prop_image_url` 缺失，不得生成该道具特写。
- 如果 `registry_version` 缺失，不得进入跨集生成。

### 九、禁止重新发明资产

所有 prompt 编译前必须执行：

```text
NO RE-INVENTION CHECK

- Is this character already confirmed?
- Is this costume already confirmed?
- Is this location already confirmed?
- Is this prop already confirmed?
- Is this world visual bible already confirmed?
- Is this voice_id already confirmed?

If yes:
Use existing asset_id and image_url.
Do not redesign.
Do not reinterpret.
Do not generate a new version.
Do not ask user again.
```

禁止表达：

- “请重新确认角色 ID。”
- “请重新上传角色图。”
- “我将重新设计角色。”
- “这里可以重新生成一个医生形象。”
- “第二集需要重新生成世界图。”
- “为了本集效果，我重新做一个地点图。”

除非用户明确要求重做。

### 十、资产缺失时的默认处理

如果系统无法读取已确认资产，但剧情上下文表明资产已经确认过，必须优先输出：

```text
ASSET MEMORY ERROR

我应该读取上一集已确认的资产，但当前上下文缺失以下内容：
- 
请不要重新设计资产。
请恢复 PROJECT ASSET REGISTRY 或上一集 Confirmed Asset Snapshot。
```

禁止在记忆缺失时擅自重新生成。

也就是说：  
**宁可报资产记忆缺失，也不能自己乱做新角色。**

### 十一、EPISODE 结束时必须输出确认快照

每集结束后必须输出：

```text
CONFIRMED ASSET SNAPSHOT FOR NEXT EPISODE

Registry Version:
Confirmed WORLD:
- asset_id:
- image_url:

Confirmed CHARACTERS:
- character_id:
- base_asset_id:
- base_image_url:
- sheet_asset_id:
- sheet_image_url:
- current_costume_id:

Confirmed COSTUMES:
- costume_id:
- full_body_asset_id:
- full_body_image_url:
- episode_allowed_range:

Confirmed LOCATIONS:
- location_id:
- image_url:

Confirmed PROPS:
- prop_id:
- image_url:

Confirmed VOICES:
- character_id:
- voice_id:

Runtime State To Carry Forward:
- 
```

这个快照就是下一集默认读取的最小记忆包。

### 十二、用户确认资产后的自动写入规则

当用户说以下任意表达：

- OK
- 可以
- 这版通过
- 用这个
- 确认
- 锁定
- 第一集 OK
- 这个角色没问题
- 场景图通过
- 道具图通过

系统必须自动把对应资产写入：

```text
PROJECT ASSET REGISTRY
confirmed_status: user_confirmed
```

不得再等待用户手动填写资产 ID。

如果图片 URL / 文件 ID / 引用 ID 已在当前上下文中存在，系统必须自动读取并写入。

### 十三、跨集 prompt 编译规则

E02 及之后所有 prompt 必须加入：

```text
use the confirmed project asset registry, inherit the previously confirmed character base image, confirmed costume full body image, confirmed world visual bible, confirmed location image, confirmed prop image, and confirmed runtime state; do not redesign the character, do not change face identity, do not change hairstyle unless specified, do not change costume unless the episode costume plan allows it, do not invent a new location design, do not invent new props, maintain cross-episode visual continuity
```

人物 prompt 必须加入：

```text
same character identity as confirmed CHAR_xxx@base image_url, same face, same body type, same hair identity, same age impression, no new face, no recasting, no alternate version
```

地点 prompt 必须加入：

```text
same confirmed location design as LOC_xxx image_url, same spatial layout, same lighting logic, same material language, no redesigned room, no new architecture
```

道具 prompt 必须加入：

```text
same confirmed prop as PROP_xxx image_url, same scale, same material, same color, same wear marks, no redesigned prop
```

### 十四、输出前跨集连续性自检

每次生成 E02/E03/E04 前必须检查：

【资产读取】

- 是否读取了 `PROJECT ASSET REGISTRY`？
- 是否读取了上一集 `CONFIRMED ASSET SNAPSHOT`？
- 是否读取了上一集 `RUNTIME STATE SNAPSHOT`？
- 是否自动继承已确认图片 URL？
- 是否没有重复询问已确认资产 ID？

【角色一致性】

- 是否使用同一个 `CHAR_xxx@base image_url`？
- 是否没有重新设计角色脸？
- 是否没有改变发型、年龄感、体型？
- 是否没有把配角脸混成主角？

【服装一致性】

- 是否使用本集合法 `COSTUME_xxx full_body image_url`？
- 是否没有提前使用后期身份服？
- 是否没有未登记换装？

【世界 / 地点 / 道具一致性】

- 是否使用已确认 `WORLD_VISUAL_BIBLE`？
- 是否使用已确认 `LOC_xxx image_url`？
- 是否没有重做场景设计？
- 是否使用已确认 `PROP_xxx image_url`？
- 是否没有随机生成新道具版本？

【剧情连续性】

- E02 是否承接 E01 cliffhanger？
- 是否没有重置人物关系？
- 是否没有忘记已揭露信息？
- 是否没有让角色不知道上一集已经发生的事？

如不通过，必须停止生成，并输出 `ASSET MEMORY ERROR` 或回到 `PROJECT ASSET REGISTRY` 修复。

### 十五、补丁口诀

确认过的资产，就是生产真相。  
下一集默认读取，不要再问 ID。  
有 URL 就自动用，有快照就自动继承。  
角色不要重做，世界不要重做，场景不要重做，道具不要重做。  
E02 不是新项目，是 E01 的延续。  
忘记资产时，宁可报错，也不能乱编。  
每集结束必须输出 Confirmed Asset Snapshot。  
每集开始必须先 Load Asset Registry。  
资产库不读，不能生成关键帧。

---
