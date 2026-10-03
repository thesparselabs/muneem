-- 0009_allocation_dates — Stage 5h (#5): business dates on allocations, so ageing "as of" a past date leaves out
-- payments applied and voided after it.

ALTER TABLE allocation ADD COLUMN allocated_on TEXT;
ALTER TABLE allocation ADD COLUMN voided_on TEXT;
UPDATE allocation SET allocated_on = substr(allocated_at, 1, 10);
UPDATE allocation SET voided_on = substr(voided_at, 1, 10) WHERE voided_at IS NOT NULL;
CREATE TRIGGER trg_allocation_dated BEFORE INSERT ON allocation WHEN NEW.allocated_on IS NULL
  BEGIN SELECT RAISE(ABORT, 'allocation needs allocated_on'); END;
CREATE TRIGGER trg_allocation_on_frozen BEFORE UPDATE OF allocated_on ON allocation
  BEGIN SELECT RAISE(ABORT, 'allocation is append-only'); END;
CREATE TRIGGER trg_allocation_voided_on BEFORE UPDATE OF voided_at ON allocation WHEN NEW.voided_on IS NULL
  BEGIN SELECT RAISE(ABORT, 'a void needs voided_on'); END;
