INSERT INTO gamesModes (name, priority, minPlayerCount, maxPlayerCount)
VALUES 
  ('Panama'),
  ('Belote'),
  ('Belote a 6'),
  ('Tarot');
/* test4269, */
INSERT INTO users (pseudo, password, admin)
VALUES 
  ('adrien', '$2b$10$kox6G.ucF8li6OQcflmfMu3jteUWnlsEZnFZPFl7U21QB58ctT54S,', 1),
  ('florian', 'tmp$2b$10$kox6G.ucF8li6OQcflmfMu3jteUWnlsEZnFZPFl7U21QB58ctT54S4269,', 1),
  ('paul', '$2b$10$kox6G.ucF8li6OQcflmfMu3jteUWnlsEZnFZPFl7U21QB58ctT54S,', 1),
  ('seb', '$2b$10$kox6G.ucF8li6OQcflmfMu3jteUWnlsEZnFZPFl7U21QB58ctT54S,', 1),
  ('gab', '$2b$10$kox6G.ucF8li6OQcflmfMu3jteUWnlsEZnFZPFl7U21QB58ctT54S,', 1);

INSERT INTO tables (name, finished, panama, gamemodeId)
VALUES 
  ('Panama', false, true, 1);