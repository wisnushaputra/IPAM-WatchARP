import ipaddress
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import IpAddress, Subnet
from app.schemas import SubnetCreate, SubnetResponse, SubnetSummary
from app.services.ip_calculator import generate_host_ips, validate_v4_subnet_24

router = APIRouter(prefix="/api/subnets", tags=["subnets"])


@router.post("", response_model=SubnetResponse, status_code=status.HTTP_201_CREATED)
def create_subnet(payload: SubnetCreate, db: Session = Depends(get_db)):
    # 1. Validate CIDR
    try:
        validate_v4_subnet_24(payload.cidr)
        canonical_cidr = str(ipaddress.IPv4Network(payload.cidr.strip(), strict=False))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # 2. Check duplicate CIDR
    existing = db.query(Subnet).filter(Subnet.cidr == canonical_cidr).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subnet with CIDR '{canonical_cidr}' already exists",
        )

    # 3. Validate gateway and generate 254 host IP definitions
    try:
        host_defs = generate_host_ips(canonical_cidr, payload.gateway)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # 4. Create Subnet entity
    subnet = Subnet(
        name=payload.name.strip(),
        cidr=canonical_cidr,
        gateway=payload.gateway.strip() if payload.gateway and payload.gateway.strip() else None,
        vlan_id=payload.vlan_id,
    )
    db.add(subnet)
    db.flush()

    # 5. Populate 254 host IP rows
    ip_records = [
        IpAddress(
            subnet_id=subnet.id,
            ip_address=h["ip_address"],
            admin_status=h["admin_status"],
            hostname=h["hostname"],
            description=h["description"],
            expected_mac=h["expected_mac"],
            detected_mac=h["detected_mac"],
            vendor=h["vendor"],
            is_online=h["is_online"],
            last_seen_at=h["last_seen_at"],
            reconciliation_status=h["reconciliation_status"],
        )
        for h in host_defs
    ]
    db.add_all(ip_records)
    db.commit()
    db.refresh(subnet)

    return SubnetResponse(
        id=subnet.id,
        name=subnet.name,
        cidr=subnet.cidr,
        gateway=subnet.gateway,
        vlan_id=subnet.vlan_id,
        last_scanned_at=subnet.last_scanned_at,
        created_at=subnet.created_at,
        total_ips=len(subnet.ip_addresses),
    )


@router.get("", response_model=list[SubnetSummary])
def list_subnets(db: Session = Depends(get_db)):
    subnets = (
        db.query(Subnet)
        .options(selectinload(Subnet.ip_addresses))
        .order_by(Subnet.created_at.desc())
        .all()
    )
    summaries = []
    for s in subnets:
        ips = s.ip_addresses
        summaries.append(
            SubnetSummary(
                id=s.id,
                name=s.name,
                cidr=s.cidr,
                gateway=s.gateway,
                vlan_id=s.vlan_id,
                last_scanned_at=s.last_scanned_at,
                created_at=s.created_at,
                total_ips=len(ips),
                assigned_count=sum(1 for ip in ips if ip.admin_status == "assigned"),
                online_count=sum(1 for ip in ips if ip.is_online),
                rogue_count=sum(
                    1 for ip in ips if ip.reconciliation_status == "ROGUE_DEVICE"
                ),
                mismatch_count=sum(
                    1 for ip in ips if ip.reconciliation_status == "MAC_MISMATCH"
                ),
            )
        )
    return summaries


@router.get("/{subnet_id}", response_model=SubnetResponse)
def get_subnet(subnet_id: int, db: Session = Depends(get_db)):
    subnet = db.query(Subnet).filter(Subnet.id == subnet_id).first()
    if not subnet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subnet not found",
        )
    return SubnetResponse(
        id=subnet.id,
        name=subnet.name,
        cidr=subnet.cidr,
        gateway=subnet.gateway,
        vlan_id=subnet.vlan_id,
        last_scanned_at=subnet.last_scanned_at,
        created_at=subnet.created_at,
        total_ips=len(subnet.ip_addresses),
    )


@router.delete("/{subnet_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subnet(subnet_id: int, db: Session = Depends(get_db)):
    subnet = db.query(Subnet).filter(Subnet.id == subnet_id).first()
    if not subnet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subnet not found",
        )
    db.delete(subnet)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
