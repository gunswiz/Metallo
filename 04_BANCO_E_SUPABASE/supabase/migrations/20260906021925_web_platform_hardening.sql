-- Non-destructive indexes for foreign-key checks, audit joins and the paginated
-- Web views. They also remove the current Supabase advisor warnings for
-- uncovered foreign keys without changing any business rule.
create index if not exists epi_deliveries_item_id_idx
  on public.epi_deliveries(item_id);
create index if not exists epi_deliveries_stock_batch_id_idx
  on public.epi_deliveries(stock_batch_id);
create index if not exists epi_deliveries_delivered_by_idx
  on public.epi_deliveries(delivered_by);
create index if not exists epi_deliveries_closed_by_idx
  on public.epi_deliveries(closed_by);
create index if not exists epi_employee_item_sets_updated_by_idx
  on public.epi_employee_item_sets(updated_by);
create index if not exists epi_employees_created_by_idx
  on public.epi_employees(created_by);
create index if not exists epi_items_created_by_idx
  on public.epi_items(created_by);
create index if not exists epi_monthly_acknowledgements_confirmed_by_idx
  on public.epi_monthly_acknowledgements(confirmed_by);
create index if not exists epi_requests_requested_by_idx
  on public.epi_requests(requested_by);
create index if not exists epi_requests_fulfilled_by_idx
  on public.epi_requests(fulfilled_by);
create index if not exists epi_stock_batches_created_by_idx
  on public.epi_stock_batches(created_by);
create index if not exists work_locations_created_by_idx
  on public.work_locations(created_by);

-- Search/order paths used by the Web repository. Partial indexes keep them
-- compact while matching the active-record filters already used by Mobile.
create index if not exists items_active_type_name_idx
  on public.items(item_type, name) where active;
create index if not exists assets_active_created_at_idx
  on public.assets(created_at desc) where active;
create index if not exists epi_employees_active_name_idx
  on public.epi_employees(full_name) where active;
