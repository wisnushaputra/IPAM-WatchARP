import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, engine, get_db
from app.models import Subnet, IpAddress, ScanHistory


def test_models_creation_and_relationships():
    mem_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=mem_engine)
    Session = sessionmaker(bind=mem_engine)
    session = Session()

    subnet = Subnet(name="Test Subnet", cidr="192.168.1.0/24", gateway="192.168.1.1")
    session.add(subnet)
    session.commit()

    ip = IpAddress(
        subnet_id=subnet.id,
        ip_address="192.168.1.10",
        admin_status="available",
        reconciliation_status="FREE",
    )
    session.add(ip)

    history = ScanHistory(
        subnet_id=subnet.id,
        total_online=1,
        total_anomalies=0,
        duration_ms=120,
    )
    session.add(history)
    session.commit()

    assert subnet.id is not None
    assert len(subnet.ip_addresses) == 1
    assert subnet.ip_addresses[0].ip_address == "192.168.1.10"
    assert len(subnet.scan_histories) == 1
    assert subnet.scan_histories[0].duration_ms == 120


def test_cascade_delete():
    mem_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=mem_engine)
    Session = sessionmaker(bind=mem_engine)
    session = Session()

    subnet = Subnet(name="Subnet To Delete", cidr="10.0.0.0/24", gateway="10.0.0.1")
    session.add(subnet)
    session.commit()

    ip = IpAddress(
        subnet_id=subnet.id,
        ip_address="10.0.0.5",
        admin_status="assigned",
        reconciliation_status="VALID_ONLINE",
    )
    history = ScanHistory(
        subnet_id=subnet.id,
        total_online=1,
        total_anomalies=0,
        duration_ms=50,
    )
    session.add_all([ip, history])
    session.commit()

    # Verify records exist
    assert session.query(IpAddress).filter_by(subnet_id=subnet.id).count() == 1
    assert session.query(ScanHistory).filter_by(subnet_id=subnet.id).count() == 1

    # Delete subnet
    session.delete(subnet)
    session.commit()

    # Verify cascade deletion
    assert session.query(IpAddress).filter_by(subnet_id=subnet.id).count() == 0
    assert session.query(ScanHistory).filter_by(subnet_id=subnet.id).count() == 0


def test_sqlite_engine_pragmas():
    with engine.connect() as conn:
        busy_timeout = conn.exec_driver_sql("PRAGMA busy_timeout;").scalar()
        assert busy_timeout == 5000
        journal_mode = conn.exec_driver_sql("PRAGMA journal_mode;").scalar()
        assert journal_mode.upper() in ["WAL", "MEMORY"]


def test_get_db_generator():
    db_gen = get_db()
    session = next(db_gen)
    assert session is not None
    # Generator cleanup
    with pytest.raises(StopIteration):
        next(db_gen)
