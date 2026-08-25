## 0.12 PATCH：ACTION INTENT / OPPONENT IDENTITY / EXTRAS FACE DIVERSITY LOCK

### 动作意图、对手身份与群众随机脸防污染补丁

【补丁目的】

修复以下问题：

1. 分镜只写“角色在做什么”，没有写“为什么做、对谁做、做完改变什么”。
2. 特写镜头中出现对方衣袖、手、肩膀、背影、局部身体时，AI 无法判断该局部属于哪个角色。
3. 对话反打 / OTS / 手部交互镜头中，对手身份不清，导致画面关系混乱。
4. 群众 / 路人 / 宾客 / 员工 / 保镖 / 服务员 / 同事等非角色被 AI 生成成和主角、反派、重要角色相似的人脸。
5. 非角色群众误被当成可复用角色，造成身份污染。

从本补丁生效起，每个 EPISODE SCRIPT DRAFT、SCENE、SHOT UNIT、KEYFRAME prompt 都必须明确动作意图、对象身份、对手身份和群众身份边界。

### 一、ACTION STATE 动作状态描述

任何角色动作不得只写“做了什么”，必须写成完整 ACTION STATE。

```text
ACTION STATE:
- Actor: 谁在做
- Action: 做什么
- Target: 对谁 / 对什么做
- Motivation: 为什么做
- Method: 用什么方式做
- Emotional State: 做这件事时的情绪
- Power Meaning: 这个动作体现谁压谁 / 谁反击谁
- Result: 做完后改变了什么
```

错误：

```text
林晚看向手机。
```

正确：

```text
ACTION STATE:
- Actor: CHAR_001 林晚
- Action: 看向手机
- Target: PROP_002 手机中的转账提醒
- Motivation: 她要确认父亲留下的资金是否真的到账
- Method: 低头快速扫一眼，随后压住表情
- Emotional State: 紧张转为冷静
- Power Meaning: 她从被羞辱者变成掌握证据的人
- Result: 她有资格在下一镜反击沈夫人
```

规则：

- 每个关键动作都必须有 Motivation。
- 每个冲突动作都必须有 Target。
- 每个爽点动作都必须有 Power Meaning。
- 每个动作结束必须产生 Result。
- 如果动作没有动机、对象、结果，该动作必须删掉或重写。

### 二、对话对象锁定

每句对白必须明确“说给谁听”。

对白字段必须扩展为：

```text
Dialogue CN:
- Speaker:
- Line:
- Speaking To:
- Heard By:
- Relationship Meaning:
- Intended Effect:
- voice_id:
- delivery:
- emotion:
- speed:
```

字段解释：Speaker = 谁说话；Speaking To = 主要说给谁；Heard By = 还有谁听见，尤其是当众羞辱 / 群体见证；Relationship Meaning = 这句话暴露或改变什么关系；Intended Effect = 说话人想让对方产生什么反应。

错误：

```text
Line: “你不配站在这里。”
```

正确：

```text
Dialogue CN:
- Speaker: CHAR_002 沈夫人
- Line: “你一个被沈家退婚的人，也配坐主桌？”
- Speaking To: CHAR_001 林晚
- Heard By: EXTRAS_GROUP_宴会宾客
- Relationship Meaning: 沈夫人公开确认林晚已从准儿媳变成被驱逐者
- Intended Effect: 逼林晚当众低头
- voice_id: VOICE_CHAR_002_F_55_COLD_AUTHORITY
- delivery: cold public humiliation
- emotion: contempt
- speed: medium-slow
```

### 三、OPPONENT IDENTITY 对手身份锁定

任何特写、肩后、衣袖、手部、背影、前景遮挡中出现“非主画面人物”的身体局部时，必须明确该局部属于谁。

SHOT UNIT 必须新增：

```text
Opponent / Partial Body Identity:
- Visible Partial Body:
- Belongs To:
- Identity Evidence:
- Relationship To Main Character:
- Must Not Be Confused With:
```

示例：

```text
Opponent / Partial Body Identity:
- Visible Partial Body: foreground black suit sleeve and left hand holding wine glass
- Belongs To: CHAR_003 沈砚，林晚的前未婚夫
- Identity Evidence: black tailored suit, silver ring, cold restrained posture
- Relationship To Main Character: ex-fiancé who abandoned her
- Must Not Be Confused With: CHAR_004 沈夫人 or any background guest
```

规则：

- OTS 镜头必须写明前景肩膀属于谁。
- 手部特写必须写明手属于谁。
- 衣袖入镜必须写明衣袖属于谁。
- 背影镜头必须写明背影属于谁。
- 道具被递出 / 收回时，必须写明哪只手来自哪个角色。
- 不允许写“a hand / someone’s sleeve / another person”这种模糊描述，除非剧情需要隐藏身份。
- 如果剧情需要隐藏身份，也必须写成 `UNKNOWN_PERSON_001`，并说明不得混淆为已有角色。

### 四、局部身体 Prompt 规则

当画面中出现局部身体时，英文 prompt 必须明确：

```text
the foreground sleeve belongs to CHAR_xxx, not a random extra;
the visible hand belongs to CHAR_xxx;
the partial shoulder in frame is CHAR_xxx, identifiable by costume and position;
do not duplicate the main character face;
do not generate an extra face for this partial body;
```

如果只需要衣袖 / 手 / 肩膀，不需要脸，必须写：

```text
partial body only, no visible face, no new character face generated
```

防止 AI 因为局部身体生成一张新脸。

