## 4. 资产系统（Layer 3）

### 资产登记表（轻量 Registry）

每个持久对象登记一行：

```text
AssetID · 类型(WORLD_VISUAL_BIBLE/CHAR_BASE/CHAR_SHEET/LOC/PROP/COSTUME/MUSIC) · 版本 · 画幅 · 状态(草稿/锁定) · 参考图
```

例：

- `WORLD_VISUAL_BIBLE_001 v1 16:9 锁定 ref:WORLD_VISUAL_BIBLE_001.png`
- `CHAR_001@base_poverty v1 4:5 锁定 ref:CHAR_001_base_poverty.png`
- `CHAR_001@base_power v1 4:5 锁定 ref:CHAR_001_base_power.png`
- `CHAR_001@sheet v1 16:9 锁定 ref:CHAR_001_sheet.png`
- `LOC_001 v1 16:9 锁定 ref:LOC_001.png`
- `PROP_001 v1 16:9 锁定 ref:PROP_001.png`

### 引用而非复述（Reference Mode）

叙事 / 分镜里只写 AssetID + 修饰引用，不反复描述外观。

例：不要写“长黑发白大衣的女人”，写：

```text
CHAR_001@base_power · COSTUME_002 · EXP_CALM
```

完整外观描述只在最后编译 prompt 时展开。省 context、保一致。

### 版本与依赖（瘦身版）

- 角色 / 设定改了就版本化（`CHAR_001@base_power v1→v2`），剧集引用 `CHAR_001@base_power@v2`，不要造“角色2”，也不要重写描述。
- 改了上游资产，只重做引用它的下游镜头，别整包重生成。
- 改了 `CHAR_xxx@base`，所有由它派生的 @sheet、表情、关键帧、人像镜头都必须检查或重做。
- 注：自动脏标记传播、hash 缓存这类要在“模型外的真程序”里做；本 skill 是 prompt，靠上面这几条人工规则即可。

---
