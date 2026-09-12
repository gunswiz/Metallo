import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

Future<Uint8List> buildIndividualEpiPdf(
    {required Map<String, dynamic> person,
    required List<Map<String, dynamic>> deliveries,
    required String generatedBy,
    DateTime? generatedAt}) async {
  if (deliveries.any((row) => row['employee_id'] != person['id'])) {
    throw StateError('O relatório contém registros de outro funcionário.');
  }
  final rows = deliveries
      .where((row) => (row['epi_items'] as Map?)?['item_kind'] == 'epi')
      .toList()
    ..sort((a, b) =>
        a['delivered_at'].toString().compareTo(b['delivered_at'].toString()));
  String date(dynamic value) {
    final d = DateTime.tryParse(value.toString())
        ?.toUtc()
        .subtract(const Duration(hours: 3));
    return d == null
        ? '-'
        : '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }

  final pdf = pw.Document(
      title: 'Ficha de EPI - ${person['full_name']}', author: 'Metallo');
  final blue = PdfColor.fromHex('#103F7A');
  pdf.addPage(pw.MultiPage(
    pageFormat: PdfPageFormat.a4,
    margin: const pw.EdgeInsets.all(36),
    maxPages: 500,
    header: (context) =>
        pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
      pw.Text('METALLO',
          style: pw.TextStyle(
              fontSize: 20, color: blue, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 10),
      pw.Text('Ficha individual de recebimento de EPI',
          style: pw.TextStyle(fontSize: 15, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 10),
      pw.Text(person['full_name']?.toString() ?? 'Funcionário',
          style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 5),
      pw.Text(
          'Matrícula: ${person['registration_code'] ?? 'Não informada'} | Profissão: ${person['profession'] ?? '-'}',
          style: const pw.TextStyle(fontSize: 9)),
      pw.SizedBox(height: 5),
      pw.Text('Período: todo o histórico disponível',
          style: const pw.TextStyle(fontSize: 9)),
      pw.SizedBox(height: 18),
    ]),
    footer: (context) =>
        pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
      pw.Divider(),
      pw.Text(
          'Página ${context.pageNumber} de ${context.pagesCount} | ${person['full_name']}',
          style: const pw.TextStyle(fontSize: 8)),
      pw.Text(
          'Gerado por $generatedBy em ${date((generatedAt ?? DateTime.now()).toIso8601String())}',
          style: const pw.TextStyle(fontSize: 7)),
    ]),
    build: (context) => [
      if (rows.isEmpty) pw.Text('Nenhuma entrega de EPI registrada.'),
      if (rows.isNotEmpty)
        pw.TableHelper.fromTextArray(
            headers: ['Entrega', 'Item / variante', 'C.A.', 'Qtd.'],
            headerDecoration:
                pw.BoxDecoration(color: PdfColor.fromHex('#E6EFF8')),
            headerStyle:
                pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9),
            cellStyle: const pw.TextStyle(fontSize: 9),
            cellPadding: const pw.EdgeInsets.all(7),
            columnWidths: {
              0: const pw.FixedColumnWidth(65),
              1: const pw.FlexColumnWidth(),
              2: const pw.FixedColumnWidth(75),
              3: const pw.FixedColumnWidth(40)
            },
            data: rows
                .map((row) => [
                      date(row['delivered_at']),
                      '${(row['epi_items'] as Map?)?['name'] ?? 'EPI'}${row['variant_snapshot'] == null ? '' : ' - ${row['variant_snapshot']}'}',
                      row['ca_snapshot'] ?? 'Não informado',
                      row['quantity'].toString()
                    ])
                .toList()),
      pw.SizedBox(height: 24),
      pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Text(
            'Confirmo o recebimento das ${rows.fold<int>(0, (sum, row) => sum + (row['quantity'] as num).toInt())} unidades de EPI relacionadas nesta ficha.',
            style: const pw.TextStyle(fontSize: 10)),
        pw.SizedBox(height: 45),
        pw.Row(children: [
          pw.Expanded(
              child: pw.Column(children: [
            pw.Divider(),
            pw.Text('Assinatura do funcionário',
                style: const pw.TextStyle(fontSize: 9))
          ])),
          pw.SizedBox(width: 30),
          pw.Text('Data: ____ / ____ / ________',
              style: const pw.TextStyle(fontSize: 9))
        ]),
        pw.SizedBox(height: 35),
        pw.SizedBox(
            width: 320,
            child: pw.Column(children: [
              pw.Divider(),
              pw.Text('Responsável pela entrega / conferência',
                  style: const pw.TextStyle(fontSize: 9))
            ])),
      ]),
    ],
  ));
  return pdf.save();
}
