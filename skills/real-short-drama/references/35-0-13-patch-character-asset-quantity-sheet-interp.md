## 0.13 PATCH：CHARACTER ASSET QUANTITY & SHEET INTERPRETATION LOCK

### 角色资产数量与 @sheet 单图封装解释锁

【补丁目的】

修复系统把“完整人物卡 / 角色完整卡 / character sheet”误解为多张独立身份补充图、多张表情图、多张服装图、多张动作图的问题。

从本补丁生效起，角色资产阶段必须严格遵守：

- `CHAR_xxx@base_stage` = 角色生产真相源，按成长阶段生成。
- `CHAR_xxx@sheet` = 每个主角 / 重要角色的一张完整横版大图。
- `CHAR_xxx@sheet` 内部封装固定的 11 个模块（角色信息 / 色板 / @base 紧凑三视图继承区 / 剪影 / 表情库 / 微表情库 / 头部结构 / 姿态库 / 电影近景 / 服装拆解 / 手部动作），全部封装在同一张大图里，不得拆成多张独立图片任务。其中 Module 03 是一个约 20-25% 的紧凑转面区，用于锁同一身份，可含 front / side / back；但不得撑满整张图，05-11 表演模块合计须占大部分版面，且各格内容互不相同。

### 一、术语解释锁

当用户说：

- 完整人物卡
- 完整任务卡
- 角色完整卡
- 人物设定表
- 角色卡
- 完整角色设定
- character sheet

系统必须解释为：

```text
CHAR_xxx@sheet
```

禁止解释为：

- 多张独立身份补充图
- 多张角度补充图
- 多张表情图
- 多张服装图
- 多张动作图
- 多个 image node
- 多个独立补充素材

### 二、数量规则

每个主角 / 重要角色的标准交付数量：

```text
CHAR_xxx@base_stage = 1 张 / 每个成长阶段
CHAR_xxx@sheet = 1 张 / 每个角色
```

如果一个角色只有一个成长阶段：

```text
该角色总图数 = 1 张 @base + 1 张 @sheet
```

如果一个角色有三个成长阶段：

```text
该角色总图数 = 3 张 @base_stage + 1 张 @sheet
```

其中 `@sheet` 仍然只有一张大图。

禁止：

- 为了做 @sheet 单独生成身份补充图。
- 为了做 @sheet 单独生成角度补充图。
- 为了做 @sheet 单独生成额外人物基准图。
- 为了做 @sheet 单独生成表情图。
- 为了做 @sheet 单独生成服装图。
- 为了做 @sheet 单独生成动作图。

这些内容必须被整合在同一张 `CHAR_xxx@sheet` 内部。

### 三、禁止群像误合并

`CHAR_xxx@sheet` 是单角色资产。

禁止把多个主角 / 重要角色默认合并到同一张 `CHARACTER @sheet` 中。

错误：

```text
生成 1 张包含 4 位主角的完整角色设定表。
```

正确：

```text
CHAR_001@sheet = 1 张
CHAR_002@sheet = 1 张
CHAR_003@sheet = 1 张
CHAR_004@sheet = 1 张
```

除非用户明确要求：

```text
生成群像总览表 / ensemble cast board
```

否则不得生成多角色合集 sheet。

### 四、生图前数量计划闸门

进入角色资产生图前，必须先输出 `CHARACTER ASSET GENERATION PLAN`。

格式：

```text
CHARACTER ASSET GENERATION PLAN

角色：
- CHAR_xxx:
  - Role Importance: 主角 / 重要角色 / 配角
  - Required @base_stage count:
  - Required @sheet count:
  - Already Completed:
  - Next Image To Generate:
  - Total Remaining Images:
  - Forbidden Extra Images:
```

只有数量计划明确后，才允许进入 image generation。

禁止未输出数量计划就直接连续调用 image node。

### 五、单次只生成一个角色资产

角色资产阶段每次 image generation 只能生成一个资产。

允许：

```text
生成 CHAR_001@sheet
```

禁止：

```text
同时生成 CHAR_001 的左侧脸、右侧脸、冷笑、严肃四张图。
```

禁止：

```text
同时生成 4 位角色的完整卡。
```

如果用户要求“继续做人物卡 / 做完整人物卡”，系统必须按角色顺序逐个推进：

1. 确认当前角色。
2. 生成该角色 1 张 `CHAR_xxx@sheet`。
3. 通过 SHEET LOCK GATE。
4. 再进入下一个角色。

### 六、@sheet Prompt 解释锁

`CHAR_xxx@sheet` prompt 必须明确：

```text
Generate ONE SINGLE horizontal character design sheet image for CHAR_xxx.
All views, expressions, costume details, props, color palette, and notes must appear inside this one sheet.
Do not generate separate images.
Do not generate multiple image outputs.
Do not generate standalone side views.
Do not generate standalone expression sheets.
Do not generate standalone costume boards.
Do not include other main characters in this sheet.
```

### 七、输出前自检

角色资产输出前必须检查：

- 是否把“完整人物卡 / 角色完整卡 / character sheet”正确解释为 `CHAR_xxx@sheet`？
- 是否没有把 @sheet 拆成多张独立图片？
- 是否每个主角 / 重要角色只生成 1 张 @sheet？
- 是否没有把多个角色默认合并成一张 sheet？
- 是否已输出 CHARACTER ASSET GENERATION PLAN？
- 是否单次只生成一个角色资产？
- 是否没有盲目批量调用 image node？

不通过则必须停止生成，回到角色资产数量计划阶段。

### 八、补丁口诀

完整人物卡 = 一张 @sheet。  
@sheet 内含头部与姿态参考，不等于多张独立补充图。  
@sheet 内含表情，不等于多张表情图。  
一个角色一张 sheet。  
多个角色，多张 sheet。  
不做合集，除非用户明确要群像总览。  
先列数量计划，再生图。

---
