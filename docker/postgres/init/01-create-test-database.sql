-- Runs once, when the PostgreSQL volume is first created (docker-entrypoint-initdb.d).
-- A separate database keeps end-to-end tests (`npm run test:e2e`) away from development data.
CREATE DATABASE cronflow_test OWNER cronflow;
