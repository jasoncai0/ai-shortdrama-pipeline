## 0.26 PATCH：HISTORICAL SKILL-BUSINESS ROMANCE LOGIC LOCK

### 古代技能经商恋爱逻辑锁

【补丁目的】

修复古言 / 穿越 / 弃妃 / 庶女 / 下堂妇 / 种田经商 / 技能逆袭 / 强权恋爱类故事中的以下漏洞：

1. 穿越、重生、替身、换身只靠旁白解释，前 3 秒没有可视化身份错位证据。
2. 被囚禁、冷宫、软禁、下堂、庶女受限角色无解释自由行动，导致经商线虚假。
3. 职业技能只变成审美装饰，不能承担生存、赚钱、反击、情感连接或真相揭露功能。
4. 经商逆袭从贫弱状态直接跳到产业成功，缺少第一桶金和商业升级链。
5. 强权恋爱对象替主角完成核心爽点，削弱主角能动性。
6. 古装美术变成空镜唯美图，没有服务冲突、权力、交易、秘密或爽点。

从本补丁生效起，所有古代技能经商恋爱类短剧必须先建立：

```text
IDENTITY DISLOCATION PROOF
→ FREEDOM LOGIC
→ SKILL FUNCTION MAP
→ MONEY LADDER
→ ROMANCE POWER BOUNDARY
→ BEAUTY-SERVES-CONFLICT CHECK
```

### 一、触发范围

凡故事包含以下任意元素，必须启用本补丁：

- 穿越 / 重生 / 替嫁 / 换身 / 失忆入局
- 弃妃 / 冷宫 / 庶女 / 下堂妇 / 被退婚 / 被软禁 / 被流放
- 花艺 / 医术 / 厨艺 / 制香 / 刺绣 / 酿酒 / 经商 / 算账 / 鉴宝 / 农事 / 手艺技能
- 古代开店 / 酒楼 / 香铺 / 医馆 / 绣坊 / 花坊 / 茶楼 / 胭脂铺 / 商会
- 帝王微服 / 王爷 / 权臣 / 将军 / 世子 / 首辅 / 富商等强权恋爱对象
- 伪善嫡姐 / 继母 / 贵女 / 后宫妃嫔 / 家族压迫

### 二、IDENTITY DISLOCATION PROOF 身份错位视觉证据

穿越 / 重生 / 换身 / 失忆类开场，前 3 秒必须出现可视化错位证据。

禁止只写：

```text
她醒来发现自己穿越了。
她发现自己成了弃妃。
她想起前世记忆。
```

必须使用至少 2 类视觉证据：

1. 现代物件与古代环境冲突：花剪、手机残影、现代戒指、旧工牌、烧焦名片。
2. 称呼错位：宫女 / 嬷嬷 / 家仆突然称她“娘娘”“小姐”“夫人”。
3. 身体处境错位：冷宫泥地、破衣、伤痕、枷锁、赐死药、废妃诏书。
4. 记忆闪断：现代店铺火光与古代屋梁交叠。
5. 技能本能：她下意识用现代专业判断识破古代危机。

输出字段：

```text
IDENTITY DISLOCATION PROOF
- Opening Visual Shock:
- Wrong Identity Called By:
- Modern Memory Fragment:
- Ancient Constraint Visible:
- Skill Reflex Trigger:
```

### 三、FREEDOM LOGIC 行动自由逻辑

身份受限角色必须说明当前能去哪里、不能去哪里、如何突破限制、谁提供通行权、代价是什么。

禁止：

- 冷宫弃妃无解释出宫开酒楼。
- 被软禁庶女自由参加所有宴会。
- 下堂妇刚被赶出门立刻拥有完整商业网络。
- 被流放角色无资金、无人脉、无通行权却快速开店。

必须建立：

```text
FREEDOM LOGIC
- Current Physical Limit:
- Social Status Limit:
- Money Limit:
- Mobility Channel:
- Proxy / Helper:
- First Legal / Illegal Exit Method:
- Cost of Movement:
- Risk If Exposed:
```

常用稳定解法：

- 前期通过宫女、旧仆、伙计、代掌柜、暗线客人进行交易。
- 先做宫内 / 家宅内订单，再扩大到外部市场。
- 通过临时令牌、赏赐、贬为庶人、假死出逃、商号代理逐步获得自由。
- 每一次行动自由扩张都必须有代价或风险。

### 四、SKILL FUNCTION MAP 职业技能功能图

主角职业技能不得只是美术装饰。

每个核心技能必须至少承担以下 3 种剧情功能：

1. 生存工具：解决饥饿、伤病、羞辱、禁足、资源短缺。
2. 赚钱工具：产生第一桶金、客户、口碑、订单、账册。
3. 反击武器：识破陷害、反制反派、揭穿伪善、制造证据。
4. 情感连接：让恋爱对象、盟友、客户看见主角能力。
5. 真相揭露媒介：通过花材、药性、香味、账目、器物、手艺识别秘密。

