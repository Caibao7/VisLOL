# League of Legends API 可获取数据总览与获取方式说明

（参考文档：当前 pipeline 不再依赖 Riot API 作为主要数据源，仅保留作为扩展参考。）

------

## 0. 使用前的统一前提（非常重要）

### 0.1 身份与主键约定（强烈建议）

- **对外展示用**：Riot ID（`gameName#tagLine`）
- **系统内部主键**：**PUUID（必须）**
- **兼容旧系统**：summonerID（可选）

> Summoner Name 已被官方标记为逐步废弃，不应作为核心标识。

------

### 0.2 路由规则（所有接口都会用到）

Riot API 的 URL 分为两类：

- **区域路由（Regional Routing）**
  - `americas.api.riotgames.com`
  - `europe.api.riotgames.com`
  - `asia.api.riotgames.com`
- **平台路由（Platform Routing）**
  - `jp1.api.riotgames.com`、`kr.api.riotgames.com`、`na1.api.riotgames.com` 等

👉 **是否用区域 or 平台，取决于接口本身**，不能混用。

------

## 1. 玩家身份与账号数据（入口数据）

### 1.1 Riot ID → PUUID（最关键入口）

**接口**

```bash
GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
```

**路由**

- 区域路由（americas / europe / asia）

**可获得字段**

```bash
{
  "puuid": "...",
  "gameName": "xxx",
  "tagLine": "JP1"
}
```

**用途**

- 一切玩家相关数据的“钥匙”
- 前端搜索玩家的唯一推荐方式

------

### 1.2 PUUID → Riot ID（反查 / 更新显示名）

**接口**

```bash
GET /riot/account/v1/accounts/by-puuid/{puuid}
```

**用途**

- 数据库里只有 PUUID 时，补齐展示用 Riot ID

------

## 2. 召唤师基础信息（账号层）

### 2.1 PUUID → Summoner 基础信息

**接口**

```bash
GET /lol/summoner/v4/summoners/by-puuid/{puuid}
```

**路由**

- 平台路由（如 jp1）

**可获得**

- summonerID（加密）
- 等级（summonerLevel）
- 头像 profileIconId
- 创建/修改时间

**典型可视化**

- 玩家资料卡
- 等级成长趋势（长期）

------

## 3. 排位与段位数据（Ranked）

### 3.1 SummonerID → 排位信息

**接口**

```bash
GET /lol/league/v4/entries/by-summoner/{summonerId}
```

**可获得**

- queueType（单双排 / 灵活）
- tier / rank（段位）
- LP
- 胜负场数
- 是否晋级赛

**可视化方向**

- 段位变化时间线
- 胜率 & 场次柱状图
- 不同队列对比

------

## 4. 英雄熟练度数据（Champion Mastery）

### 4.1 PUUID → 英雄熟练度列表

**接口**

```bash
GET /lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}
```

**可获得**

- championId
- masteryLevel
- masteryPoints
- 最近游玩时间

**可视化方向**

- 英雄池雷达图
- 英雄熟练度热力图
- 时间衰减模型（主玩英雄变化）

------

## 5. 对局数据（最核心、最丰富）

### 5.1 PUUID → 比赛 ID 列表

**接口**

```bash
GET /lol/match/v5/matches/by-puuid/{puuid}/ids
```

**路由**

- 区域路由（americas / asia / europe）

**参数**

- start / count
- queue（可筛选排位 / 大乱斗等）
- startTime / endTime

------

### 5.2 matchId → 单场比赛完整数据

**接口**

```bash
GET /lol/match/v5/matches/{matchId}
```

**数据量非常大，核心包含：**

#### A. 比赛元信息

- 游戏模式
- 队列类型
- 时长
- 版本号（gameVersion）

#### B. 玩家级数据（participants）

- 英雄
- K / D / A
- 经济、补刀、伤害
- 装备、符文
- 位置（teamPosition）
- 胜负

#### C. 队伍级数据（teams）

- 胜负
- 龙、男爵、防御塔
- ban/pick

**可视化方向（重点）**

- KDA / 经济 / 伤害分布
- 胜率 vs 游戏时长
- 英雄 & 装备组合
- 阵容结构分析

------

### 5.3 时间轴数据（Timeline）

**接口**

```bash
GET /lol/match/v5/matches/{matchId}/timeline
```

**可获得**

- 每分钟经济
- 击杀事件
- 目标事件
- 装备购买时间

**可视化方向**

- 经济曲线
- 节奏点分析（击杀 / 资源）
- 装备成型时间线

------

## 6. 成就 / 挑战系统（Challenges）

### 6.1 PUUID → 玩家挑战数据

**接口**

```bash
GET /lol/challenges/v1/player-data/{puuid}
```

**可获得**

- 各类挑战完成度
- 等级、百分位

**可视化方向**

- 成就雷达
- 玩家风格标签化

