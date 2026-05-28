create extension if not exists vector;

create table if not exists agentops_vector_points (
  id text primary key,
  embedding vector(64) not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists agentops_vector_points_embedding_idx
on agentops_vector_points
using ivfflat (embedding vector_cosine_ops)
with (lists = 8);
