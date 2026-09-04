part of '../../app.dart';

const _epiBlue = Color(0xFF168CFF);
const _epiCard = Color(0xFF101A27);
const _epiBackground = Color(0xFF03101B);

class _ModuleError extends StatelessWidget {
  const _ModuleError({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.cloud_off_outlined, size: 46, color: Colors.white54),
        const SizedBox(height: 10),
        const Text('Não foi possível carregar os funcionários.'),
        TextButton(onPressed: onRetry, child: const Text('Tentar novamente')),
      ]));
}

void _message(BuildContext context, String text) {
  final isError = text.toLowerCase().contains('erro') ||
      text.toLowerCase().contains('não foi') ||
      text.toLowerCase().contains('já foi');
  final color = isError ? Colors.orangeAccent : _epiBlue;
  final messenger = ScaffoldMessenger.of(context);
  messenger.clearSnackBars();
  messenger.showSnackBar(SnackBar(
    behavior: SnackBarBehavior.floating,
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 18),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    duration: const Duration(seconds: 3),
    elevation: 8,
    backgroundColor: const Color(0xFF142234),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: BorderSide(color: color.withValues(alpha: .5)),
    ),
    content: Row(children: [
      Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: color.withValues(alpha: .16),
          borderRadius: BorderRadius.circular(11),
        ),
        child: Icon(
          isError ? Icons.info_outline_rounded : Icons.check_rounded,
          color: color,
          size: 22,
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Text(text,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w700)),
      ),
    ]),
  ));
}
