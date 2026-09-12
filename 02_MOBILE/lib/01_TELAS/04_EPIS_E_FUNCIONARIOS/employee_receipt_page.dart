import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'package:metallo/04_FUNCOES_E_LOGICA/epi_individual_pdf.dart';
import 'package:metallo/06_ACESSO_A_DADOS/epi_repository.dart';

class EmployeeReceiptPage extends StatefulWidget {
  const EmployeeReceiptPage(
      {super.key, required this.repo, required this.person});
  final EpiRepository repo;
  final Map<String, dynamic> person;
  @override
  State<EmployeeReceiptPage> createState() => _EmployeeReceiptPageState();
}

class _EmployeeReceiptPageState extends State<EmployeeReceiptPage> {
  late final Future<Uint8List> _pdf = _load();
  Future<Uint8List> _load() async {
    final rows =
        await widget.repo.fetchEmployeeReceipt(widget.person['id'].toString());
    final profile = await widget.repo.client
        .from('profiles')
        .select('full_name')
        .eq('id', widget.repo.client.auth.currentUser!.id)
        .single();
    return buildIndividualEpiPdf(
        person: widget.person,
        deliveries: rows,
        generatedBy: profile['full_name'].toString());
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Ficha individual de EPI')),
      body: FutureBuilder<Uint8List>(
          future: _pdf,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return const Center(
                  child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Text(
                          'Não foi possível gerar a ficha completa. Confira a conexão e abra novamente.')));
            }
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            return PdfPreview(
                build: (_) => snapshot.data!,
                pdfFileName: 'ficha-epi-${widget.person['id']}.pdf',
                canChangeOrientation: false,
                canChangePageFormat: false,
                allowPrinting: true,
                allowSharing: true);
          }));
}
