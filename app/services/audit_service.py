"""
PyORB Audit Service
Records every operation for complete investigation trail
"""
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog, AuditAction
from app.models.user import User
from typing import Optional, Any
from loguru import logger
import uuid


def log_action(
    db: Session,
    action: AuditAction,
    table_name: str,
    user: Optional[User] = None,
    record_id: Optional[uuid.UUID] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    description: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """
    Log every system action to audit trail.
    Called automatically on every create/update/delete operation.
    """
    entry = AuditLog(
        user_id=user.id if user else None,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=old_values,
        new_values=new_values,
        description=description,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(entry)
    db.commit()
    logger.info(f"AUDIT: {action.value} on {table_name} by {user.username if user else 'system'}")


def get_audit_log(
    db: Session,
    table_name: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
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
