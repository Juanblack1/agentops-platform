create table if not exists agentops_snapshots (
  id text primary key,
  schema_version integer not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

insert into agentops_snapshots (id, schema_version, payload)
values (
  'default',
  1,
  '{
    "schemaVersion": 1,
    "documents": [],
    "tickets": [],
    "agentRuns": [],
    "evaluations": [],
    "approvalRequests": [],
    "auditEvents": [],
    "outboxMessages": []
  }'::jsonb
)
on conflict (id) do nothing;
