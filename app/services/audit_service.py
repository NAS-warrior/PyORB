"""
PyORB Audit Service
Records every operation for complete investigation trail
"""
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog, AuditAction
from app.models.user import User
from typing import Optional
from loguru import logger
import uuid
import json


def _safe_dict(data) -> Optional[dict]:
    """Safely convert data to JSON-serializable dict."""
    if data is None:
        return None
    try:
        # Convert to JSON string and back to ensure serializability
        return json.loads(json.dumps(data, default=str))
    except Exception:
        return {"raw": str(data)}


def log_action(
    db: Session,
    action: AuditAction,
    table_name: str,
    user: Optional[User] = None,
    record_id=None,
    old_values=None,
    new_values=None,
    description: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Log every system action to audit trail."""
    try:
        entry = AuditLog(
            user_id=user.id if user else None,
            action=action,
            table_name=table_name,
            record_id=record_id if isinstance(record_id, uuid.UUID) else None,
            old_values=_safe_dict(old_values),
            new_values=_safe_dict(new_values),
            description=description,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(entry)
        db.commit()
        logger.info(f"AUDIT: {action.value} on {table_name} by {user.username if user else 'system'}")
    except Exception as e:
        logger.error(f"Audit log failed: {e}")
        db.rollback()


def get_audit_log(
    db: Session,
    table_name: Optional[str] = None,
    user_id=None,
    action: Optional[AuditAction] = None,
    limit: int = 100,
    offset: int = 0
):
    """Retrieve audit log entries with optional filters."""
    query = db.query(AuditLog)
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    return query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
