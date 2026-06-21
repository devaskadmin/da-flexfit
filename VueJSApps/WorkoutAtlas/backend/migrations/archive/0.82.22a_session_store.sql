-- FlexFit v0.82.22a - Session verification repair
-- MySQL session store schema for connect-mysql2 using table: user_sessions
--
-- Notes:
-- connect-mysql2 requires: sid, session, expires
-- Requested diagnostic fields are also included: session_id, expires_at, data, created_date

CREATE TABLE IF NOT EXISTS user_sessions (
  sid VARCHAR(255) NOT NULL,
  session LONGTEXT NOT NULL,
  expires INT NULL,

  -- requested diagnostic columns
  session_id VARCHAR(255) NOT NULL,
  expires_at DATETIME NULL,
  data LONGTEXT NULL,
  created_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (sid),
  KEY idx_user_sessions_expires (expires),
  KEY idx_user_sessions_expires_at (expires_at),
  KEY idx_user_sessions_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Keep requested columns synchronized with connect-mysql2 core columns.
DROP TRIGGER IF EXISTS trg_user_sessions_bi;
CREATE TRIGGER trg_user_sessions_bi
BEFORE INSERT ON user_sessions
FOR EACH ROW
BEGIN
  SET NEW.session_id = NEW.sid;
  SET NEW.data = NEW.session;
  SET NEW.expires_at = IF(NEW.expires IS NULL OR NEW.expires = 0, NULL, FROM_UNIXTIME(NEW.expires));
END;

DROP TRIGGER IF EXISTS trg_user_sessions_bu;
CREATE TRIGGER trg_user_sessions_bu
BEFORE UPDATE ON user_sessions
FOR EACH ROW
BEGIN
  SET NEW.session_id = NEW.sid;
  SET NEW.data = NEW.session;
  SET NEW.expires_at = IF(NEW.expires IS NULL OR NEW.expires = 0, NULL, FROM_UNIXTIME(NEW.expires));
END;
