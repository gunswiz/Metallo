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
    try {
      return _parseManifest(body, currentBuild, strict: false);
    } on FormatException {
      return null;
    }
  }

  static AppUpdateInfo? _parseManifest(
    String body,
    int currentBuild, {
    required bool strict,
  }) {
    dynamic decoded;
    try {
      decoded = jsonDecode(body);
    } catch (error) {
      if (strict) {
        throw const FormatException('Manifesto de atualização inválido');
      }
      return null;
    }
    if (decoded is! Map<String, dynamic>) {
      if (strict) {
        throw const FormatException('Manifesto de atualização inválido');
      }
      return null;
    }
    final data = decoded;
    final build = data['build'];
    final version = data['version'];
    final rawUrl = data['apk_url'];
    if (build is! int ||
        version is! String ||
        !RegExp(r'^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$').hasMatch(version) ||
        version.length > 64 ||
        rawUrl is! String) {
      if (strict) {
        throw const FormatException('Manifesto de atualização inválido');
      }
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
      if (strict) {
        throw const FormatException('Destino de atualização inválido');
      }
      return null;
    }
    if (build <= currentBuild) return null;
    return AppUpdateInfo(version: version, build: build, url: url);
  }

  static Future<AppUpdateInfo?> check() async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    try {
      final request = await client.getUrl(Uri.parse(_manifest));
      final response =
          await request.close().timeout(const Duration(seconds: 10));
      if (response.statusCode != HttpStatus.ok) {
        throw HttpException(
          'Servidor de atualização respondeu ${response.statusCode}',
        );
      }
      if (response.contentLength > _maxManifestBytes) {
        throw const FormatException('Manifesto de atualização muito grande');
      }
      final bytes = await response.fold<List<int>>(<int>[], (buffer, chunk) {
        if (buffer.length + chunk.length > _maxManifestBytes) {
          throw const FormatException('Update manifest too large');
        }
        buffer.addAll(chunk);
        return buffer;
      }).timeout(const Duration(seconds: 10));
      final installed = await PackageInfo.fromPlatform();
      final currentBuild = int.tryParse(installed.buildNumber) ?? 0;
      return _parseManifest(utf8.decode(bytes), currentBuild, strict: true);
    } finally {
      client.close(force: true);
    }
  }

  static Future<void> showIfAvailable(BuildContext context,
      {bool showUpToDate = false,
      Future<AppUpdateInfo?> Function()? checker,
      Future<bool> Function(Uri url)? launcher}) async {
    final actionLock = UiActionLock.acquire(context, 'app-update-check');
    if (actionLock == null) return;
    try {
      AppUpdateInfo? update;
      try {
        update = await (checker ?? check)();
      } catch (_) {
        if (context.mounted && showUpToDate) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            behavior: SnackBarBehavior.floating,
            content: Text(
                'Não foi possível verificar atualizações. Confira sua internet e tente novamente.'),
          ));
        }
        return;
      }
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
      final availableUpdate = update;
      final accepted = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          icon: Image.asset('assets/metallo_logo_outline.png', height: 54),
          title: const Text('Saiu uma nova atualização'),
          content: Text(
              'A versão ${availableUpdate.version} está disponível. Gostaria de atualizar agora?'),
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
        var launched = false;
        try {
          launched = launcher == null
              ? await launchUrl(availableUpdate.url,
                  mode: LaunchMode.externalApplication)
              : await launcher(availableUpdate.url);
        } catch (_) {
          launched = false;
        }
        if (!launched && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            behavior: SnackBarBehavior.floating,
            content: Text(
                'Não foi possível abrir o download. Tente novamente pela tela da conta.'),
          ));
        }
      }
    } finally {
      actionLock.release();
    }
  }
}
