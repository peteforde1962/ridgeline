-- Plan flexibility: let users tailor which activity types their plan includes,
-- which body regions to emphasize, and which MTB skill areas to prioritize.
-- All default to "include everything" so existing plans keep behaving the same.

alter table profiles
  add column if not exists enabled_activities text[] default array['ride','strength','yoga','run','rope']::text[],
  add column if not exists body_focus         text[] default array['legs','core','upper','posterior']::text[],
  add column if not exists training_focus     text[] default array[]::text[];

-- enabled_activities values are session types from the plan template:
--   'ride' | 'strength' | 'yoga' | 'run' | 'rope'
--
-- body_focus (used to weight strength content selection):
--   'legs' | 'core' | 'upper' | 'posterior' | 'mobility'
--
-- training_focus (used to weight ride content selection):
--   'climbing' | 'descending' | 'endurance' | 'power' | 'technical' | 'race'
