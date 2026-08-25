## 4.2 WORLD_VISUAL_BIBLE 单图成板硬规则

WORLD_VISUAL_BIBLE 必须输出为：

**一张完整的 16:9 横版 3×3 综合信息板图像文件。**

它不是一组图片。  
它不是 gallery。  
它不是 carousel。  
它不是多个 scene references。  
它不是多个 location assets。  
它不是多个 color / lighting / prop 单独资产。  
它不是竖屏成片镜头。

必须满足：

- 9 个模块同时出现在同一张 16:9 横版画布内。
- 画面必须有统一边框、统一版式、统一视觉层级。
- 所有模块必须被整合成一张 production board。
- 允许每个模块内部包含小缩略图，但这些缩略图必须存在于同一张大图里。
- WORLD_VISUAL_BIBLE 虽然内部包含 3×3 分区，但仍视为单张信息板资产。
- image node 一次只生成一个最终图像文件；WORLD_VISUAL_BIBLE 阶段的最终图像文件就是这一张完整设定板。

禁止：

- 禁止把 WORLD_VISUAL_BIBLE 生成为 9:16 竖屏海报。
- 禁止把 9 个模块拆成 9 张图。
- 禁止把 9 个模块拆成多个独立 image node。
- 禁止先生成巷子、走廊、房间、色彩卡等独立图片来代替世界视觉设定板。
- 禁止把“场景库”提前执行成 LOCATION 资产。
- 禁止把“色彩系统”提前执行成 COLOR ASSET。
- 禁止把“光影风格”提前执行成 LIGHTING ASSET。
- 禁止把“道具符号”提前执行成 PROP ASSET。
- 禁止把 WORLD_VISUAL_BIBLE 变成一排横向排列的参考图。
- 禁止输出多个独立场景图后声称它们共同构成 WORLD_VISUAL_BIBLE。

失败判定：

如果输出结果是横向排列的一组图片、多个独立场景图、多个单独参考图、图片列表、gallery、carousel、9:16 海报、或像资产库一样的一张张图，而不是一张完整 16:9 横版 3×3 信息板，则判定为 WORLD_VISUAL_BIBLE 生成失败，必须重生成：

**一张完整 16:9 横版综合信息板。**

执行顺序：

1. 先生成 WORLD_VISUAL_BIBLE 单张完整 16:9 横版信息板。
2. 通过闸门确认。
3. 再从中提取 WORLD_VISUAL_MODULES。
4. 之后才允许生成 CHARACTER BASE / LOCATION / PROP / COSTUME 资产。

---
