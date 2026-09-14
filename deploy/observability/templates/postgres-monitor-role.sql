SELECT format(
  'CREATE ROLE cinematacms_monitor LOGIN PASSWORD %L',
  :'monitor_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cinematacms_monitor')
\gexec

ALTER ROLE cinematacms_monitor WITH PASSWORD :'monitor_password';
GRANT pg_monitor TO cinematacms_monitor;
