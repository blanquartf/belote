-- Custom SQL migration file, put your code below! --
INSERT INTO gamesModes (name)
    VALUES 
    ('Panama'),
    ('Belote'),
    ('Belote a 6'),
    ('Tarot');
INSERT INTO users (pseudo, password, admin,ready,canPlayTarot,canPlayTwoTables)
    VALUES 
    ('adrien', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 1,0,0,0),
    ('florian', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 1,0,0,0),
    ('paul', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 1,0,0,0),
    ('gab', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 1,0,0,0),
    ('seb', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 1,0,0,0),
    ('seb1', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 0,0,0,0),
    ('seb2', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 0,0,0,0),
    ('seb3', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 0,0,0,0),
    ('seb4', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 0,0,0,0),
    ('seb5', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 0,0,0,0),
    ('seb6', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 0,0,0,0),
    ('seb7', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 0,0,0,0),
    ('seb8', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 0,0,0,0),
    ('seb9', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 0,0,0,0),
    ('seb10', '$2b$10$urDSWXcCa/gQ9TBCvDbNh.X65uNvVyIkRON1j1hGIe0gaHSQr/NLu', 0,0,0,0);
    
INSERT INTO tables (name, finished, panama, gamemode_id)
    VALUES 
    ('Panama', 0, 1, 1),
    ('Table 1', 0, 0, 2),
    ('Table 2', 0, 0, 3);

INSERT INTO tables_users (table_id, user_id, team) VALUES
    (2,6,'red'),
    (2,7,'red'),
    (2,8,'black'),
    (2,9,'black');
INSERT INTO tables_users (table_id, user_id, team) VALUES
    (3,10,'red'),
    (3,11,'red'),
    (3,12,'black'),
    (3,13,'black'),
    (3,14,'green'),
    (3,15,'green');