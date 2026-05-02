// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchBootstrapReadinessMock,
  fetchIngressTlsStatusMock,
  renewIngressTlsMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchBootstrapReadinessMock: vi.fn(),
  fetchIngressTlsStatusMock: vi.fn(),
  renewIngressTlsMock: vi.fn(),
}));

vi.mock("../src/api/admin/ingress-tls", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/ingress-tls")>("../src/api/admin/ingress-tls");
  return {
    ...actual,
    fetchIngressTlsStatus: fetchIngressTlsStatusMock,
    renewIngressTls: renewIngressTlsMock,
  };
});

vi.mock("../src/api/admin/bootstrap", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/bootstrap")>("../src/api/admin/bootstrap");
  return {
    ...actual,
    fetchBootstrapReadiness: fetchBootstrapReadinessMock,
  };
});

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser, IngressTlsStatusResponse } from "../src/api/domain";
import { IngressTlsPage } from "../src/pages/IngressTlsPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

function createIngressStatus(overrides: Partial<IngressTlsStatusResponse> = {}): IngressTlsStatusResponse {
  return {
    status: "ok",
    fqdn: "forgeframe.example.com",
    public_origin: "https://forgeframe.example.com",
    frontend_root_path: "/",
    runtime_api_base: "/v1",
    admin_api_base: "/admin",
    public_https_host: "0.0.0.0",
    public_https_port: 443,
    public_http_helper_host: "0.0.0.0",
    public_http_helper_port: 80,
    tls_mode: "integrated_acme",
    acme_directory_url: "https://acme-v02.api.letsencrypt.org/directory",
    acme_webroot_path: "/var/lib/forgeframe/acme-webroot",
    integrated_tls_automation: true,
    dns_resolves: true,
    resolved_addresses: ["203.0.113.10"],
    certificate: {
      present: true,
      certificate_path: "/etc/forgeframe/tls/live/fullchain.pem",
      key_path: "/etc/forgeframe/tls/live/privkey.pem",
      trust_state: "public_ca",
      issuer: "CN=Let's Encrypt",
      subject: "CN=forgeframe.example.com",
      valid_from: "Apr 23 00:00:00 2026 GMT",
      valid_to: "Jul 22 23:59:59 2026 GMT",
      last_issued_at: "2026-04-23T00:00:00+00:00",
      last_renewed_at: "2026-04-23T00:00:00+00:00",
      renewal_due_at: "2026-06-22T23:59:59+00:00",
      days_remaining: 54,
      last_error: null,
    },
    mode_classification: "normative_public_https",
    renewal_supported: true,
    renewal_allowed: true,
    renewal_blocked_reason: null,
    blockers: [],
    checked_at: "2026-04-23T08:40:00Z",
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root | null = null;

async function renderIntoDom(element: ReactNode) {
  root = createRoot(container);
  await act(async () => {
    root?.render(element);
  });
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function getButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
}

beforeEach(() => {
  vi.resetAllMocks();

  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [
      {
        instance_id: "instance_alpha",
        slug: "instance-alpha",
        display_name: "Alpha Instance",
        description: "Alpha",
        status: "active",
        tenant_id: "tenant_alpha",
        company_id: "company_alpha",
        deployment_mode: "linux_host_native",
        exposure_mode: "same_origin",
        is_default: true,
        metadata: {},
        created_at: "2026-04-23T09:00:00Z",
        updated_at: "2026-04-23T09:00:00Z",
      },
    ],
  });

  fetchBootstrapReadinessMock.mockResolvedValue({
    status: "ok",
    ready: false,
    checked_at: "2026-04-23T08:30:00Z",
    checks: [
      { id: "public_fqdn_configured", ok: true, details: "forgeframe.example.com" },
      { id: "public_dns_resolution", ok: false, details: "unresolved" },
      { id: "public_https_listener", ok: true, details: "0.0.0.0:443;mode=integrated_acme" },
      { id: "port80_certificate_helper", ok: true, details: "0.0.0.0:80" },
      { id: "same_origin_runtime_api", ok: true, details: "runtime=/v1;admin=/admin" },
      { id: "certificate_material", ok: false, details: "/etc/forgeframe/tls/live/fullchain.pem" },
    ],
    next_steps: [
      "Publish A/AAAA records for the public FQDN.",
      "Reissue certificate material after DNS is live.",
    ],
  });

  fetchIngressTlsStatusMock.mockResolvedValue(createIngressStatus({
    mode_classification: "limited_exception",
    renewal_allowed: false,
    renewal_blocked_reason: "public_fqdn_dns_unresolved",
    dns_resolves: false,
    resolved_addresses: [],
    blockers: ["public_fqdn_dns_unresolved", "certificate_material_missing"],
    certificate: {
      present: false,
      certificate_path: "/etc/forgeframe/tls/live/fullchain.pem",
      key_path: "/etc/forgeframe/tls/live/privkey.pem",
      trust_state: "missing",
      issuer: null,
      subject: null,
      valid_from: null,
      valid_to: null,
      last_issued_at: null,
      last_renewed_at: null,
      renewal_due_at: null,
      days_remaining: null,
      last_error: "certificate material missing",
    },
  }));

  renewIngressTlsMock.mockResolvedValue({
    status: "ok",
    renewal: {
      status: "ok",
      stdout: "renewed certificates",
      stderr: "",
      exit_code: 0,
      command: ["bash", "renew-certificates.sh"],
    },
    ingress: createIngressStatus(),
  });

  container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
});

