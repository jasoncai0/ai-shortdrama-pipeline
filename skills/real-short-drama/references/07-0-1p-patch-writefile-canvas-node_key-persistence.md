## 0.1P PATCH：WRITEFILE CANVAS NODE_KEY PERSISTENCE LOCK

### WriteFile 真实 Canvas 文本节点持久化锁

【补丁目的】

修复 v0.0.2 中“Canvas / 文件块模拟写盘”仍可能被误判为真实沉淀的问题。

从本补丁生效起，当前所有会被后续阶段引用的文本型生产产物，必须通过平台 `WriteFile` 创建真实 Canvas 文本节点，并获得 `node_key` 作为持久化凭证。

本补丁中的两个最高优先级关键锚点：

```text
WriteFile
node_key
```

含义：

```text
WriteFile = 创建真实 Canvas 文本节点的唯一合法写回动作
node_key = Canvas 文本节点真实存在、可被后续 agent 引用的唯一合法持久化凭证
```

---

### 一、最高原则

```text
NO WriteFile, NO Canvas node.
NO node_key, NO persistence.
NO node_key, NO downstream inheritance.
```

当前所有脚本、框架、分镜、关键帧说明、视频任务说明、EDL、状态快照等文本型生产内容，只有在满足以下条件后，才允许被视为已沉淀：

```text
1. 已通过 WriteFile 创建真实 Canvas 文本节点
2. 平台返回 node_key
3. node_key 已写入对应阶段状态
4. 下游引用时显式读取该 node_key
```

如果没有 `node_key`，即使对话里完整输出了 Markdown，也只能算：

```text
PREVIEW_ONLY
NOT PERSISTED
DOWNSTREAM_BLOCKED
```

---

### 二、适用范围

以下内容必须通过 `WriteFile` 创建真实 Canvas 文本节点：

```text
project_brief.md
story_framework.md
series_engine.md
ep01_beat_lock.md
character_function_map.md

visual/world_visual_bible.md
visual/world_visual_modules.md

assets/characters.md
assets/locations.md
assets/props.md
assets/costumes.md
assets/asset_registry.md

episodes/EP001_relation_map.md
scripts/EP001.md
storyboards/EP001_storyboard.md
production/EP001_footage_delivery_plan.md
keyframes/EP001_keyframes.md
video_tasks/EP001_video_tasks.md
edl/EP001_selects_edl.md
assembly/EP001_final_assembly_plan.md

state/runtime_state.md
state/confirmed_asset_snapshot.md
```

尤其强制：

```text
所有剧本框架内容：必须 WriteFile → node_key
所有脚本内容：必须 WriteFile → node_key
所有分镜内容：必须 WriteFile → node_key
所有视频任务内容：必须 WriteFile → node_key
```

---

### 三、Canvas 节点写回状态

所有文本型生产文件必须新增以下字段：

```text
CANVAS NODE WRITEBACK STATUS

Target File:
Expected Canvas Title:
Required Write Tool: WriteFile
WriteFile Called: yes / no
Canvas Text Node Created: yes / no
node_key:
Node Persistence Status:
- NODE_CONFIRMED / NODE_MISSING / NODE_PENDING

Can Be Used By Downstream:
- yes / no

If no:
- reason:
- required_next_action:
```

判定规则：

```text
If node_key is empty:
Canvas Text Node Created = no
Node Persistence Status = NODE_MISSING
Can Be Used By Downstream = no
```

只有：

```text
WriteFile Called: yes
Canvas Text Node Created: yes
node_key: non-empty
Node Persistence Status: NODE_CONFIRMED
```

才允许：

```text
Stage Completed: yes
Writeback Status: WRITEBACK_CONFIRMED
Can Enter Next Stage: yes
Can Be Used By Downstream: yes
```

---

### 四、WriteFile 强制调用规则

任何阶段完成时，如果产物会被后续阶段引用，系统必须执行：

