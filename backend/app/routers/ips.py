from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import IpAddress
from app.schemas import IpAddressResponse, IpAddressUpdate
from app.services.ip_calculator import normalize_mac, reconcile_status

router = APIRouter(prefix="/api/ips", tags=["ips"])


@router.put("/{ip_id}", response_model=IpAddressResponse)
def update_ip(
    ip_id: int,
    payload: IpAddressUpdate,
    db: Session = Depends(get_db),
):
    ip_record = db.query(IpAddress).filter(IpAddress.id == ip_id).first()
    if not ip_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IP address not found",
        )

    if payload.expected_mac is not None:
        if not payload.expected_mac.strip():
            ip_record.expected_mac = None
        else:
            try:
                ip_record.expected_mac = normalize_mac(payload.expected_mac)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(e),
                )

    if payload.admin_status is not None:
        ip_record.admin_status = payload.admin_status.strip().lower()

    if payload.hostname is not None:
        ip_record.hostname = payload.hostname.strip() if payload.hostname else None

    if payload.description is not None:
        ip_record.description = payload.description.strip() if payload.description else None

    try:
        ip_record.reconciliation_status = reconcile_status(
            admin_status=ip_record.admin_status,
            is_online=ip_record.is_online,
            expected_mac=ip_record.expected_mac,
            detected_mac=ip_record.detected_mac,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    db.commit()
    db.refresh(ip_record)
    return ip_record


@router.post("/{ip_id}/trust-mac", response_model=IpAddressResponse)
def trust_mac(ip_id: int, db: Session = Depends(get_db)):
    ip_record = db.query(IpAddress).filter(IpAddress.id == ip_id).first()
    if not ip_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IP address not found",
        )

    if not ip_record.detected_mac or not ip_record.detected_mac.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot trust MAC: No MAC detected for this IP",
        )

    ip_record.expected_mac = ip_record.detected_mac
    ip_record.admin_status = "assigned"
    ip_record.reconciliation_status = reconcile_status(
        admin_status=ip_record.admin_status,
        is_online=ip_record.is_online,
        expected_mac=ip_record.expected_mac,
        detected_mac=ip_record.detected_mac,
    )

    db.commit()
    db.refresh(ip_record)
    return ip_record
