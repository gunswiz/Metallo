import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../shared/widgets/ui_action_lock.dart';

class AppUpdateInfo {
  const AppUpdateInfo(
      {required this.version, required this.build, required this.url});
  final String version;
  final int build;
  final Uri url;
}

class AppUpdateService {
  static const _maxManifestBytes = 64 * 1024;
  static const _manifest =
      'https://raw.githubusercontent.com/gunswiz/Metallo/main/updates/latest.json';

  static AppUpdateInfo? parseManifest(String body, int currentBuild) {
    final data = jsonDecode(body);
    if (data is! Map<String, dynamic>) return null;
    final build = data['build'];
    final version = data['version'];
    final rawUrl = data['apk_url'];
    if (build is! int ||
        build <= currentBuild ||
        version is! String ||
        !RegExp(r'^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$').hasMatch(version) ||
        version.length > 64 ||
        rawUrl is! String) {
      return null;
    }
    final url = Uri.tryParse(rawUrl);
    if (url == null ||
        url.scheme != 'https' ||
        url.host != 'github.com' ||
        url.userInfo.isNotEmpty ||
        url.hasPort ||
        url.hasQuery ||
        url.hasFragment ||
        !RegExp(r'^/gunswiz/Metallo/releases/download/v[0-9][A-Za-z0-9.+-]*/Metallo\.apk$')
            .hasMatch(url.path)) {
      return null;
    }
    return AppUpdateInfo(version: version, build: build, url: url);
  }

  static Future<AppUpdateInfo?> check() async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    try {
      final request = await client.getUrl(Uri.parse(_manifest));
      final response =
          await request.close().timeout(const Duration(seconds: 10));
      if (response.statusCode != HttpStatus.ok) return null;
      if (response.contentLength > _maxManifestBytes) return null;
      final bytes = await response.fold<List<int>>(<int>[], (buffer, chunk) {
        if (buffer.length + chunk.length > _maxManifestBytes) {
          throw const FormatException('Update manifest too large');
        }
        buffer.addAll(chunk);
        return buffer;
      }).timeout(const Duration(seconds: 10));
      final installed = await PackageInfo.fromPlatform();
      final currentBuild = int.tryParse(installed.buildNumber) ?? 0;
      return parseManifest(utf8.decode(bytes), currentBuild);
    } catch (_) {
      return null;
    } finally {
      client.close(force: true);
    }
  }

  static Future<void> showIfAvailable(BuildContext context,
      {bool showUpToDate = false}) async {
    final actionLock = UiActionLock.acquire(context, 'app-update-check');
    if (actionLock == null) return;
    try {
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
    } finally {
      actionLock.release();
    }
  }
}
