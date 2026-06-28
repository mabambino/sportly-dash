-- Transaction fee monetization model
-- Replaces the fixed monthly-subscription model with a per-transaction fee:
--   fee = round(amount_cents * fee_percent_bps / 10000) + fee_fixed_cents
-- Basis points (bps) are used to avoid floating point: 250 bps = 2.50%.

-- 1. Fee configuration on the club (the platform/processor fee split).
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS fee_percent_bps INTEGER NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS fee_fixed_cents INTEGER NOT NULL DEFAULT 30;

-- 2. Record the computed split on every member payment.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS fee_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_cents INTEGER NOT NULL DEFAULT 0;

-- 3. Trigger to automatically calculate the fee + net amount when a payment
--    is inserted or its amount changes, using the owning club's fee config.
CREATE OR REPLACE FUNCTION public.apply_transaction_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pct_bps INTEGER;
  fixed INTEGER;
BEGIN
  SELECT fee_percent_bps, fee_fixed_cents
    INTO pct_bps, fixed
  FROM public.clubs
  WHERE id = NEW.club_id;

  pct_bps := COALESCE(pct_bps, 0);
  fixed := COALESCE(fixed, 0);

  NEW.fee_cents := ROUND(NEW.amount_cents * pct_bps / 10000.0) + fixed;
  NEW.net_cents := NEW.amount_cents - NEW.fee_cents;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_transaction_fee ON public.payments;
CREATE TRIGGER trg_apply_transaction_fee
  BEFORE INSERT OR UPDATE OF amount_cents ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_transaction_fee();
