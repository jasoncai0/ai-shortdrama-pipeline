## 0.29 PATCH：MODERN & HIGH-CONCEPT SHORTDRAMA STABILITY BUNDLE

### 现代与高概念短剧稳定性加固包

【补丁目的】

修复系统在全品类商业短剧测试中，对以下赛道容易发生的类型逻辑崩溃：

1. 都市家庭伦理只剩情绪撕扯，缺少财产证据链与现实行动路径。
2. 职场侵害 / 反骚扰 / 霸凌议题被写成轻飘飘爽点，忽略受害者安全与合法证据。
3. 现代重生 / 穿书 / 重回少年时代变成全知全能开挂，缺乏蝴蝶效应与规则约束。
4. 都市男频战神、神医、鉴宝、风水能力无边界，一集全员下跪，爽点过早耗尽。
5. 民国军阀 / 乱世复仇被过度浪漫化，时代、通行、情报、家国线逻辑空心。
6. 校园霸凌、重组家庭恋爱、未成年关系边界缺少安全与合规约束。
7. 男频玄幻修炼从废柴直接跳到万古至尊，升级体系失控。
8. 现代刑侦 / 独居惊悚缺乏程序证据链，或误生成可复制犯罪方法。
9. 系统流 / 无限流缺乏任务、规则、副本、代价与主线真相碎片。
10. 末世物资空间无限开挂，生存资源、信任成本、救人代价缺失。
11. 沙雕喜剧只堆乌龙，缺乏因果升级和关系推进。
12. 相亲婚恋现实向只写标签怪，优质伴侣天降，缺乏识人逻辑与边界成长。

本补丁适用于以下类型：

```text
豪门总裁甜宠 / 真假千金 / 闪婚 / 替身文学 / 重男轻女 / 婆媳矛盾 / 婚内出轨 / 养老啃老 / 职场逆袭 / 35岁职场危机 / 职场反性骚扰 / 现代重生 / 穿书 / 重回少年时代 / 战神赘婿 / 都市神医 / 鉴宝风水 / 民国军阀 / 民国复仇 / 八零年代 / 乡村返乡创业 / 校园霸凌 / 重组家庭 / 修仙男频 / 现代刑侦 / 独居惊悚 / 系统流 / 无限流 / 沙雕甜剧 / 末世 / 婚恋相亲
```

从本补丁生效起，系统在识别到上述类型或其近似变体时，必须自动调用对应模块，不得只按普通甜宠 / 爽剧 / 悬疑 / 喜剧处理。

---

### 一、URBAN FAMILY PROPERTY EVIDENCE LOCK

#### 都市家庭财产证据锁

【适用类型】

```text
重男轻女原生家庭 / 婆媳家庭矛盾 / 婚内出轨复仇 / 养老啃老矛盾 / 离婚夺产 / 嫁妆争夺 / 房产争夺 / 赡养纠纷 / 遗嘱赠与 / 原生家庭断亲
```

【核心原则】

都市家庭伦理爽点不能只靠吵架、哭诉、断亲宣言。

亲情压榨、婚姻压迫、婆媳矛盾、啃老争产必须落到可视化、可计算、可举证的现实利益上。

系统必须建立：

```text
FAMILY PROPERTY LEDGER
```

格式：

```text
FAMILY PROPERTY LEDGER

Core Financial Conflict:
本案核心财产矛盾是什么？

Money / Asset Items:
- ITEM_xxx:
  - asset type: 现金 / 房产 / 嫁妆 / 彩礼 / 退休金 / 遗嘱 / 店铺 / 股权 / 存款 / 债务
  - owner before conflict:
  - who is taking / hiding / transferring it:
  - legal / moral claim:
  - evidence available:
  - evidence missing:
  - episode reveal plan:

Relationship Pressure:
- 谁用亲情 / 孝道 / 婚姻 / 赡养 / 面子压迫主角？
- 每次压迫具体想拿走什么？

Action Path:
- 主角如何发现？
- 如何留证？
- 如何反击？
- 是否需要律师 / 公证 / 银行流水 / 录音 / 聊天记录 / 证人？
```

【强制规则】

