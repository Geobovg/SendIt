-- f_edits lot ChatGPT spille femmerkamper for seg. Fremgangen i Femmer settes tilbake:
-- AI-stigen til trinn 5 (også beste trinn, så topplista stemmer) og alle kortene til 78 uten ekstra XP.
do $$
declare
  target uuid;
begin
  select id into target from profiles where username_key = 'f_edits';
  if target is null then
    raise notice 'Fant ingen bruker med brukernavnet f_edits';
    return;
  end if;
  update five_profiles set ai_level = 5, best_ai_level = 5 where user_id = target;
  update five_cards set overall = 78, xp = 0 where owner_id = target;
end $$;
