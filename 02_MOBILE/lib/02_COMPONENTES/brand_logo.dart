import 'package:flutter/material.dart';

class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.height = 86});
  final double height;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/metallo_logo_outline.png',
      height: height,
      fit: BoxFit.contain,
    );
  }
}
