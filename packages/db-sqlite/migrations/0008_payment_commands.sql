-- 0008_payment_commands — Stage 5d: a client-minted command id makes saving a payment, write-off or expense safe to repeat.

ALTER TABLE payment ADD COLUMN command_id TEXT;
ALTER TABLE write_off ADD COLUMN command_id TEXT;
ALTER TABLE expense ADD COLUMN command_id TEXT;
CREATE UNIQUE INDEX ux_payment_command ON payment(business_id, command_id) WHERE command_id IS NOT NULL;
CREATE UNIQUE INDEX ux_write_off_command ON write_off(business_id, command_id) WHERE command_id IS NOT NULL;
CREATE UNIQUE INDEX ux_expense_command ON expense(business_id, command_id) WHERE command_id IS NOT NULL;
CREATE TRIGGER trg_payment_command_frozen BEFORE UPDATE OF command_id ON payment BEGIN SELECT RAISE(ABORT, 'payment is append-only'); END;
CREATE TRIGGER trg_write_off_command_frozen BEFORE UPDATE OF command_id ON write_off BEGIN SELECT RAISE(ABORT, 'write_off is append-only'); END;
CREATE TRIGGER trg_expense_command_frozen BEFORE UPDATE OF command_id ON expense BEGIN SELECT RAISE(ABORT, 'expense is append-only'); END;