```text
TEXT NODE CREATION PROTOCOL

1. Compile final Markdown content for the target production file.
2. Call WriteFile to create a real Canvas text node.
3. Receive node_key from the platform.
4. Write node_key into stage status and asset registry when applicable.
5. Only then mark the file as persisted.
```

禁止以下行为：

```text
只在聊天正文输出 Markdown
只写 “### 文件：xxx.md”
只输出代码块
只说“已写入”
只说“已保存”
只说“已沉淀到画布”
没有 node_key 就进入下一阶段
```

---

### 五、真实 Canvas 节点才是生产真相源

从本补丁生效起，生产真相源优先级如下：

```text
Priority 1: Canvas text node created by WriteFile + valid node_key
Priority 2: User-uploaded source file registered with explicit file id
Priority 3: Tool-created persistent artifact with stable id / path / url
Invalid: Chat markdown preview without node_key
Invalid: Conversation memory
Invalid: Plain text summary
Invalid: Prompt-only output
```

下游 agent / skill / prompt compiler / 视频任务只能合法引用：

```text
source_node_key
```

不得只引用：

```text
上一轮对话内容
用户看过的 Markdown
未落 Canvas 的文件块
未返回 node_key 的预览
```

---

### 六、文件路径与 node_key 映射表

每个项目必须维护 Canvas 节点映射表，写入 `state/canvas_node_registry.md` 或 `state/runtime_state.md`。

格式：

```md
# CANVAS NODE REGISTRY

## Narrative Framework Nodes

- project_brief.md:
  - node_key:
  - status: NODE_CONFIRMED / NODE_MISSING
- story_framework.md:
  - node_key:
  - status:
- series_engine.md:
  - node_key:
  - status:
- ep01_beat_lock.md:
  - node_key:
  - status:
- character_function_map.md:
  - node_key:
  - status:

## Visual Nodes

- visual/world_visual_bible.md:
  - node_key:
  - status:
- visual/world_visual_modules.md:
  - node_key:
  - status:

## Asset Nodes

- assets/characters.md:
  - node_key:
  - status:
- assets/locations.md:
  - node_key:
  - status:
- assets/props.md:
  - node_key:
  - status:
- assets/asset_registry.md:
  - node_key:
  - status:

## Episode Nodes

- scripts/EP001.md:
  - node_key:
  - status:
- storyboards/EP001_storyboard.md:
  - node_key:
  - status:
- keyframes/EP001_keyframes.md:
  - node_key:
  - status:
- video_tasks/EP001_video_tasks.md:
  - node_key:
  - status:
- edl/EP001_selects_edl.md:
  - node_key:
  - status:
```

规则：

- `node_key` 一旦登记，不得随意改写。
- 如果重新生成同一文件，必须更新对应 `node_key`，并标记旧 node 为 deprecated。
- 下游引用必须写明 `source_node_key`。
- 如果文件路径存在但 node_key 缺失，等同于未持久化。

---

### 七、下游引用门禁

进入任何下游阶段前，必须执行：

```text
CANVAS NODE INHERITANCE GATE

Requested Stage:
Required Source Files:
Required Source node_keys:
Existing node_keys:
Missing node_keys:
Can Read Canvas Nodes:
Is Entry Legal:
```

示例：

```text
Requested Stage: SCENE BREAKDOWN / STORYBOARD

Required Source Files:
- scripts/EP001.md
- assets/characters.md
- assets/locations.md
- assets/props.md

Required Source node_keys:
- scripts/EP001.md.node_key
- assets/characters.md.node_key
- assets/locations.md.node_key
- assets/props.md.node_key

Missing node_keys:
- scripts/EP001.md.node_key

Is Entry Legal: no
Return To: scripts/EP001.md WriteFile writeback
```

如果任一必要 `node_key` 缺失：

```text
Is Entry Legal: no
Stage Blocked: yes
Next Allowed Stage: missing source file WriteFile writeback
```

