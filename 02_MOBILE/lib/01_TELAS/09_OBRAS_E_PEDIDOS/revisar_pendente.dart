import 'package:flutter/material.dart';
import 'package:metallo/06_ACESSO_A_DADOS/site_operations_repository.dart';

Future<void> showPendingReview(BuildContext context, SiteOperationsRepository repo,
    Map<String, dynamic> entry, VoidCallback onSaved) async {
  final data=Map<String,dynamic>.from(entry['data'] as Map);
  final quantity=TextEditingController(text:data['quantity']?.toString()??'');
  final note=TextEditingController(text:data['note']?.toString()??'');
  try {
    final confirmed=await showDialog<bool>(context:context,builder:(dialog)=>AlertDialog(
      title:const Text('Revisar lançamento recusado'),
      content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[
        Text(entry['error']?.toString()??'Confira o lançamento.'),
        if(data.containsKey('quantity')) TextField(controller:quantity,keyboardType:TextInputType.number,decoration:const InputDecoration(labelText:'Quantidade')),
        TextField(controller:note,decoration:const InputDecoration(labelText:'Observação')),
        if(data['lines'] is List) const Text('Para mudar os lotes, retire esta entrega recusada e monte novamente com os lotes corretos.'),
        const Text('A resposta de recusa confirma que essa tentativa não foi gravada. A identificação será preservada no reenvio.'),
      ])),
      actions:[TextButton(onPressed:()=>Navigator.pop(dialog,false),child:const Text('Cancelar')),
        FilledButton(onPressed:()=>Navigator.pop(dialog,true),child:const Text('Guardar revisão'))]));
    if(confirmed!=true)return;
    if(data.containsKey('quantity')) {
      final value=int.tryParse(quantity.text);
      if(value==null||value<1)throw StateError('Informe uma quantidade inteira maior que zero.');
      data['quantity']=value;
    }
    data['note']=note.text.trim();
    await repo.revisePending(entry['id'].toString(),data);
    onSaved();
    if(context.mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Revisão guardada. Use Enviar pendentes para confirmar.')));
  }catch(error){
    if(context.mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(error.toString())));
  }finally{quantity.dispose();note.dispose();}
}
