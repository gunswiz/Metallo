import 'package:flutter/material.dart';

Future<T?> showLifecycleDialog<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool barrierDismissible = true,
}) async {
  final navigator = Navigator.of(context, rootNavigator: true);
  final route = DialogRoute<T>(
    context: context,
    builder: builder,
    themes: InheritedTheme.capture(from: context, to: navigator.context),
    barrierDismissible: barrierDismissible,
    barrierColor: DialogTheme.of(context).barrierColor ??
        Theme.of(context).dialogTheme.barrierColor ??
        Colors.black54,
    traversalEdgeBehavior: TraversalEdgeBehavior.closedLoop,
  );
  final result = await navigator.push<T>(route);
  // Navigator.pop completes before the reverse transition removes the route.
  // Callers often own TextEditingControllers used by the dialog, so they must
  // not dispose them until the route has actually left the widget tree.
  await route.completed;
  return result;
}

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
  bool scrollContent = false,
  bool showBusyIndicator = false,
  double? busyIndicatorSize,
  TextStyle? errorTextStyle,
}) =>
    showLifecycleDialog<bool>(
      context: context,
      builder: (dialogContext) => _AsyncActionDialog(
        title: title,
        content: content,
        actionLabel: actionLabel,
        onAction: onAction,
        errorText: errorText,
        validate: validate,
        actionIcon: actionIcon,
        cancelLabel: cancelLabel,
        busyActionLabel: busyActionLabel,
        contentCrossAxisAlignment: contentCrossAxisAlignment,
        scrollContent: scrollContent,
        showBusyIndicator: showBusyIndicator,
        busyIndicatorSize: busyIndicatorSize,
        errorTextStyle: errorTextStyle,
      ),
    );

class _AsyncActionDialog extends StatefulWidget {
  const _AsyncActionDialog({
    required this.title,
    required this.content,
    required this.actionLabel,
    required this.onAction,
    required this.errorText,
    required this.validate,
    required this.actionIcon,
    required this.cancelLabel,
    required this.busyActionLabel,
    required this.contentCrossAxisAlignment,
    required this.scrollContent,
    required this.showBusyIndicator,
    required this.busyIndicatorSize,
    required this.errorTextStyle,
  });

  final Widget title;
  final List<Widget> content;
  final String actionLabel;
  final Future<void> Function() onAction;
  final String Function(Object error) errorText;
  final String? Function()? validate;
  final IconData? actionIcon;
  final String cancelLabel;
  final String? busyActionLabel;
  final CrossAxisAlignment contentCrossAxisAlignment;
  final bool scrollContent;
  final bool showBusyIndicator;
  final double? busyIndicatorSize;
  final TextStyle? errorTextStyle;

  @override
  State<_AsyncActionDialog> createState() => _AsyncActionDialogState();
}

class _AsyncActionDialogState extends State<_AsyncActionDialog> {
  bool busy = false;
  String? error;

  Future<void> _submit() async {
    if (busy) return;
    final validationError = widget.validate?.call();
    if (validationError != null) {
      setState(() => error = validationError);
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.onAction();
      if (mounted) Navigator.pop(context, true);
    } catch (exception) {
      if (mounted) setState(() => error = widget.errorText(exception));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget _content(BuildContext context) {
    final column = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: widget.contentCrossAxisAlignment,
      children: [
        ...widget.content,
        if (error != null) ...[
          const SizedBox(height: 10),
          Text(
            error!,
            style: widget.errorTextStyle ??
                TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
      ],
    );
    return widget.scrollContent ? SingleChildScrollView(child: column) : column;
  }

  Widget _actionChild() {
    if (busy && widget.showBusyIndicator) {
      if (widget.busyIndicatorSize == null) {
        return const CircularProgressIndicator(strokeWidth: 2);
      }
      return SizedBox(
        width: widget.busyIndicatorSize,
        height: widget.busyIndicatorSize,
        child: const CircularProgressIndicator(strokeWidth: 2),
      );
    }
    return Text(
      widget.busyActionLabel != null && busy
          ? widget.busyActionLabel!
          : widget.actionLabel,
    );
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: widget.title,
        content: _content(context),
        actions: [
          TextButton(
            onPressed: busy ? null : () => Navigator.pop(context, false),
            child: Text(widget.cancelLabel),
          ),
          if (widget.actionIcon == null)
            FilledButton(
              onPressed: busy ? null : _submit,
              child: _actionChild(),
            )
          else
            FilledButton.icon(
              onPressed: busy ? null : _submit,
              icon: Icon(widget.actionIcon),
              label: _actionChild(),
            ),
        ],
      );
}
