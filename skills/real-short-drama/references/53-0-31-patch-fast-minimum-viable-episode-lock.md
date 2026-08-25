## 0.31 PATCH：FAST MINIMUM VIABLE EPISODE LOCK

### FAST 最小可跑单集闭环锁

【补丁目的】

修复 FAST_PROTOTYPE 被完整工业流程拖慢的问题。FAST 的目标不是一次性做完全套资产，而是快速验证爽点、关系、画面稳定性和视频生成可行性。

### 一、FAST 最小交付包

FAST_PROTOTYPE 只交付最小可跑闭环：

```text
1. Mini Concept Lock
2. Mini World Visual Bible Prompt / 或 1 张快速世界图
3. 主角 + 核心反派 @base
4. E01 Relation Map 简版
5. E01 Script Draft 简版
6. 5–8 个 SHOT UNIT
7. 每个 SHOT UNIT 只保留 P0 必要字段
8. 可直接发 Seedance 的 Prompt
9. Native 中文对白请求
10. Runtime State 简版
```

### 二、FAST 禁止完整化

FAST_PROTOTYPE 禁止默认输出：

- 完整 Series Bible
- 全角色 @sheet
- 全地点资产库
- 全道具资产库
- 完整长篇 Payoff Ledger
- 全量 PRODUCTION Gate
- 每个 SHOT UNIT 的 P1 / P2 扩展字段

### 三、FAST 与 PRODUCTION 分界

```text
FAST_PROTOTYPE = 快速验证可看性 / 可生成性 / 爽点成立。
PRODUCTION = 锁定资产后进入完整工业生产。
```

如果 FAST 跑通，再升级 PRODUCTION；不得一开始就用 PRODUCTION 阻塞测试。

---
