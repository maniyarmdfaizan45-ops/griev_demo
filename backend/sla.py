from datetime import datetime, timedelta, timezone

SLA_HOURS_BY_PRIORITY = {
    "HIGH": 24,
    "MEDIUM": 72,
    "LOW": 168,
}
NEAR_DEADLINE_FRACTION = 0.25


def normalize_priority(priority):
    return str(priority or "LOW").strip().upper()


def parse_timestamp(value):
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value or "").strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def to_iso(timestamp):
    return parse_timestamp(timestamp).isoformat().replace("+00:00", "Z")


def sla_hours_for_priority(priority):
    return SLA_HOURS_BY_PRIORITY.get(normalize_priority(priority), SLA_HOURS_BY_PRIORITY["LOW"])


def calculate_deadline(started_at, priority):
    return to_iso(parse_timestamp(started_at) + timedelta(hours=sla_hours_for_priority(priority)))


def resolution_hours(submitted_at, resolution_timestamp):
    elapsed = parse_timestamp(resolution_timestamp) - parse_timestamp(submitted_at)
    return round(elapsed.total_seconds() / 3600, 2)


def calculate_sla_status(status, deadline, priority, resolution_timestamp=None, stored_result=None, now=None):
    if status == "CLOSED" and stored_result:
        return stored_result
    if status == "RESOLVED" and resolution_timestamp:
        resolved_at = parse_timestamp(resolution_timestamp)
        return "RESOLVED_WITHIN_SLA" if resolved_at <= parse_timestamp(deadline) else "RESOLVED_AFTER_SLA"
    if status == "CLOSED" and resolution_timestamp:
        resolved_at = parse_timestamp(resolution_timestamp)
        return "RESOLVED_WITHIN_SLA" if resolved_at <= parse_timestamp(deadline) else "RESOLVED_AFTER_SLA"

    current_time = parse_timestamp(now or datetime.now(timezone.utc))
    deadline_time = parse_timestamp(deadline)
    start_time = deadline_time - timedelta(hours=sla_hours_for_priority(priority))
    remaining_window = deadline_time - start_time
    near_start = deadline_time - (remaining_window * NEAR_DEADLINE_FRACTION)
    if current_time >= deadline_time:
        return "SLA_BREACHED"
    if current_time >= near_start:
        return "NEAR_DEADLINE"
    return "WITHIN_SLA"