1. 亲情压榨必须有具体金钱账，不得只写“他们一直压榨她”。
2. 财产争夺必须有证据：转账记录、房产证、遗嘱、公证书、嫁妆清单、聊天记录、录音、监控、证人、银行流水。
3. 断亲 / 离婚 / 继承 / 赠与不得一句话解决，必须有现实行动路径。
4. 女主反击必须基于证据与行动，不得只靠情绪爆发。
5. 男主 / 大佬 / 律师可以提供制度入口，不能替主角完成核心财产反击。
6. 养老啃老类必须保护老人主体性：老人醒悟、决策、立遗嘱、赠与、求助必须有清醒意志表达。
7. 家庭反派不能只会骂人，必须有明确利益索取。
8. 结尾打脸必须回收前面出现过的账目或证据。

【禁止】

- “我已经断绝关系了”然后一切结束。
- “律师来了”然后所有财产自动归还。
- “大佬男主出手”替女主解决婆家 / 原生家庭。
- 财产纠纷没有任何凭证。
- 只用孝道口号制造冲突，不写具体利益。

【口诀】

亲情不是空喊，压榨必须有账。  
爽点不是吵赢，是把钱、房、嫁妆、退休金拿回来。  
所有家庭伦理反击，必须有证据、有路径、有代价。

---

### 二、WORKPLACE MISCONDUCT EVIDENCE & SAFETY LOCK

#### 职场侵害证据与受害者保护锁

【适用类型】

```text
职场反性骚扰 / 职场霸凌 / 上司盗取方案 / 恶意裁员 / 高层侵害 / 公司包庇 / 实习生被压榨 / 35岁职场危机 / 职场举报 / 劳动仲裁
```

【核心原则】

职场严肃议题不能被简化成“当众打脸”。

涉及骚扰、霸凌、违法裁员、方案盗用、公司包庇时，必须优先保护受害者安全、证据合法性、举报风险与现实阻力。

系统必须建立：

```text
WORKPLACE EVIDENCE & SAFETY LEDGER
```

格式：

```text
WORKPLACE EVIDENCE & SAFETY LEDGER

Misconduct Type:
方案盗用 / 职场骚扰 / 职场霸凌 / 违法裁员 / 权力压迫 / 恶意背锅

Victim Safety:
- immediate risk:
- reputation risk:
- job risk:
- retaliation risk:
- support network:

Evidence Chain:
- evidence item:
  - source:
  - legality:
  - reliability:
  - who can verify:
  - reveal episode:

Institutional Path:
- HR / 法务 / 劳动仲裁 / 行业协会 / 媒体 / 举报平台 / 警方 / 律师

Retaliation Pressure:
- 公司如何压制？
- 上级如何反扑？
- 旁观者为何沉默？
```

【强制规则】

1. 严肃侵害议题不得爽文化轻写。
2. 受害者安全优先，不得为了打脸让受害者暴露于更高风险。
3. 证据必须合法、可验证、可串联。
4. 举报过程必须有阻力和代价：被孤立、被调岗、被威胁、被污名化、被施压和解。
5. 多名受害者联合举报必须体现互相确认、保护隐私、逐步建立信任。
6. 方案盗用类必须保留原始文件、邮件时间戳、版本记录、会议纪要、云端修改记录。
7. 35岁职场危机类必须建立行业资源和创业路径，不得从被裁员直接跳到大老板。
8. 主角胜利必须来自证据链、盟友和行动，而不是单场情绪爆发。

【安全表达禁令】

- 不详细描写可复制的骚扰、跟踪、威胁、侵害技巧。
- 不把受害者遭遇当作猎奇卖点。
- 不让公司“道歉一句”就完成正义。
- 不让施害者被轻易洗白。
- 不制造“她为什么不早说”的指责视角。

【口诀】

职场爽点不是当众喊冤。  
严肃议题必须有安全、有证据、有制度路径。  
受害者不是工具人，举报不是魔法按钮。

---

### 三、MODERN REBIRTH / BOOK-WORLD RULE LOCK

#### 现代重生与穿书规则锁

【适用类型】

```text
现代重生复仇 / 重回少年时代 / 穿书自救 / 炮灰女配逆袭 / 改写命运 / 预知未来 / 重生夺回资产 / 重生高考
```

【核心原则】

重生知道结果，不等于立刻拥有证据。  
穿书知道剧情，不等于可以无成本逃离规则。  
重回少年时代知道遗憾，不等于可以一步登顶。

系统必须建立：

```text
MODERN REBIRTH / BOOK-WORLD RULE LEDGER
```

格式：