---

### 八、阶段完成口径更新

所有阶段完成回复必须从：

```text
Files Written / Updated:
- scripts/EP001.md
```

升级为：

```text
CANVAS NODES CREATED / UPDATED:
- scripts/EP001.md
  - WriteFile: called
  - node_key: {node_key}
  - status: NODE_CONFIRMED
```

如果没有获得 node_key，必须写：

```text
CANVAS NODE WRITEBACK FAILED / PENDING:
- scripts/EP001.md
  - WriteFile: not called / failed / unavailable
  - node_key: none
  - status: NODE_MISSING
  - downstream: blocked
```

禁止在缺少 node_key 时输出：

```text
STAGE COMPLETE
Files Written
Can Enter Next Stage
```

---

### 九、与 Markdown Preview 的关系

Markdown Preview 仍可作为用户审阅草稿，但必须降级：

```text
Markdown Preview = human-readable draft only
Canvas Text Node = production truth source
```

允许：

```text
先输出 Markdown Preview 供用户看。
用户确认后，调用 WriteFile 创建 Canvas 文本节点。
获得 node_key 后，阶段才算完成。
```

禁止：

```text
Markdown Preview 输出后，直接说已写入画布。
Markdown Preview 输出后，直接进入分镜。
Markdown Preview 输出后，后续 agent 直接引用聊天正文。
```

---

### 十、与 0.1O / 0.1O-1 的关系

`0.1O PRODUCTION FILE CONTRACT & CANVAS WRITEBACK LOCK` 规定生产内容必须文件化 / Canvas 化。

`0.1O-1 CANVAS WRITEBACK REALITY CHECK LOCK` 规定 Markdown 预览不等于真实写回。

本补丁进一步收紧：

```text
真实写回的唯一合法 Canvas 文本路径 = WriteFile
真实持久化凭证 = node_key
```

如果三者冲突，以本补丁为最高优先级。

原先任何类似：

```text
如果运行环境不支持真实写盘，用文件块模拟写盘。
```

必须改为：

```text
如果无法调用 WriteFile 或无法获得 node_key，只能输出 Markdown Preview；
该阶段必须标记为 NODE_MISSING / WRITEBACK_PENDING；
不得进入依赖该节点的下游阶段。
```

---

### 十一、失败判定

出现以下任一情况，判定持久化失败：

- 只输出 Markdown，没有调用 `WriteFile`。
- 调用了 `WriteFile`，但没有返回 `node_key`。
- 返回了普通文本，但没有 Canvas 文本节点。
- 只声称“已写入画布”，但未给出 `node_key`。
- 下游引用文件路径，但没有引用 `source_node_key`。
- 分镜阶段没有脚本 `node_key`。
- 视频任务阶段没有分镜 / keyframes / asset_registry 的 `node_key`。
- `node_key` 为空、占位、伪造或无法定位。
- 旧 node_key 对应内容已被上游修改，但未标记 deprecated / review required。

失败后必须输出：

```text
NODE WRITEBACK FAILURE

Target File:
Required Tool: WriteFile
node_key:
Failure Reason:
Stage Completion: blocked
Next Allowed Stage:
```

---

### 十二、补丁口诀

WriteFile 才能创建真实 Canvas 文本节点。  
node_key 才是持久化凭证。  
没有 node_key，就没有沉淀。  
没有 node_key，不进分镜。  
没有 node_key，不进视频任务。  
Markdown 只是预览，不是生产真相。  
脚本要进分镜，先拿 scripts/EP001.md 的 node_key。  
分镜要进视频，先拿 storyboards/EP001_storyboard.md 的 node_key。  
下游只认 source_node_key，不认聊天记忆
PREDECESSOR NODE GATE 必须在下游阶段前执行
没有 LOCATION / PROP / SCENE BREAKDOWN 的 node_key，不得进入关键帧。
