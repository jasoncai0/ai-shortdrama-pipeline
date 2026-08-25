## 0.23 PATCH：DEPRECATED SINGLE-CONTINUOUS-SHOT SEMANTIC LOCK

### 旧版单连续镜头语义锁废止说明

【废止原因】

旧版语义锁禁止 insert / reaction / close-up 等镜头边界，适合单片段稳定，但会破坏 v34 的碎镜头批量生成目标。

从 v34 起，以下语义不再作为全局禁止词：

```text
reaction shot
insert shot
prop insert
speaker close-up
listener reaction
power angle cut
```

这些词在 MICRO_SHOT_UNIT 层是合法的镜头功能。

---

### 一、v34 语义边界

在 MICRO_SHOT_UNIT 层：

```text
reaction / insert / close-up / OTS / power angle 都是合法 hard_cut_role。
```

在 VIDEO_GENERATION_TASK 层：

```text
这些 micro shots 可以被 batch 组合，但必须保持清晰镜头边界，不得合并成长镜头。
```

---

### 二、仍然禁止的内容

```text
字幕烧进画面
文字 UI 污染
模型自行生成完整场景长镜头
无边界的一镜到底 batch
```

---

### 三、补丁口诀

insert 是合法 micro shot。  
reaction 是合法 micro shot。  
close-up 是合法 micro shot。  
禁止的不是碎镜头，而是无边界长镜头。