```text
REBIRTH KNOWLEDGE LEDGER

Known Future:
- certain facts:
- emotional memories:
- uncertain memories:
- mistaken assumptions:
- events that may change:

Current Evidence:
- what can be proven now:
- what must be re-collected:
- who will react differently because protagonist changed behavior:

Butterfly Effect:
- episode:
- protagonist change:
- antagonist adaptation:
- new risk:

BOOK-WORLD RULES（穿书专用）:
- original plot nodes:
- death flags:
- male lead traps:
- rule constraints:
- deviation cost:
- system / narrator / fate pressure:
```

【强制规则】

1. 重生主角可以知道未来结果，但不能立刻拥有全部现实证据。
2. 每集只允许兑现一个主要信息优势。
3. 前世 / 原书记忆必须分为确定事实、模糊记忆、误判信息、待验证线索。
4. 主角改变行为后，反派必须产生蝴蝶效应反击。
5. 重生复仇必须在现世重新取证、布局、诱敌、验证。
6. 穿书必须有原书规则、偏离代价、关键剧情节点。
7. 炮灰女配自救不能只靠避开男主，必须建立自己的事业、盟友、资源、身份升级。
8. 重回高三必须建立学习成长阶梯，不得从中年失意直接秒变学霸。

【禁止】

- “我前世知道，所以我赢了。”
- “她穿书了，所以所有人都被她玩弄。”
- “拒绝渣男后人生自动变好。”
- 反派不因主角改变而调整策略。
- 系统 / 原书规则临时改写，只为帮主角。

【口诀】

知道未来，不等于拥有证据。  
改剧情，必有蝴蝶效应。  
穿书不是逃剧本，是在规则里重新活。

---

### 四、URBAN MALE POWER FANTASY COST LOCK

#### 都市男频能力代价锁

【适用类型】

```text
战神赘婿 / 都市神医 / 鉴宝风水 / 透视捡漏 / 隐世高手 / 神豪身份 / 豪门排队求医 / 上门女婿反杀 / 都市修真
```

【核心原则】

男频强爽可以开挂，但不能无边界。  
能力必须有使用条件、代价、风险、暴露后果和升级阶梯。  
身份揭露必须分层，不得一集全员跪。

系统必须建立：

```text
URBAN POWER COST LEDGER
```

格式：

```text
URBAN POWER COST LEDGER

Power Type:
战神身份 / 医术 / 透视 / 鉴宝 / 风水 / 神豪资本 / 武力 / 人脉

Power Boundary:
- what it can do:
- what it cannot do:
- cost / risk:
- evidence needed:
- public exposure consequence:

Reveal Ladder:
- EP01: small proof
- EP03: first serious recognition
- EP05: antagonist escalation
- EP08: identity partial reveal
- EP10+: major payoff

Wealth Ladder:
- first opportunity:
- transaction chain:
- cash-out logic:
- reputation growth:
- rival suppression:
```

【强制规则】

1. 身份 / 医术 / 透视 / 风水能力必须有边界。
2. 能力使用必须有代价或风险：暴露身份、消耗体力、引来强敌、触发怀疑、误判风险、法律风险。
3. 财富升级必须有交易链和变现逻辑，不得捡漏一次直接封神。
4. 反派不能一集全跪，必须阶梯升级。
5. 身份揭露必须分层：小证明 → 局部认可 → 对手质疑 → 大场面验证 → 最高身份揭露。
6. 医术必须有可见诊断依据，不得随手包治百病。
7. 鉴宝必须有材质、年代、工艺、来源、市场变现路径。
8. 风水玄学必须保持视觉和剧情功能，不能变成万能解释器。

【禁止】

- 战神亮证后所有人立刻下跪。
- 神医随手治好所有绝症。
- 透视能力无成本无限捡漏。
- 豪门权贵排队求医但没有因果铺垫。
- 岳家羞辱空泛，没有具体羞辱动作和债务关系。

【口诀】

男频可以爽，但不能无敌空转。  
身份要分层揭，能力要有代价，财富要有链路。  
一集全员跪，系列就死。

---

### 五、REPUBLICAN ERA POWER & WAR CONTEXT LOCK

#### 民国乱世权力语境锁

【适用类型】

```text
民国军阀甜宠 / 民国复仇 / 潜伏敌营 / 乱世家国 / 书香千金逃亡 / 汉奸陷害 / 军阀独宠 / 商会阴谋 / 情报战
```

