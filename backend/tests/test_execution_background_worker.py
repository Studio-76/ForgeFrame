from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.execution.admin_service import ExecutionAdminService
from app.execution.service import ExecutionTransitionService
from app.execution.worker_service import ExecutionWorkerService
from app.instances.models import InstanceRecord
from app.providers.base import ChatDispatchResult
from app.responses.models import NormalizedResponsesRequest
from app.responses.service import ResponsesService
from app.settings.config import Settings
from app.storage.execution_repository import ExecutionWorkerORM, RunAttemptORM, RunCommandORM, RunORM, RunOutboxORM
from app.storage.harness_repository import Base
from app.storage.runtime_responses_repository import RuntimeResponseORM


class _StubInstanceService:
    def __init__(self, *, instance_id: str, company_id: str) -> None:
        self._instance = InstanceRecord(
            instance_id=instance_id,
            slug=instance_id,
            display_name=instance_id,
            description="Execution worker scope",
            status="active",
            tenant_id=instance_id,
            company_id=company_id,
            deployment_mode="restricted_eval",
            exposure_mode="local_only",
            is_default=True,
            metadata={},
            created_at=datetime(2026, 4, 23, 8, 0, tzinfo=UTC).isoformat(),
            updated_at=datetime(2026, 4, 23, 8, 0, tzinfo=UTC).isoformat(),
        )

    def resolve_instance(self, *, company_id: str | None = None, instance_id: str | None = None, **_: object) -> InstanceRecord:
        assert company_id in {None, self._instance.company_id}
        assert instance_id in {None, self._instance.instance_id}
        return self._instance


class _FakeDispatchService:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def dispatch_chat(self, **kwargs: object) -> tuple[ChatDispatchResult, object]:
        self.calls.append(kwargs)
        return (
            ChatDispatchResult(
                model="gpt-4.1-mini",
                provider="openai_api",
                content="background worker reply",
            ),
            SimpleNamespace(
                decision_id="route_bg_1",
                summary="non-simple routing selected background target",
                classification="non_simple",
                policy_stage="preferred",
                resolved_target=SimpleNamespace(target_key="openai_api::gpt-4.1-mini"),
                structured_explainability={"selected_target": "openai_api::gpt-4.1-mini"},
                raw_explainability={"selection_basis": {"route_context": kwargs.get("request_metadata")}},
            ),
        )


class _FakeAnalyticsStore:
    def __init__(self) -> None:
        self.non_stream_results: list[dict[str, object]] = []
        self.runtime_errors: list[dict[str, object]] = []

    def record_non_stream_result(self, result, client=None, *, context=None, request_metadata=None) -> None:
        self.non_stream_results.append(
            {
                "result": result,
                "client": client,
                "context": context,
                "request_metadata": request_metadata,
            }
        )

    def record_runtime_error(self, **kwargs: object) -> None:
        self.runtime_errors.append(kwargs)


def _services(tmp_path: Path) -> tuple[ExecutionTransitionService, ResponsesService, ExecutionWorkerService, ExecutionAdminService, sessionmaker[Session], _FakeDispatchService, _FakeAnalyticsStore]:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'execution-worker.sqlite'}")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)
    transitions = ExecutionTransitionService(session_factory)
    responses = ResponsesService(session_factory, execution=transitions)
    fake_dispatch = _FakeDispatchService()
    fake_analytics = _FakeAnalyticsStore()
    settings = Settings(
        admin_auth_enabled=False,
        harness_storage_backend="file",
        control_plane_storage_backend="file",
        observability_storage_backend="file",
        governance_storage_backend="file",
        instances_storage_backend="file",
    )
    worker = ExecutionWorkerService(
        session_factory,
        settings=settings,
        execution=transitions,
        responses=responses,
        instance_service=_StubInstanceService(instance_id="instance_alpha", company_id="company_alpha"),
        dispatch_factory=lambda _instance_id: fake_dispatch,
        analytics_store=fake_analytics,
    )
    admin = ExecutionAdminService(session_factory)
    return transitions, responses, worker, admin, session_factory, fake_dispatch, fake_analytics


def _instance(company_id: str = "company_alpha") -> InstanceRecord:
    now = datetime(2026, 4, 23, 8, 0, tzinfo=UTC).isoformat()
    return InstanceRecord(
        instance_id="instance_alpha",
        slug="instance-alpha",
        display_name="Alpha Instance",
        description="Execution worker scope",
        status="active",
        tenant_id="tenant_alpha",
        company_id=company_id,
        deployment_mode="restricted_eval",
        exposure_mode="local_only",
        is_default=True,
        metadata={},
        created_at=now,
        updated_at=now,
    )


