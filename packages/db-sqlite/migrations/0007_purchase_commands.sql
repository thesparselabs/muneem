-- 0007_purchase_commands — Stage 5c: a client-minted command id makes saving a purchase or debit note safe to repeat.

ALTER TABLE purchase ADD COLUMN command_id TEXT;
ALTER TABLE debit_note ADD COLUMN command_id TEXT;
CREATE UNIQUE INDEX ux_purchase_command ON purchase(business_id, command_id) WHERE command_id IS NOT NULL;
CREATE UNIQUE INDEX ux_debit_note_command ON debit_note(business_id, command_id) WHERE command_id IS NOT NULL;
CREATE TRIGGER trg_purchase_command_frozen BEFORE UPDATE OF command_id ON purchase BEGIN SELECT RAISE(ABORT, 'purchase is append-only'); END;
CREATE TRIGGER trg_debit_note_command_frozen BEFORE UPDATE OF command_id ON debit_note BEGIN SELECT RAISE(ABORT, 'debit_note is append-only'); END;