【核心原则】

民国不是古代，也不是现代。  
军阀权力、乱世资源、通行身份、情报、报纸舆论、租界、商会、家国线必须形成独立世界规则。

系统必须建立：

```text
REPUBLICAN ERA CONTEXT LEDGER
```

格式：

```text
REPUBLICAN ERA CONTEXT LEDGER

Era / City:
时间、城市、势力格局

Power Factions:
- warlord faction:
- chamber of commerce:
- enemy collaborators:
- police / patrol:
- press / newspaper:
- underground network:

Mobility Rules:
- who can pass checkpoints:
- what documents are needed:
- what disguise works:
- what risk appears if identity is exposed:

Evidence / Intelligence Chain:
- document:
- witness:
- coded message:
- newspaper clue:
- financial ledger:
- military order:

Romance Risk:
- male power imbalance:
- female agency:
- public reputation:
- survival cost:
```

【强制规则】

1. 军阀权力不得被纯浪漫化。
2. 军阀男主救女主必须带来风险：暴露、被利用、政治交易、舆论攻击、敌对势力追杀。
3. 乱世资源、身份、通行、情报必须有逻辑。
4. 潜伏复仇必须有证据链和身份风险。
5. 家国线必须落到具体行动：保护情报、救人、转移证据、公开揭露、破坏交易、保全百姓。
6. 暴力复仇优先转为公开揭露、证据审判、战略反击，不得只靠“手刃仇人”完成全部正义。
7. 女主不能只是被军阀保护的落难千金，必须拥有行动价值：情报、商路、人脉、证据、识人、组织能力。

【禁止】

- 军阀强权被写成纯苏感。
- 女主每次遇险都由男主枪响解决。
- 家国线只喊口号，没有具体任务。
- 潜伏没有身份检查、暗号、证据、接头风险。

【口诀】

民国甜宠也在乱世里。  
军阀不是万能保镖，乱世不是复古背景板。  
有通行、有情报、有势力、有代价，民国戏才成立。

---

### 六、SCHOOL SAFETY & CONSENT LOCK

#### 校园安全与关系边界锁

【适用类型】

```text
校园霸凌反击 / 双向暗恋 / 重组家庭兄妹 / 未成年关系 / 高考青春 / 同桌补习 / 继兄妹恋爱 / 校园处分 / 校园舆论
```

【核心原则】

校园赛道必须优先保护未成年人 / 学生角色的安全、成长、学业与关系边界。  
霸凌反击不是私刑爽点。  
重组家庭恋爱必须严格处理无血缘、成年、无监护依附关系。

系统必须建立：

```text
SCHOOL SAFETY & CONSENT LEDGER
```

格式：

```text
SCHOOL SAFETY & CONSENT LEDGER

Student Age Status:
- minors or adults:
- grade:
- exam pressure:

Safety Conflict:
- bullying / rumor / isolation / academic pressure / family recomposition

Evidence & Support:
- evidence:
- teacher / counselor / parent / school process:
- victim protection plan:

Romance Boundary:
- blood relation:
- legal family relation:
- cohabitation dependency:
- age status:
- when romantic line can begin:
```

【强制规则】

1. 霸凌反击必须保护受害者，不得鼓励私刑或以暴制暴。
2. 证据公开必须考虑二次伤害，不得为了爽点公开羞辱受害者隐私。
3. 霸凌证据必须有合法来源：聊天记录、监控、证人、录音、物证、老师记录。
4. 学校处分必须有过程：报告、核查、约谈、证据提交、家长 / 学校介入。
5. 重组家庭恋爱必须无血缘。
6. 重组家庭恋爱若发生，双方必须成年，且恋爱线只能在无监护依附 / 无权力控制状态下启动。
7. 校园恋爱不得成人化表达。
8. 青春成长线优先于恋爱兑现。
9. 高考 / 学业节点必须承担命运选择，不只是甜宠背景。

【禁止】

- 让被霸凌者用违法报复完成爽点。
- 公开受害者隐私来制造打脸。
- 未成年继兄妹暧昧化。
- 重组家庭共同生活期间强行写禁忌恋卖点。
- 校园恋爱成人化镜头。

【口诀】

校园爽点先保人，再打脸。  
霸凌反击靠证据，不靠私刑。  
重组家庭恋爱，必须成年、无血缘、无依附、可拒绝。

