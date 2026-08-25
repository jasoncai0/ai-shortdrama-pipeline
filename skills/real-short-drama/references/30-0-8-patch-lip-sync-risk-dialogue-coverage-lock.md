## 0.8 PATCH：LIP-SYNC RISK & DIALOGUE COVERAGE LOCK

### 口型风险与对白覆盖锁

【补丁目的】

修复口型错位、正脸长台词穿帮、远景角色不动嘴、对白语速与镜头时长不匹配的问题。

### 一、口型风险分级

每条含对白的 `SHOT UNIT` 必须标注：

```text
Lip Sync Risk = low / medium / high
```

低风险：

- VO / OS / 旁白
- 背影说话
- 侧脸短句
- 听者反应镜头承接对白

中风险：

- 正脸短句
- 中近景一句台词
- OTS 中可见少量口型

高风险：

- 正脸长台词
- 大情绪哭喊长句
- 多人连续对话
- 远景多人对话但要求准确口型
- 快速语速对白

### 二、对白覆盖规则

正脸说话只允许短句。长台词必须切分覆盖：

```text
正脸短句 → 听者反应 → 手部 / 道具插入镜 → 侧脸 / 背影继续 → 情绪特写
```

禁止：

- 10 秒以上正脸连续说长台词。
- 多人同框同时说话。
- 远景要求准确口型。
- 情绪爆发时同时要求精准口型和复杂动作。

### 三、原生对白与镜头时长匹配

每句对白必须估算可说完时间。

规则：

- 4–6s：1 句短台词，建议 6–14 个汉字。
- 6–8s：1–2 句短台词，建议不超过 24 个汉字。
- 8–12s：可承载一组攻防对白，但必须使用反应镜头或 OTS 覆盖。
- 12–15s：不允许纯正脸长说，必须混合反应、道具、背影、侧脸。

### 四、SHOT UNIT 补充字段

```text
Lip Sync Risk:
Dialogue Coverage Plan:
- visible mouth / side profile / back view / reaction cutaway / prop insert / VO / OS
Estimated Dialogue Duration:
Native Audio Timing:
```

### 五、口诀

正脸短句，长句切反应。嘴型难时，用侧脸、背影、手部、道具、VO。

---