def test_background_worker_processes_response_queue_and_updates_worker_registry(tmp_path: Path) -> None:
    _transitions, responses, worker, _admin, session_factory, fake_dispatch, fake_analytics = _services(tmp_path)
    request = NormalizedResponsesRequest(
        model="gpt-4.1-mini",
        instructions="Answer tersely.",
        input_items=[{"id": "msg_1", "type": "message", "role": "user", "status": "completed", "content": [{"type": "input_text", "text": "hello"}]}],
        background=True,
        metadata={"request": "background"},
        max_output_tokens=256,
        temperature=0.7,
    )
    response, run_id = responses.create_background_response(
        company_id="company_alpha",
        instance_id="instance_alpha",
        account_id="acct_alpha",
        request_path="/v1/responses",
        request=request,
        request_fingerprint_hash="fp_background_worker",
    )

    worker.start_worker(
        company_id="company_alpha",
        worker_key="worker_alpha",
        execution_lane="background_agentic",
        instance_id="instance_alpha",
    )
    result = worker.run_background_cycle(
        company_id="company_alpha",
        worker_key="worker_alpha",
        execution_lane="background_agentic",
        run_kind="responses_background",
        instance_id="instance_alpha",
    )

    assert result.outcome == "completed"
    assert result.response_id == response.id
    assert fake_dispatch.calls[0]["requested_model"] == "gpt-4.1-mini"
    assert fake_dispatch.calls[0]["request_metadata"] == {
        "route": "/v1/responses",
        "operation": "responses.background.execute",
        "service_name": "forgeframe-execution-worker",
        "service_kind": "worker",
        "request": "background",
        "instance_id": "instance_alpha",
        "execution_run_id": run_id,
        "attempt_id": result.attempt_id,
        "worker_key": "worker_alpha",
        "response_id": response.id,
    }
    assert fake_dispatch.calls[0]["response_controls"] == {
        "max_output_tokens": 256,
        "temperature": 0.7,
        "metadata": {"request": "background"},
    }
    assert fake_analytics.non_stream_results
    assert fake_analytics.non_stream_results[0]["request_metadata"] == fake_dispatch.calls[0]["request_metadata"]

    with session_factory() as session:
        run = session.get(RunORM, run_id)
        response_row = session.execute(
            text("SELECT lifecycle_status, instance_id, resolved_model, provider_key FROM runtime_responses WHERE id = :response_id"),
            {"response_id": response.id},
        ).one()
        worker_row = session.execute(
            text("SELECT worker_state, active_attempts, current_run_id, current_attempt_id, last_completed_at, last_error_code FROM execution_workers WHERE company_id = :company_id AND worker_key = :worker_key"),
            {"company_id": "company_alpha", "worker_key": "worker_alpha"},
        ).one()

    assert run is not None
    assert run.state == "succeeded"
    assert run.operator_state == "completed"
    assert run.result_summary is not None
    assert run.result_summary["routing"]["decision_id"] == "route_bg_1"
    assert run.result_summary["routing"]["selected_target_key"] == "openai_api::gpt-4.1-mini"
    assert run.result_summary["dispatch"]["stage"] == "completed"
    assert run.result_summary["wake_gate"]["claim_allowed"] is True
    assert tuple(response_row) == ("completed", "instance_alpha", "gpt-4.1-mini", "openai_api")
    assert worker_row[0] == "idle"
    assert worker_row[1] == 0
    assert worker_row[2] is None
    assert worker_row[3] is None
    assert worker_row[4] is not None
    assert worker_row[5] is None


def test_dispatch_snapshot_surfaces_registered_idle_workers_without_lease_inference(tmp_path: Path) -> None:
    _transitions, _responses, worker, admin, _session_factory, _fake_dispatch, _fake_analytics = _services(tmp_path)
    worker.start_worker(
        company_id="company_alpha",
        worker_key="worker_alpha",
        execution_lane="background_agentic",
        instance_id="instance_alpha",
    )
    worker.heartbeat_worker(
        company_id="company_alpha",
        worker_key="worker_alpha",
        execution_lane="background_agentic",
        instance_id="instance_alpha",
        worker_state="idle",
        clear_error=True,
    )

    snapshot = admin.get_dispatch_snapshot(instance=_instance())

    assert snapshot.leased_attempts == []
    assert snapshot.workers[0].worker_key == "worker_alpha"
    assert snapshot.workers[0].worker_state == "idle"
    assert snapshot.workers[0].active_attempts == 0
    assert snapshot.workers[0].leased_runs == []