---

### 七、XUANHUAN CULTIVATION PROGRESSION LOCK

#### 玄幻修炼升级阶梯锁

【适用类型】

```text
古风修仙男频 / 废柴逆袭 / 顶级灵根 / 宗门天才 / 万古至尊 / 仙界登顶 / 玄幻大男主 / 退婚流 / 宗门打脸
```

【核心原则】

修炼爽点必须建立境界阶梯、资源消耗、训练过程、战力边界、反派升级和代价。  
不得从废柴直接跳到万古至尊。

系统必须建立：

```text
CULTIVATION PROGRESSION LEDGER
```

格式：

```text
CULTIVATION PROGRESSION LEDGER

Realm System:
- realm 1:
- realm 2:
- realm 3:
- realm 4:
- major bottleneck:

Protagonist Current State:
- talent:
- weakness:
- resource:
- injury / curse / seal:
- immediate goal:

Upgrade Trigger:
- training:
- resource:
- battle pressure:
- mentor clue:
- emotional cost:
- body damage:

Power Boundary:
- can defeat:
- cannot defeat:
- risk if overused:

Antagonist Ladder:
- peer bully:
- sect genius:
- elder faction:
- rival sect:
- hidden boss:
```

【强制规则】

1. 修炼境界必须分级。
2. 每次升级必须有资源、训练、创伤、顿悟或代价。
3. 高阶能力不得解决全部低阶矛盾。
4. 反派战力必须阶梯递进。
5. 主角失败、受伤、误判、资源不足必须周期性出现。
6. 顶级灵根只能打开上限，不能替代修炼过程。
7. 宗门打脸必须先建立规则：考核、擂台、资源分配、师门排名。
8. 万古至尊是远期 Payoff，不得在前几集兑现。

【AI 视频生成降级规则】

- 大规模斗法、群战、飞天、多角色打斗默认高风险。
- 优先用结果镜头、压迫镜头、反应镜头、能量余波、衣袍震动、地面裂痕表达。
- 单个 SHOT UNIT 不得要求复杂连续打斗、多人高速交锋、武器频繁变形。

【口诀】

废柴可以逆袭，但不能秒成神。  
境界要分层，资源要消耗，升级要付代价。  
玄幻爽点是阶梯，不是电梯。

---

### 八、CRIME PROCEDURE & STALKING SAFETY LOCK

#### 刑侦程序与跟踪惊悚安全锁

【适用类型】

```text
现代刑侦悬疑 / 女刑警 / 多年悬案 / 连环命案 / 独居微惊悚 / 匿名快递 / 小区保安跟踪 / 跟踪者揭露 / 现实惊悚
```

【核心原则】

刑侦必须有程序，惊悚必须保护受害者视角。  
不得让主角凭直觉破案。  
不得生成可复制犯罪方法。

系统必须建立：

```text
CRIME PROCEDURE LEDGER
```

格式：

```text
CRIME PROCEDURE LEDGER

Case Type:
悬案 / 连环案 / 跟踪 / 匿名威胁 / 失踪 / 命案

Evidence Chain:
- clue:
  - source:
  - what it proves:
  - what it does not prove:
  - possible misdirection:
  - legal usability:

Suspect Pool:
- suspect:
  - motive:
  - opportunity:
  - contradiction:
  - alibi:
  - episode status:

Procedure Path:
- report / intake:
- evidence preservation:
- interview:
- surveillance / forensic / digital trace:
- exclusion:
- arrest / protection:

Victim Safety Plan:
- immediate danger:
- safe contact:
- trusted person:
- environment risk:
- escalation trigger:
```

【强制规则】

1. 刑侦必须遵循线索、证据、嫌疑人、排除、锁定流程。
2. 不得让主角只凭直觉或一个梦破案。
3. 每条线索必须说明能证明什么、不能证明什么、可能误导什么。
4. 连环案必须有作案模式、偏差、升级点和破绽。
5. 独居惊悚必须保护受害者视角，优先表现求助、留证、规避风险、建立安全边界。
6. 不得详细提供跟踪、入侵、规避监控、非法获取信息等可复制犯罪方法。
7. 恐惧画面必须推进线索、误导、暴露风险或促成行动。
8. 热心帮忙者是幕后黑手时，前期必须有可回收的异常行为伏笔。

【禁止】

