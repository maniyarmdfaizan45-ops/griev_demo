ESCALATION_NOT_ESCALATED = "NOT_ESCALATED"
ESCALATION_ESCALATED = "ESCALATED"
ESCALATION_LEVEL_DEPARTMENT = 1
ESCALATION_REASON_SLA_BREACHED = "SLA deadline exceeded"


def is_eligible_for_escalation(status, sla_status):
    return sla_status == "SLA_BREACHED" and status not in {"RESOLVED", "CLOSED"}