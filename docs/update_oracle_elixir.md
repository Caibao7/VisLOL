# Oracle's Elixir 数据更新说明

本项目使用 Oracle's Elixir 的历史赛事 CSV 作为主数据源。

## 使用方式

```bash
python -m pipeline oracle
```

## 行为说明

- 从 Google Drive 文件夹全量下载
- 覆盖 `data/raw/oracle_elixir/` 目录
- 写入元信息：
  - `data/meta/oracle_elixir_state.json`
  - `data/meta/oracle_elixir_latest.json`

## 配置项（config.json）

```json
{
  "oracle_elixir": {
    "keep_tmp": false,
    "out_dir": "data/raw/oracle_elixir"
  }
}
```

- `keep_tmp`: 是否保留临时下载目录
- `out_dir`: 输出目录

## 依赖

该脚本依赖 `gdown`：

```bash
pip install gdown
```

