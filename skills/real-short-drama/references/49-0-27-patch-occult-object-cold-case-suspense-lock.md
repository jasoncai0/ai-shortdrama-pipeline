## 0.27 PATCH：OCCULT OBJECT COLD CASE SUSPENSE LOCK

### 旧物灵异悬案逻辑锁

【补丁目的】

修复旧物 / 灵异 / 失踪案 / 遗书 / 旧照片 / 旧录音 / 家族秘密 / 校园旧案 / 民国旧案类故事中的以下漏洞：

1. 旧物只负责吓人，不承担证据功能。
2. 灵异现象过早坐实为真鬼，现实悬疑线崩塌。
3. 核心证据一集全揭，系列追看引擎消失。
4. 十年前 / 多年前旧案时间线混乱。
5. 主角职业身份没有参与破案，只靠运气发现线索。
6. 恐怖画面空转，只制造惊吓，不推进线索、误导或行动。
7. 阻挠者 / 凶手没有在现实人物关系网中逐步显影。

从本补丁生效起，旧物灵异悬案类必须建立：

```text
OBJECT AS EVIDENCE CONTAINER
→ SUPERNATURAL AMBIGUITY LOCK
→ CLUE LADDER
→ CASE TIMELINE LEDGER
→ PROFESSIONAL DETECTION FUNCTION
→ HORROR VISUAL CLUE FUNCTION
→ REAL-WORLD SUSPECT WEB
```

### 一、触发范围

凡故事包含以下任意元素，必须启用本补丁：

- 旧相框 / 旧镜子 / 旧婚纱 / 旧娃娃 / 旧录音机 / 旧房契 / 旧照片 / 旧箱子 / 旧书 / 古董
- 遗书 / 血书 / 录音 / 照片夹层 / 暗格 / 隐藏档案
- 失踪少女 / 十年前旧案 / 家族灭门 / 校园旧案 / 民国悬案 / 冤案
- 每晚哭声 / 影子 / 门响 / 水痕 / 相片变化 / 梦中提示
- 古董店老板 / 修复师 / 旧货商 / 典当行 / 档案员 / 摄影师 / 记者等职业主角

### 二、OBJECT AS EVIDENCE CONTAINER 旧物证据容器锁

旧物必须是案件证据容器，不只是恐怖道具。

输出字段：

```text
OBJECT AS EVIDENCE CONTAINER
Object ID:
Object Type:
- Surface Horror Feature:
- Hidden Physical Evidence:
- Case Link:
- First Owner:
- Current Holder:
- Why It Appeared Now:
- What It Wants Audience To Misread:
- What It Actually Proves:
```

规则：

- 旧物必须能保存、遮蔽、误导或揭露案件信息。
- 旧物的材质、年代、损坏、夹层、污渍、修补痕迹必须服务线索。
- 旧物每次出现都必须推进信息、制造误导或触发行动。

禁止：

- 旧物只是“很阴森”。
- 相框只是会哭，但不提供案件信息。
- 旧照片只负责吓人，没有人物关系变化。
- 遗书只做一次性说明书。

### 三、SUPERNATURAL AMBIGUITY LOCK 灵异暧昧边界锁

前 70% 剧情允许强灵异感，但每个灵异现象必须同时保留至少一个现实解释可能。

禁止：

- 第一集直接坐实真鬼复仇。
- 第一集直接拆穿全是恶作剧。
- 灵异现象没有现实线索关联。
- 现实解释过早清空恐怖张力。

输出字段：

```text
SUPERNATURAL AMBIGUITY
Phenomenon:
- Supernatural Reading:
- Realistic Possible Explanation:
- Evidence Supporting Supernatural:
- Evidence Supporting Realistic:
- When To Delay Explanation Until:
```

稳定策略：

- 哭声可能是录音、邻墙共振、旧磁带、管道声、机关，也可能真与死者有关。
- 相片变化可能是水汽、夹层错位、旧底片重影，也可能是灵异提示。
- 梦境提示可以对应现实中被忽略的物理证据。

### 四、CLUE LADDER 线索阶梯

核心证据不得一次性释放。

遗书、录音、照片、档案、日记、旧物夹层必须拆成多级线索：

```text
CLUE LADDER
Core Evidence:
1. First Visible Clue:
2. Hidden Clue:
3. Misleading Clue:
4. Tampered Clue:
5. Reinterpreted Clue:
6. Suspect Link:
7. Final Proof:
Payoff Episode:
```

规则：

- 第一集只能释放足够追看的局部信息。
- 每 1–2 集必须新增一个线索或推翻一个旧理解。
- 关键证据必须至少经历一次“误读 → 重读”。
- 最终证据必须能回收前期异常画面。

禁止：

- 第一集读完整封遗书。
- 第一集说出凶手是谁。
- 第一集解释所有灵异现象。
- 线索只增加信息，不改变嫌疑方向。

