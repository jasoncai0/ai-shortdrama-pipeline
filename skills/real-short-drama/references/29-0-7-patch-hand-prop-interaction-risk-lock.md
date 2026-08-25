## 0.7 PATCH：HAND & PROP INTERACTION RISK LOCK

### 手部与道具交互风险锁

【补丁目的】

修复 AI 真人短剧中手部畸形、拿物穿帮、道具比例错误、手指数量错误、物体悬浮、手与物体接触不真实等问题。

### 一、手部风险分级

所有涉及手部 / 道具交互的镜头必须标注 `Hand Prop Risk`。

```text
Hand Prop Risk = low / medium / high
```

低风险：

- 手自然下垂
- 手放在桌面
- 单手握住大物体
- 静态拿手机 / 文件 / 卡片

中风险：

- 手指按手机
- 递文件
- 拿杯子
- 拿钥匙
- 签字
- 戴戒指 / 摘眼镜

高风险：

- 双手复杂交叉
- 多人同时抢夺道具
- 快速打斗中的手部动作
- 倒酒、切菜、复杂餐具交互
- 精确手势
- 手部贴脸大特写持续运动

### 二、高风险降级规则

高风险手部动作必须自动降级为 AI 稳定表达。

降级方式：

- 用单手静态持物替代复杂双手交互。
- 用动作前 / 动作后结果替代动作全过程。
- 用遮挡、侧面、半身、道具近景降低手指暴露。
- 用反应镜头承接动作结果。
- 用 SFX 表达动作冲击，而不是强行生成复杂手部过程。

例：

错误：

```text
主角快速从反派手中抢过合同，翻页，拿笔签字，再甩回桌上。
```

正确：

```text
SHOT UNIT 1: 主角的手按住合同边缘，反派手停住。
SHOT UNIT 2: 文件已经被主角签好，主角把合同推回桌面，纸张与桌面有接触阴影。
SFX: 文件拍桌。
```

### 三、道具交互要求

所有手持道具必须满足：

- 道具尺寸合理。
- 手指数量正常。
- 手与道具有真实接触点。
- 道具不悬浮。
- 道具有接触阴影。
- 道具材质反映环境光。
- 道具状态在 `SCENE CONTINUITY LEDGER` 中登记。

### 四、Prompt 必须加入

涉及手部 / 道具的 keyframe 或 Seedance prompt 必须加入：

```text
natural hand anatomy, correct number of fingers, realistic grip, realistic contact between hand and prop, stable prop scale, accurate contact shadows, no floating objects, no twisted fingers, no extra fingers, no missing fingers
```

### 五、自检

- 是否有复杂手部动作？
- 是否标注 Hand Prop Risk？
- 高风险手部动作是否已降级？
- 道具是否登记在 Scene Continuity Ledger？
- 手与道具是否有真实接触和接触阴影？
- 是否避免多指、少指、扭曲手指？

---
