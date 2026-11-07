// Shared by the grid, the table and the legend so a status always looks the same everywhere.
export const STATUS_LABELS = {
  FREE: 'Free',
  VALID_ONLINE: 'Valid online',
  OFFLINE: 'Offline',
  ROGUE_DEVICE: 'Rogue device',
  MAC_MISMATCH: 'MAC mismatch',
  RESERVED: 'Reserved',
};

// Fill style carries meaning on top of color: dashed = expected but missing,
// hatched = blocked off, solid red = conflict that needs a person.
export const STATUS_CELL = {
  FREE: 'bg-surface border-line text-muted',
  VALID_ONLINE: 'bg-ok/15 border-ok text-ink',
  OFFLINE: 'bg-sunken border-dashed border-line-strong text-muted',
  ROGUE_DEVICE: 'bg-warn/40 border-warn text-ink font-semibold',
  MAC_MISMATCH: 'bg-bad border-bad text-paper font-semibold',
  RESERVED: 'hatch bg-surface border-line-strong text-ink',
};

export const STATUS_TEXT = {
  FREE: 'text-muted',
  VALID_ONLINE: 'text-ok',
  OFFLINE: 'text-muted',
  ROGUE_DEVICE: 'text-warn',
  MAC_MISMATCH: 'text-bad',
  RESERVED: 'text-ink',
};

export const statusLabel = (s) => STATUS_LABELS[s] || s || STATUS_LABELS.FREE;
