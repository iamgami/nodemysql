CREATE DATABASE burgers_db;

USE burgers_db;

CREATE TABLE burgers(
    id INT NOT NULL AUTO_INCREMENT,
    burger_name VARCHAR(255) NO NULL,
    devoured BOOLEAN DEFAULT false,
    date_ TIMESTAMP,
    PRIMARY KEY (id)
)






