afterEach(() => {
  if (!root) {
    return;
  }
  act(() => {
    root?.unmount();
  });
  root = null;
});

describe("ingress and tls page", () => {
  it("renders a blocked public-https posture with a checklist and blocker follow-ups", async () => {
    await renderIntoDom(withAppContext({
      path: "/ingress-tls?instanceId=instance_alpha",
      element: <IngressTlsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(fetchBootstrapReadinessMock).toHaveBeenCalled();
    expect(fetchIngressTlsStatusMock).toHaveBeenCalled();
    expect(container.textContent).toContain("Blocked");
    expect(container.textContent).toContain("Remediation checklist");
    expect(container.textContent).toContain("public_fqdn_dns_unresolved");
    expect(container.textContent).toContain("Verify DNS records");
    expect(container.textContent).toContain("Issue or import certificate");
    expect((getButtonByText(container, "Renew certificates") as HTMLButtonElement | undefined)?.disabled).toBe(true);
  });

  it("marks manual or self-signed delivery as an explicit exception instead of green", async () => {
    fetchIngressTlsStatusMock.mockResolvedValue({
      ...createIngressStatus({
        tls_mode: "manual",
        mode_classification: "limited_exception",
        renewal_allowed: false,
        renewal_blocked_reason: "tls_mode_not_integrated_acme",
        blockers: ["tls_mode_not_integrated_acme"],
      }),
      certificate: {
        present: true,
        certificate_path: "/etc/forgeframe/tls/live/fullchain.pem",
        key_path: "/etc/forgeframe/tls/live/privkey.pem",
        trust_state: "self_signed",
        issuer: "CN=forgeframe.example.com",
        subject: "CN=forgeframe.example.com",
        valid_from: "Apr 23 00:00:00 2026 GMT",
        valid_to: "Jul 22 23:59:59 2026 GMT",
        last_issued_at: "2026-04-23T00:00:00+00:00",
        last_renewed_at: "2026-04-23T00:00:00+00:00",
        renewal_due_at: "2026-06-22T23:59:59+00:00",
        days_remaining: 54,
        last_error: null,
      },
    });

    await renderIntoDom(withAppContext({
      path: "/ingress-tls?instanceId=instance_alpha",
      element: <IngressTlsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(container.textContent).toContain("Blocked");
    expect(container.textContent).toContain("Self-signed certificate (exception)");
    expect(container.textContent).toContain("tls_mode_not_integrated_acme");
    expect(container.textContent).toContain("Configure TLS mode");
  });

  it("runs renew when the ingress contract allows it and shows the operation result", async () => {
    fetchIngressTlsStatusMock.mockResolvedValue(createIngressStatus());

    await renderIntoDom(withAppContext({
      path: "/ingress-tls?instanceId=instance_alpha",
      element: <IngressTlsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    const renewButton = getButtonByText(container, "Renew certificates");
    expect((renewButton as HTMLButtonElement | undefined)?.disabled).toBe(false);

    await act(async () => {
      renewButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(renewIngressTlsMock).toHaveBeenCalled();
    expect(container.textContent).toContain("Last renew operation");
    expect(container.textContent).toContain("renewed certificates");
    expect(container.textContent).toContain("Production-ready");
  });
});
