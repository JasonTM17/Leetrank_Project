# Alertmanager

Routes Prometheus alerts to webhook receivers (n8n workflows by default).

## Environment variables

| Variable                            | Default                                   | Description      |
| ----------------------------------- | ----------------------------------------- | ---------------- |
| `ALERTMANAGER_WEBHOOK_URL`          | `http://n8n:5678/webhook/alerts`          | Default receiver |
| `ALERTMANAGER_CRITICAL_WEBHOOK_URL` | `http://n8n:5678/webhook/alerts-critical` | Critical alerts  |
| `ALERTMANAGER_WARNING_WEBHOOK_URL`  | `http://n8n:5678/webhook/alerts-warning`  | Warning alerts   |

## Routing logic

1. All alerts hit the `default` receiver.
2. `severity: critical` also fires the `critical` receiver (`continue: true`).
3. `severity: warning` fires the `warning` receiver instead of default.
4. Inhibit rule: a firing critical alert silences the matching warning.

## Testing with amtool

```bash
# Fire a test alert
amtool alert add test severity=critical instance=web-1 --alertmanager.url=http://localhost:9093

# List active alerts
amtool alert --alertmanager.url=http://localhost:9093

# Silence an alert for 1h
amtool silence add alertname=test --duration=1h --alertmanager.url=http://localhost:9093
```
