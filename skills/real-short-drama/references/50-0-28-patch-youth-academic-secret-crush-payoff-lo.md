## 0.28 PATCH：YOUTH ACADEMIC SECRET-CRUSH PAYOFF LOCK

### 青春学业暗恋回收锁

【补丁目的】

修复青春校园 / 高考 / 暗恋 / 同桌补习 / 伪学渣 / 垫底逆袭 / 延迟告白 / 双向救赎类故事中的以下漏洞：

1. 低冲突纯爱过平，像散文，不像短剧。
2. 伪学渣没有隐藏能力逻辑，只是装酷。
3. 垫底女生被低智化，变成被拯救对象。
4. 补习过程变成做题流水账，缺少关系推进和爽点兑现。
5. 暗恋真相只靠口头告白，缺少证据冲击。
6. 高考后揭露没有前期伏笔，反转突兀。
7. 青春校园没有传统反派后缺少压力源。
8. 男主替女主完成成长，女主缺少主动兑现。

从本补丁生效起，青春学业暗恋类必须建立：

```text
HIDDEN COMPETENCE LOGIC
→ UNDERPERFORMANCE WOUND
→ STUDY PAYOFF LADDER
→ OBJECT EVIDENCE REVEAL
→ FORESHADOW LEDGER
→ PRESSURE SOURCES
→ EXAM DESTINY PAYOFF
→ AGENCY PROTECTION
```

### 一、触发范围

凡故事包含以下任意元素，必须启用本补丁：

- 高冷转学生 / 伪学渣 / 校霸学霸 / 隐藏年级第一
- 垫底女生 / 吊车尾 / 高考逆袭 / 同桌补习
- 暗恋多年 / 转学追随 / 延迟告白 / 高考后才知道
- 青春校园 / 纯爱 / 双向救赎 / 成绩反打
- 志愿表 / 录取通知 / 错题本 / 旧照片 / 申请表 / 笔记作为情感证据

### 二、HIDDEN COMPETENCE LOGIC 隐藏能力逻辑

伪学渣 / 伪差生 / 高冷转学生必须说明为什么被误认为差、真实强在哪里、为什么隐藏、隐藏代价是什么。

输出字段：

```text
HIDDEN COMPETENCE LOGIC
Character:
- Public Label:
- Real Competence:
- Reason For Hiding:
- Cost of Hiding:
- First Crack In Disguise:
- Who Notices First:
- Reveal Payoff Episode:
```

稳定选项：

- 为进入女主所在普通班故意压低入学成绩。
- 偏科极端，理科天才但文科崩盘。
- 家庭变故导致阶段性低谷，被误判废掉。
- 拒绝原校竞赛绑定，转学后不参加排名。
- 过去被成绩利用，所以主动隐藏锋芒。

禁止：

- 只写“他其实是学霸”。
- 只用高冷气质替代能力证据。
- 男主无代价隐藏能力。
- 第一集就完全揭穿身份。

### 三、UNDERPERFORMANCE WOUND 垫底伤口锁

垫底学生不得默认写成低智。

必须给出成绩落后的现实原因、心理伤口、外部压力和可逆成长路径。

输出字段：

```text
UNDERPERFORMANCE WOUND
Character:
- Public Label:
- Real Cause of Low Score:
- Emotional Wound:
- External Pressure:
- Missing Foundation:
- Reversible Growth Path:
- First Small Win:
```

可用原因：

- 家庭变故、打工、照顾亲人导致学习断层。
- 被长期羞辱后考试焦虑。
- 转学适应失败。
- 基础断层但理解力不差。
- 被老师和同学放弃，形成自我否定。

禁止：

- 把女主写成笨。
- 把成长完全交给男主。
- 让补习像施舍。
- 让女主只负责被拯救和感动。

### 四、STUDY PAYOFF LADDER 学业爽点阶梯

学习成长类剧情必须建立 STUDY PAYOFF LADDER。

```text
STUDY PAYOFF LADDER
1. Public Humiliation: 第一次成绩羞辱。
2. Diagnosis: 男主 / 主角发现真正短板。
3. First Help: 第一次有效帮助，但可能被误解。
4. First Small Progress: 第一次小进步。
5. Public Doubt: 外界质疑作弊 / 拖后腿 / 不配。
6. Skill Transfer: 女主学会方法，而不是只收答案。
7. First Public Counter: 成绩或能力当众反打。
8. Final Exam Payoff: 高考 / 大考 / 志愿兑现。
```

规则：

- 补习镜头必须同时推进知识、关系、误会或情绪。
- 每次成绩进步必须有前置方法和代价。
- 不得只拍做题、翻书、讲题。
- 错题本、笔记、公式、排名榜必须承担情绪和关系功能。

### 五、OBJECT EVIDENCE REVEAL 暗恋证据揭露

暗恋真相不得只靠口头告白。

