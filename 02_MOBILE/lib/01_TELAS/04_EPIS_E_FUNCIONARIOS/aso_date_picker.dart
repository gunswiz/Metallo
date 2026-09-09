import 'package:flutter/material.dart';

const asoDatePickerLocale = Locale('pt', 'BR');

Future<DateTime?> showAsoDatePicker(
  BuildContext context, {
  required String helpText,
  required DateTime initialDate,
  required DateTime firstDate,
  required DateTime lastDate,
}) {
  return showDatePicker(
    context: context,
    locale: asoDatePickerLocale,
    helpText: helpText,
    initialDate: initialDate,
    firstDate: firstDate,
    lastDate: lastDate,
  );
}
