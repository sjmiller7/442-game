-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
-- -----------------------------------------------------
-- Schema othellodb
-- -----------------------------------------------------
DROP SCHEMA IF EXISTS `othellodb` ;

-- -----------------------------------------------------
-- Schema othellodb
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `othellodb` DEFAULT CHARACTER SET utf8mb3 ;
USE `othellodb` ;

-- -----------------------------------------------------
-- Table `othellodb`.`user`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `othellodb`.`user` ;

CREATE TABLE IF NOT EXISTS `othellodb`.`user` (
  `uID` INT NOT NULL AUTO_INCREMENT,
  `status` VARCHAR(45) NOT NULL,
  `username` VARCHAR(45) NOT NULL,
  `password` VARCHAR(60) NOT NULL,
  PRIMARY KEY (`uID`),
  UNIQUE INDEX `username_UNIQUE` (`username` ASC) VISIBLE,
  UNIQUE INDEX `uID_UNIQUE` (`uID` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 31
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `othellodb`.`game`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `othellodb`.`game` ;

CREATE TABLE IF NOT EXISTS `othellodb`.`game` (
  `gID` INT NOT NULL AUTO_INCREMENT,
  `black` INT NOT NULL,
  `white` INT NOT NULL,
  `turn` VARCHAR(5) NOT NULL,
  PRIMARY KEY (`gID`),
  INDEX `black_user_idx` (`black` ASC) VISIBLE,
  INDEX `white_user_idx` (`white` ASC) VISIBLE,
  CONSTRAINT `black_user`
    FOREIGN KEY (`black`)
    REFERENCES `othellodb`.`user` (`uID`),
  CONSTRAINT `white_user`
    FOREIGN KEY (`white`)
    REFERENCES `othellodb`.`user` (`uID`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `othellodb`.`board`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `othellodb`.`board` ;

CREATE TABLE IF NOT EXISTS `othellodb`.`board` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `gID` INT NOT NULL,
  `board` JSON NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `gID_game_idx` (`gID` ASC) VISIBLE,
  CONSTRAINT `b_gID_game`
    FOREIGN KEY (`gID`)
    REFERENCES `othellodb`.`game` (`gID`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `othellodb`.`game_message`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `othellodb`.`game_message` ;

CREATE TABLE IF NOT EXISTS `othellodb`.`game_message` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `uID` INT NOT NULL,
  `gID` INT NOT NULL,
  `message` VARCHAR(250) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE,
  INDEX `uID_user_idx` (`uID` ASC) VISIBLE,
  INDEX `gID_game_idx` (`gID` ASC) VISIBLE,
  CONSTRAINT `msg_gID_game`
    FOREIGN KEY (`gID`)
    REFERENCES `othellodb`.`game` (`gID`),
  CONSTRAINT `msg_uID_user`
    FOREIGN KEY (`uID`)
    REFERENCES `othellodb`.`user` (`uID`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `othellodb`.`invitation`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `othellodb`.`invitation` ;

CREATE TABLE IF NOT EXISTS `othellodb`.`invitation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `from` INT NOT NULL,
  `to` INT NOT NULL,
  `status` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE,
  INDEX `from_user_idx` (`from` ASC) VISIBLE,
  INDEX `to_user_idx` (`to` ASC) VISIBLE,
  CONSTRAINT `from_user`
    FOREIGN KEY (`from`)
    REFERENCES `othellodb`.`user` (`uID`),
  CONSTRAINT `to_user`
    FOREIGN KEY (`to`)
    REFERENCES `othellodb`.`user` (`uID`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `othellodb`.`lobby_message`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `othellodb`.`lobby_message` ;

CREATE TABLE IF NOT EXISTS `othellodb`.`lobby_message` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `uID` INT NOT NULL,
  `message` VARCHAR(250) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE,
  INDEX `uID_user_idx` (`uID` ASC) VISIBLE,
  CONSTRAINT `lm_uID_user`
    FOREIGN KEY (`uID`)
    REFERENCES `othellodb`.`user` (`uID`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `othellodb`.`piece`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `othellodb`.`piece` ;

CREATE TABLE IF NOT EXISTS `othellodb`.`piece` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `status` VARCHAR(45) NOT NULL,
  `gID` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `gID_game_idx` (`gID` ASC) VISIBLE,
  CONSTRAINT `p_gID_game`
    FOREIGN KEY (`gID`)
    REFERENCES `othellodb`.`game` (`gID`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `othellodb`.`register_session`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `othellodb`.`register_session` ;

CREATE TABLE IF NOT EXISTS `othellodb`.`register_session` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `session_token` VARCHAR(60) NOT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
AUTO_INCREMENT = 53
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `othellodb`.`session`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `othellodb`.`session` ;

CREATE TABLE IF NOT EXISTS `othellodb`.`session` (
  `uID` INT NOT NULL,
  `session_token` VARCHAR(60) NOT NULL,
  `expires` DATETIME NOT NULL,
  PRIMARY KEY (`uID`),
  UNIQUE INDEX `session_token_UNIQUE` (`session_token` ASC) VISIBLE,
  CONSTRAINT `user_session`
    FOREIGN KEY (`uID`)
    REFERENCES `othellodb`.`user` (`uID`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb3;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
