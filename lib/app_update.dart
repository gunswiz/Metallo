import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

class AppUpdateInfo {
  const AppUpdateInfo(
      {required this.version, required this.build, required this.url});
  final String version;
  final int build;
  final Uri url;
}

class AppUpdateService {
  static const _manifest =
      'https://raw.githubusercontent.com/gunswiz/Metallo/main/updates/latest.json';

  static Future<AppUpdateInfo?> check() async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    try {
      final request = await client.getUrl(Uri.parse(_manifest));
      final response =
          await request.close().timeout(const Duration(seconds: 10));
      if (response.statusCode != HttpStatus.ok) return null;
      final data =
          jsonDecode(await response.transform(utf8.decoder).join()) as Map;
      final installed = await PackageInfo.fromPlatform();
      final newestBuild = int.tryParse('${data['build']}') ?? 0;
      final currentBuild = int.tryParse(installed.buildNumber) ?? 0;
      final url = Uri.tryParse('${data['apk_url'] ?? ''}');
      if (newestBuild <= currentBuild || url == null || !url.hasScheme)
        return null;
      return AppUpdateInfo(
        version: '${data['version']}',
        build: newestBuild,
        url: url,
      );
    } catch (_) {
      return null;
    } finally {
      client.close(force: true);
    }
  }

  static Future<void> showIfAvailable(BuildContext context,
      {bool showUpToDate = false}) async {
    final update = await check();
    if (!context.mounted) return;
    if (update == null) {
      if (showUpToDate) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text('Você já está usando a versão mais recente.'),
        ));
      }
      return;
    }
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: Image.asset('assets/metallo_logo_outline.png', height: 54),
        title: const Text('Saiu uma nova atualização'),
        content: Text(
            'A versão ${update.version} está disponível. Gostaria de atualizar agora?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Agora não')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Atualizar')),
        ],
      ),
    );
    if (accepted == true) {
      await launchUrl(update.url, mode: LaunchMode.externalApplication);
    }
  }
}
