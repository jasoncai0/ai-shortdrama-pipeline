## 0.6 PATCH：SCENE CONTINUITY LEDGER LOCK

### 场景连续性账本锁

【补丁目的】

修复同一场戏中角色服装、发型、首饰、手持道具、站位、受伤状态、光照状态随机变化的问题。

从本补丁生效起，每一场 SCENE 必须建立 `SCENE CONTINUITY LEDGER`，并由每个 `SHOT UNIT` 继承。

### 一、SCENE CONTINUITY LEDGER 定义

`SCENE CONTINUITY LEDGER` = 单场戏连续性账本。

它记录同一场戏中所有不可随机变化的视觉与声音状态。

格式：

```text
SCENE CONTINUITY LEDGER

Scene ID:
Location:
Time of Day:
Lighting State:
Weather / Environment:

CHAR_xxx:
- Costume:
- Hair:
- Makeup:
- Jewelry / Accessories:
- Handheld Prop:
- Injury / Dirt / Tear / Blood State:
- Emotional State:
- Position / Blocking:
- Voice State:

Props In Scene:
- PROP_xxx:
  - owner / holder:
  - location:
  - visible / hidden:
  - interaction state:

Interaction Continuity:
- Who is talking to whom:
- Who is looking at whom:
- Who holds which prop:
- Which hand holds the prop:
- Which partial body appears in frame:
- Which character the partial body belongs to:
- Extras present:
- Extras face rule:

Continuity Must Not Change:
- 
```

### 二、继承规则

每个 `SHOT UNIT` 必须继承本场 `SCENE CONTINUITY LEDGER`。

禁止：

- 同一场戏服装突然改变。
- 发型突然改变。
- 首饰突然消失或新增。
- 手机、黑卡、合同、钥匙等手持道具无因果消失。
- 同一伤口、泪痕、血迹、污渍在相邻镜头中随机变化。
- 角色站位前后不连续。
- 同一场戏光源方向、色温、强度随机变化。

如果道具、服装、站位、伤痕必须变化，必须在 `Micro Beats` 中写出可见动作原因。

例：

```text
Micro Beat 2: CHAR_001 把黑卡从右手放到桌面，之后 PROP_BLACK_CARD 状态从 held_by_CHAR_001 变为 on_table_front_center。
```

### 三、SHOT UNIT 补充字段

每个 `SHOT UNIT` 必须加入：

```text
Continuity Inherited From:
- Scene Continuity Ledger:
- Costume Continuity:
- Hair / Makeup Continuity:
- Jewelry / Accessory Continuity:
- Handheld Prop Continuity:
- Position / Blocking Continuity:
- Lighting Continuity:
```

### 四、连续性自检

每个 SCENE 输出前必须检查：

- 相邻 `SHOT UNIT` 中角色脸、发型、服装是否一致？
- 道具出现 / 消失是否有动作原因？
- 首饰、包、鞋、眼镜、手机等细节是否稳定？
- 站位是否有连续性？
- 光照是否保持同一场景状态？
- 情绪状态是否有递进，而不是随机跳变？

不通过则必须回到 `SCENE CONTINUITY LEDGER` 或对应 `SHOT UNIT` 修正。

---
