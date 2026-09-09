import 'package:flutter/material.dart';

const metalloPrimary = Color(0xFF1687FF);
const metalloSecondary = Color(0xFF55A9FF);
const metalloAccent = Color(0xFF52A9FF);
const metalloSuccess = Color(0xFF67D39A);
const metalloBackground = Color(0xFF05080D);
const metalloSurface = Color(0xFF111720);
const metalloFeatureCard = Color(0xFF101A27);
const metalloInputFill = Color(0xFF121820);
const metalloBorder = Color(0xFF2B394B);
const metalloNavigationBackground = Color(0xFF090D13);
const metalloNavigationIndicator = Color(0xFF123A65);
const metalloDrawerBackground = Color(0xFF0A0F16);
const metalloIconBackground = Color(0xFF0E3157);
const metalloEpiIconBackground = Color(0xFF0C355C);
const metalloEpiRaisedSurface = Color(0xFF142234);
const metalloEpiBorder = Color(0xFF17324B);
const metalloGuideExample = Color(0xFF65B5FF);
const metalloGuideInstructions = Color(0xFF9A8CFF);
const metalloWarning = Color(0xFFFFB74D);
const metalloChartPrimary = Color(0xFF2B8CFF);
const metalloChartLine = Color(0xFF258CFF);
const metalloChartComparison = Color(0xFF687584);
const metalloConsumptionDecrease = Color(0xFFFF5A52);
const metalloConsumptionIncrease = Color(0xFF73D84E);
const metalloCatalogCode = Color(0xFF8CC8FF);
const metalloLightBlue = Color(0xFF89CFF0);
const metalloEquipmentWarning = Color(0xFFF5B942);

ThemeData metalloTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: metalloPrimary,
    brightness: Brightness.dark,
  ).copyWith(
    primary: metalloPrimary,
    secondary: metalloSecondary,
    surface: metalloSurface,
  );

  return ThemeData(
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: metalloBackground,
    useMaterial3: true,
    appBarTheme: const AppBarTheme(
      backgroundColor: metalloBackground,
      foregroundColor: Colors.white,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: metalloSurface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: metalloInputFill,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: metalloBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: metalloBorder),
      ),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: metalloNavigationBackground,
      indicatorColor: metalloNavigationIndicator,
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
  );
}
