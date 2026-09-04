part of '../../app.dart';

class ConsumptionDonutChart extends StatelessWidget {
  const ConsumptionDonutChart(
      {super.key, required this.data, this.showLabels = false});
  final List<Map<String, dynamic>> data;
  final bool showLabels;
  @override
  Widget build(BuildContext context) => CustomPaint(
      painter: _DonutPainter(data),
      child: showLabels
          ? Align(
              alignment: Alignment.bottomCenter,
              child: Wrap(
                  spacing: 12,
                  runSpacing: 6,
                  alignment: WrapAlignment.center,
                  children: [
                    for (int i = 0; i < data.length && i < 6; i++)
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        Container(
                            width: 8,
                            height: 8,
                            color: _consumptionColors[
                                i % _consumptionColors.length]),
                        const SizedBox(width: 5),
                        Text(
                            '${data[i]['name']} ${(data[i]['pct'] as double).toStringAsFixed(0)}%',
                            style: const TextStyle(fontSize: 10))
                      ])
                  ]))
          : const SizedBox.expand());
}

class _DonutPainter extends CustomPainter {
  _DonutPainter(this.data);
  final List<Map<String, dynamic>> data;
  @override
  void paint(Canvas canvas, Size size) {
    final total = data.fold<double>(0, (a, e) => a + (e['qty'] as double));
    if (total == 0) return;
    final c = Offset(size.width / 2,
        showCenter(size.height) ? size.height * .42 : size.height / 2);
    final r = (size.shortestSide * .36).clamp(20.0, 88.0).toDouble();
    final rect = Rect.fromCircle(center: c, radius: r);
    var start = -1.57079632679;
    for (int i = 0; i < data.length; i++) {
      final sweep = (data[i]['qty'] as double) / total * 6.28318530718;
      final p = Paint()
        ..color = _consumptionColors[i % _consumptionColors.length]
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * .38
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(rect, start, sweep, false, p);
      start += sweep;
    }
  }

  bool showCenter(double h) => h > 180;
  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) => true;
}

class ConsumptionLineChart extends StatelessWidget {
  const ConsumptionLineChart({super.key, required this.data});
  final List<Map<String, dynamic>> data;
  @override
  Widget build(BuildContext context) =>
      CustomPaint(painter: _LinePainter(data), child: const SizedBox.expand());
}

class _LinePainter extends CustomPainter {
  _LinePainter(this.data);
  final List<Map<String, dynamic>> data;
  @override
  void paint(Canvas canvas, Size size) {
    final values = data.map((e) => e['qty'] as double).toList();
    final max =
        values.isEmpty ? 1.0 : values.fold<double>(0, (a, b) => a > b ? a : b);
    final left = 34.0, right = 10.0, top = 12.0, bottom = 28.0;
    final w = size.width - left - right, h = size.height - top - bottom;
    final grid = Paint()
      ..color = Colors.white.withValues(alpha: .07)
      ..strokeWidth = 1;
    for (int i = 0; i < 5; i++) {
      final y = top + h * i / 4;
      canvas.drawLine(Offset(left, y), Offset(left + w, y), grid);
    }
    if (data.isEmpty) return;
    final path = Path();
    final fill = Path();
    for (int i = 0; i < data.length; i++) {
      final x = left + (data.length == 1 ? 0.0 : w * i / (data.length - 1));
      final y =
          top + h - (max == 0 ? 0.0 : (data[i]['qty'] as double) / max * h);
      if (i == 0) {
        path.moveTo(x, y);
        fill.moveTo(x, top + h);
        fill.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fill.lineTo(x, y);
      }
      final tp = TextPainter(
          text: TextSpan(
              text: data[i]['label'].toString(),
              style: const TextStyle(fontSize: 9, color: Colors.white54)),
          textDirection: TextDirection.ltr)
        ..layout();
      tp.paint(canvas, Offset(x - tp.width / 2, top + h + 8));
      final vp = TextPainter(
          text: TextSpan(
              text: _formatQty(data[i]['qty'] as double),
              style: const TextStyle(
                  fontSize: 9,
                  color: Colors.white70,
                  fontWeight: FontWeight.w700)),
          textDirection: TextDirection.ltr)
        ..layout();
      vp.paint(canvas, Offset(x - vp.width / 2, y - 17));
    }
    fill.lineTo(left + w, top + h);
    fill.close();
    canvas.drawPath(
        fill,
        Paint()
          ..shader = LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                const Color(0xFF258CFF).withValues(alpha: .35),
                const Color(0xFF258CFF).withValues(alpha: .02)
              ]).createShader(Rect.fromLTWH(left, top, w, h)));
    canvas.drawPath(
        path,
        Paint()
          ..color = const Color(0xFF258CFF)
          ..strokeWidth = 2.2
          ..style = PaintingStyle.stroke);
    for (int i = 0; i < data.length; i++) {
      final x = left + (data.length == 1 ? 0.0 : w * i / (data.length - 1));
      final y =
          top + h - (max == 0 ? 0.0 : (data[i]['qty'] as double) / max * h);
      canvas.drawCircle(
          Offset(x, y), 4, Paint()..color = const Color(0xFF258CFF));
      canvas.drawCircle(Offset(x, y), 2, Paint()..color = Colors.white);
    }
  }

  @override
  bool shouldRepaint(covariant _LinePainter oldDelegate) => true;
}

