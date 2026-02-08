alter table if exists project_traceability
add column if not exists code_index int;

create index if not exists idx_project_traceability_type_seq
on project_traceability(project_id, type_code, code_index);

with ranked as (
	select id,
				 row_number() over (partition by project_id, type_code order by created_at, id) as rn
	from project_traceability
)
update project_traceability pt
set code_index = ranked.rn
from ranked
where pt.id = ranked.id
	and pt.code_index is null;