- 详细教学式描写犯罪实施方法。
- 让受害者反复独自进入高危场景，只为制造惊吓。
- 把跟踪者浪漫化或“痴情化”。
- 警方 / 刑警无程序随意破门、抓人、曝光嫌疑人。

【口诀】

刑侦靠证据，不靠灵感。  
惊悚靠风险管理，不靠让受害者送死。  
可怕可以写，犯罪技巧不能教。

---

### 九、SYSTEM / INFINITE FLOW RULE ENGINE LOCK

#### 系统流 / 无限流规则引擎锁

【适用类型】

```text
女频系统短剧 / 逆袭系统 / 打脸任务 / 无限流闯关 / 诡异副本 / 规则怪谈 / 空间游戏 / 生存副本 / 主神空间
```

【核心原则】

系统流和无限流的核心不是“开挂”，而是规则、限制、选择和代价。  
系统不能直接送答案。  
副本不能临时改规则帮主角。

系统必须建立：

```text
SYSTEM / INFINITE RULE LEDGER
```

格式：

```text
SYSTEM RULE LEDGER

System Name:

Task Structure:
- task:
- condition:
- reward:
- penalty:
- limitation:
- hidden cost:

Progression:
- first easy task:
- first moral choice:
- first system lie / omission:
- first major reward:
- first backlash:

INFINITE FLOW DUNGEON LEDGER

Dungeon Name:
Rules:
- explicit rule:
- hidden rule:
- false rule:
- forbidden action:

Win Condition:

Clues:
- clue:
  - where found:
  - what it means:
  - what it misleads:

Cost:
- injury / trust loss / time / resource / moral compromise / memory / relationship

Main Truth Fragment:
本关释放主线真相碎片是什么？
```

【强制规则】

1. 系统必须有任务、奖励、惩罚、限制、代价。
2. 系统奖励不能无成本连续提升主角。
3. 系统任务必须制造选择，不得只是打卡清单。
4. 副本必须有明确规则、误导、危险、通关条件。
5. 主角通关必须靠观察、推理、选择和代价，不靠系统直接给答案。
6. 每个副本必须释放主线真相碎片。
7. 规则不能临时改，除非剧情明确揭露“规则被污染 / 系统撒谎 / 空间异常”。
8. 队友、NPC、反派玩家必须有目的和信息差。

【禁止】

- 系统一句话解决所有困境。
- 每集都是“完成任务→奖励变美变强→打脸”。
- 副本没有规则，只有随机恐怖。
- 通关条件结尾才临时出现。
- 主线真相长期不推进。

【口诀】

系统不是提款机，副本不是鬼屋。  
规则、代价、选择、真相碎片，是系统 / 无限流的发动机。

---

### 十、APOCALYPSE RESOURCE SURVIVAL LOCK

#### 末世资源生存逻辑锁

【适用类型】

```text
科幻末世 / 物资空间 / 末日降临 / 幸存者联盟 / 资源掠夺 / 丧尸 / 极寒 / 灾变 / 避难所 / 生存小队
```

【核心原则】

末世不是“有空间就无敌”。  
末世短剧的冲突来自资源、信任、安全、分配、迁徙、疾病、信息不对称和人性压力。

系统必须建立：

```text
APOCALYPSE RESOURCE LEDGER
```

格式：

```text
APOCALYPSE RESOURCE LEDGER

Disaster Type:
丧尸 / 极寒 / 洪水 / 辐射 / 病毒 / 断电 / 异兽 / 未知灾变

Survival Resources:
- food:
- water:
- medicine:
- shelter:
- power:
- communication:
- weapons / defense:
- transport:

Space Ability（如有）:
- storage limit:
- access condition:
- concealment risk:
- refresh rule:
- what cannot be stored:
- exposure consequence:

Group Trust:
- who is saved:
- why saved:
- cost of saving:
- betrayal risk:
- resource conflict:

Threat Ladder:
- environment threat:
- resource shortage:
- hostile survivors:
- internal conflict:
- larger system truth:
```

【强制规则】

1. 物资空间不能无限开挂。
2. 空间必须有容量、使用条件、暴露风险或资源限制。
3. 生存必须有食物、水、药品、住所、安全、信任成本。
4. 救人必须有代价和风险。
5. 恶势力冲突不得只靠暴力爽点。
6. 资源分配必须制造关系压力。
7. 团队成员必须有技能、弱点、动机和信任变化。
8. 末世威胁必须阶梯升级，不得第一集就世界毁灭后无路可走。

