#!/usr/bin/env python3
"""Run the dedicated ForgeFrame execution worker loop."""

from __future__ import annotations

import argparse
import os
import signal
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.execution.dependencies import get_execution_worker_service
from app.settings.config import get_settings


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--instance-id", help="Optional explicit ForgeFrame instance scope.")
    parser.add_argument("--company-id", help="Optional explicit execution company scope.")
    parser.add_argument("--worker-key", help="Optional worker key override.")
    parser.add_argument("--execution-lane", help="Optional execution lane override.")
    parser.add_argument("--run-kind", help="Optional run kind filter override.")
    parser.add_argument("--poll-interval", type=float, help="Optional idle poll interval override.")
    parser.add_argument("--lease-ttl", type=int, help="Optional worker lease TTL override.")
    parser.add_argument("--heartbeat-ttl", type=int, help="Optional worker heartbeat TTL override.")
    parser.add_argument(
        "--max-cycles",
        type=int,
        default=0,
        help="Stop after N cycles. Default 0 keeps the worker running until interrupted.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    settings = get_settings()
    company_id = (args.company_id or settings.execution_worker_company_id or settings.bootstrap_tenant_id).strip()
    instance_id = (args.instance_id or settings.execution_worker_instance_id or settings.bootstrap_tenant_id).strip()
    worker_key = (args.worker_key or settings.execution_worker_key or "forgeframe-worker").strip()
    execution_lane = (args.execution_lane or settings.execution_worker_execution_lane or "background_agentic").strip()
    run_kind = (args.run_kind or settings.execution_worker_run_kind or "responses_background").strip()
    poll_interval = args.poll_interval if args.poll_interval is not None else settings.execution_worker_poll_interval_seconds
    lease_ttl = args.lease_ttl if args.lease_ttl is not None else settings.execution_worker_lease_ttl_seconds
    heartbeat_ttl = args.heartbeat_ttl if args.heartbeat_ttl is not None else settings.execution_worker_heartbeat_ttl_seconds
    max_cycles = max(0, args.max_cycles)

    worker = get_execution_worker_service()
    process_id = os.getpid()
    stop_requested = False

    def _request_stop(_signum: int, _frame) -> None:  # pragma: no cover - signal handling is runtime-only.
        nonlocal stop_requested
        stop_requested = True

    signal.signal(signal.SIGINT, _request_stop)
    signal.signal(signal.SIGTERM, _request_stop)

    worker.start_worker(
        company_id=company_id,
        worker_key=worker_key,
        instance_id=instance_id,
        execution_lane=execution_lane,
        heartbeat_ttl_seconds=heartbeat_ttl,
        process_id=process_id,
    )

    completed_cycles = 0
    try:
        while not stop_requested and (max_cycles == 0 or completed_cycles < max_cycles):
            try:
                result = worker.run_background_cycle(
                    company_id=company_id,
                    worker_key=worker_key,
                    instance_id=instance_id,
                    execution_lane=execution_lane,
                    run_kind=run_kind,
                    process_id=process_id,
                    lease_ttl_seconds=lease_ttl,
                    heartbeat_ttl_seconds=heartbeat_ttl,
                )
            except Exception as exc:
                worker.fail_worker(
                    company_id=company_id,
                    worker_key=worker_key,
                    instance_id=instance_id,
                    execution_lane=execution_lane,
                    heartbeat_ttl_seconds=heartbeat_ttl,
                    error_code="worker_cycle_crashed",
                    error_detail=str(exc),
                    process_id=process_id,
                )
                print(f"[forgeframe-worker] cycle crashed: {exc}", file=sys.stderr, flush=True)
                time.sleep(max(0.1, float(poll_interval)))
                continue

            completed_cycles += 1
            if not result.processed:
                time.sleep(max(0.1, float(poll_interval)))
    finally:
        worker.stop_worker(
            company_id=company_id,
            worker_key=worker_key,
            instance_id=instance_id,
            execution_lane=execution_lane,
            reason="worker_loop_stopped",
            process_id=process_id,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
