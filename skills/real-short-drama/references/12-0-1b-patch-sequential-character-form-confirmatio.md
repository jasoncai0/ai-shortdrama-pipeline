## 0.1B PATCH：SEQUENTIAL CHARACTER FORM CONFIRMATION LOCK

### 角色多形态串行确认锁

【补丁目的】

修复以下问题：

1. 一个角色存在多个形态 / 阶段 / 身份版本时，系统一次性生成全部形态，导致批量浪费。
2. 基础脸未确认前，就生成医生形态、婚纱形态、觉醒形态、战损形态。
3. 第一张角色图不满意，后续所有派生形态全部作废。
4. 多形态之间脸、年龄感、骨相、发型基础、身材比例不一致。
5. AI 把不同服装 / 不同阶段误生成为不同角色。
6. 用户无法逐步控制角色最终长相。

从本补丁生效起，角色多形态生成必须采用：

```text
ONE CHARACTER → ONE WHITE-BACKGROUND THREE-VIEW FULL-BODY BASE → ONE CONFIRMED BASE IDENTITY → ONE FORM AT A TIME
```

禁止同一角色多个形态并行生成。

### 一、核心原则

角色多形态不是并行资产。

角色多形态必须串行生成：

```text
CHARACTER IDENTITY BASE
→ USER CONFIRM
→ FORM 01
→ USER CONFIRM
→ FORM 02
→ USER CONFIRM
→ FORM 03
```

不能：

```text
基础形态 + 医生形态 + 婚纱形态 + 总裁形态 + 战损形态
一次性全部生成
```

因为：

- 基础脸未锁定，所有派生形态都不可靠；
- 用户不满意第一张，后面全浪费；
- 多形态会互相污染角色身份；
- AI 容易把“阶段变化”理解成“换演员”。

### 二、角色身份底图优先锁

每个角色必须先生成并确认唯一 `CHARACTER IDENTITY BASE`。

格式：

```text
CHARACTER IDENTITY BASE

Character ID:
Character Name:
Narrative Role:
Base Identity Purpose:
- lock face
- lock age impression
- lock bone structure
- lock body proportion
- lock hair identity
- lock skin realism
- lock default emotional baseline

Base Asset:
- base_asset_id:
- base_image_url:
- confirmed_status:
```

规则：

- `CHARACTER IDENTITY BASE` 只负责确认“这个人长什么样”。
- 不负责一次性展示所有服装。
- 不负责展示所有身份形态。
- 不负责剧透后期身份。
- 未确认 base，不得生成任何派生形态。

### 三、BASE CONFIRMATION GATE

新增硬门禁：

```text
BASE CONFIRMATION GATE

CHAR_xxx:
- base_asset_id:
- base_image_url:
- is_base_face_confirmed: yes / no
- confirmed_by_user: yes / no
- can_generate_next_form: yes / no
```

规则：

如果：

```text
is_base_face_confirmed: no
```

则：

```text
can_generate_next_form: no
```

禁止：

- 继续生成该角色其他形态；
- 继续生成该角色多套服装；
- 继续生成该角色 @sheet；
- 继续生成该角色关键帧；
- 继续生成该角色 I2V。

### 四、多形态生成顺序

如果一个角色有多个形态，必须按以下顺序：

```text
CHARACTER FORM PIPELINE

Step 1:
Generate CHAR_xxx@base_identity
Purpose: 锁脸 / 骨相 / 年龄感 / 身材比例

Step 2:
User confirms base identity

Step 3:
Generate FORM_01_CURRENT_EPISODE_DEFAULT
Purpose: 当前剧情合法形态

Step 4:
User confirms FORM_01

Step 5:
Generate FORM_02 only if:
- 剧情当前需要
- 用户要求继续
- FORM_01 已确认
- FORM_02 不会提前剧透

Step 6:
Repeat one form at a time
```

### 五、禁止一次性多形态输出

禁止以下输出方式：