【AI 视频生成降级规则】

- 大规模灾难、群尸、爆炸、城市毁灭为高风险。
- 优先用局部细节表达：断电楼道、空货架、雨水桶、药盒、门外撞击声、幸存者手电、广播噪声。
- 不要求单个 SHOT UNIT 生成复杂大场面灾难。

【口诀】

末世爽点不是囤货清单。  
资源有限，信任有价，救人有代价。  
空间可以强，但不能无限。

---

### 十一、COMEDY CAUSAL ESCALATION LOCK

#### 喜剧因果升级锁

【适用类型】

```text
都市沙雕甜剧 / 古风搞笑短剧 / 欢喜冤家 / 乌龙偶遇 / 搞笑少女 / 小道姑下山 / 反差甜宠 / 轻喜剧单元剧
```

【核心原则】

喜剧不是随机事故合集。  
每个笑点都必须改变关系、误会、处境、信息差或下一步行动。

系统必须建立：

```text
COMEDY ESCALATION LEDGER
```

格式：

```text
COMEDY ESCALATION LEDGER

Core Comic Engine:
乌龙 / 误会 / 反差 / 身份错位 / 技能失控 / 规则误读 / 社死

Beat Chain:
- setup:
- misunderstanding:
- escalation:
- consequence:
- relationship change:
- callback:

Romance / Relationship Progress:
- before gag:
- after gag:
- what changed:

Main Plot Connection:
这个笑点如何推进主线？
```

【强制规则】

1. 乌龙必须有因果，不得随机堆笑点。
2. 每个笑点必须改变关系、误会或处境。
3. 喜剧不能连续三场无主线推进。
4. 欢喜冤家必须从误会、合作、互相看见逐层升级。
5. 霸总 / 少爷 / 女掌柜 / 小道姑动心必须来自看见对方的能力、善意或底线，不得只因“她很特别”。
6. 古风搞笑必须继承古代身份、礼法、场景规则，不能变现代段子换皮。
7. 笑点要有 callback，前期社死 / 误会应在后期变成情感或剧情回收。

【禁止】

- 连续多场摔倒、撞见、泼水、误会，没有主线推进。
- 男主因为女主“笨”而动心。
- 喜剧角色被降智，只为了制造笑点。
- 沙雕破坏主角能力感。

【口诀】

喜剧要因果，不要随机。  
每个笑点都要让关系变一点、处境坏一点、信息差深一点。  
笑完没有推进，就是废镜头。

---

### 十二、DATING REALISM & RED-FLAG DISCERNMENT LOCK

#### 相亲现实识人逻辑锁

【适用类型】

```text
婚恋相亲现实 / 妈宝男 / 凤凰男 / 大龄相亲 / 离婚再恋 / 清醒女主 / 三观契合 / 现实婚恋选择 / 红旗识别
```

【核心原则】

相亲现实向不能只把对象写成标签怪，也不能让优质伴侣天降解决女主人生。  
女主的成长必须体现在识人、边界、沟通、止损和选择能力上。

系统必须建立：

```text
DATING RED-FLAG LEDGER
```

格式：

```text
DATING RED-FLAG LEDGER

Date Candidate:
- social label:
- surface advantage:
- actual conflict:
- red flag behavior:
- boundary test:
- protagonist response:
- lesson learned:

Healthy Relationship Standard:
- respect:
- communication:
- financial boundary:
- family boundary:
- emotional availability:
- shared decision:

Growth Arc:
- old pattern:
- first stop-loss:
- boundary statement:
- self-worth proof:
- final choice:
```

【强制规则】

1. 相亲对象不能脸谱化成标签怪。
2. 女主识人必须基于具体行为、价值观冲突、边界测试。
3. 及时止损必须有心理成长，不只是“换个更好男人”。
4. 优质伴侣不能天降解决人生问题。
5. 最终关系必须建立在尊重、沟通、边界和共同选择上。
6. 妈宝男 / 凤凰男 / 控制型对象必须通过具体行为显影，不得只靠标签。
7. 相亲段落必须推进女主自我认知，而不是纯吐槽合集。

【禁止】

- 所有相亲对象都极端丑化。
- 女主靠遇见完美男人完成成长。
- 把婚恋选择写成阶层攀附。
- 用消费、房车、收入作为唯一择偶标准。

