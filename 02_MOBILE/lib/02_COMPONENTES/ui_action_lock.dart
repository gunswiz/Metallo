import 'package:flutter/widgets.dart';

/// Prevents duplicate UI actions; server authorization/idempotency is separate.
class UiActionLock {
  static final _owners = Expando<Set<String>>('metallo-ui-actions');

  static UiActionLock? acquire(BuildContext context, String key) {
    if (!context.mounted) return null;
    final actions = _owners[Navigator.of(context)] ??= <String>{};
    if (!actions.add(key)) return null;
    return UiActionLock._(actions, key);
  }

  UiActionLock._(this._actions, this._key);
  final Set<String> _actions;
  final String _key;
  bool _released = false;

  void release() {
    if (_released) return;
    _released = true;
    _actions.remove(_key);
  }
}
