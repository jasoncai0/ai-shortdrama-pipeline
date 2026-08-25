## 0.22 PATCH：SCENE COMPLEXITY BUDGET LOCK

### 场景复杂度预算锁

【补丁目的】

修复以下问题：

1. 单个场景塞入过多人、过多动作、过多道具、过多关系，导致 AI 视频生成失控。
2. 群像戏、宴会戏、会议戏、医院抢救戏、婚礼戏等高复杂场景被写成多人同框长对白。
3. 剧本层面没有提前判断某场是否超出 AI 视频稳定生成能力。
4. SHOT UNIT 虽然符合时长，但内部复杂度过高，导致人物串脸、口型乱、手部错、站位漂移。

从本补丁生效起，每个 SCENE 在进入 SHOT UNIT 前，必须先计算 `SCENE COMPLEXITY BUDGET`。

### 一、复杂度预算字段

每个 SCENE 必须新增：

```text
SCENE COMPLEXITY BUDGET

Scene ID:
Scene Type:
- dialogue / confrontation / banquet / meeting / hospital / wedding / crowd / fight / chase / car / courtroom / family_dinner / office / bedroom / street

Clear Face Count:
清晰露脸主要人物数量。

Speaking Character Count:
有台词人物数量。

Active Prop Count:
需要被手持、移动、展示、交互的关键道具数量。

Crowd Count:
背景群众数量。

Location Complexity:
low / medium / high

Action Complexity:
low / medium / high

Dialogue Complexity:
low / medium / high

Hand Prop Complexity:
low / medium / high

Continuity Complexity:
low / medium / high

Overall Scene Risk:
low / medium / high

Required Downgrade:
none / simplify_people / simplify_props / split_scene / use_reaction_closeups / use_OS_dialogue / reduce_crowd / move_info_to_subtitle_text_or_dialogue
```

### 二、默认安全预算

普通短剧 AI 视频场景推荐预算：

```text
Clear Face Count: 1–3
Speaking Character Count: 1–2
Active Prop Count: 0–2
Crowd Count: 0–5, preferably blurred
Complex Actions: 0–1
Precise Hand Interactions: 0–1
Readable Text: 0
```

超过预算必须降级。

### 三、高风险触发条件

满足任意条件，Scene Risk 自动升为 high：

```text
清晰露脸人物 > 4
同时说话人物 > 2
背景群众 > 8 且要求清晰表情
同一 SHOT UNIT 内出现 2 个以上关键手部动作
同一 SHOT UNIT 内要求可读文字
同一 SHOT UNIT 内既要长对白又要复杂动作
同一 SHOT UNIT 内多个角色移动换位
同一 SHOT UNIT 内多人抢夺 / 拉扯 / 推搡
同一场景内道具状态超过 3 次变化
```

### 四、高风险降级策略

如果 Scene Risk = high，必须至少执行一种降级：

```text
1. clear face count 降到 1–3。
2. 群众变为虚化背景、背影、侧脸、肩膀轮廓。
3. 复杂动作拆为“动作前 + 动作后结果”。
4. 长对白改为 OS / VO / reaction coverage。
5. 证据文字转入对白 / OS / VO / 字幕文本。
6. 多人争吵改为主反派单人 close-up 轮换。
7. 群体震惊改为 2 个代表性反应人物。
8. 道具交互从复杂操作改为静态持有 / 压桌 / 推近。
9. 场景拆成两个连续场景。
```

### 五、禁止行为

禁止在高风险场景中继续要求：

```text
多人清晰正脸同时说话
多人围桌复杂站位变化
长正脸台词 + 手部复杂动作
群众同时震惊且每个人表情清晰
文件文字可读
手机 UI 可读
多道具连续传递
复杂打斗 / 拉扯 / 抢夺同时有对白
```

### 六、输出前自检

- 本场清晰露脸人数是否超过预算？
- 有台词人物是否超过 2 个？
- 是否有多个手部道具交互？
- 是否有群众清晰表情要求？
- 是否有可读文字要求？
- 是否既要长对白又要复杂动作？
- 如果高风险，是否已经降级？
- 降级后是否仍能表达剧情信息？

### 七、口诀

场面可以大，生成要小。  
群像用气氛，关键用特写。  
多人同框不如单人反应。  
复杂动作不如结果镜头。  
预算超了，必须降级。

---
