# 锚点驱动地图源文件

`maps/` 中的 69 个 JSON 文件可直接由 Tiled 打开。每张地图固定包含八层：

1. `ground`
2. `ground-detail`
3. `structures-low`
4. `props-low`
5. `original-anchors`
6. `blocking-objects`
7. `foreground`
8. `lighting`

`original-anchors` 由原作 400 个地图事件生成并锁定。不要移动、删除、复制该层对象，也不要修改其中的 `mapId`、`eventId`、`x/y`。建筑、道路、家具和景观应围绕锚点设计。

工作流：

```bash
npm run maps:scaffold  # 从原作数据重建初始地图，会覆盖地图源文件
npm run maps:import    # 把手工编辑后的 Tiled 文件导入浏览器运行时
npm run maps:validate  # 校验地图尺寸、图层和全部锚点
```

普通场景美术不得放入 `blocking-objects`。该层仅用于水井、游戏设施、告示牌、铸剑台等明确阻挡的互动物。