class ConsumptionGroupedBarChart extends StatelessWidget {
  const ConsumptionGroupedBarChart(
      {super.key, required this.current, required this.previous});
  final List<Map<String, dynamic>> current, previous;
  @override
  Widget build(BuildContext context) => CustomPaint(
      painter: _GroupedBarPainter(current, previous),
      child: const SizedBox.expand());
}

class _GroupedBarPainter extends CustomPainter {
  _GroupedBarPainter(this.current, this.previous);
  final List<Map<String, dynamic>> current, previous;
  @override
  void paint(Canvas canvas, Size size) {
    final n = current.length;
    if (n == 0) return;
    final vals = [
      ...current.map((e) => e['qty'] as double),
      ...previous.map((e) => e['qty'] as double)
    ];
    final max = vals.fold<double>(0, (a, b) => a > b ? a : b);
    final base = size.height - 28,
        top = 18.0,
        h = base - top,
        groupW = size.width / n;
    for (int i = 0; i < n; i++) {
      final a = current[i]['qty'] as double,
          b = i < previous.length ? previous[i]['qty'] as double : 0.0;
      final double bhA = max == 0 ? 0.0 : a / max * h,
          bhB = max == 0 ? 0.0 : b / max * h;
      final x = i * groupW + groupW * .25;
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              Rect.fromLTWH(x, base - bhA, groupW * .22, bhA),
              const Radius.circular(4)),
          Paint()..color = const Color(0xFF2B8CFF));
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              Rect.fromLTWH(x + groupW * .27, base - bhB, groupW * .22, bhB),
              const Radius.circular(4)),
          Paint()..color = const Color(0xFF687584));
      final tp = TextPainter(
          text: TextSpan(
              text: current[i]['label'].toString(),
              style: const TextStyle(fontSize: 9, color: Colors.white54)),
          textDirection: TextDirection.ltr)
        ..layout();
      tp.paint(canvas, Offset(i * groupW + (groupW - tp.width) / 2, base + 8));
    }
  }

  @override
  bool shouldRepaint(covariant _GroupedBarPainter oldDelegate) => true;
}

class ConsumptionHorizontalBars extends StatelessWidget {
  const ConsumptionHorizontalBars({super.key, required this.data});
  final List<Map<String, dynamic>> data;
  @override
  Widget build(BuildContext context) {
    final max = data.fold<double>(
        0, (a, e) => (e['qty'] as double) > a ? (e['qty'] as double) : a);
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      for (int i = 0; i < data.length; i++)
        Padding(
            padding: const EdgeInsets.symmetric(vertical: 7),
            child: Row(children: [
              SizedBox(
                  width: 115,
                  child: Text(data[i]['name'].toString(),
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11))),
              Expanded(
                  child: LayoutBuilder(
                      builder: (context, c) => Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                              height: 24,
                              width: max == 0
                                  ? 2.0
                                  : c.maxWidth *
                                      (data[i]['qty'] as double) /
                                      max,
                              decoration: BoxDecoration(
                                  color: i == 1
                                      ? const Color(0xFF2B8CFF)
                                      : i == 0
                                          ? const Color(0xFF687584)
                                          : _consumptionColors[
                                              i % _consumptionColors.length],
                                  borderRadius: BorderRadius.circular(3)))))),
              const SizedBox(width: 7),
              SizedBox(
                  width: 52,
                  child: Text(_formatQty(data[i]['qty'] as double),
                      style: const TextStyle(
                          fontSize: 10, fontWeight: FontWeight.w800)))
            ]))
    ]);
  }
}