### 五、CASE TIMELINE LEDGER 旧案时间线账本

失踪案 / 冤案 / 遗书类悬疑必须建立时间线账本。

```text
CASE TIMELINE LEDGER
Cold Case Name:
Past Timeline:
- Date / Time:
- Location:
- Person Present:
- Official Version:
- Hidden Truth Possibility:
- Evidence State:
- Who Benefited:

Present Timeline:
- Date / Time:
- Current Trigger:
- Object Movement:
- New Holder:
- New Threat:
- New Evidence Found:
- Who Reacts Abnormally:
```

规则：

- 所有线索必须落到具体时间、地点、人物、证据状态。
- 过去发生的事必须影响现在的人物行动。
- 当前阻挠者必须和过去旧案存在利益或恐惧连接。
- 官方结论和隐藏真相必须持续存在张力。

### 六、PROFESSIONAL DETECTION FUNCTION 职业破案功能

主角职业能力必须参与发现线索。

不同职业的稳定用途：

```text
古董店老板 / 旧货商：识别年代、来源链、修补痕迹、夹层、假包浆、旧货流转。
修复师：发现背板二次钉合、胶水新旧、纸张纤维、木材受潮方向。
摄影师：识别照片裁切、暗房痕迹、底片重影、洗印年代。
记者：追查旧报道、采访证词、档案矛盾。
档案员：查失踪登记、户籍异常、旧卷宗缺页。
法医 / 医生：识别伤痕、药物、死亡时间疑点。
```

输出字段：

```text
PROFESSIONAL DETECTION FUNCTION
Protagonist Profession:
- Skill Used:
- Ordinary Person Would Miss:
- Evidence Found Through Skill:
- Wrong Assumption Corrected:
- Next Action Triggered:
```

禁止主角只靠运气、梦境或鬼魂直接给答案。

### 七、HORROR VISUAL CLUE FUNCTION 恐怖视觉线索功能

每个恐怖视觉必须回答三个问题：

```text
HORROR VISUAL CLUE FUNCTION
Visual Abnormality:
- What It Suggests:
- What It Misleads:
- What Action It Triggers:
- Evidence It Connects To:
- Payoff Later:
```

可用视觉机制：

- 每晚固定时间哭声 = 失踪 / 死亡 / 录音启动时间。
- 水痕 = 水边、井、浴室、雨夜、淹溺、地下室。
- 相片裂纹 = 指向被裁掉的人。
- 夹层干花 = 最后出现地点或关系信物。
- 玻璃内雾字 = 角色主观恐惧，也可能是温差与残留油脂。
- 木框刻痕 = 旧校名、房号、车牌、缩写。

禁止只写：

```text
相框很诡异。
女人哭声很恐怖。
照片突然变了。
```

### 八、REAL-WORLD SUSPECT WEB 现实嫌疑网

灵异悬疑最终必须落到现实人物关系网中的压力和利益。

```text
REAL-WORLD SUSPECT WEB
Victim:
Suspects:
- Name / Role:
- Past Relationship With Victim:
- Present Relationship With Object:
- Motive:
- Fear:
- What They Hide:
- How They Block Investigation:
- Red Herring / Real Threat:
```

规则：

- 凶手 / 阻挠者不能最后凭空出现。
- 每个重要嫌疑人第一次出场必须有关系显影。
- 每个阻挠动作必须绑定过去旧案的利益或恐惧。
- 真凶可以隐藏，但必须早有异常反应或利益痕迹。

### 九、结尾悬念规则

结尾悬念必须抛出新问题，而不只是吓一跳。

合格悬念：

- 新人物认出旧物。
- 旧案相关人突然上门。
- 证据出现近期篡改痕迹。
- 遗书第一句推翻官方结论。
- 主角发现自己也在旧照片里。
- 警方档案显示少女失踪后还曾出现。

不合格悬念：

- 灯突然灭了。
- 鬼脸出现。
- 门自己开了。
- 主角尖叫。

除非该惊吓同时带出新线索。

### 十、输出前自检

每次处理旧物灵异悬案类题材，输出前必须检查：

- 旧物是否是证据容器，而不是单纯恐怖道具？
- 灵异现象是否保留现实解释可能？
- 核心证据是否拆成 CLUE LADDER？
- 是否建立 CASE TIMELINE LEDGER？
- 主角职业能力是否参与发现线索？
- 每个恐怖视觉是否推进线索、误导或行动？
- 嫌疑人 / 阻挠者是否在现实关系网中逐步显影？
- 结尾悬念是否抛出新问题，而不是只吓一跳？

### 十一、补丁口诀

旧物不是摆设，是证据容器。  
灵异先暧昧，不要太早坐实。  
遗书别一次读完，照片别一次解释完。  
旧案必须有时间线。  
主角职业要破案，不要只靠撞鬼。  
每个恐怖画面都必须给线索、给误导、给行动。  
结尾不是吓人，是抛出新问题。

---
