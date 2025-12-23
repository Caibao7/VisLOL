# 英雄联盟数据获取 Pipeline 项目文档（当前版本）

本文档描述当前实际使用的数据获取方案与落地结构。**当前项目阶段以 Oracle's Elixir 的历史赛事 CSV 为主数据源**，不再依赖 LiveStats。

------

## 1. 当前目标与策略

- 目标：只解决数据获取与落地缓存问题
- 当前主数据源：Oracle's Elixir（历史赛事汇总 CSV）
- 更新方式：手动触发（用于前端“下载最新数据”按钮）

------

## 2. 当前可用的数据源与任务

### 2.1 Oracle's Elixir（主数据源）

- 数据形式：年度赛事汇总 CSV（含队伍/选手/英雄/经济/目标/对局节奏等指标）
- 更新方式：**全量下载并覆盖**
- 下载入口：

```bash
python -m pipeline oracle
```

------

## 3. 当前目录结构（落地结果）

```bash
data/
  raw/
    oracle_elixir/
      2014_LoL_esports_match_data_from_OraclesElixir.csv
      2015_LoL_esports_match_data_from_OraclesElixir.csv
      ...
      2025_LoL_esports_match_data_from_OraclesElixir.csv

  meta/
    oracle_elixir_state.json
    oracle_elixir_latest.json

  logs/
    lolapi.log
```

------

## 4. Oracle's Elixir 下载流程

1. 从 Google Drive 文件夹全量下载
2. 覆盖 `data/raw/oracle_elixir/` 目录
3. 写入元信息（下载时间与文件列表）

配置项（`config.json`）：

```json
{
  "oracle_elixir": {
    "keep_tmp": false,
    "out_dir": "data/raw/oracle_elixir"
  }
}
```

------

## 5. 说明

- LiveStats 已移除（历史时间线数据过少且不可稳定获取）
- Riot API 与 Data Dragon 仍保留在 pipeline 中，但当前不作为最终数据源

