import 'package:flutter/material.dart';

Future<bool?> showAsyncActionDialog({
  required BuildContext context,
  required Widget title,
  required List<Widget> content,
  required String actionLabel,
  required Future<void> Function() onAction,
  required String Function(Object error) errorText,
  String? Function()? validate,
  IconData? actionIcon,
  String cancelLabel = 'Cancelar',
  String? busyActionLabel,
  CrossAxisAlignment contentCrossAxisAlignment = CrossAxisAlignment.center,
}) {
  var busy = false;
  String? error;
  return showDialog<bool>(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setLocal) => AlertDialog(
        title: title,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: contentCrossAxisAlignment,
          children: [
            ...content,
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(
                error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: busy ? null : () => Navigator.pop(dialogContext, false),
            child: Text(cancelLabel),
          ),
          if (actionIcon == null)
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      if (busy) return;
                      final validationError = validate?.call();
                      if (validationError != null) {
                        setLocal(() => error = validationError);
                        return;
                      }
                      setLocal(() {
                        busy = true;
                        error = null;
                      });
                      try {
                        await onAction();
                        if (dialogContext.mounted) {
                          Navigator.pop(dialogContext, true);
                        }
                      } catch (exception) {
                        if (dialogContext.mounted) {
                          setLocal(() => error = errorText(exception));
                        }
                      } finally {
                        if (dialogContext.mounted) {
                          setLocal(() => busy = false);
                        }
                      }
                    },
              child: Text(busyActionLabel != null && busy
                  ? busyActionLabel
                  : actionLabel),
            )
          else
            FilledButton.icon(
              onPressed: busy
                  ? null
                  : () async {
                      if (busy) return;
                      final validationError = validate?.call();
                      if (validationError != null) {
                        setLocal(() => error = validationError);
                        return;
                      }
                      setLocal(() {
                        busy = true;
                        error = null;
                      });
                      try {
                        await onAction();
                        if (dialogContext.mounted) {
                          Navigator.pop(dialogContext, true);
                        }
                      } catch (exception) {
                        if (dialogContext.mounted) {
                          setLocal(() => error = errorText(exception));
                        }
                      } finally {
                        if (dialogContext.mounted) {
                          setLocal(() => busy = false);
                        }
                      }
                    },
              icon: Icon(actionIcon),
              label: Text(busyActionLabel != null && busy
                  ? busyActionLabel
                  : actionLabel),
            ),
        ],
      ),
    ),
  );
}
