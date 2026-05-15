# 后端架构设计文档

## 1. 技术栈
- FastAPI + SQLAlchemy async, PostgreSQL, Redis, MinIO, Meilisearch, Milvus Lite, Celery + Redis

## 2. 模块划分
- 数据导入, 标注管理, QC, 搜索, 导出, 权限, 分析

## 3. 状态机示意
```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Uploading
    Uploading --> Uploaded
    Uploaded --> Scanning
    Scanning --> Validating
    Validating --> ValidationPassed
    ValidationPassed --> PreviewReady
    PreviewReady --> Importing
    Importing --> Imported
    Imported --> QCQueueGenerated
    ValidationFailed --> Draft
    Importing --> ImportFailed
```
## 4. 数据库 Schema
- RawAsset, PreAnnotationStep1, PreAnnotationStep2, HumanReview, AuditArtifact
