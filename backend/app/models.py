from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Subnet(Base):
    __tablename__ = "subnets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    cidr = Column(String, unique=True, index=True, nullable=False)
    gateway = Column(String, nullable=True)
    vlan_id = Column(Integer, nullable=True)
    last_scanned_at = Column(DateTime, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    ip_addresses = relationship(
        "IpAddress",
        back_populates="subnet",
        cascade="all, delete-orphan",
    )
    scan_histories = relationship(
        "ScanHistory",
        back_populates="subnet",
        cascade="all, delete-orphan",
    )


class IpAddress(Base):
    __tablename__ = "ip_addresses"

    id = Column(Integer, primary_key=True, index=True)
    subnet_id = Column(
        Integer,
        ForeignKey("subnets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ip_address = Column(String, index=True, nullable=False)
    admin_status = Column(String, default="available", nullable=False)
    hostname = Column(String, nullable=True)
    description = Column(String, nullable=True)
    expected_mac = Column(String, nullable=True)
    detected_mac = Column(String, nullable=True)
    vendor = Column(String, nullable=True)
    is_online = Column(Boolean, default=False, nullable=False)
    last_seen_at = Column(DateTime, nullable=True)
    reconciliation_status = Column(String, default="FREE", nullable=False)

    subnet = relationship("Subnet", back_populates="ip_addresses")


class ScanHistory(Base):
    __tablename__ = "scan_histories"

    id = Column(Integer, primary_key=True, index=True)
    subnet_id = Column(
        Integer,
        ForeignKey("subnets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scanned_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    total_online = Column(Integer, default=0, nullable=False)
    total_anomalies = Column(Integer, default=0, nullable=False)
    duration_ms = Column(Integer, default=0, nullable=False)

    subnet = relationship("Subnet", back_populates="scan_histories")
