import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  late String sql;

  setUpAll(() {
    sql = File(
      'supabase/migrations/20260904193736_secure_epi_mutations.sql',
    ).readAsStringSync();
  });

  test('removes broad EPI mutation privileges', () {
    expect(sql, contains('revoke execute on all functions in schema public'));
    expect(sql, contains('alter default privileges for role postgres'));
    expect(sql, contains('drop policy if exists epi_stock_delivery_update'));
    expect(sql, contains('drop policy if exists epi_deliveries_write'));
    expect(sql, contains('drop policy if exists epi_requests_write'));
    expect(sql,
        contains('revoke all on table public.epi_stock_batches from anon'));
    expect(
        sql,
        contains(
            'revoke insert, update, delete on table public.epi_deliveries'));
    expect(
        sql, contains('grant update (current_status, closed_at, closed_by)'));
  });

  test('uses checked server operations for stock mutations', () {
    expect(
        RegExp(r"security definer\s+set search_path = ''", multiLine: true)
            .allMatches(sql)
            .length,
        greaterThanOrEqualTo(4));
    expect(sql, contains("and p.role in ('admin', 'engineer')"));
    expect(sql, contains('for update;'));
    expect(sql, contains('insufficient_epi_stock'));
    expect(sql, contains('or variant = v_request.requested_variant'));
  });

  test('keeps delivery history immutable and server-attributed', () {
    expect(sql, contains("raise exception 'immutable_delivery_history'"));
    expect(sql, contains('new.closed_at := now()'));
    expect(sql, contains('new.closed_by := (select auth.uid())'));
    expect(sql, contains('delivered_by'));
    expect(sql, contains('(select auth.uid())'));
  });

  test('reconciles a batch only through the variant-aware trigger', () {
    final batchStart = sql.indexOf(
      'create or replace function public.register_epi_delivery_batch',
    );
    final batchEnd = sql.indexOf(
      'revoke execute on function public.register_epi_delivery_batch',
      batchStart,
    );
    final batchFunction = sql.substring(batchStart, batchEnd);
    expect(batchFunction, isNot(contains('v_delivered_remaining')));
    expect(batchFunction, isNot(contains('update public.epi_requests')));
  });
}
