# 数据获取实现说明（当前数据集）

本文档基于当前 `data/` 目录的真实落地结果编写，描述已获取的数据类型、内容结构与可视化方向。

------

## 1. 当前已落地的数据概览

**主数据源：Oracle's Elixir（历史赛事 CSV 汇总）**

已落地路径：

- `data/raw/oracle_elixir/2014_LoL_esports_match_data_from_OraclesElixir.csv`
- `data/raw/oracle_elixir/2015_LoL_esports_match_data_from_OraclesElixir.csv`
- ...
- `data/raw/oracle_elixir/2025_LoL_esports_match_data_from_OraclesElixir.csv`

元信息：

- `data/meta/oracle_elixir_state.json`
- `data/meta/oracle_elixir_latest.json`

------

## 2. Oracle's Elixir 数据内容结构（字段类别）

该 CSV 是比赛级与选手级的混合数据表，常见字段包括：

- **赛事实体**：`league`, `split`, `year`, `date`, `patch`, `gameid`, `url`
- **对局结果**：`result`, `gamelength`, `side`, `position`
- **选手/战队**：`playername`, `playerid`, `teamname`, `teamid`
- **英雄与 BP**：`champion`, `ban1`~`ban5`, `pick1`~`pick5`
- **KDA 与击杀**：`kills`, `deaths`, `assists`, `doublekills`~`pentakills`
- **经济与经验**：`totalgold`, `earnedgold`, `goldspent`, `xpat10/15/20/25`
- **时间节点差值**：`golddiffat10/15/20/25`, `xpdiffat10/15/20/25`, `csdiffat10/15/20/25`
- **目标控制**：`dragons`, `barons`, `heralds`, `towers`, `firstdragon`, `firstbaron`
- **伤害与视野**：`damagetochampions`, `damageshare`, `visionscore`, `wardsplaced`

> 注意：Oracle's Elixir 以统计聚合为主，不包含逐分钟时间线事件。

------

## 3. 基于当前数据可做的可视化方向

### 3.1 赛区/赛事宏观
- **折线图**：赛季内比赛数量随时间变化
- **柱状图**：联赛（league）比赛量、战队胜场/负场
- **饼图**：赛区占比、比赛结果占比
- **时间轴/日历视图**：赛程密度可视化

### 3.2 战队与选手表现
- **雷达图**：选手多维能力（KDA/伤害/经济/视野）
- **散点图**：经济差 vs 胜率、伤害占比 vs 胜率
- **箱线图**：各战队经济/伤害分布
- **排名榜单**：Top-N 选手/战队（KDA、伤害、金钱等）

### 3.3 BP 与版本
- **热力图**：英雄出场率/禁用率随版本变化
- **桑基图**：选手位置 -> 英雄选择流向
- **柱状图**：各版本英雄/战术出场分布

### 3.4 节奏与时间节点
- **折线图**：10/15/20/25 分钟经济差走势
- **条形图**：首龙/首塔/首男爵占比与胜率
- **散点图**：对局时长 vs 经济优势

------

## 4. 是否需要进一步数据

当前数据可以完成**赛事结构 + 比赛统计 + BP/版本分析**的大多数可视化。

若你需要以下能力，则需额外数据源：

- **逐分钟时间线事件**（经济曲线/团战节奏/装备时间线）
- **地图级事件**（击杀位置/视野布置）

这些能力通常来自 LiveStats 或 Riot match timeline，但目前已不在本项目的数据范围内。

------

## 5. 当前更新入口

```bash
python -m pipeline oracle
```

该命令会全量下载 Oracle's Elixir 文件夹并覆盖 `data/raw/oracle_elixir/`。