必须通过物证、文件、旁人证词或被回收的细节揭露。

输出字段：

```text
OBJECT EVIDENCE REVEAL
Secret Crush Truth:
- Evidence Object:
- Where It Appears:
- What It First Seems To Mean:
- What It Actually Proves:
- Who Reveals It:
- Emotional Payoff Line:
```

可用证据：

- 转学申请表：目标班级是女主所在班。
- 旧照片：两人过去曾有交集。
- 志愿表：男主放弃更好选择，选择她所在城市。
- 错题本：笔记完全按照女主错误习惯整理。
- 录取通知：两人目的地重合不是巧合。
- 班主任证词：他转学时只问“她还在这个班吗？”
- 旧手机备忘录：记录她每次月考排名和情绪低点。

禁止：

- 高考后男主直接说“我就是为了你转学”。
- 没有物证和伏笔的突然深情。
- 只用旁白解释暗恋多年。

### 六、FORESHADOW LEDGER 伏笔账本

延迟告白 / 后置真相类必须建立伏笔账本。

```text
FORESHADOW LEDGER
Final Truth:
Foreshadows:
- Episode:
- Detail:
- First Meaning:
- Later Meaning:
- Payoff Episode:
```

规则：

- 每 1–2 集至少埋一个可回收伏笔。
- 最终揭露时必须回收至少 3 个前期细节。
- 伏笔必须当时有表层意义，回收时有深层意义。

例：

- 他知道她不吃香菜：表层是观察细，深层是多年前就记得。
- 他避开转学原因：表层是高冷，深层是怕暴露追随。
- 他笔记里有她三年前字体：表层是巧合，深层是旧识。

### 七、PRESSURE SOURCES 青春压力源

青春纯爱可以没有传统恶毒反派，但必须有压力源。

```text
PRESSURE SOURCES
- Academic Pressure:
- Family Pressure:
- Peer Pressure:
- Teacher Pressure:
- Time Pressure:
- Misunderstanding Pressure:
- Future Choice Pressure:
```

规则：

- 每集至少激活一种压力源。
- 压力必须具体化为动作、台词、排名、通知、家长要求、志愿冲突或公开羞辱。
- 不能只有甜蜜互动。

常用压力：

- 老师认为女主不该参加高考。
- 同学嘲笑“差生互助”。
- 家长要求女主放弃读书去打工。
- 男主原校竞赛老师逼他回去。
- 年级第一制造误会或成绩压迫。
- 高考倒计时逼迫两人分开选择未来。

### 八、EXAM DESTINY PAYOFF 高考命运兑现

高考 / 大考不得只是时间背景，必须承担命运选择。

输出字段：

```text
EXAM DESTINY PAYOFF
Exam / Deadline:
- What The Exam Changes:
- What The Protagonist Must Prove:
- What Relationship Risk It Creates:
- What Future Choice It Forces:
- Score / Admission / Volunteer Form Payoff:
```

规则：

- 考试必须改变主角命运。
- 成绩兑现必须回收补习阶梯。
- 志愿选择必须连接暗恋真相或人生选择。
- 高考后揭露必须同时完成成长 payoff 与情感 payoff。

### 九、AGENCY PROTECTION 主角能动性保护

男主可以帮助女主，但不能替女主完成成长。

允许男主：

- 诊断短板
- 提供方法
- 挡一次羞辱
- 给错题本
- 激发信心
- 暗中陪伴
- 在关键时刻相信她

禁止男主：

- 替女主考试
- 替女主解决所有压力
- 用自己身份让女主被认可
- 让女主成绩提升没有过程
- 让女主最终只因被爱而翻身

输出字段：

```text
AGENCY PROTECTION
Hero Help:
Heroine Active Choice:
Heroine Effort Shown:
Heroine Payoff Earned By:
What Hero Must Not Solve:
```

### 十、输出前自检

每次处理青春学业暗恋类题材，输出前必须检查：

- 伪学渣是否有隐藏能力逻辑？
- 垫底学生是否没有被低智化？
- 成绩落后是否有现实原因和可逆成长路径？
- 补习是否建立 STUDY PAYOFF LADDER？
- 暗恋真相是否通过物证 / 文件 / 笔记 / 旁人证词揭露？
- 是否建立 FORESHADOW LEDGER？
- 每 1–2 集是否有可回收伏笔？
- 每集是否至少有一种青春压力源？
- 高考是否承担命运选择，而不是纯时间背景？
- 男主是否没有替女主完成核心成长？

### 十一、补丁口诀

伪学渣要有真本事，也要有隐藏代价。  
垫底不是笨，是有伤口、有压力、有断层。  
补习不是做题流水账，是关系、误会、成绩的阶梯。  
暗恋别靠嘴说，要靠物证回收。  
青春可以甜，但每集都要有压力。  
高考不是背景，是命运开关。  
男主可以照亮她，不能替她发光。

---
