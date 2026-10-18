-- Alternative posisjoner oppdatert fra FotMob (2026-10-18), samme regler som 0112.
-- Bare spillere der listen er endret siden 0112 er med (43 stk).

update player_catalog as catalog
set alt_positions = alt.positions
from (values
    ('desire-doue', array['RW', 'LW', 'ST']),
    ('christian-pulisic', array['ST', 'LW']),
    ('dani-olmo', array['CM', 'LW', 'ST']),
    ('youssouf-fofana', array['CM']),
    ('joelinton', array['CDM', 'LW']),
    ('andre-frank-zambo-anguissa', array['CDM']),
    ('nico-gonzalez', array['CM']),
    ('nahuel-molina', array['LB']),
    ('ola-aina', array['RW']),
    ('matias-soule', array['CAM']),
    ('gabri-veiga', array[]::text[]),
    ('alex-berenguer', array['RW']),
    ('keane-lewis-potter', array['LB', 'RW']),
    ('quentin-merlin', array[]::text[]),
    ('oscar-gloukh', array['CM', 'LW', 'RW']),
    ('maxence-caqueret', array['CDM', 'CAM']),
    ('diego-moreira', array['RW', 'LB']),
    ('florian-neuhaus', array['CAM']),
    ('chidera-ejuke', array[]::text[]),
    ('ernest-nuamah', array['ST']),
    ('dario-essugo', array[]::text[]),
    ('marius-bulter', array['ST', 'CAM']),
    ('woo-yeong-jeong', array['CAM', 'ST']),
    ('rayan-philippe', array['RW', 'CAM']),
    ('santiago-gimenez', array[]::text[]),
    ('andreas-hanche-olsen', array[]::text[]),
    ('andre', array['CM']),
    ('emanuel-emegha', array[]::text[]),
    ('ben-doak', array['LW']),
    ('vinicius-souza', array['CM']),
    ('kalvin-phillips', array['CM']),
    ('el-chadaille-bitshiabu', array[]::text[]),
    ('dani-raba', array['RW']),
    ('benjamin-dominguez', array[]::text[]),
    ('jean-luc-dompe', array[]::text[]),
    ('juan-cuadrado', array[]::text[]),
    ('kosta-nedeljkovic', array[]::text[]),
    ('badredine-bouanani', array[]::text[]),
    ('armindo-sieb', array['RW']),
    ('nelson-weiper', array[]::text[]),
    ('julian-malatini', array[]::text[]),
    ('francis-coquelin', array[]::text[]),
    ('caleb-ekuban', array[]::text[])
) as alt (slug, positions)
where catalog.slug = alt.slug
  and catalog.alt_positions is distinct from alt.positions::text[];

update manager_cards as card
set alt_positions = catalog.alt_positions
from player_catalog as catalog
where card.catalog_id = catalog.id
  and card.alt_positions is distinct from catalog.alt_positions;
