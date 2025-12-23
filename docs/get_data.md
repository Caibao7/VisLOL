# 英雄联盟数据获取 Pipeline 说明（最终版）

本文档汇总当前项目内**所有数据获取模块**的目的、接口/来源、落地结构与数据内容，并说明当前最终使用的数据集。

------

## 1. Pipeline 总览

当前 pipeline 由以下模块组成：

1) **Data Dragon**（游戏生态：英雄/装备/符文/版本）
2) **LoL API**（玩家/对局数据）
3) **LoL Esports persisted/gw**（赛事结构：联赛/赛程/比赛详情）
4) **Oracle's Elixir**（历史赛事汇总 CSV，最终主数据）

实际入口命令：

```bash
python -m pipeline ddragon
python -m pipeline lolapi
python -m pipeline esports
python -m pipeline oracle
```

------

## 2. 模块一：Data Dragon（游戏生态）

### 2.1 数据源
- 官方静态资源：`https://ddragon.leagueoflegends.com`
- 无需 API Key

### 2.2 获取内容
- 版本号列表
- 当前版本 Realm 信息
- 英雄、装备、召唤师技能、符文

### 2.3 落地目录
```
data/raw/ddragon/{version}/{locale}/champion.json
data/raw/ddragon/{version}/{locale}/item.json
data/raw/ddragon/{version}/{locale}/summoner.json
data/raw/ddragon/{version}/{locale}/runesReforged.json
data/raw/ddragon/{version}/{locale}/realms_{region}.json
```

### 2.4 数据用途
- 版本信息与英雄/装备/符文基础数据
- 为后续可视化（英雄池、装备合成图、符文体系）提供“静态字典”

------

## 3. 模块二：LoL API（玩家/对局，可选）

### 3.1 说明
- 该模块用于个人/小规模玩家数据展示
- 需要 Riot API Key（开发 Key 可能受限）

### 3.2 获取内容
- Riot ID ↔ PUUID
- Summoner 基础信息
- 英雄熟练度
- Challenges
- Match 详情（可选 timeline）

### 3.3 落地目录
```
data/raw/lolapi/players/{puuid}/account.json
data/raw/lolapi/players/{puuid}/summoner.json
data/raw/lolapi/players/{puuid}/mastery.json
data/raw/lolapi/players/{puuid}/challenges.json
data/raw/lolapi/players/{puuid}/ranked.json  (若 API 权限允许)

data/raw/lolapi/matches/{region}/{matchId}.json
data/raw/lolapi/matches/{region}/timeline/{matchId}.json
```

### 3.4 数据用途
- 玩家画像卡、英雄池可视化、对局统计展示
- 非赛事级主数据来源

------

## 4. 模块三：LoL Esports persisted/gw（赛事结构）

### 4.1 数据源
- `https://esports-api.lolesports.com/persisted/gw`
- 需要 `x-api-key`

### 4.2 获取内容
- 联赛列表
- 赛程（schedule）
- 比赛详情（event details）

### 4.3 落地目录
```
data/raw/esports_gw/leagues/leagues.json
data/raw/esports_gw/schedules/{leagueId}.json
data/raw/esports_gw/events/{eventId}.json
```

### 4.4 数据用途
- 构建“赛事结构层”（赛程/对阵/BO/赛区分布）
- 为 Oracle's Elixir 提供对照与补充元信息

> 当前只抓 LPL/LCK 赛区，时间范围可配置。

------

## 5. 模块四：Oracle's Elixir（最终主数据）

### 5.1 数据源
- Oracle's Elixir 数据集（Google Drive 全量文件夹）
- 下载地址：`oracleselixir.com/tools/downloads`

### 5.2 获取方式
- **全量下载整个文件夹并覆盖** `data/raw/oracle_elixir/`

入口命令：

```bash
python -m pipeline oracle
```

### 5.3 落地目录
```
data/raw/oracle_elixir/2014_LoL_esports_match_data_from_OraclesElixir.csv
...
data/raw/oracle_elixir/2025_LoL_esports_match_data_from_OraclesElixir.csv
```

### 5.4 数据内容（字段类别）

Oracle’s Elixir CSV 是比赛级 + 选手级混合数据表，常见字段包括：

- **赛事实体**：`league`, `split`, `year`, `date`, `patch`, `gameid`, `url`
- **对局结果**：`result`, `gamelength`, `side`, `position`
- **选手/战队**：`playername`, `playerid`, `teamname`, `teamid`
- **英雄与 BP**：`champion`, `ban1`~`ban5`, `pick1`~`pick5`
- **KDA 与击杀**：`kills`, `deaths`, `assists`, `doublekills`~`pentakills`
- **经济与经验**：`totalgold`, `earnedgold`, `goldspent`, `xpat10/15/20/25`
- **时间节点差值**：`golddiffat10/15/20/25`, `xpdiffat10/15/20/25`, `csdiffat10/15/20/25`
- **目标控制**：`dragons`, `barons`, `heralds`, `towers`, `firstdragon`, `firstbaron`
- **伤害与视野**：`damagetochampions`, `damageshare`, `visionscore`, `wardsplaced`


------

## 6. 当前数据目录全览（最终）

```
data/
  raw/
    ddragon/...
    esports_gw/...
    lolapi/...
    oracle_elixir/*.csv

  meta/
    ddragon_state.json
    esports_state.json
    esports_games.json
    lolapi_state.json
    oracle_elixir_state.json
    oracle_elixir_latest.json

  logs/
    lolapi.log
```

------

## 7. 可能的可视化方向  

包括但不限于：

- **折线图**：赛季内比赛数量、经济差/经验差随时间变化
- **柱状图**：战队胜场、英雄出场率、BP 统计
- **饼图**：赛区占比、英雄分路占比
- **散点图**：经济差 vs 胜率、伤害占比 vs 胜率
- **雷达图**：选手多维能力（KDA/伤害/经济/视野）
- **桑基图**：位置 → 英雄选择流向
- **热力图**：版本/英雄出场分布、队伍对阵频次

------