输出字段：

```text
SKILL FUNCTION MAP
Skill Name:
- Survival Use:
- Money Use:
- Counterattack Use:
- Romance / Trust Use:
- Truth Reveal Use:
- Visual Symbol:
- Payoff Episode:
```

禁止：

- 花艺只负责画面好看。
- 医术只负责救人，没有反击和证据功能。
- 厨艺只负责做菜，没有商业升级。
- 制香只负责暧昧氛围，没有线索或权力用途。

### 五、MONEY LADDER 经商升级阶梯

所有古代经商逆袭必须建立 MONEY LADDER。

不得从贫弱 / 被废 / 无资源状态直接跳到开大酒楼、开连锁店、成为首富。

标准阶梯：

```text
MONEY LADDER
1. First Resource: 主角手里最初能用的东西是什么？
2. First Product: 第一个可售卖的产品 / 服务是什么？
3. First Customer: 第一个愿意付钱的人是谁？为什么？
4. First Coin: 第一笔钱如何到手？金额小但必须可信。
5. First Reputation: 第一次口碑如何扩散？
6. First Blockade: 反派如何封杀 / 抢功 / 断供？
7. First Business Counter: 主角如何用技能反击商业封锁？
8. First Scale-Up: 如何从小订单变成店铺 / 宴席 / 商号？
```

每个商业升级节点必须绑定：

- 具体产品
- 具体客户
- 具体收入来源
- 具体阻力
- 具体反击

### 六、ROMANCE POWER BOUNDARY 强权恋爱边界

帝王 / 王爷 / 权臣 / 将军 / 世子 / 富商等强权恋爱对象不得替主角完成核心爽点。

允许强权恋爱对象承担：

- 观察者
- 误判者
- 试探者
- 顾客
- 见证者
- 风险源
- 制度性验证者
- 后期情感与权力背书

禁止强权恋爱对象承担：

- 替主角赚钱
- 替主角揭露核心真相
- 替主角完成主要打脸
- 替主角解决所有行动自由问题
- 一出场就无条件宠爱并清空冲突

输出字段：

```text
ROMANCE POWER BOUNDARY
Love Interest Role This Episode:
- Witness / Tester / Customer / Threat / Validator:
- What He Can Help:
- What He Must Not Solve:
- Heroine Active Payoff:
- Relationship Progress Through Skill:
```

核心规则：

主角的生存、赚钱、揭露、反击必须由主角主动完成。恋爱对象可以看见、误解、试探、确认、背书，但不能代替主角成为爽点发动机。

### 七、伪善型反派三层面具

伪善嫡姐 / 继母 / 贵女 / 宫妃等反派不能只骂主角。

必须建立：

```text
HYPOCRISY VILLAIN MASK
- Public Mask: 她在众人面前如何显得善良 / 体面 / 无辜？
- Private Action: 她私下如何抢夺、陷害、封杀？
- Material Benefit: 她从主角身上拿走了什么具体利益？
- Public Humiliation Method:
- Hidden Crime / Debt:
- Payoff Evidence:
```

规则：

- 伪善型反派必须有公众人设。
- 每次羞辱必须服务她的利益。
- 每次打脸必须揭穿“面具”和“利益”两层。

### 八、BEAUTY-SERVES-CONFLICT 古装美术服务冲突锁

古装花艺、酒楼、宫廷、宴席、华服、园林等美术镜头不得空转。

每个唯美镜头必须绑定以下至少 1 个功能：

- 关系压迫
- 商业动作
- 秘密揭露
- 情绪变化
- 权力反转
- 技能展示
- 证据显影
- 恋爱误判 / 试探

输出前检查：

```text
BEAUTY-SERVES-CONFLICT CHECK
- Is this visual only decorative? yes / no
- Conflict Function:
- Skill Function:
- Relationship Function:
- Payoff Function:
```

若一个古装美术镜头只负责“好看”，没有剧情功能，必须删除或改写。

### 九、输出前自检

每次处理古代技能经商恋爱类题材，输出前必须检查：

- 穿越 / 重生是否有前 3 秒身份错位视觉证据？
- 身份受限主角是否有行动自由逻辑？
- 职业技能是否至少承担 3 种剧情功能？
- 经商线是否有 MONEY LADDER？
- 强权恋爱对象是否没有替主角完成核心爽点？
- 伪善反派是否有公众面具、私下行动、具体利益？
- 古装美术是否服务冲突，而不是空镜唯美？
- 第一集是否同时完成身份困境、技能显影、第一阻力、第一反击或第一赚钱动作？

### 十、补丁口诀

穿越要有错位证据。  
被困要有行动逻辑。  
技能不是装饰，是生存、赚钱、反击、恋爱、揭密。  
经商不能一跳成功，必须有第一桶金。  
强权男主不能替女主爽。  
古装美术必须压剧情，不许只负责好看。

---
