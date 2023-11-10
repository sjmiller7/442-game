-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema OthelloDB
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema OthelloDB
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `OthelloDB` DEFAULT CHARACTER SET utf8 ;
USE `OthelloDB` ;

-- -----------------------------------------------------
-- Table `OthelloDB`.`User`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `OthelloDB`.`User` ;

CREATE TABLE IF NOT EXISTS `OthelloDB`.`User` (
  `uID` INT NOT NULL AUTO_INCREMENT,
  `status` VARCHAR(45) NOT NULL,
  `username` VARCHAR(45) NOT NULL,
  `password` VARCHAR(60) NOT NULL,
  PRIMARY KEY (`uID`),
  UNIQUE INDEX `username_UNIQUE` (`username` ASC) VISIBLE,
  UNIQUE INDEX `uID_UNIQUE` (`uID` ASC) VISIBLE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `OthelloDB`.`Invitation`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `OthelloDB`.`Invitation` ;

CREATE TABLE IF NOT EXISTS `OthelloDB`.`Invitation` (
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
    REFERENCES `OthelloDB`.`User` (`uID`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `to_user`
    FOREIGN KEY (`to`)
    REFERENCES `OthelloDB`.`User` (`uID`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `OthelloDB`.`Lobby_Message`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `OthelloDB`.`Lobby_Message` ;

CREATE TABLE IF NOT EXISTS `OthelloDB`.`Lobby_Message` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `uID` INT NOT NULL,
  `message` VARCHAR(250) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE,
  INDEX `uID_user_idx` (`uID` ASC) VISIBLE,
  CONSTRAINT `lm_uID_user`
    FOREIGN KEY (`uID`)
    REFERENCES `OthelloDB`.`User` (`uID`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `OthelloDB`.`Game`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `OthelloDB`.`Game` ;

CREATE TABLE IF NOT EXISTS `OthelloDB`.`Game` (
  `gID` INT NOT NULL AUTO_INCREMENT,
  `black` INT NOT NULL,
  `white` INT NOT NULL,
  `turn` VARCHAR(5) NOT NULL,
  PRIMARY KEY (`gID`),
  INDEX `black_user_idx` (`black` ASC) VISIBLE,
  INDEX `white_user_idx` (`white` ASC) VISIBLE,
  CONSTRAINT `black_user`
    FOREIGN KEY (`black`)
    REFERENCES `OthelloDB`.`User` (`uID`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `white_user`
    FOREIGN KEY (`white`)
    REFERENCES `OthelloDB`.`User` (`uID`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `OthelloDB`.`Board`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `OthelloDB`.`Board` ;

CREATE TABLE IF NOT EXISTS `OthelloDB`.`Board` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `gID` INT NOT NULL,
  `board` JSON NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `gID_game_idx` (`gID` ASC) VISIBLE,
  CONSTRAINT `b_gID_game`
    FOREIGN KEY (`gID`)
    REFERENCES `OthelloDB`.`Game` (`gID`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `OthelloDB`.`Piece`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `OthelloDB`.`Piece` ;

CREATE TABLE IF NOT EXISTS `OthelloDB`.`Piece` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `status` VARCHAR(45) NOT NULL,
  `gID` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `gID_game_idx` (`gID` ASC) VISIBLE,
  CONSTRAINT `p_gID_game`
    FOREIGN KEY (`gID`)
    REFERENCES `OthelloDB`.`Game` (`gID`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `OthelloDB`.`Game_Message`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `OthelloDB`.`Game_Message` ;

CREATE TABLE IF NOT EXISTS `OthelloDB`.`Game_Message` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `uID` INT NOT NULL,
  `gID` INT NOT NULL,
  `message` VARCHAR(250) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE,
  INDEX `uID_user_idx` (`uID` ASC) VISIBLE,
  INDEX `gID_game_idx` (`gID` ASC) VISIBLE,
  CONSTRAINT `msg_uID_user`
    FOREIGN KEY (`uID`)
    REFERENCES `OthelloDB`.`User` (`uID`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `msg_gID_game`
    FOREIGN KEY (`gID`)
    REFERENCES `OthelloDB`.`Game` (`gID`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