```text
一次生成：
- 贫困形态
- 医生形态
- 婚纱形态
- 高管形态
- 战损形态
- 黑化形态
```

必须改成：

```text
先生成：
- 基础身份底图

用户确认后，再生成：
- 当前 E01 合法服装形态

用户确认后，再根据剧情需要继续生成：
- 医生形态 / 婚纱形态 / 高管形态 / 战损形态
```

### 六、FORM REGISTRY 形态注册表

每个角色可以有多个形态，但必须登记在 `FORM REGISTRY` 中。

```text
FORM REGISTRY

CHAR_xxx:
- base_identity_asset_id:
- base_identity_confirmed_status:
- current_confirmed_form:
- form_generation_mode: sequential_only

FORMS:

FORM_01:
- form_name:
- form_stage:
- narrative_function:
- episode_allowed_range:
- spoiler_risk:
- depends_on:
- required_previous_confirmation:
- generation_status:
- form_asset_id:
- form_image_url:
- user_confirmed:

FORM_02:
- form_name:
- form_stage:
- narrative_function:
- episode_allowed_range:
- spoiler_risk:
- depends_on:
- required_previous_confirmation:
- generation_status:
- form_asset_id:
- form_image_url:
- user_confirmed:
```

### 七、形态依赖规则

每个后续形态必须依赖前一个已确认资产。

```text
FORM DEPENDENCY RULE

FORM_02 must inherit:
- CHAR_xxx@base_identity confirmed face
- FORM_01 confirmed body proportion
- confirmed hair identity unless story requires change
- confirmed skin realism
- confirmed age impression
```

禁止：

- FORM_02 重新随机生成脸；
- FORM_03 改变年龄感；
- 战损形态变成另一个演员；
- 医生形态脸更成熟，婚纱形态脸更年轻；
- 高管形态改变骨相。

### 八、当前剧情合法形态优先

第一集默认只允许生成当前剧情需要的形态。

例如：

```text
女主隐藏身份：顶尖医生
E01 当前身份：被婆家嫌弃的普通养女
```

正确生成顺序：

```text
1. 女主基础身份底图：确认脸
2. E01 普通养女形态：朴素衣服 / 当前处境
3. E03 揭露医生身份时，才生成医生形态
```

错误：

```text
E01 一次性生成：
- 普通养女形态
- 顶尖医生形态
- 手术服形态
- 高定礼服形态
```

### 九、用户确认触发规则

当用户说：

- OK
- 可以
- 这个脸可以
- 这版通过
- 用这个
- 确认
- 锁定
- 继续下一个形态

系统才允许进入下一个形态。

自动写入：

```text
base_identity_confirmed_status: user_confirmed
can_generate_next_form: yes
```

如果用户只是说：

```text
继续
```

系统必须判断当前形态是否已确认。

如果未确认，不得跳到下一个形态。

### 十、输出前自检

每次生成角色形态前必须检查：

【基础脸】

- 该角色基础身份底图是否已确认？
- 用户是否确认这个人长什么样？
- 是否已经写入 PROJECT ASSET REGISTRY？

【形态顺序】

- 是否一次性生成多个形态？
- 当前形态是否依赖已确认形态？
- 是否跳过了 FORM CONFIRMATION GATE？

【剧情合法性】

- 当前形态是否允许在当前集数出现？
- 是否提前剧透后期身份？
- 是否生成了当前剧情不需要的形态？

【资产浪费】

- 如果当前形态失败，后续形态是否会全部作废？
- 是否应该先暂停等待确认？

如果任一项不通过，必须停止生成，不得继续批量生成形态。

### 十一、补丁口诀

一个角色，先确认一张脸。  
脸没确认，不生成形态。  
形态不能并行，必须串行。  
先锁人，再锁衣服，再锁阶段。  
当前集需要什么，就先做什么。  
后期形态不要提前跑。  
用户没确认，不许继续下一个形态。  
宁可慢一步，不要一次性废一批。

---
