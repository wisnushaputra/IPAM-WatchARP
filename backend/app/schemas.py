from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class SubnetBase(BaseModel):
    name: str
    cidr: str
    gateway: Optional[str] = None
    vlan_id: Optional[int] = None


class SubnetCreate(SubnetBase):
    pass


class SubnetResponse(SubnetBase):
    id: int
    last_scanned_at: Optional[datetime] = None
    created_at: datetime
    total_ips: int = 254

    model_config = ConfigDict(from_attributes=True)


class SubnetSummary(SubnetResponse):
    assigned_count: int = 0
    online_count: int = 0
    rogue_count: int = 0
    mismatch_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class IpAddressBase(BaseModel):
    ip_address: str
    admin_status: str = "available"
    hostname: Optional[str] = None
    description: Optional[str] = None
    expected_mac: Optional[str] = None
    detected_mac: Optional[str] = None
    vendor: Optional[str] = None
    is_online: bool = False
    last_seen_at: Optional[datetime] = None
    reconciliation_status: str = "FREE"


class IpAddressResponse(IpAddressBase):
    id: int
    subnet_id: int

    model_config = ConfigDict(from_attributes=True)


class IpAddressUpdate(BaseModel):
    admin_status: Optional[str] = None
    hostname: Optional[str] = None
    description: Optional[str] = None
    expected_mac: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ScanHistoryResponse(BaseModel):
    id: int
    subnet_id: int
    scanned_at: datetime
    total_online: int
    total_anomalies: int
    duration_ms: int

    model_config = ConfigDict(from_attributes=True)

