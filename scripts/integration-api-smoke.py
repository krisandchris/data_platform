#!/usr/bin/env python3
"""Black-box integration smoke for the running Urban Violation API.

The script intentionally uses only the Python standard library so it can run
against either the accepted main stack or the agent worktree stack without
adding a test dependency to the product packages.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
from pathlib import Path
import sys
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4


DATASET_TYPE = "urban_violation"
BATCH_ID = "urban_violation__0508_fixture"
SAMPLE_ID = "000122_0_1760525212732"
LABEL_CONFIG_PATH = Path("DATASET/urban_violation/label_config.json")


class SmokeFailure(RuntimeError):
    """Raised when a runtime contract check fails."""


@dataclass
class Response:
    status: int
    headers: dict[str, str]
    body: bytes
    payload: Any


def headers(user_id: str, role: str) -> dict[str, str]:
    return {"X-User-Id": user_id, "X-User-Role": role}


ADMIN_HEADERS = headers("platform_admin", "platform_admin")


class ApiClient:
    def __init__(self, base_url: str, timeout: float = 20.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def request(
        self,
        method: str,
        path: str,
        *,
        expected: tuple[int, ...] = (200,),
        query: dict[str, Any] | None = None,
        json_body: Any | None = None,
        extra_headers: dict[str, str] | None = None,
        parse_json: bool = True,
    ) -> Response:
        url = f"{self.base_url}{path}"
        if query:
            url = f"{url}?{urlencode({key: value for key, value in query.items() if value is not None})}"
        body = None
        request_headers = {"User-Agent": "uvp-integration-smoke/1.0"}
        if extra_headers:
            request_headers.update(extra_headers)
        if json_body is not None:
            body = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
            request_headers["Content-Type"] = "application/json"
        req = Request(url=url, data=body, headers=request_headers, method=method)
        try:
            with urlopen(req, timeout=self.timeout) as resp:
                response_body = resp.read()
                status = resp.status
                response_headers = dict(resp.headers.items())
        except HTTPError as exc:
            response_body = exc.read()
            status = exc.code
            response_headers = dict(exc.headers.items())
        except URLError as exc:
            raise SmokeFailure(f"{method} {url} failed: {exc}") from exc

        payload: Any = None
        if parse_json:
            content_type = response_headers.get("content-type", response_headers.get("Content-Type", ""))
            if "json" in content_type or response_body.startswith((b"{", b"[")):
                try:
                    payload = json.loads(response_body.decode("utf-8"))
                except json.JSONDecodeError as exc:
                    raise SmokeFailure(f"{method} {url} returned invalid JSON: {exc}") from exc

        if status not in expected:
            preview = response_body.decode("utf-8", errors="replace")[:800]
            raise SmokeFailure(f"{method} {url} expected {expected}, got {status}: {preview}")
        return Response(status=status, headers=response_headers, body=response_body, payload=payload)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SmokeFailure(message)


def load_label_config(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise SmokeFailure(f"label config not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def create_user(api: ApiClient, user_id: str, role: str, batch_id: str) -> None:
    api.request(
        "POST",
        "/api/users",
        expected=(201,),
        json_body={
            "user_id": user_id,
            "display_name": user_id,
            "email": f"{user_id}@example.local",
            "password": "StrongPassw0rd!",
        },
        extra_headers=ADMIN_HEADERS,
    )
    api.request(
        "POST",
        "/api/role-bindings",
        expected=(201,),
        json_body={
            "user_id": user_id,
            "role": role,
            "scope_type": "dataset_batch",
            "scope_id": batch_id,
        },
        extra_headers=ADMIN_HEADERS,
    )


def latest_submission_id(history: list[dict[str, Any]], reviewer_id: str) -> str:
    for item in reversed(history):
        if (
            item.get("reviewer_id") == reviewer_id
            or item.get("created_by") == reviewer_id
            or item.get("user_id") == reviewer_id
        ):
            submission_id = item.get("submission_id")
            if isinstance(submission_id, str) and submission_id:
                return submission_id
    if history and isinstance(history[-1].get("submission_id"), str):
        return history[-1]["submission_id"]
    raise SmokeFailure("label edit history did not contain a submission_id")


def run(api: ApiClient, args: argparse.Namespace) -> dict[str, Any]:
    run_id = f"{int(time.time())}_{uuid4().hex[:8]}"
    annotator_id = f"smoke_annotator_{run_id}"
    lead_id = f"smoke_qc_lead_{run_id}"
    label_config = load_label_config(args.label_config)

    health = api.request("GET", "/health")
    require(health.payload.get("status") == "ok", f"unexpected health payload: {health.payload}")

    saved_config = api.request(
        "POST",
        f"/api/datasets/{args.dataset_type}/label-configs",
        json_body={"file_name": args.label_config.name, "config": label_config, "activate": True},
        extra_headers=ADMIN_HEADERS,
    ).payload
    api.request(
        "POST",
        f"/api/datasets/{args.dataset_type}/label-configs/{saved_config['config_id']}/activate",
        extra_headers=ADMIN_HEADERS,
    )
    active_config = api.request(
        "GET",
        f"/api/datasets/{args.batch_id}/label-config/active",
        extra_headers=ADMIN_HEADERS,
    ).payload
    require(active_config.get("config_id") == saved_config.get("config_id"), "batch did not inherit active label config")

    create_user(api, annotator_id, "annotator", args.batch_id)
    create_user(api, lead_id, "qc_lead", args.batch_id)

    assignment = api.request(
        "POST",
        f"/api/datasets/{args.batch_id}/qc/assignment",
        json_body={"assignee_user_id": annotator_id},
        extra_headers=ADMIN_HEADERS,
    ).payload
    require(assignment.get("dataset_id") == args.batch_id, "assignment did not resolve to concrete batch id")

    lease = api.request(
        "POST",
        f"/api/datasets/{args.batch_id}/samples/{args.sample_id}/lease",
        extra_headers=headers(annotator_id, "annotator"),
    ).payload
    lease_id = lease["lease"]["lease_id"]

    review = api.request(
        "GET",
        f"/api/datasets/{args.batch_id}/samples/{args.sample_id}/review",
        extra_headers=ADMIN_HEADERS,
    ).payload
    relation = review["stage1"]["key_relations"][0]
    before_description = relation.get("description") or relation.get("relation") or "relation"
    after_description = f"{before_description}#integration-smoke-{run_id}"

    api.request(
        "POST",
        f"/api/datasets/{args.batch_id}/samples/{args.sample_id}/label-edits",
        json_body={
            "task_mode": "label_edit",
            "submit_action": "submit_changes",
            "task_status": "annotation_submitted",
            "lease_id": lease_id,
            "base_revision": 0,
            "operations": [
                {
                    "scope": "relation:R1",
                    "field": "description",
                    "op": "replace",
                    "before": before_description,
                    "after": after_description,
                }
            ],
        },
        extra_headers=headers(annotator_id, "annotator"),
    )

    history_response = api.request(
        "GET",
        f"/api/datasets/{args.batch_id}/samples/{args.sample_id}/label-edits/history",
        extra_headers=headers(lead_id, "qc_lead"),
    ).payload
    require(isinstance(history_response, list), "label edit history should be a list")
    submission_id = latest_submission_id(history_response, annotator_id)

    confirmed = api.request(
        "POST",
        f"/api/datasets/{args.batch_id}/samples/{args.sample_id}/label-edits/{submission_id}/confirm",
        extra_headers=headers(lead_id, "qc_lead"),
    ).payload
    require(confirmed.get("submission_id") == submission_id, "submission confirmation id mismatch")

    pool = api.request(
        "GET",
        "/api/sample-pool",
        query={"dataset_id": args.batch_id, "sample_id": args.sample_id, "status": "active"},
        extra_headers=ADMIN_HEADERS,
    ).payload
    require(pool.get("total", 0) >= 1, "confirmed changed sample did not enter sample pool")
    pool_item = pool["items"][0]

    pool_stats = api.request("GET", "/api/sample-pool/stats", extra_headers=ADMIN_HEADERS).payload
    require(pool_stats.get("active_items", 0) >= 1, "sample pool stats did not count active item")

    export_job = api.request(
        "POST",
        "/api/exports",
        json_body={
            "format": "coco_json",
            "source_type": "correction_sample_pool",
            "filters": {"dataset_id": args.batch_id, "status": "active"},
        },
        extra_headers=ADMIN_HEADERS,
    ).payload
    export_id = export_job["export_id"]
    require(export_job.get("status") == "completed", "export job did not complete synchronously")

    export_detail = api.request("GET", f"/api/exports/{export_id}", extra_headers=ADMIN_HEADERS).payload
    require(export_detail.get("export_id") == export_id, "export detail id mismatch")
    export_download = api.request(
        "GET",
        f"/api/exports/{export_id}/download",
        extra_headers=ADMIN_HEADERS,
    ).payload
    require({"info", "images", "annotations", "categories"}.issubset(export_download), "COCO export shape mismatch")
    require(export_download["info"].get("coordinate_space") == "quantized_1000", "unexpected export coordinate space")

    eval_one = api.request(
        "POST",
        f"/api/datasets/{args.batch_id}/evaluations",
        expected=(201,),
        json_body={
            "model_version": f"uvp-smoke-v1-{run_id}",
            "metrics": {
                "mAP": 0.72,
                "precision": 0.81,
                "recall": 0.74,
                "f1": 0.77,
                "false_positive_rate": 0.19,
                "hard_sample_hit_rate": 0.66,
            },
            "category_metrics": {
                "illegal_parking": {"mAP": 0.71, "precision": 0.8, "recall": 0.73, "f1": 0.76}
            },
            "changed_sample_ids": [args.sample_id],
            "notes": "integration smoke baseline evaluation",
        },
        extra_headers=ADMIN_HEADERS,
    ).payload
    eval_two = api.request(
        "POST",
        f"/api/datasets/{args.batch_id}/evaluations",
        expected=(201,),
        json_body={
            "model_version": f"uvp-smoke-v2-{run_id}",
            "metrics": {
                "mAP": 0.78,
                "precision": 0.86,
                "recall": 0.8,
                "f1": 0.83,
                "false_positive_rate": 0.13,
                "hard_sample_hit_rate": 0.81,
            },
            "category_metrics": {
                "illegal_parking": {"mAP": 0.77, "precision": 0.85, "recall": 0.79, "f1": 0.82}
            },
            "changed_sample_ids": [args.sample_id, "001710_0_1763108687181"],
            "notes": "integration smoke comparison evaluation",
        },
        extra_headers=ADMIN_HEADERS,
    ).payload

    evaluations = api.request(
        "GET",
        f"/api/datasets/{args.batch_id}/evaluations",
        extra_headers=ADMIN_HEADERS,
    ).payload
    require(len(evaluations) >= 2, "evaluation list did not include created evaluations")

    compared = api.request(
        "GET",
        "/api/evaluations/compare",
        query={"left_id": eval_one["evaluation_id"], "right_id": eval_two["evaluation_id"]},
        extra_headers=ADMIN_HEADERS,
    ).payload
    require(compared["metric_delta"]["mAP"] > 0, "evaluation comparison did not produce positive mAP delta")

    delta_samples = api.request(
        "GET",
        f"/api/evaluations/{eval_two['evaluation_id']}/delta-samples",
        extra_headers=ADMIN_HEADERS,
    ).payload
    require(delta_samples.get("total") == 2, "evaluation delta-samples total mismatch")

    snapshots = api.request(
        "GET",
        f"/api/datasets/{args.dataset_type}/snapshots",
        extra_headers=ADMIN_HEADERS,
    ).payload
    sample_snapshots = [item for item in snapshots if item.get("sample_id") == args.sample_id]
    left_snapshot = next((item for item in sample_snapshots if item.get("snapshot_type") == "baseline"), None)
    right_snapshot = next((item for item in sample_snapshots if item.get("snapshot_type") == "confirmed"), None)
    require(left_snapshot is not None and right_snapshot is not None, "baseline/confirmed snapshots were not found")

    snapshot_diff = api.request(
        "GET",
        f"/api/datasets/{args.batch_id}/snapshots/diff",
        query={
            "left_snapshot_id": left_snapshot["snapshot_id"],
            "right_snapshot_id": right_snapshot["snapshot_id"],
        },
        extra_headers=ADMIN_HEADERS,
    ).payload
    require(snapshot_diff.get("operation_count", 0) >= 1, "snapshot diff did not detect operations")
    require(snapshot_diff.get("changed_fields"), "snapshot diff changed_fields is empty")

    rollback = api.request(
        "POST",
        f"/api/datasets/{args.batch_id}/snapshots/{right_snapshot['snapshot_id']}/rollback",
        expected=(501,),
        extra_headers=ADMIN_HEADERS,
    ).payload
    require(rollback.get("code") == "rollback_disabled", "rollback did not return rollback_disabled")

    audit = api.request(
        "GET",
        "/api/audit-events",
        query={"dataset_id": args.batch_id},
        extra_headers=ADMIN_HEADERS,
    ).payload
    actions = {item.get("action") for item in audit}
    expected_actions = {
        "batch_assignment.assign",
        "sample_lease.acquire",
        "label_edit.submit",
        "label_edit.confirm",
        "evaluation.create",
        "snapshot.rollback.disabled",
    }
    missing_actions = sorted(expected_actions - actions)
    require(not missing_actions, f"audit actions missing: {missing_actions}")

    return {
        "dataset_id": args.batch_id,
        "sample_id": args.sample_id,
        "submission_id": submission_id,
        "pool_item_id": pool_item["item_id"],
        "export_id": export_id,
        "evaluation_ids": [eval_one["evaluation_id"], eval_two["evaluation_id"]],
        "snapshot_ids": [left_snapshot["snapshot_id"], right_snapshot["snapshot_id"]],
        "audit_actions_checked": sorted(expected_actions),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Backend base URL.")
    parser.add_argument("--dataset-type", default=DATASET_TYPE)
    parser.add_argument("--batch-id", default=BATCH_ID)
    parser.add_argument("--sample-id", default=SAMPLE_ID)
    parser.add_argument("--label-config", type=Path, default=LABEL_CONFIG_PATH)
    parser.add_argument("--output", type=Path, help="Optional JSON summary output path.")
    parser.add_argument("--timeout", type=float, default=20.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    api = ApiClient(args.base_url, timeout=args.timeout)
    try:
        summary = run(api, args)
    except SmokeFailure as exc:
        print(f"[integration-api-smoke] FAIL: {exc}", file=sys.stderr)
        return 1
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[integration-api-smoke] PASS")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