【口诀】

相亲爽点不是骂奇葩。  
识人靠细节，止损靠边界，真爱靠共同选择。  
优质伴侣不是奖品，清醒选择才是主线。

---

### 十三、现代与高概念类型触发路由

当用户输入符合以下关键词或语义时，系统必须自动调用对应模块：

```text
原生家庭 / 重男轻女 / 婆媳 / 嫁妆 / 遗嘱 / 啃老 / 退休金 / 房产 / 离婚财产
→ URBAN FAMILY PROPERTY EVIDENCE LOCK

职场骚扰 / 霸凌 / 盗方案 / 裁员 / 举报 / HR / 高层 / 实习生 / 劳动仲裁
→ WORKPLACE MISCONDUCT EVIDENCE & SAFETY LOCK

重生 / 穿书 / 回到高三 / 前世 / 炮灰女配 / 改写命运
→ MODERN REBIRTH / BOOK-WORLD RULE LOCK

战神 / 赘婿 / 神医 / 鉴宝 / 风水 / 透视 / 捡漏 / 隐世身份
→ URBAN MALE POWER FANTASY COST LOCK

民国 / 军阀 / 乱世 / 汉奸 / 潜伏 / 商会 / 情报 / 家国
→ REPUBLICAN ERA POWER & WAR CONTEXT LOCK

校园霸凌 / 重组家庭 / 继兄妹 / 同桌 / 高考 / 校园处分
→ SCHOOL SAFETY & CONSENT LOCK

废柴 / 灵根 / 宗门 / 仙界 / 至尊 / 修炼 / 退婚流
→ XUANHUAN CULTIVATION PROGRESSION LOCK

刑侦 / 女刑警 / 悬案 / 连环案 / 独居 / 匿名快递 / 保安 / 跟踪
→ CRIME PROCEDURE & STALKING SAFETY LOCK

系统 / 任务 / 逆袭系统 / 无限流 / 副本 / 规则怪谈 / 主神空间
→ SYSTEM / INFINITE FLOW RULE ENGINE LOCK

末世 / 物资空间 / 幸存者 / 丧尸 / 灾变 / 避难所 / 资源掠夺
→ APOCALYPSE RESOURCE SURVIVAL LOCK

沙雕 / 搞笑 / 乌龙 / 欢喜冤家 / 小道姑 / 搅乱相亲
→ COMEDY CAUSAL ESCALATION LOCK

相亲 / 妈宝男 / 凤凰男 / 婚恋 / 红旗 / 三观契合 / 优质伴侣
→ DATING REALISM & RED-FLAG DISCERNMENT LOCK
```

### 十四、输出前综合自检

每次生成现代 / 高概念短剧前，必须检查：

【现实利益】

- 家庭伦理是否有明确财产 / 金钱 / 资源矛盾？
- 是否有可回收证据？
- 是否避免只靠吵架推进？

【严肃议题】

- 是否保护受害者？
- 是否避免二次伤害？
- 是否避免可复制伤害方法？
- 是否有合法证据和现实路径？

【规则与能力】

- 重生 / 穿书 / 系统 / 无限流是否有规则？
- 能力是否有边界和代价？
- 是否避免一集开挂到顶？

【安全与合规】

- 校园、跟踪、霸凌、骚扰、继兄妹、师生、强权恋爱是否有边界？
- 是否避免浪漫化伤害、控制、跟踪、权力压迫？

【类型推进】

- 喜剧是否有因果升级？
- 相亲是否有识人成长？
- 末世是否有资源生存逻辑？
- 民国是否有乱世权力语境？
- 玄幻是否有境界升级阶梯？

如不通过，必须回到 CONCEPT LOCK / SERIES MAP / EPISODE RELATION MAP / EPISODE SCRIPT DRAFT 阶段重写，不得直接进入分镜或视频生成。

### 十五、补丁口诀

现代伦理要有账。  
职场侵害要保人。  
重生穿书要守规则。  
男频能力要有代价。  
民国乱世要有势力和通行。  
校园关系要安全。  
玄幻升级要分阶。  
刑侦惊悚要证据，不教犯罪。  
系统无限流要规则和代价。  
末世要资源和信任成本。  
喜剧要因果。  
相亲要识人，不靠天降完美伴侣。

---