### 五、EXTRAS 群众身份边界

群众、路人、宾客、员工、保镖、服务员、同事等非重要角色必须登记为 EXTRAS，而不是 CHARACTER。

格式：

```text
EXTRAS GROUP:
- extras_group_id:
- scene role:
- quantity:
- demographic range:
- costume range:
- behavior:
- face rule:
- must not resemble:
- relation to main conflict:
```

示例：

```text
EXTRAS GROUP:
- extras_group_id: EXTRAS_GROUP_宴会宾客
- scene role: wealthy banquet guests witnessing public humiliation
- quantity: 12–20 background people
- demographic range: mixed adults, 25–65, varied facial structures
- costume range: formal evening wear in dark luxury palette
- behavior: whispering, watching, avoiding eye contact with Lin Wan
- face rule: random diverse background faces, non-recurring, not character-locked
- must not resemble: CHAR_001, CHAR_002, CHAR_003, CHAR_004
- relation to main conflict: social pressure witness group
```

规则：

- 群众必须是随机背景脸。
- 群众不得使用主角 / 反派 / 重要角色 @base。
- 群众不得和任何角色长得相似。
- 群众不得被登记为可复用角色，除非剧情升级。
- 群众脸不需要跨镜头一致，只需要不撞主角脸。
- 背景群众可虚化、侧脸、背影、半遮挡，降低生成风险。
- 群众不得抢主角视觉权重。

### 六、EXTRAS Face Diversity Prompt

所有包含群众的 SHOT KEYFRAME / Seedance Prompt 必须加入：

```text
background extras have random diverse faces, no resemblance to the main characters, no duplicated protagonist face, no repeated villain face, no face cloning from character references, extras are non-recurring background people, slightly defocused, natural varied appearances
```

如果群众只需要氛围，不需要清晰脸：

```text
background extras slightly blurred, side profiles and back views, no clear repeated faces, no character resemblance
```

禁止：

- background people using the same face as CHAR_xxx
- extras cloned from the protagonist
- crowd with identical faces
- repeated main character face in background
- random extra becoming a new important character

### 七、群众镜头风险控制

群众镜头优先采用：背影、侧脸、前景遮挡、轻微虚化、半身轮廓、低景深、只拍反应轮廓、只拍手部鼓掌 / 后退 / 举杯、只拍肩膀和头部轮廓。

谨慎使用：大量清晰正脸群众、多个群众同时说话、群众与主角近距离身体接触、群众围成复杂队形、群众和主角同框长时间正脸清晰出现。

如果群众超过 5 人且需要清晰表情，必须降级为：

```text
2–3 个代表性反应人物 + 背景虚化人群
```

### 八、SCENE CONTINUITY LEDGER 补充

SCENE CONTINUITY LEDGER 必须新增：

```text
Interaction Continuity:
- Who is talking to whom:
- Who is looking at whom:
- Who holds which prop:
- Which hand holds the prop:
- Which partial body appears in frame:
- Which character the partial body belongs to:
- Extras present:
- Extras face rule:
```

每个 SHOT UNIT 必须从上一条继承这些关系，不得随机改变。

### 九、SHOT UNIT 模板补充

每个 SHOT UNIT 必须新增以下字段：

```text
Action State:
- Actor:
- Action:
- Target:
- Motivation:
- Method:
- Emotional State:
- Power Meaning:
- Result:

Dialogue Target:
- Speaker:
- Speaking To:
- Heard By:
- Intended Effect:

Opponent / Partial Body Identity:
- Visible Partial Body:
- Belongs To:
- Identity Evidence:
- Must Not Be Confused With:

Extras Control:
- extras_group_id:
- face rule:
- must not resemble:
- blur / visibility level:
```

如果该 SHOT UNIT 没有群众，则写：`Extras Control: none`。如果没有局部身体入镜，则写：`Opponent / Partial Body Identity: none`。

### 十、输出前自检补充

每集输出前必须检查：

【动作状态】每个关键动作是否写清楚 Actor / Action / Target / Motivation / Result？角色为什么做这件事是否清楚？动作对象是谁是否清楚？动作之后改变了什么是否清楚？

【对话对象】每句重要对白是否写清楚 Speaking To？当众羞辱是否写清楚 Heard By？台词是否改变了对方状态？是否避免一个人凭空说话、另一个片段突然出现？

【局部身体身份】OTS 前景肩膀属于谁？手部特写的手属于谁？衣袖 / 背影 / 遮挡人物是否明确身份？是否防止局部身体被 AI 生成成随机新角色？是否防止对手局部和主角身份混淆？

【群众随机脸】群众是否登记为 EXTRAS，而不是 CHARACTER？群众是否明确随机、多样、非复用？群众是否明确不得像主角 / 反派 / 重要角色？是否避免群众复制 @base 参考脸？群众是否尽量虚化、侧脸、背影或低权重？超过 5 人的群众是否降级为 2–3 个代表反应 + 背景虚化？

如果不通过，必须回到 EPISODE SCRIPT DRAFT / SCENE BREAKDOWN / SHOT UNIT 阶段修正。

### 十一、补丁口诀

动作不是“做什么”，而是“谁为什么对谁做”。对白不是自言自语，必须知道说给谁听。特写里出现的手、衣袖、肩膀，也必须有身份。群众不是角色。群众随机、多样、虚化，绝不能长得像主角。主角脸只能属于主角，反派脸只能属于反派。背景人不锁脸，只防撞脸。

---
