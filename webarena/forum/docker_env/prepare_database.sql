TRUNCATE submission_votes;
DELETE FROM comments WHERE timestamp >= '2023-02-19 00:00:00+00';
DELETE FROM submissions WHERE timestamp >= '2023-02-19 00:00:00+00';
SET max_parallel_maintenance_workers = 0;
SET maintenance_work_mem = '64MB';
VACUUM FULL ANALYZE;
