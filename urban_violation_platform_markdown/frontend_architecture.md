# 前端架构设计文档

## 1. 模块结构
```
frontend/src/
  app/
  services/
  features/
    datasets/
    import/
    review-workbench/
    qc/
    exports/
  shared/
    components/
    composables/
    types/
```
## 2. Feature 分层
- domain, composables, stores, components, services/api

## 3. 页面路由示意
- /datasets, /datasets/:id/overview, /datasets/:id/assets, /datasets/:id/import-jobs/:jobId, /datasets/:id/preannotations, /datasets/:id/qc, /datasets/:id/samples/:sampleId/review
